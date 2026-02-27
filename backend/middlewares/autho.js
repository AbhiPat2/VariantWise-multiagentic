module.exports = (req, res, next) => {
  console.log("Session at /api/me:", req.session);

  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ message: 'Unauthorized - session missing' });
};
