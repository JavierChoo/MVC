// ...new file...
const checkAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  req.flash('error', 'Please log in to view this resource');
  res.redirect('/login');
};

const checkAdmin = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  // always set a clear flash message before redirecting
  req.flash('error', 'Access denied. Admins only.');
  res.redirect('/shopping');
};

module.exports = { checkAuthenticated, checkAdmin };
// ...new file...