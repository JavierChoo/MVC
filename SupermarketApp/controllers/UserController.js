const crypto = require('crypto');
const User = require('../models/User');

const UserController = {
  showLoginForm(req, res) {
    res.render('login', { messages: req.flash('success'), errors: req.flash('error') });
  },

  showRegisterForm(req, res) {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
  },

  loginUser(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
      req.flash('error', 'Email and password are required');
      return res.redirect('/login');
    }

    User.findUserByEmail(email, (err, user) => {
      if (err) {
        req.flash('error', 'Server error');
        return res.redirect('/login');
      }
      if (!user) {
        req.flash('error', 'Invalid email or password');
        return res.redirect('/login');
      }

      const hashed = crypto.createHash('sha1').update(password).digest('hex');
      if (user.password !== hashed) {
        req.flash('error', 'Invalid email or password');
        return res.redirect('/login');
      }

      // Remove password before storing in session
      delete user.password;
      req.session.user = user;
      req.flash('success', 'Login successful');

      if (user.role === 'admin') return res.redirect('/inventory');
      return res.redirect('/shopping');
    });
  },

  registerUser(req, res) {
    const { username, email, password, address, contact, role } = req.body;

    // Basic validation
    if (!username || !email || !password || !address || !contact || !role) {
      req.flash('error', 'All fields are required');
      req.flash('formData', req.body);
      return res.redirect('/register');
    }
    if (password.length < 6) {
      req.flash('error', 'Password must be at least 6 characters');
      req.flash('formData', req.body);
      return res.redirect('/register');
    }

    User.findUserByEmail(email, (err, existing) => {
      if (err) {
        req.flash('error', 'Server error');
        req.flash('formData', req.body);
        return res.redirect('/register');
      }
      if (existing) {
        req.flash('error', 'Email already in use');
        req.flash('formData', req.body);
        return res.redirect('/register');
      }

      const hashed = crypto.createHash('sha1').update(password).digest('hex');
      const newUser = { username, email, password: hashed, address, contact, role };

      User.createUser(newUser, (err, created) => {
        if (err) {
          req.flash('error', 'Failed to create user');
          req.flash('formData', req.body);
          return res.redirect('/register');
        }
        req.flash('success', 'Registration successful. Please log in.');
        res.redirect('/login');
      });
    });
  },

  logoutUser(req, res) {
    req.session.destroy(() => {
      res.redirect('/login');
    });
  }
};

module.exports = UserController;