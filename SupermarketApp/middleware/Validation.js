// ...existing code...
/**
 * Reusable validation middleware
 */

const validateRegistration = (req, res, next) => {
  const { username, email, password, address, contact, role } = req.body;
  const errors = [];

  if (!username || !username.toString().trim()) errors.push('Username is required');
  if (!email || !email.toString().trim()) errors.push('Email is required');
  if (!password) errors.push('Password is required');
  if (password && password.length < 6) errors.push('Password must be at least 6 characters');
  if (!address || !address.toString().trim()) errors.push('Address is required');
  if (!contact || !contact.toString().trim()) errors.push('Contact is required');
  if (!role || !role.toString().trim()) errors.push('Role is required');

  if (errors.length) {
    req.flash('error', errors);
    req.flash('formData', req.body);
    return res.redirect('/register');
  }

  return next();
};

const validateProduct = (req, res, next) => {
  // normalise incoming fields (name used in forms)
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
    req.flash('error', errors);
    // keep submitted form data to repopulate fields
    req.flash('formData', req.body);

    // Decide redirect target based on route path
    try {
      const routePath = req.route && req.route.path ? req.route.path : '';
      if (routePath.includes('updateProduct') || routePath.includes('/updateProduct/:id')) {
        const id = req.params && req.params.id ? req.params.id : '';
        return res.redirect(`/updateProduct/${id}`);
      }
    } catch (e) {
      // ignore and fallthrough
    }

    // default to add product page
    return res.redirect('/addProduct');
  }

  // attach normalized fields back to req.body for downstream handlers
  req.body.productName = name;
  req.body.price = Number(price);
  req.body.quantity = Number(quantity);

  return next();
};

module.exports = { validateRegistration, validateProduct };
// ...existing code...