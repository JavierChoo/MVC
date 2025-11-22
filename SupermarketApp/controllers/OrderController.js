// ...existing code...
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Cart = require('../models/Cart');

const OrderController = {
  // Checkout: create order from user's cart, add items, clear cart, then redirect
  checkout(req, res) {
    const user = req.session.user;
    if (!user) {
      req.flash('error', 'Please log in to checkout');
      return res.redirect('/login');
    }

    Cart.getOrCreateCart(user.id, (err, cart) => {
      if (err) {
        req.flash('error', 'Unable to access cart');
        return res.redirect('/cart');
      }

      Cart.getCartItems(cart.id, (err2, items) => {
        if (err2) {
          req.flash('error', 'Unable to retrieve cart items');
          return res.redirect('/cart');
        }

        if (!items || items.length === 0) {
          req.flash('error', 'Your cart is empty');
          return res.redirect('/cart');
        }

        const totalAmount = items.reduce((sum, it) => sum + ((it.price || 0) * (it.quantity || 0)), 0);

        Order.createOrder(user.id, totalAmount, (err3, order) => {
          if (err3) {
            req.flash('error', 'Failed to create order');
            return res.redirect('/cart');
          }

          // Insert order items sequentially and then clear cart
          let pending = items.length;
          let hadError = false;

          items.forEach((it) => {
            OrderItem.create(order.id, it.product_id || it.productId || it.productId, it.quantity, it.price, (err4) => {
              if (err4) {
                hadError = true;
                // Log and continue attempting to insert remaining items
                console.error('Failed to add order item', err4);
              }

              pending -= 1;
              if (pending === 0) {
                if (hadError) {
                  req.flash('error', 'Order was created but some items failed to save. Contact support.');
                } else {
                  req.flash('success', 'Order placed successfully');
                }

                // Clear cart items regardless (best-effort)
                Cart.clear(cart.id, (errClear) => {
                  if (errClear) {
                    console.error('Failed to clear cart after checkout', errClear);
                    req.flash('error', 'Order placed but failed to clear cart. Contact support.');
                  }
                  // Redirect to orders page (history)
                  res.redirect('/orders');
                });
              }
            });
          });
        });
      });
    });
  },

  // Show order history for logged-in user
  viewOrders(req, res) {
    const user = req.session.user;
    if (!user) {
      req.flash('error', 'Please log in to view orders');
      return res.redirect('/login');
    }

    Order.getOrdersByUser(user.id, (err, orders) => {
      if (err) {
        req.flash('error', 'Unable to load orders');
        return res.redirect('/shopping');
      }
      res.render('orders', { orders: orders || [], user, messages: req.flash('success'), errors: req.flash('error') });
    });
  },

  // Show details for a specific order
  viewOrderDetails(req, res) {
    const user = req.session.user;
    if (!user) {
      req.flash('error', 'Please log in to view order details');
      return res.redirect('/login');
    }

    const orderId = parseInt(req.params.id, 10);
    if (Number.isNaN(orderId)) {
      req.flash('error', 'Invalid order id');
      return res.redirect('/orders');
    }

    Order.getOrderItems(orderId, (err, items) => {
      if (err) {
        req.flash('error', 'Unable to load order items');
        return res.redirect('/orders');
      }
      res.render('orderDetails', { orderId, items: items || [], user, messages: req.flash('success'), errors: req.flash('error') });
    });
  }
};

module.exports = OrderController;
// ...existing code...