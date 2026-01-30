const netsService = require("../services/netsService");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const db = require("../db");
const Cart = require("../models/Cart");

function decideFinalStatus({ mappedStatus, txnStatus, expectedAmount, paidAmount, isSandbox }) {
  const normalized = String(mappedStatus || "PENDING").toUpperCase();
  if (normalized === "SUCCESS") {
    // Sandbox: paid amount is unreliable; never fail a SUCCESS due to amount mismatch.
    if (
      expectedAmount != null &&
      paidAmount != null &&
      Number.isFinite(expectedAmount) &&
      Number.isFinite(paidAmount) &&
      expectedAmount.toFixed(2) !== paidAmount.toFixed(2) &&
      isSandbox
    ) {
      console.warn("[NETS WARNING] amount mismatch ignored in sandbox", {
        expectedAmount,
        paidAmount,
        txnRef: null
      });
    }
    return {
      finalStatus: "SUCCESS",
      reason: "provider_success_sandbox_amount_unreliable"
    };
  }
  if (normalized === "FAILED") {
    return { finalStatus: "FAILED", reason: "provider_failed" };
  }
  return { finalStatus: "PENDING", reason: "pending" };
}

function computeTotal(items) {
  const total = items.reduce(
    (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0),
    0
  );
  return Number(total.toFixed(2));
}

function getOrderByIdAsync(orderId) {
  return new Promise((resolve, reject) => {
    Order.getOrderById(orderId, null, (err, order) => {
      if (err) return reject(err);
      return resolve(order);
    });
  });
}

function getOrderItemsAsync(orderId) {
  return new Promise((resolve, reject) => {
    OrderItem.getItemsByOrderId(orderId, (err, items) => {
      if (err) return reject(err);
      return resolve(Array.isArray(items) ? items : []);
    });
  });
}

function getCartItemsForUser(userId) {
  return new Promise((resolve, reject) => {
    Cart.getOrCreateCart(userId, (err, cart) => {
      if (err) return reject(err);
      if (!cart || !cart.id) return resolve([]);
      Cart.getCartItems(cart.id, (err2, items) => {
        if (err2) return reject(err2);
        return resolve(Array.isArray(items) ? items : []);
      });
    });
  });
}

async function generateQr(req, res) {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ error: "Login required." });
    }

    const appOrderIdRaw = req.body && req.body.appOrderId;
    const appOrderId = Number.isFinite(Number(appOrderIdRaw))
      ? Number(appOrderIdRaw)
      : null;
    if (!appOrderId) {
      return res.status(400).json({ error: "Missing appOrderId." });
    }

    const order = await getOrderByIdAsync(appOrderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }
    if (order.user_id !== user.id) {
      return res.status(403).json({ error: "Not authorized for this order." });
    }

    const cartItems = await getCartItemsForUser(user.id);
    if (!cartItems.length) {
      return res.status(400).json({ error: "Cart is empty." });
    }

    const totalAmount = computeTotal(cartItems);
    if (totalAmount <= 0) {
      return res.status(400).json({ error: "Invalid order total." });
    }

    const notifyMobile = 0;

    const txnId = (req.body && req.body.txn_id) || `ORDER-${appOrderId}`;

    console.log("NETS server total for order:", {
      appOrderId,
      totalAmount: totalAmount.toFixed(2)
    });

    // Keep order items and total in sync with current cart
    await new Promise((resolve) => {
      db.query("UPDATE orders SET total = ? WHERE id = ?", [totalAmount, appOrderId], () => resolve());
    });
    await new Promise((resolve) => {
      db.query("DELETE FROM order_items WHERE order_id = ?", [appOrderId], () => resolve());
    });
    await Promise.all(
      cartItems.map((it) => {
        const productId = it.product_id || it.productId || it.productID;
        return new Promise((resolve) => {
          OrderItem.create(appOrderId, productId, it.quantity, it.price, () => resolve());
        });
      })
    );

    console.log("NETS generateQr payload:", {
      appOrderId,
      txn_id: txnId,
      amt_in_dollars: totalAmount.toFixed(2)
    });

    db.query(
      "SELECT provider_txn_id FROM transactions WHERE order_id = ? AND payment_method = 'NETS' AND status = 'PENDING' LIMIT 1",
      [appOrderId],
      async (errPending, pendingRows) => {
        if (errPending) {
          console.error("NETS pending lookup failed:", errPending);
          return res.status(500).json({ error: "Failed to check NETS pending status." });
        }
        if (pendingRows && pendingRows.length) {
          const existingTxnRef = pendingRows[0].provider_txn_id;
          console.log("[NETS REQUEST] reuse pending txnRef", existingTxnRef);
          return res.status(200).json({ txn_retrieval_ref: existingTxnRef });
        }

        try {
          const result = await netsService.generateQr({
            txn_id: txnId,
            amt_in_dollars: totalAmount.toFixed(2),
            notify_mobile: notifyMobile
          });

          const providerTxnId = result && result.txn_retrieval_ref ? result.txn_retrieval_ref : null;
          if (providerTxnId) {
            console.log("[NETS REQUEST] creating new txnRef", providerTxnId);
            db.query(
              "SELECT id FROM transactions WHERE provider_txn_id = ? LIMIT 1",
              [providerTxnId],
              (errCheck, rows) => {
                if (errCheck) return;
                if (rows && rows.length) {
                  db.query(
                    "UPDATE transactions SET order_id = ?, amount = ?, status = ?, payment_method = ? WHERE provider_txn_id = ?",
                    [appOrderId, totalAmount, "PENDING", "NETS", providerTxnId],
                    () => {}
                  );
                } else {
                  db.query(
                    "INSERT INTO transactions (order_id, payment_method, provider_txn_id, amount, status, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
                    [appOrderId, "NETS", providerTxnId, totalAmount, "PENDING"],
                    () => {}
                  );
                }
              }
            );
            console.log("NETS txn_retrieval_ref:", providerTxnId, "saved amount:", totalAmount.toFixed(2));
          }

          return res.json(result);
        } catch (errGen) {
          const status = errGen.status || (errGen.response && errGen.response.status) || 500;
          const details = errGen.details || (errGen.response && errGen.response.data) || errGen.message;
          console.error("NETS generateQr failed:", details);
          return res.status(status).json({ error: "Failed to generate NETS QR.", details });
        }
      }
    );
  } catch (err) {
    const status = err.status || (err.response && err.response.status) || 500;
    const details = err.details || (err.response && err.response.data) || err.message;
    console.error("netsController.generateQr - error", details);
    return res.status(status).json({
      error: "Failed to generate NETS QR.",
      details
    });
  }
}

async function queryQrStatus(req, res) {
  try {
    const { txn_retrieval_ref } = req.body || {};
    if (!txn_retrieval_ref) {
      return res.status(400).json({ error: "Missing txn_retrieval_ref." });
    }

    const result = await netsService.queryStatusByRef(txn_retrieval_ref);
    return res.json(result);
  } catch (err) {
    const status = err.status || (err.response && err.response.status) || 500;
    const details = err.details || (err.response && err.response.data) || err.message;
    console.error("netsController.queryQrStatus - error", details);
    return res.status(status).json({
      error: "Failed to query NETS QR status.",
      details
    });
  }
}

async function streamStatus(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const txnRef = req.params.txn_retrieval_ref;
  const isSandbox =
    (process.env.NETS_QR_QUERY_URL || "").includes("sandbox") ||
    (process.env.NETS_QR_URL || "").includes("sandbox") ||
    (process.env.NETS_ENV || "").toUpperCase() === "SANDBOX";
  let closed = false;
  let terminalSent = false;
  let ended = false;
  let lastStatus = null;
  const startedAt = Date.now();
  const maxDurationMs = 2 * 60 * 1000;

  const interval = setInterval(async () => {
    if (closed) return;
    if (ended) return;
    if (Date.now() - startedAt >= maxDurationMs) {
      if (!terminalSent) {
        terminalSent = true;
        closed = true;
        clearInterval(interval);
        res.write('data: {"status":"TIMEOUT"}\n\n');
        console.log("[SSE EVENT OUT]", { txnRef, status: "TIMEOUT" });
        console.log("[SSE END]", { txnRef, reason: "timeout" });
        res.end();
        ended = true;
      }
      return;
    }
    try {
      const result = await netsService.queryStatusByRef(txnRef);
      const status = String(result.status || "PENDING").toUpperCase();
      if (status !== lastStatus) {
        const rawTxnStatus =
          result.raw && result.raw.result && result.raw.result.data
            ? result.raw.result.data.txn_status
            : undefined;
        console.log("NETS SSE status for", txnRef, "=>", status, "txn_status:", rawTxnStatus);
        lastStatus = status;
      }

      if (status === "SUCCESS" || status === "FAILED") {
        if (terminalSent) return;
        terminalSent = true;
        closed = true;
        clearInterval(interval);
        if (status === "SUCCESS") {
          db.query(
            "SELECT amount, order_id FROM transactions WHERE provider_txn_id = ? LIMIT 1",
            [txnRef],
            (errTxn, rows) => {
              const expectedAmount = rows && rows.length ? Number(rows[0].amount) : null;
              const paidAmount = result.amount != null ? Number(result.amount) : null;
              const decision = decideFinalStatus({
                mappedStatus: status,
                txnStatus: status,
                expectedAmount,
                paidAmount,
                isSandbox
              });
              res.write(`data: ${JSON.stringify({ status: decision.finalStatus })}\n\n`);
              db.query(
                "UPDATE transactions SET status = ? WHERE provider_txn_id = ?",
                [decision.finalStatus, txnRef],
                () => {}
              );
              console.log("[SSE EVENT OUT]", { txnRef, status: decision.finalStatus });
              console.log("[SSE END]", { txnRef, reason: decision.reason });
              res.end();
              ended = true;
            }
          );
        } else {
          const decision = decideFinalStatus({
            mappedStatus: status,
            txnStatus: status,
            expectedAmount: null,
            paidAmount: null,
            isSandbox
          });
          res.write(`data: ${JSON.stringify({ status: decision.finalStatus })}\n\n`);
          db.query(
            "UPDATE transactions SET status = ? WHERE provider_txn_id = ?",
            [decision.finalStatus, txnRef],
            () => {}
          );
          console.log("[SSE EVENT OUT]", { txnRef, status: decision.finalStatus });
          console.log("[SSE END]", { txnRef, reason: decision.reason });
          res.end();
          ended = true;
        }
      } else {
        res.write('data: {"status":"PENDING"}\n\n');
      }
    } catch (err) {
      res.write('data: {"status":"PENDING"}\n\n');
    }
  }, 2000);

  req.on("close", () => {
    closed = true;
    clearInterval(interval);
  });
}

module.exports = {
  generateQr,
  queryQrStatus,
  streamStatus
};
