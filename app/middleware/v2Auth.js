const { verifyToken } = require('../auth/tokens');

function requireV2Auth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const user = verifyToken(token);

  if (!user) return res.status(401).json({ error: 'No autorizado' });
  req.user = user;
  req.workspaceId = user.workspace_id;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'El rol no permite esta acción' });
    }
    next();
  };
}

module.exports = { requireV2Auth, requireRole };
