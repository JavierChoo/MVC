// ...existing code...
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');

const CheckoutController = {
  checkout(req, res) {
    const user = req.session.user;
    if (!user) {
      req.flash('error', 'Please log in to checkout');
      return res.redirect('/login');
    }

    // 1. Get or create cart
    Cart.getOrCreateCart(user.id, (err, cart) => {
      if (err) {
        console.error('Error getting cart:', err);
        req.flash('error', 'Unable to access cart');
        return res.redirect('/cart');
      }

      // 2. Get cart items
      Cart.getCartItems(cart.id, (err2, items) => {
        if (err2) {
          console.error('Error getting cart items:', err2);
          req.flash('error', 'Unable to retrieve cart items');
          return res.redirect('/cart');
        }

        if (!items || items.length === 0) {
          req.flash('error', 'Your cart is empty');
          return res.redirect('/cart');
        }

        // 3. Calculate total and create order
        const totalAmount = items.reduce((sum, it) => sum + ((it.price || 0) * (it.quantity || 0)), 0);

        Order.createOrder(user.id, totalAmount, (err3, order) => {
          if (err3) {
            console.error('Error creating order:', err3);
            req.flash('error', 'Failed to create order');
            return res.redirect('/cart');
          }

          // 4. Insert each cart item into order_items
          let pending = items.length;
          let hadError = false;

          items.forEach((it) => {
            const productId = it.product_id || it.productId;
            const qty = it.quantity || 0;
            const price = it.price || 0;

            OrderItem.create(order.id, productId, qty, price, (err4) => {
              if (err4) {
                hadError = true;
                console.error('Error adding order item:', err4);
              }

              pending -= 1;
              if (pending === 0) {
                // 5. Clear the cart
                Cart.clear(cart.id, (errClear) => {
                  if (errClear) {
                    console.error('Error clearing cart after checkout:', errClear);
                    req.flash('error', 'Order placed but failed to clear cart. Contact support.');
                    // Redirect to order history even if clearing failed
                    return res.redirect('/orderHistory');
                  }

                  // 6. Redirect with success or partial error message
                  if (hadError) {
                    req.flash('error', 'Order created but some items failed to save. Contact support.');
                  } else {
                    req.flash('success', 'Order placed successfully');
                  }
                  res.redirect('/orderHistory');
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