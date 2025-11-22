// ...existing code...
const db = require('../db');

const Cart = {
  getOrCreateCart(userId, callback) {
    const sqlFind = 'SELECT id, user_id, created_at FROM carts WHERE user_id = ? LIMIT 1';
    db.query(sqlFind, [userId], (err, results) => {
      if (err) return callback(err);
      if (results && results.length) return callback(null, results[0]);

      const sqlCreate = 'INSERT INTO carts (user_id, created_at) VALUES (?, NOW())';
      db.query(sqlCreate, [userId], (err2, result) => {
        if (err2) return callback(err2);
        callback(null, { id: result.insertId, user_id: userId });
      });
    });
  },

  addItem(cartId, productId, quantity, callback) {
    const sqlFindItem = 'SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? LIMIT 1';
    db.query(sqlFindItem, [cartId, productId], (err, results) => {
      if (err) return callback(err);
      if (results && results.length) {
        const item = results[0];
        const sqlUpdate = 'UPDATE cart_items SET quantity = ? WHERE id = ?';
        const newQty = item.quantity + Number(quantity);
        db.query(sqlUpdate, [newQty, item.id], (err2, result) => {
          if (err2) return callback(err2);
          callback(null, { id: item.id, cart_id: cartId, product_id: productId, quantity: newQty });
        });
      } else {
        const sqlInsert = 'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)';
        db.query(sqlInsert, [cartId, productId, quantity], (err3, result3) => {
          if (err3) return callback(err3);
          callback(null, { id: result3.insertId, cart_id: cartId, product_id: productId, quantity });
        });
      }
    });
  },

  getCartItems(cartId, callback) {
    const sql = `
      SELECT ci.id, ci.cart_id, ci.product_id, ci.quantity,
             p.productName, p.price, p.image
      FROM cart_items ci
      LEFT JOIN products p ON ci.product_id = p.id
      WHERE ci.cart_id = ?
    `;
    db.query(sql, [cartId], (err, results) => callback(err, results));
  },

  updateItem(cartItemId, quantity, callback) {
    const sql = 'UPDATE cart_items SET quantity = ? WHERE id = ?';
    db.query(sql, [quantity, cartItemId], (err, result) => callback(err, result));
  },

  clear(cartId, callback) {
    const sql = 'DELETE FROM cart_items WHERE cart_id = ?';
    db.query(sql, [cartId], (err, result) => callback(err, result));
  }
};

module.exports = Cart;
// ...existing code...