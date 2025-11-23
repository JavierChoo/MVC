const crypto = require('crypto');
const User = require('../models/User');

const UserController = {
  // kept for compatibility — renders login form
  showLogin(req, res) {
    return res.render('login', { messages: req.flash('success'), errors: req.flash('error'), formData: req.flash('formData') });
  },

  // explicit name requested
  showLoginForm(req, res) {
    return this.showLogin(req, res);
  },

  // Login using email + password (SHA1)
  loginUser(req, res) {
    const { email, password } = req.body || {};
    if (!email || !password) {
      req.flash('error', 'Email and password are required');
      req.flash('formData', { email });
      return res.redirect('/login');
    }

    User.findUserByEmail(email, (err, user) => {
      if (err) {
        console.error('Error finding user by email:', err);
        req.flash('error', 'Server error');
        req.flash('formData', { email });
        return res.redirect('/login');
      }

      if (!user) {
        req.flash('error', 'Invalid credentials');
        req.flash('formData', { email });
        return res.redirect('/login');
      }

      const hashed = crypto.createHash('sha1').update(String(password)).digest('hex');
      const stored = user.password || user.passwordHash || user.pass || '';

      if (hashed !== String(stored)) {
        req.flash('error', 'Invalid credentials');
        req.flash('formData', { email });
        return res.redirect('/login');
      }

      // Save session user without password
      req.session.user = {
        id: user.id,
        username: user.username || user.name || user.email,
        role: user.role || 'user',
        email: user.email
      };

      req.flash('success', 'Logged in');

      if (req.session.user.role === 'admin') {
        return res.redirect('/inventory');
      }
      return res.redirect('/shopping');
    });
  },

  showRegister(req, res) {
    return res.render('register', { messages: req.flash('success'), errors: req.flash('error'), formData: req.flash('formData') });
  },

  registerUser(req, res) {
    const userData = req.body;
    User.create(userData, (err) => {
      if (err) {
        console.error('Registration error:', err);
        req.flash('error', 'Registration failed');
        req.flash('formData', userData);
        return res.redirect('/register');
      }
      req.flash('success', 'Registration successful, please login');
      return res.redirect('/login');
    });
  },

  logoutUser(req, res) {
    req.session.destroy(err => {
      if (err) console.error('Logout error', err);
      return res.redirect('/');
    });
  },

  profile(req, res) {
    if (!req.session.user) {
      req.flash('error', 'Please log in to view your profile');
      return res.redirect('/login');
    }
    return res.render('profile', { messages: req.flash('success'), errors: req.flash('error') });
  }
};

module.exports = UserController;