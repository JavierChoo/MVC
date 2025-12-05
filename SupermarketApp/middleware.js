// Combined auth + validation middleware

const checkAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  req.flash('error', 'Please log in to view this resource');
  return res.redirect('/login');
};

const checkAdmin = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  req.flash('error', 'Access denied. Admins only.');
  return res.redirect('/shopping');
};

const validateRegistration = (req, res, next) => {
  const { username, email, password, address, contact, role } = req.body;
  const errors = [];
  const allowedRoles = ['user', 'admin'];

  if (!username || !username.toString().trim()) errors.push('Username is required');
  if (!email || !email.toString().trim()) errors.push('Email is required');
  if (!password) errors.push('Password is required');
  if (password && password.length < 6) errors.push('Password must be at least 6 characters');
  if (!address || !address.toString().trim()) errors.push('Address is required');
  if (!contact || !contact.toString().trim()) errors.push('Contact is required');
  if (!role || !role.toString().trim()) errors.push('Role is required');
  if (role && !allowedRoles.includes(role)) errors.push('Role is invalid');

  if (errors.length) {
    req.flash('error', errors);
    req.flash('formData', req.body);
    return res.redirect('/register');
  }

  return next();
};

const validateProduct = (req, res, next) => {
  const fs = require('fs');

  // Helper to clean up uploaded file when validation fails
  const cleanupUploadedFile = () => {
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }
  };

  const name = req.body.name || req.body.productName || '';
  const priceRaw = req.body.price;
  const quantityRaw = req.body.quantity;

  const errors = [];

  if (!name || !name.toString().trim()) errors.push('Product name is required');

  const price = priceRaw !== undefined && priceRaw !== null && priceRaw !== '' ? Number(priceRaw) : NaN;
  if (Number.isNaN(price)) {
    errors.push('Price is required and must be a number');
  } else if (price <= 0) {
    errors.push('Price must be greater than 0');
  }

  const quantity = quantityRaw !== undefined && quantityRaw !== null && quantityRaw !== '' ? Number(quantityRaw) : NaN;
  if (Number.isNaN(quantity)) {
    errors.push('Quantity is required and must be a number');
  } else if (!Number.isInteger(quantity) || quantity < 0) {
    errors.push('Quantity must be an integer equal to or greater than 0');
  }

  if (errors.length) {
    cleanupUploadedFile();

    req.flash('error', errors);
    req.flash('formData', req.body);

    try {
      const routePath = req.route && req.route.path ? req.route.path : '';
      if (routePath.includes('updateProduct') || routePath.includes('/updateProduct/:id')) {
        const id = req.params && req.params.id ? req.params.id : '';
        return res.redirect(`/updateProduct/${id}`);
      }
    } catch (e) {
      // ignore and fallthrough
    }

    return res.redirect('/addProduct');
  }

  req.body.productName = name;
  req.body.price = Number(price);
  req.body.quantity = Number(quantity);

  return next();
};

module.exports = {
  checkAuthenticated,
  checkAdmin,
  validateRegistration,
  validateProduct
};
