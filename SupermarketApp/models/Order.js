const db = require('../db');

const Order = {
  createOrder(userId, totalAmount, callback) {
    // The DB now stores the order total in the `total` column.
    const sql = 'INSERT INTO orders (user_id, total, created_at) VALUES (?, ?, NOW())';
    db.query(sql, [userId, totalAmount], (err, result) => {
      if (err) return callback(err);
      // Return an object that keeps the view-compatible field name total_amount
      callback(null, { id: result.insertId, user_id: userId, total_amount: totalAmount });
    });
  },

  getOrdersByUser(userId, callback) {
    // Select `total` but alias it to total_amount so existing EJS uses total_amount
    const sql = 'SELECT id, user_id, total AS total_amount, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC';

    db.query(sql, [userId], (err, results) => {
      if (err) {
        console.error('Order.getOrdersByUser - SQL error');
        console.error('SQL:', sql);
        console.error('Params:', [userId]);
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);
        return callback(err);
      }

      return callback(null, Array.isArray(results) ? results : []);
    });
  },

  getOrderItems(orderId, callback) {
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

module.exports = Order;