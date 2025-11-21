// ...existing code...
const db = require('../db');

const Product = {
  getAll(callback) {
    const sql = 'SELECT id, productName, quantity, price, image FROM products';
    db.query(sql, (err, results) => callback(err, results));
  },

  getById(id, callback) {
    const sql = 'SELECT id, productName, quantity, price, image FROM products WHERE id = ?';
    db.query(sql, [id], (err, results) => {
      if (err) return callback(err);
      const product = results && results.length ? results[0] : null;
      callback(null, product);
    });
  },

  create(product, callback) {
    const sql = 'INSERT INTO products (productName, quantity, price, image) VALUES (?, ?, ?, ?)';
    const params = [product.productName, product.quantity, product.price, product.image];
    db.query(sql, params, (err, result) => {
      if (err) return callback(err);
      callback(null, { id: result.insertId, ...product });
    });
  },

  update(id, product, callback) {
    const sql = 'UPDATE products SET productName = ?, quantity = ?, price = ?, image = ? WHERE id = ?';
    const params = [product.productName, product.quantity, product.price, product.image, id];
    db.query(sql, params, (err, result) => callback(err, result));
  },

  delete(id, callback) {
    const sql = 'DELETE FROM products WHERE id = ?';
    db.query(sql, [id], (err, result) => callback(err, result));
  }
};

module.exports = Product;
// ...existing code...
