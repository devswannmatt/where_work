const { getIssuerBaseUrl, getManagementApiToken, fetchJson } = require('../utils/auth0Management');

function toBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  const text = String(value || '').trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'yes';
}

function userAccess(user) {
  const appMetadata = user && user.app_metadata && typeof user.app_metadata === 'object'
    ? user.app_metadata
    : {};

  return {
    admin: toBoolean(appMetadata.admin),
    supervisor: toBoolean(appMetadata.supervisor),
  };
}

exports.listUsers = async (req, res, next) => {
  try {
    const token = await getManagementApiToken();
    const issuerBaseUrl = getIssuerBaseUrl();

    const usersResponse = await fetchJson(
      `${issuerBaseUrl}/api/v2/users?per_page=100&page=0&include_totals=true&fields=user_id,name,email,nickname,app_metadata&include_fields=true`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const users = (usersResponse.users || []).map((user) => {
      const access = userAccess(user);

      return {
        ...user,
        isAdmin: access.admin,
        isSupervisor: access.supervisor,
      };
    });

    res.render('admin/users', {
      title: 'User Roles',
      users,
      updatedMessage: req.query.updated ? 'User access updated.' : '',
      errorMessage: req.query.error ? 'Unable to update access metadata. Check Auth0 API permissions.' : '',
    });
  } catch (error) {
    next(error);
  }
};

exports.updateUserRole = async (req, res, next) => {
  try {
    const token = await getManagementApiToken();
    const issuerBaseUrl = getIssuerBaseUrl();

    const userId = String(req.body.userId || '').trim();
    const admin = toBoolean(req.body.admin);
    const supervisor = toBoolean(req.body.supervisor);

    if (!userId) {
      return res.redirect('/admin/users?error=1');
    }

    await fetchJson(
      `${issuerBaseUrl}/api/v2/users/${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          app_metadata: {
            admin,
            supervisor,
          },
        }),
      }
    );

    return res.redirect('/admin/users?updated=1');
  } catch (error) {
    return next(error);
  }
};
