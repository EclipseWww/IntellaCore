const roleCheck = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: '未授权' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: '没有权限访问此资源' });
    }

    next();
  };
};

module.exports = roleCheck; 