const crypto = require('crypto');
const User = require('../models/User');

const UserController = {
  // kept for compatibility — renders login form
  showLogin(req, res) {
    // Use res.locals to avoid consuming flash twice (navbar + view)
    return res.render('login', { messages: res.locals.messages || [], errors: res.locals.errors || [], formData: req.flash('formData') });
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

      const disabled = user.is_disabled || user.role === 'disabled';
      if (disabled) {
        req.flash('error', 'Error: your account is disabled. Please contact an administrator.');
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
    const userData = { ...req.body };
    userData.password = crypto.createHash('sha1').update(String(userData.password || '')).digest('hex');
    userData.is_disabled = 0;

    const createFn = (typeof User.createUser === 'function') ? User.createUser : User.create;
    if (typeof createFn !== 'function') {
      console.error('Registration error: create method missing');
      req.flash('error', 'Registration failed');
      req.flash('formData', req.body);
      return res.redirect('/register');
    }

    createFn.call(User, userData, (err) => {
      if (err) {
        console.error('Registration error:', err);
        req.flash('error', 'Registration failed');
        req.flash('formData', req.body);
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

  // Admin: list all users
  listUsers(req, res) {
    const user = req.session && req.session.user;
    if (!user || user.role !== 'admin') {
      req.flash('error', 'Access denied');
      return res.redirect('/shopping');
    }

    User.getAll((err, users) => {
      if (err) {
        console.error('UserController.listUsers - error fetching users', err);
        req.flash('error', 'Unable to load users');
        return res.redirect('/inventory');
      }

      // Hide the currently logged-in admin from the list to avoid self-actions
      const filtered = Array.isArray(users)
        ? users.filter(u => u.id !== user.id)
        : [];

      return res.render('users', {
        users: filtered,
        messages: req.flash('success'),
        errors: req.flash('error')
      });
    });
  },

  // Admin: disable a user by id (soft delete)
  deleteUser(req, res) {
    const current = req.session && req.session.user;
    if (!current || current.role !== 'admin') {
      req.flash('error', 'Access denied');
      return res.redirect('/shopping');
    }

    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      req.flash('error', 'Invalid user id');
      return res.redirect('/users');
    }

    // Optional safety: prevent self-disable to avoid locking the session out mid-flow
    if (current.id === id) {
      req.flash('error', 'You cannot disable your own account while logged in.');
      return res.redirect('/users');
    }

    User.setDisabled(id, true, (err, result) => {
      if (err) {
        console.error('UserController.deleteUser - error disabling user', err);
        req.flash('error', 'Failed to disable user');
        return res.redirect('/users');
      }
      if (result && result.affectedRows === 0) {
        req.flash('error', 'User not found');
        return res.redirect('/users');
      }

      req.flash('success', 'User disabled');
      return res.redirect('/users');
    });
  },

  // Admin: change a user's role
  updateRole(req, res) {
    const current = req.session && req.session.user;
    if (!current || current.role !== 'admin') {
      req.flash('error', 'Access denied');
      return res.redirect('/shopping');
    }

    const id = parseInt(req.params.id, 10);
    const { role } = req.body || {};
    const allowedRoles = ['admin', 'user'];

    if (Number.isNaN(id)) {
      req.flash('error', 'Invalid user id');
      return res.redirect('/users');
    }

    if (!allowedRoles.includes(role)) {
      req.flash('error', 'Invalid role selected');
      return res.redirect('/users');
    }

    // Don't allow an admin to remove their own admin rights
    if (current.id === id && role !== 'admin') {
      req.flash('error', 'You cannot remove your own admin access while logged in.');
      return res.redirect('/users');
    }

    User.updateRole(id, role, (err, result) => {
      if (err) {
        console.error('UserController.updateRole - error updating role', err);
        req.flash('error', 'Failed to update user role');
        return res.redirect('/users');
      }
      if (result && result.affectedRows === 0) {
        req.flash('error', 'User not found');
        return res.redirect('/users');
      }

      req.flash('success', 'User role updated');
      return res.redirect('/users');
    });
  },

  // Admin: disable/enable user
  toggleUser(req, res) {
    const current = req.session && req.session.user;
    if (!current || current.role !== 'admin') {
      req.flash('error', 'Access denied');
      return res.redirect('/shopping');
    }

    const id = parseInt(req.params.id, 10);
    const { action } = req.body || {};
    const disable = action !== 'enable';

    if (Number.isNaN(id)) {
      req.flash('error', 'Invalid user id');
      return res.redirect('/users');
    }

    if (current.id === id) {
      req.flash('error', 'You cannot disable your own account while logged in.');
      return res.redirect('/users');
    }

    User.setDisabled(id, disable, (err, result) => {
      if (err) {
        console.error('UserController.toggleUser - error toggling user', err);
        req.flash('error', 'Failed to update user status');
        return res.redirect('/users');
      }
      if (result && result.affectedRows === 0) {
        req.flash('error', 'User not updated (ensure user exists and is_disabled column is available)');
        return res.redirect('/users');
      }

      req.flash('success', disable ? 'User disabled' : 'User enabled');
      return res.redirect('/users');
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
