const axios = require("axios");

const NETS_QR_URL = process.env.NETS_QR_URL;
const NETS_QR_QUERY_URL = process.env.NETS_QR_QUERY_URL;
const API_KEY = process.env.API_KEY;
const PROJECT_ID = process.env.PROJECT_ID;

async function queryStatusByRef(txn_retrieval_ref) {
  if (!NETS_QR_QUERY_URL) {
    throw new Error("NETS_QR_QUERY_URL is not configured.");
  }
  if (!API_KEY || !PROJECT_ID) {
    throw new Error("Missing NETS API credentials.");
  }
  if (!txn_retrieval_ref) {
    throw new Error("Missing txn_retrieval_ref.");
  }

  const response = await axios.post(
    NETS_QR_QUERY_URL,
    { txn_retrieval_ref },
    {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "x-project-id": PROJECT_ID
      }
    }
  );

  const data = response.data || {};
  const status = data.status || data.payment_status || data.txn_status || "PENDING";
  const txnRetrievalRef =
    data.txn_retrieval_ref || data.txnRetrievalRef || txn_retrieval_ref;

  return {
    txn_retrieval_ref: txnRetrievalRef,
    status
  };
}

async function generateQr(payload) {
  if (!NETS_QR_URL) {
    throw new Error("NETS_QR_URL is not configured.");
  }
  if (!API_KEY || !PROJECT_ID) {
    throw new Error("Missing NETS API credentials.");
  }

  const response = await axios.post(NETS_QR_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "x-project-id": PROJECT_ID
    }
  });

  const data = response.data || {};
  const qrBase64 =
    data.qr_base64 || data.qrCodeBase64 || data.qr_code_base64 || null;
  const txnRetrievalRef =
    data.txn_retrieval_ref || data.txnRetrievalRef || data.trx_ref || null;

  if (!qrBase64 || !txnRetrievalRef) {
    const err = new Error("Invalid NETS response.");
    err.details = data;
    err.status = 502;
    throw err;
  }

  return {
    qr_base64: qrBase64,
    txn_retrieval_ref: txnRetrievalRef
  };
}

module.exports = {
  generateQr,
  queryStatusByRef
};
