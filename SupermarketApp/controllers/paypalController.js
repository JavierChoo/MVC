const Cart = require("../models/Cart");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
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

function getOrderByIdAsync(orderId, userId) {
  return new Promise((resolve, reject) => {
    Order.getOrderById(orderId, userId, (err, order) => {
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

function clearCartByUserAsync(userId) {
  return new Promise((resolve, reject) => {
    Cart.getOrCreateCart(userId, (err, cart) => {
      if (err) return reject(err);
      if (!cart || !cart.id) return resolve(null);
      Cart.clear(cart.id, (err2, result) => {
        if (err2) return reject(err2);
        return resolve(result);
      });
    });
  });
}

async function createOrder(req, res) {
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

    const existingOrder = await getOrderByIdAsync(appOrderId, null);
    if (!existingOrder) {
      return res.status(404).json({ error: "Order not found." });
    }
    if (existingOrder.user_id !== user.id) {
      return res.status(403).json({ error: "Not authorized for this order." });
    }

    const orderItems = await getOrderItemsAsync(appOrderId);
    const totalAmount = computeTotal(orderItems);
    if (totalAmount <= 0) {
      return res.status(400).json({ error: "Invalid order total." });
    }

    const order = await paypalService.createOrder(totalAmount.toFixed(2));

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
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ error: "Login required." });
    }

    const paypalOrderId = (req.body && (req.body.paypalOrderId || req.body.orderId)) || null;
    if (!paypalOrderId) {
      return res.status(400).json({ error: "Missing paypalOrderId." });
    }

    const appOrderIdRaw = req.body && req.body.appOrderId;
    const appOrderId = Number.isFinite(Number(appOrderIdRaw))
      ? Number(appOrderIdRaw)
      : null;
    if (!appOrderId) {
      return res.status(400).json({ error: "Missing appOrderId." });
    }

    const existingOrder = await getOrderByIdAsync(appOrderId, null);
    if (!existingOrder) {
      return res.status(404).json({ error: "Order not found." });
    }
    if (existingOrder.user_id !== user.id) {
      return res.status(403).json({ error: "Not authorized for this order." });
    }

    const capture = await paypalService.captureOrder(paypalOrderId);

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
    if (!amountValue || !currencyCode) {
      return res.status(502).json({ error: "PayPal capture missing amount." });
    }
    if (status && String(status).toUpperCase() !== "COMPLETED") {
      return res.status(400).json({ error: "Payment not completed." });
    }

    const finalOrderId = appOrderId;

    await new Promise((resolve, reject) => {
      Transaction.insertTransaction(
        {
          order_id: finalOrderId,
          payment_method: "PAYPAL",
          provider_txn_id: paypalOrderId,
          amount: amountValue,
          status: "SUCCESS"
        },
        (err, result) => {
          if (err) return reject(err);
          return resolve(result);
        }
      );
    });

    if (finalOrderId !== null) {
      await new Promise((resolve, reject) => {
        Order.markOrderPaid(finalOrderId, (err, result) => {
          if (err) return reject(err);
          return resolve(result);
        });
      });
    }

    await clearCartByUserAsync(user.id);

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
