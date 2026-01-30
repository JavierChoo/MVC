const axios = require("axios");

const NETS_QR_URL =
  "https://sandbox.nets.openapipaas.com/api/v1/common/payments/nets-qr/request";
const NETS_QR_QUERY_URL =
  process.env.NETS_QR_QUERY_URL ||
  "https://sandbox.nets.openapipaas.com/api/v1/common/payments/nets-qr/query";
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
    { txn_retrieval_ref, frontend_timeout_status: 0 },
    {
      headers: {
        "Content-Type": "application/json",
        "api-key": API_KEY,
        "project-id": PROJECT_ID
      }
    }
  );

  const data = response.data || {};
  const result = data.result && data.result.data ? data.result.data : null;
  const responseCode = result && result.response_code ? String(result.response_code) : null;
  const txnStatus = result && result.txn_status != null ? Number(result.txn_status) : null;
  let normalizedStatus = "PENDING";
  if (responseCode === "00" && txnStatus === 2) normalizedStatus = "SUCCESS";
  if (responseCode && responseCode !== "00" && txnStatus === 0) normalizedStatus = "FAILED";
  const txnRetrievalRef =
    (result && (result.txn_retrieval_ref || result.txnRetrievalRef)) ||
    data.txn_retrieval_ref ||
    data.txnRetrievalRef ||
    txn_retrieval_ref;

  return {
    txn_retrieval_ref: txnRetrievalRef,
    status: normalizedStatus,
    raw: data
  };
}

async function generateQr(payload) {
  if (!NETS_QR_URL) {
    throw new Error("NETS_QR_URL is not configured.");
  }
  if (!API_KEY || !PROJECT_ID) {
    throw new Error("Missing NETS API credentials.");
  }

  const amountRaw =
    (payload && payload.cartTotal) ??
    (payload && payload.total) ??
    (payload && payload.amount) ??
    (payload && payload.amt_in_dollars);
  const requestBody = {
    txn_id:
      "sandbox_nets|m|8ff8e5b6-d43e-4786-8ac5-7accf8c5bd9b",
    amt_in_dollars: amountRaw,
    notify_mobile: 0
  };

  console.log("NETS requestBody being sent:", requestBody);

  const response = await axios.post(NETS_QR_URL, requestBody, {
    headers: {
      "api-key": API_KEY,
      "project-id": PROJECT_ID
    }
  });

  const data = response.data || {};
  const result = data.result && data.result.data ? data.result.data : null;
  const qrCode = result && result.qr_code ? result.qr_code : null;
  const txnRetrievalRef = result && result.txn_retrieval_ref ? result.txn_retrieval_ref : null;
  const responseCode = result && result.response_code ? result.response_code : null;
  const txnStatus = result && result.txn_status ? result.txn_status : null;

  if (!qrCode || !txnRetrievalRef) {
    const err = new Error("Invalid NETS response.");
    err.details = data;
    err.status = 502;
    throw err;
  }

  return {
    qr_code: qrCode,
    txn_retrieval_ref: txnRetrievalRef,
    response_code: responseCode,
    txn_status: txnStatus,
    raw: data
  };
}

module.exports = {
  generateQr,
  queryStatusByRef
};
