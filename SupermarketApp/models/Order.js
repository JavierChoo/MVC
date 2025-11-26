const db = require('../db');

/**
 * Order model
 *
 * Table: orders
 *  - id (INT, PK, AUTO_INCREMENT)
 *  - user_id (INT, FK -> users.id)
 *  - total (DECIMAL)  <-- returned as string by MySQL driver
 *  - created_at (TIMESTAMP)
 */
const Order = {
  /**
   * Create a new order for a user.
   *
   * @param {number} userId      - ID of the user placing the order
   * @param {number} totalAmount - Total amount of the order
   * @param {function} callback  - function(err, order)
   */
  createOrder(userId, totalAmount, callback) {
    const sql = `
      INSERT INTO orders (user_id, total, created_at)
      VALUES (?, ?, NOW())
    `;
    const params = [userId, totalAmount];

    db.query(sql, params, (err, result) => {
      if (err) {
        console.error('Order.createOrder - SQL error');
        console.error('SQL:', sql.trim());
        console.error('Params:', params);
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);
        return callback(err);
      }

      const order = {
        id: result.insertId,
        user_id: userId,
        // ensure total is a Number in JS
        total: Number(totalAmount) || 0
      };

      return callback(null, order);
    });
  },

  /**
   * Get all orders for a specific user, newest first.
   *
   * NOTE: MySQL returns DECIMAL as strings; we normalize to Number here.
   *
   * @param {number} userId      - ID of the user
   * @param {function} callback  - function(err, orders[])
   */
  getOrdersByUser(userId, callback) {
    const sql = `
      SELECT id, user_id, total, created_at
      FROM orders
      WHERE user_id = ?
      ORDER BY created_at DESC
    `;
    const params = [userId];

    db.query(sql, params, (err, results) => {
      if (err) {
        console.error('Order.getOrdersByUser - SQL error');
        console.error('SQL:', sql.trim());
        console.error('Params:', params);
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);
        return callback(err);
      }

      if (!Array.isArray(results)) {
        console.warn('Order.getOrdersByUser - non-array result, normalizing to []');
        return callback(null, []);
      }

      // 3. Sanitize DECIMAL -> Number
      const normalized = results.map(o => ({
        ...o,
        total: Number(o.total || 0)
      }));

      return callback(null, normalized);
    });
  },

  /**
   * Get a single order by id for a given user.
   * @param {number} orderId
   * @param {number} userId
   * @param {function} callback - function(err, order|null)
   */
  getOrderById(orderId, userId, callback) {
    const params = [orderId];
    let sql = `
      SELECT o.id, o.user_id, o.total, o.created_at,
             u.username AS customerName, u.email AS customerEmail, u.address AS customerAddress
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `;

    if (userId && Number.isInteger(userId)) {
      sql += ' AND o.user_id = ?';
      params.push(userId);
    }

    sql += ' LIMIT 1';

    db.query(sql, params, (err, results) => {
      if (err) return callback(err);
      const order = Array.isArray(results) && results.length ? results[0] : null;
      if (order) order.total = Number(order.total || 0);
      return callback(null, order);
    });
  },

  /**
   * Get all orders (admin only)
   */
  getAllOrders(callback) {
    const sql = `
      SELECT o.id, o.user_id, o.total, o.created_at,
             u.username AS customerName, u.email AS customerEmail
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
    `;
    db.query(sql, (err, results) => {
      if (err) return callback(err);
      const normalized = Array.isArray(results)
        ? results.map(o => ({ ...o, total: Number(o.total || 0) }))
        : [];
      return callback(null, normalized);
    });
  },

  /**
   * Get all items for a specific order, joined with product details.
   *
   * @param {number} orderId     - ID of the order
   * @param {function} callback  - function(err, items[])
   */
  getOrderItems(orderId, callback) {
    const sql = `
      SELECT
        oi.id,
        oi.order_id,
        oi.product_id,
        oi.quantity,
        oi.price,
        p.productName
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `;
    const params = [orderId];

    db.query(sql, params, (err, results) => {
      if (err) {
        console.error('Order.getOrderItems - SQL error');
        console.error('SQL:', sql.trim());
        console.error('Params:', params);
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);
        return callback(err);
      }

      return callback(null, Array.isArray(results) ? results : []);
    });
  }
};

module.exports = Order;
