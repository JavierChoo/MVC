// ...existing code...
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');

const CheckoutController = {
  showCheckout(req, res) {
    const user = req.session.user;
    if (!user) {
      req.flash('error', 'Please log in to checkout');
      return res.redirect('/login');
    }

    Cart.getOrCreateCart(user.id, (err, cart) => {
      if (err) {
        req.flash('error', 'Unable to load cart');
        return res.redirect('/cart');
      }

      Cart.getCartItems(cart.id, (err2, items) => {
        if (err2) {
          req.flash('error', 'Unable to load cart');
          return res.redirect('/cart');
        }

        const cartItems = items || [];
        if (!cartItems.length) {
          return res.render('checkout', {
            cart: [],
            messages: req.flash('success'),
            errors: req.flash('error'),
            paypalClientId: process.env.PAYPAL_CLIENT_ID || '',
            appOrderId: null
          });
        }

        const totalAmount = cartItems.reduce(
          (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0),
          0
        );

        const existingOrderId = req.session.pendingOrderId || null;
        if (existingOrderId) {
          Order.getOrderById(existingOrderId, null, (err3, order) => {
            if (err3 || !order || order.user_id !== user.id) {
              req.session.pendingOrderId = null;
              return createPendingOrder();
            }
            return renderCheckout(existingOrderId);
          });
          return;
        }

        return createPendingOrder();

        function renderCheckout(orderId) {
          return res.render('checkout', {
            cart: cartItems,
            messages: req.flash('success'),
            errors: req.flash('error'),
            paypalClientId: process.env.PAYPAL_CLIENT_ID || '',
            appOrderId: orderId
          });
        }

        function createPendingOrder() {
          if (totalAmount <= 0) {
            req.flash('error', 'Invalid cart total');
            return renderCheckout(null);
          }

          Order.createOrder(user.id, totalAmount, (err3, order) => {
            if (err3 || !order || !order.id) {
              req.flash('error', 'Failed to create order');
              return renderCheckout(null);
            }

            let pending = cartItems.length;
            let hadError = false;

            cartItems.forEach((it) => {
              const productId = it.product_id || it.productId || it.productID;
              OrderItem.create(order.id, productId, it.quantity, it.price, (err4) => {
                if (err4) hadError = true;
                pending -= 1;
                if (pending === 0) {
                  if (hadError) {
                    req.flash('error', 'Some order items failed to save.');
                  }
                  req.session.pendingOrderId = order.id;
                  return renderCheckout(order.id);
                }
              });
            });
          });
        }
      });
    });
  },

  checkout(req, res) {
    return res.redirect('/checkout');
  }
};

module.exports = CheckoutController;
// ...existing code...
