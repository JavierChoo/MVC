// ...existing code...
const db = require('../db');

let ensuredDisabledColumn = false;

// Ensures `is_disabled` column exists; safe to call multiple times.
function ensureDisabledColumn(callback) {
  if (ensuredDisabledColumn) return callback && callback();
  const alterSql = 'ALTER TABLE users ADD COLUMN is_disabled TINYINT(1) NOT NULL DEFAULT 0';
  db.query(alterSql, (err) => {
    if (!err || (err && err.code === 'ER_DUP_FIELDNAME')) {
      ensuredDisabledColumn = true;
      return callback && callback();
    }
    return callback && callback(err);
  });
}

const User = {
  // Find a user by email, returns single user or null
  findUserByEmail(email, callback) {
    const sql = 'SELECT id, username, email, password, address, contact, role, is_disabled FROM users WHERE email = ? LIMIT 1';
    db.query(sql, [email], (err, results) => {
      if (err && err.code === 'ER_BAD_FIELD_ERROR') {
        return ensureDisabledColumn((ensureErr) => {
          if (ensureErr) return callback(ensureErr);
          return db.query(sql, [email], (retryErr, retryResults) => {
            if (retryErr) return callback(retryErr);
            const user = retryResults && retryResults.length ? retryResults[0] : null;
            return callback(null, user);
          });
        });
      }
      if (err) return callback(err);
      const user = results && results.length ? results[0] : null;
      callback(null, user);
    });
  },

  // Get user by id
  getUserById(id, callback) {
    const sql = 'SELECT id, username, email, password, address, contact, role, is_disabled FROM users WHERE id = ?';
    db.query(sql, [id], (err, results) => {
      if (err && err.code === 'ER_BAD_FIELD_ERROR') {
        return ensureDisabledColumn((ensureErr) => {
          if (ensureErr) return callback(ensureErr);
          return db.query(sql, [id], (retryErr, retryResults) => {
            if (retryErr) return callback(retryErr);
            const user = retryResults && retryResults.length ? retryResults[0] : null;
            return callback(null, user);
          });
        });
      }
      if (err) return callback(err);
      const user = results && results.length ? results[0] : null;
      callback(null, user);
    });
  },

  // Create a new user. Expects a user object with username, email, password, address, contact, role
  createUser(user, callback) {
    const sql = 'INSERT INTO users (username, email, password, address, contact, role, is_disabled) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const params = [user.username, user.email, user.password, user.address, user.contact, user.role, user.is_disabled || 0];
    db.query(sql, params, (err, result) => {
      if (err && err.code === 'ER_BAD_FIELD_ERROR') {
        return ensureDisabledColumn((ensureErr) => {
          if (ensureErr) return callback(ensureErr);
          return db.query(sql, params, (retryErr, retryResult) => {
            if (retryErr) return callback(retryErr);
            return callback(null, { id: retryResult.insertId, ...user });
          });
        });
      }
      if (err) return callback(err);
      callback(null, { id: result.insertId, ...user });
    });
  },

  // Update existing user by id. Expects full user object (username, email, password, address, contact, role)
  updateUser(id, user, callback) {
    const sql = 'UPDATE users SET username = ?, email = ?, password = ?, address = ?, contact = ?, role = ?, is_disabled = ? WHERE id = ?';
    const params = [user.username, user.email, user.password, user.address, user.contact, user.role, user.is_disabled || 0, id];
    db.query(sql, params, (err, result) => {
      if (err && err.code === 'ER_BAD_FIELD_ERROR') {
        return ensureDisabledColumn((ensureErr) => {
          if (ensureErr) return callback(ensureErr);
          return db.query(sql, params, (retryErr, retryResult) => callback(retryErr, retryResult));
        });
      }
      return callback(err, result);
    });
  },

  // Fetch all users (admin)
  getAll(callback) {
    const sql = 'SELECT id, username, email, address, contact, role, is_disabled FROM users ORDER BY id ASC';
    db.query(sql, (err, results) => {
      if (err && err.code === 'ER_BAD_FIELD_ERROR') {
        return ensureDisabledColumn((ensureErr) => {
          if (ensureErr) return callback(ensureErr);
          return db.query(sql, (retryErr, retryResults) => {
            if (retryErr) return callback(retryErr);
            return callback(null, Array.isArray(retryResults) ? retryResults : []);
          });
        });
      }
      if (err) return callback(err);
      return callback(null, Array.isArray(results) ? results : []);
    });
  },

  // Alias to support older controller calls
  create(user, callback) {
    return this.createUser(user, callback);
  },

  // Delete user by id
  deleteUser(id, callback) {
    return this.setDisabled(id, true, callback);
  },

  updateRole(id, role, callback) {
    const sql = 'UPDATE users SET role = ? WHERE id = ?';
    db.query(sql, [role, id], (err, result) => callback(err, result));
  },

  setDisabled(id, isDisabled, callback) {
    const sql = 'UPDATE users SET is_disabled = ? WHERE id = ?';
    db.query(sql, [isDisabled ? 1 : 0, id], (err, result) => {
      if (err && err.code === 'ER_BAD_FIELD_ERROR') {
        return ensureDisabledColumn((ensureErr) => {
          if (ensureErr) return callback(ensureErr);
          return db.query(sql, [isDisabled ? 1 : 0, id], (retryErr, retryResult) => callback(retryErr, retryResult));
        });
      }
      return callback(err, result);
    });
  }
};

module.exports = User;
// ...existing code...
