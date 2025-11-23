// ...existing code...
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');

const CheckoutController = {
  showCheckout(req, res) {
    // rely on res.locals.user in views; do not pass user manually
    return res.render('checkout', { messages: req.flash('success'), errors: req.flash('error') });
  },

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

          let pending = items.length;
          let hadError = false;

          items.forEach((it) => {
            OrderItem.create(order.id, it.product_id || it.productId || it.productId, it.quantity, it.price, (err4) => {
              if (err4) {
                hadError = true;
                console.error('Failed to add order item', err4);
              }

              pending -= 1;
              if (pending === 0) {
                if (hadError) {
                  req.flash('error', 'Order was created but some items failed to save. Contact support.');
                } else {
                  req.flash('success', 'Order placed successfully');
                }

                Cart.clear(cart.id, (errClear) => {
                  if (errClear) {
                    console.error('Failed to clear cart after checkout', errClear);
                    req.flash('error', 'Order placed but failed to clear cart. Contact support.');
                  }
                  return res.redirect('/orders');
                });
              }
            });
          });
        });
      });
    });
  }
};

module.exports = CheckoutController;
// ...existing code...