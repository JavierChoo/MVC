const netsService = require("../services/netsService");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");

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

    const items = await getOrderItemsAsync(appOrderId);
    const totalAmount = computeTotal(items);
    if (totalAmount <= 0) {
      return res.status(400).json({ error: "Invalid order total." });
    }

    const notifyMobile = 0;

    const txnId = (req.body && req.body.txn_id) || `ORDER-${appOrderId}`;

    console.log("NETS generateQr payload:", {
      appOrderId,
      txn_id: txnId,
      amt_in_dollars: totalAmount.toFixed(2)
    });

    const result = await netsService.generateQr({
      txn_id: txnId,
      amt_in_dollars: totalAmount.toFixed(2),
      notify_mobile: notifyMobile
    });

    return res.json(result);
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
  let closed = false;

  const startedAt = Date.now();
  const maxDurationMs = 5 * 60 * 1000;

  const interval = setInterval(async () => {
    if (closed) return;
    if (Date.now() - startedAt >= maxDurationMs) {
      res.write("event: payment\n");
      res.write('data: {"status":"FAILED","reason":"TIMEOUT"}\n\n');
      clearInterval(interval);
      res.end();
      return;
    }
    try {
      const result = await netsService.queryStatusByRef(txnRef);
      const status = String(result.status || "PENDING").toUpperCase();
      console.log("NETS SSE status for", txnRef, "=>", status);

      if (status === "SUCCESS" || status === "COMPLETED" || status === "FAILED") {
        res.write("event: payment\n");
        res.write(`data: ${JSON.stringify(result)}\n\n`);
        clearInterval(interval);
        res.end();
      } else {
        res.write("event: heartbeat\n");
        res.write('data: {"status":"PENDING"}\n\n');
      }
    } catch (err) {
      res.write("event: heartbeat\n");
      res.write('data: {"status":"PENDING"}\n\n');
    }
  }, 3000);

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
