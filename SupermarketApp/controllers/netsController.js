const netsService = require("../services/netsService");

async function generateQr(req, res) {
  try {
    const { txn_id, amt_in_dollars, notify_mobile } = req.body || {};
    if (!txn_id || !amt_in_dollars || !notify_mobile) {
      return res.status(400).json({
        error: "Missing required fields: txn_id, amt_in_dollars, notify_mobile."
      });
    }

    const result = await netsService.generateQr({
      txn_id,
      amt_in_dollars,
      notify_mobile
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

  const interval = setInterval(async () => {
    if (closed) return;
    try {
      const result = await netsService.queryStatusByRef(txnRef);
      const status = String(result.status || "PENDING").toUpperCase();

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
      const message = err && err.message ? err.message : "NETS query failed";
      res.write("event: error\n");
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      clearInterval(interval);
      res.end();
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
