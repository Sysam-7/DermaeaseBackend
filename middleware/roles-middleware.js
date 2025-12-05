export function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    next();
  };
}

export function requireRole(role) {
  return (req, res, next) => {
    try {
      const user = req.user || req.userData || (req.userId ? { _id: req.userId, role: req.role } : null);
      // if your auth middleware sets req.user, prefer that
      const userRole = (req.user && req.user.role) || req.role || (user && user.role);
      if (!userRole) return res.status(401).json({ message: 'Not authenticated' });
      if (Array.isArray(role) ? role.includes(userRole) : userRole === role) return next();
      return res.status(403).json({ message: 'Forbidden' });
    } catch (err) {
      return res.status(500).json({ message: 'Server error' });
    }
  };
}

// default export (optional)
export default { requireRole };





