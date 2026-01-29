const Cart = require("../models/Cart");
const Order = require("../models/Order");
const Transaction = require("../models/transactionModel");
const paypalService = require("../services/paypalService");

function getCartItemsForUser(userId) {
  return new Promise((resolve, reject) => {
    Cart.getOrCreateCart(userId, (err, cart) => {
      if (err) return reject(err);
      if (!cart || !cart.id) {
        return resolve({ cart: null, items: [] });
      }
      Cart.getCartItems(cart.id, (err2, items) => {
        if (err2) return reject(err2);
        return resolve({ cart, items: Array.isArray(items) ? items : [] });
      });
    });
  });
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

async function createOrder(req, res) {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ error: "Login required." });
    }

    const { cart, items } = await getCartItemsForUser(user.id);
    if (!cart) {
      return res.status(404).json({ error: "Cart not found." });
    }
    if (!items.length) {
      return res.status(404).json({ error: "Cart is empty." });
    }

    const totalAmount = computeTotal(items);
    if (totalAmount <= 0) {
      return res.status(400).json({ error: "Invalid cart total." });
    }

    const currency = (req.body && req.body.currency) || "USD";
    const order = await paypalService.createOrder(
      totalAmount.toFixed(2),
      currency
    );

    return res.json({ id: order.id });
  } catch (err) {
    console.error("paypalController.createOrder - error", err);
    const status = err.status && Number.isInteger(err.status) ? err.status : 500;
    return res.status(status).json({
      error: "Failed to create PayPal order.",
      details: err.details || err.message,
    });
  }
}

async function captureOrder(req, res) {
  try {
    const orderId = req.body && req.body.orderId;
    if (!orderId) {
      return res.status(400).json({ error: "Missing orderId." });
    }

    const localOrderIdRaw =
      (req.body && (req.body.localOrderId || req.body.orderDbId)) || null;
    const localOrderId = Number.isFinite(Number(localOrderIdRaw))
      ? Number(localOrderIdRaw)
      : null;

    if (localOrderId !== null) {
      const localOrder = await getOrderByIdAsync(localOrderId);
      if (!localOrder) {
        return res.status(404).json({ error: "Order not found." });
      }
    }

    const capture = await paypalService.captureOrder(orderId);

    const payer = capture.payer || {};
    const payerId = payer.payer_id || null;

    const purchaseUnit =
      capture.purchase_units && capture.purchase_units.length
        ? capture.purchase_units[0]
        : null;
    const captureInfo =
      purchaseUnit &&
      purchaseUnit.payments &&
      purchaseUnit.payments.captures &&
      purchaseUnit.payments.captures.length
        ? purchaseUnit.payments.captures[0]
        : null;

    const amountValue =
      (captureInfo && captureInfo.amount && captureInfo.amount.value) ||
      (purchaseUnit && purchaseUnit.amount && purchaseUnit.amount.value) ||
      null;
    const currencyCode =
      (captureInfo &&
        captureInfo.amount &&
        captureInfo.amount.currency_code) ||
      (purchaseUnit && purchaseUnit.amount && purchaseUnit.amount.currency_code) ||
      null;
    const status =
      (captureInfo && captureInfo.status) || capture.status || null;
    const captureTime =
      (captureInfo && (captureInfo.create_time || captureInfo.update_time)) ||
      capture.create_time ||
      null;

    if (!amountValue || !currencyCode) {
      return res.status(502).json({ error: "PayPal capture missing amount." });
    }

    await new Promise((resolve, reject) => {
      Transaction.insertTransaction(
        {
          order_id: localOrderId,
          paypal_orderId: orderId,
          payerId,
          payerEmail: payer.email_address || null,
          amount: amountValue,
          currency: currencyCode,
          status,
          time: captureTime || new Date(),
        },
        (err, result) => {
          if (err) return reject(err);
          return resolve(result);
        }
      );
    });

    if (localOrderId !== null) {
      await new Promise((resolve, reject) => {
        Order.markOrderPaid(localOrderId, (err, result) => {
          if (err) return reject(err);
          return resolve(result);
        });
      });
    }

    return res.json(capture);
  } catch (err) {
    console.error("paypalController.captureOrder - error", err);
    const status = err.status && Number.isInteger(err.status) ? err.status : 500;
    return res.status(status).json({
      error: "Failed to capture PayPal order.",
      details: err.details || err.message,
    });
  }
}

module.exports = {
  createOrder,
  captureOrder,
};
