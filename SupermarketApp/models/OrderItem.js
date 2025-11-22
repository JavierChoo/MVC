// ...existing code...
const db = require('../db');

const OrderItem = {
  create(orderId, productId, quantity, price, callback) {
    const sql = 'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)';
    db.query(sql, [orderId, productId, quantity, price], (err, result) => {
      if (err) return callback(err);
      callback(null, { id: result.insertId, order_id: orderId, product_id: productId, quantity, price });
    });
  },

  getItemsByOrderId(orderId, callback) {
    const sql = `
      SELECT oi.id, oi.order_id, oi.product_id, oi.quantity, oi.price,
             p.productName
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `;
    db.query(sql, [orderId], (err, results) => {
      if (err) return callback(err);
      callback(null, results);
    });
  }
};

module.exports = OrderItem;
// ...existing code...