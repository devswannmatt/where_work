const { getAccessFlagsFromUser, hasAnyRole } = require('../utils/authRoles');
const { getUserAccessFlags } = require('../utils/auth0Management');

function requireRole(expectedRoles) {
  return async (req, res, next) => {
    if (!req.oidc || !req.oidc.isAuthenticated()) {
      return res.oidc.login();
    }

    let accessFlags = getAccessFlagsFromUser(req.oidc.user, process.env.AUTH0_METADATA_NAMESPACE || '');
    if (!accessFlags.admin && !accessFlags.supervisor && req.oidc.user && req.oidc.user.sub) {
      try {
        accessFlags = await getUserAccessFlags(req.oidc.user.sub);
      } catch (_error) {
        accessFlags = { admin: false, supervisor: false };
      }
    }

    if (hasAnyRole(accessFlags, expectedRoles)) {
      req.userAccessFlags = accessFlags;
      return next();
    }

    return res.status(403).render('403', {
      title: 'Access Denied',
      message: 'You do not have permission to access this page.',
    });
  };
}

module.exports = {
  requireRole,
};
