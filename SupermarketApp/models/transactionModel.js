const db = require('../db');

/**
 * Transaction model
 *
 * Table: transactions
 *  - order_id (INT, FK -> orders.id)
 *  - payment_method (VARCHAR)
 *  - provider_txn_id (VARCHAR)
 *  - amount (DECIMAL)
 *  - status (VARCHAR)
 *  - created_at (TIMESTAMP)
 */
const Transaction = {
  /**
   * Insert a transaction record.
   *
   * @param {object} data
   * @param {number|null} data.order_id
   * @param {string} data.payment_method
   * @param {string} data.provider_txn_id
   * @param {string|number} data.amount
   * @param {string} data.status
   * @param {function} callback
   */
  insertTransaction(data, callback) {
    const sql = `
      INSERT INTO transactions
        (order_id, payment_method, provider_txn_id, amount, status, created_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;
    const params = [
      data.order_id || null,
      data.payment_method || null,
      data.provider_txn_id || null,
      data.amount || null,
      data.status || null
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
