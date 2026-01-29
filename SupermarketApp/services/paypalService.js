const dotenv = require("dotenv");

dotenv.config();

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const ENVIRONMENT = process.env.PAYPAL_ENVIRONMENT;
const PAYPAL_API = process.env.PAYPAL_API;

const DEFAULT_API =
  ENVIRONMENT && ENVIRONMENT.toUpperCase() === "LIVE"
    ? "https://api.paypal.com"
    : "https://api.sandbox.paypal.com";

const API_BASE = PAYPAL_API || DEFAULT_API;

function getBasicAuthHeader() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Missing PayPal client credentials in environment variables.");
  }

  const token = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  return `Basic ${token}`;
}

async function parseJsonResponse(response) {
  const data = await response.json();
  if (!response.ok) {
    const message =
      data && data.message ? data.message : "PayPal API request failed.";
    const error = new Error(message);
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

async function generateAccessToken() {
  const response = await fetch(`${API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: getBasicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await parseJsonResponse(response);
  return data;
}

async function createOrder(totalAmount) {
  const tokenData = await generateAccessToken();
  const accessToken = tokenData.access_token;

  const response = await fetch(`${API_BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "SGD",
            value: totalAmount,
          },
        },
      ],
    }),
  });

  return parseJsonResponse(response);
}

async function captureOrder(orderId) {
  const tokenData = await generateAccessToken();
  const accessToken = tokenData.access_token;

  const response = await fetch(
    `${API_BASE}/v2/checkout/orders/${orderId}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  return parseJsonResponse(response);
}

module.exports = {
  generateAccessToken,
  createOrder,
  captureOrder,
};
