let cachedToken = '';
let tokenExpiresAt = 0;

function getIssuerBaseUrl() {
  return String(process.env.AUTH0_ISSUER_BASE_URL || '').replace(/\/$/, '');
}

function getManagementCredentials() {
  return {
    clientId: process.env.AUTH0_CLIENT_ID || '',
    clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`Auth0 API ${response.status}: ${errorText}`);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function getManagementApiToken() {
  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 30_000) {
    return cachedToken;
  }

  const issuerBaseUrl = getIssuerBaseUrl();
  const { clientId, clientSecret } = getManagementCredentials();

  if (!issuerBaseUrl || !clientId || !clientSecret) {
    throw new Error('Auth0 client credentials are not configured.');
  }

  const tokenResponse = await fetchJson(`${issuerBaseUrl}/oauth/token`, {
    method: 'POST',
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      audience: `${issuerBaseUrl}/api/v2/`,
    }),
  });

  cachedToken = tokenResponse.access_token;
  tokenExpiresAt = now + ((Number(tokenResponse.expires_in) || 300) * 1000);
  return cachedToken;
}

function toBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  const text = String(value || '').trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'yes';
}

async function getUserAccessFlags(userId) {
  if (!userId) {
    return { admin: false, supervisor: false };
  }

  const issuerBaseUrl = getIssuerBaseUrl();
  const token = await getManagementApiToken();

  const user = await fetchJson(
    `${issuerBaseUrl}/api/v2/users/${encodeURIComponent(userId)}?fields=app_metadata&include_fields=true`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const appMetadata = user && typeof user.app_metadata === 'object' ? user.app_metadata : {};

  return {
    admin: toBoolean(appMetadata.admin),
    supervisor: toBoolean(appMetadata.supervisor),
  };
}

module.exports = {
  getIssuerBaseUrl,
  getManagementApiToken,
  fetchJson,
  getUserAccessFlags,
};
