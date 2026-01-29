const db = require('../db');

/**
 * Transaction model
 *
 * Table: transactions
 *  - order_id (INT, FK -> orders.id)
 *  - paypal_order_id (VARCHAR)
 *  - payer_id (VARCHAR)
 *  - payer_email (VARCHAR)
 *  - amount (DECIMAL)
 *  - currency (VARCHAR)
 *  - status (VARCHAR)
 *  - time (DATETIME/TIMESTAMP)
 */
const Transaction = {
  /**
   * Insert a transaction record.
   *
   * @param {object} data
   * @param {number|null} data.order_id
   * @param {string} data.paypal_orderId
   * @param {string} data.payerId
   * @param {string} data.payerEmail
   * @param {string|number} data.amount
   * @param {string} data.currency
   * @param {string} data.status
   * @param {string|Date|null} data.time
   * @param {function} callback
   */
  insertTransaction(data, callback) {
    const sql = `
      INSERT INTO transactions
        (order_id, paypal_order_id, payer_id, payer_email, amount, currency, status, time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      data.order_id || null,
      data.paypal_orderId || null,
      data.payerId || null,
      data.payerEmail || null,
      data.amount || null,
      data.currency || null,
      data.status || null,
      data.time || new Date()
    ];

    db.query(sql, params, (err, result) => {
      if (err) {
        console.error('Transaction.insertTransaction - SQL error');
        console.error('SQL:', sql.trim());
        console.error('Params:', params);
        console.error('Error code:', err.code);
        console.error('Error message:', err.message);
        return callback(err);
      }
      return callback(null, result);
    });
  }
};

module.exports = Transaction;
