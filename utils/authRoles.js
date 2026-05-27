function toBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  const text = String(value || '').trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'yes';
}

function getAccessFlagsFromUser(user, metadataNamespace) {
  if (!user || typeof user !== 'object') {
    return {
      admin: false,
      supervisor: false,
    };
  }

  const appMetadata = user.app_metadata && typeof user.app_metadata === 'object'
    ? user.app_metadata
    : {};
  const namespace = String(metadataNamespace || '').trim().replace(/\/$/, '');

  const adminClaim = namespace ? user[`${namespace}/admin`] : undefined;
  const supervisorClaim = namespace ? user[`${namespace}/supervisor`] : undefined;

  const admin = adminClaim !== undefined ? toBoolean(adminClaim) : toBoolean(appMetadata.admin);
  const supervisor = supervisorClaim !== undefined ? toBoolean(supervisorClaim) : toBoolean(appMetadata.supervisor);

  return {
    admin,
    supervisor,
  };
}

function getRoleNames(flags) {
  const roles = [];
  if (flags && flags.admin) {
    roles.push('Admin');
  }
  if (flags && flags.supervisor) {
    roles.push('Supervisor');
  }
  return roles;
}

function hasAnyRole(flags, expectedRoles) {
  const expected = (expectedRoles || []).map((role) => String(role || '').trim().toLowerCase());
  return expected.some((role) => (role === 'admin' && flags.admin) || (role === 'supervisor' && flags.supervisor));
}

module.exports = {
  getAccessFlagsFromUser,
  getRoleNames,
  hasAnyRole,
};
