// ...existing code...
const db = require('../db');

const User = {
  // Find a user by email, returns single user or null
  findUserByEmail(email, callback) {
    const sql = 'SELECT id, username, email, password, address, contact, role FROM users WHERE email = ? LIMIT 1';
    db.query(sql, [email], (err, results) => {
      if (err) return callback(err);
      const user = results && results.length ? results[0] : null;
      callback(null, user);
    });
  },

  // Get user by id
  getUserById(id, callback) {
    const sql = 'SELECT id, username, email, password, address, contact, role FROM users WHERE id = ?';
    db.query(sql, [id], (err, results) => {
      if (err) return callback(err);
      const user = results && results.length ? results[0] : null;
      callback(null, user);
    });
  },

  // Create a new user. Expects a user object with username, email, password, address, contact, role
  createUser(user, callback) {
    const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, ?, ?, ?, ?)';
    const params = [user.username, user.email, user.password, user.address, user.contact, user.role];
    db.query(sql, params, (err, result) => {
      if (err) return callback(err);
      callback(null, { id: result.insertId, ...user });
    });
  },

  // Update existing user by id. Expects full user object (username, email, password, address, contact, role)
  updateUser(id, user, callback) {
    const sql = 'UPDATE users SET username = ?, email = ?, password = ?, address = ?, contact = ?, role = ? WHERE id = ?';
    const params = [user.username, user.email, user.password, user.address, user.contact, user.role, id];
    db.query(sql, params, (err, result) => callback(err, result));
  },

  // Delete user by id
  deleteUser(id, callback) {
    const sql = 'DELETE FROM users WHERE id = ?';
    db.query(sql, [id], (err, result) => callback(err, result));
  }
};

module.exports = User;
// ...existing code...