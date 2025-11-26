const db = require('../db');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

const CartController = {
  // POST /add-to-cart/:productId
  addToCart(req, res) {
    const user = req.session && req.session.user;
    if (!user) {
      req.flash('error', 'Please log in to add items to your cart');
      return res.redirect('/login');
    }

    const productId = parseInt(req.params.productId, 10);
    const quantity = parseInt(req.body.quantity, 10) || 1;

    if (!productId || Number.isNaN(productId) || quantity <= 0) {
      req.flash('error', 'Invalid product or quantity');
      return res.redirect('/shopping');
    }

    Product.getById(productId, (err, product) => {
      if (err) {
        console.error('CartController.addToCart - error selecting product', err);
        req.flash('error', 'Server error while loading product');
        return res.redirect('/shopping');
      }
      if (!product) {
        req.flash('error', 'Product not found');
        return res.redirect('/shopping');
      }
      if (product.quantity < quantity) {
        req.flash('error', 'Not enough stock available for this product');
        return res.redirect('/shopping');
      }

      Cart.getOrCreateCart(user.id, (cartErr, cart) => {
        if (cartErr) {
          console.error('CartController.addToCart - error getting cart', cartErr);
          req.flash('error', 'Unable to access cart');
          return res.redirect('/shopping');
        }

        const adjustStockSql = 'UPDATE products SET quantity = quantity - ? WHERE id = ? AND quantity >= ?';
        db.query(adjustStockSql, [quantity, productId, quantity], (stockErr, stockResult) => {
          if (stockErr || !stockResult || stockResult.affectedRows === 0) {
            console.error('CartController.addToCart - error adjusting stock', stockErr);
            req.flash('error', 'Not enough stock available');
            return res.redirect('/shopping');
          }

          Cart.addItem(cart.id, productId, quantity, (addErr) => {
            if (addErr) {
              console.error('CartController.addToCart - error adding item', addErr);
              // rollback stock on failure
              db.query('UPDATE products SET quantity = quantity + ? WHERE id = ?', [quantity, productId], () => {});
              req.flash('error', 'Unable to add item to cart');
              return res.redirect('/shopping');
            }

            req.flash('success', 'Item added to cart');
            return res.redirect('/cart');
          });
        });
      });
    });
  },

  // GET /cart
  viewCart(req, res) {
    const user = req.session && req.session.user;
    if (!user) {
      req.flash('error', 'Please log in to view your cart');
      return res.redirect('/login');
    }

    Cart.getOrCreateCart(user.id, (cartErr, cart) => {
      if (cartErr) {
        console.error('CartController.viewCart - error getting cart', cartErr);
        return res.render('cart', {
          cart: [],
          errors: req.flash('error').concat(['Unable to load cart items']),
          messages: req.flash('success')
        });
      }

      Cart.getCartItems(cart.id, (err, rows) => {
        if (err) {
          console.error('CartController.viewCart - SQL error:', err);
          return res.render('cart', {
            cart: [],
            errors: req.flash('error').concat(['Unable to load cart items']),
            messages: req.flash('success')
          });
        }

        const cartItems = Array.isArray(rows) ? rows.map(row => ({
          ...row,
          id: row.product_id // keep existing view expectation
        })) : [];

        return res.render('cart', {
          cart: cartItems,
          errors: req.flash('error') || [],
          messages: req.flash('success') || []
        });
      });
    });
  },

  // POST /cart/update/:productId
  updateCartItem(req, res) {
    const user = req.session && req.session.user;
    if (!user) {
      req.flash('error', 'Please log in to update your cart');
      return res.redirect('/login');
    }

    const productId = parseInt(req.params.id, 10);
    const newQuantity = parseInt(req.body.quantity, 10);

    if (!productId || Number.isNaN(productId) || !newQuantity || newQuantity <= 0) {
      req.flash('error', 'Invalid product or quantity');
      return res.redirect('/cart');
    }

    Cart.getOrCreateCart(user.id, (cartErr, cart) => {
      if (cartErr) {
        console.error('CartController.updateCartItem - error getting cart', cartErr);
        req.flash('error', 'Unable to update cart');
        return res.redirect('/cart');
      }

      const findSql = 'SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ? LIMIT 1';
      db.query(findSql, [cart.id, productId], (findErr, rows) => {
        if (findErr) {
          console.error('CartController.updateCartItem - error finding cart row', findErr);
          req.flash('error', 'Unable to update cart');
          return res.redirect('/cart');
        }
        if (!rows || !rows.length) {
          req.flash('error', 'Cart item not found');
          return res.redirect('/cart');
        }

        const currentQty = rows[0].quantity;
        if (currentQty === newQuantity) {
          return res.redirect('/cart');
        }

        // Check available stock before adjusting
        Product.getById(productId, (prodErr, product) => {
          if (prodErr || !product) {
            console.error('CartController.updateCartItem - error loading product', prodErr);
            req.flash('error', 'Unable to update cart');
            return res.redirect('/cart');
          }

          const available = (product.quantity || 0) + currentQty; // include units already reserved in cart
          if (newQuantity > available) {
            req.flash('error', `Only ${available} in stock for ${product.productName}`);
            return res.redirect('/cart');
          }

          const diff = newQuantity - currentQty;
          const adjustStockSql = diff > 0
            ? 'UPDATE products SET quantity = quantity - ? WHERE id = ? AND quantity >= ?'
            : 'UPDATE products SET quantity = quantity + ? WHERE id = ?';
          const adjustParams = diff > 0 ? [diff, productId, diff] : [Math.abs(diff), productId];

          db.query(adjustStockSql, adjustParams, (stockErr, stockResult) => {
            if (stockErr || (diff > 0 && (!stockResult || stockResult.affectedRows === 0))) {
              console.error('CartController.updateCartItem - error adjusting stock', stockErr);
              req.flash('error', 'Not enough stock to update quantity');
              return res.redirect('/cart');
            }

            const updateCartSql = 'UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?';
            db.query(updateCartSql, [newQuantity, cart.id, productId], (updateErr) => {
              if (updateErr) {
                console.error('CartController.updateCartItem - error updating cart', updateErr);
                req.flash('error', 'Unable to update cart');
                return res.redirect('/cart');
              }
              req.flash('success', 'Cart updated');
              return res.redirect('/cart');
            });
          });
        });
      });
    });
  },

  // POST /cart/remove/:productId
  removeCartItem(req, res) {
    const user = req.session && req.session.user;
    if (!user) {
      req.flash('error', 'Please log in to update your cart');
      return res.redirect('/login');
    }

    const productId = parseInt(req.params.id, 10);
    if (!productId || Number.isNaN(productId)) {
      req.flash('error', 'Invalid product');
      return res.redirect('/cart');
    }

    Cart.getOrCreateCart(user.id, (cartErr, cart) => {
      if (cartErr) {
        console.error('CartController.removeCartItem - error getting cart', cartErr);
        req.flash('error', 'Unable to update cart');
        return res.redirect('/cart');
      }

      const selectSql = 'SELECT quantity FROM cart_items WHERE cart_id = ? AND product_id = ? LIMIT 1';
      db.query(selectSql, [cart.id, productId], (selectErr, rows) => {
        if (selectErr) {
          console.error('CartController.removeCartItem - error selecting cart item', selectErr);
          req.flash('error', 'Unable to update cart');
          return res.redirect('/cart');
        }
        if (!rows || !rows.length) {
          req.flash('error', 'Cart item not found');
          return res.redirect('/cart');
        }

        const qty = rows[0].quantity;
        const restoreStockSql = 'UPDATE products SET quantity = quantity + ? WHERE id = ?';

        db.query(restoreStockSql, [qty, productId], (restoreErr) => {
          if (restoreErr) {
            console.error('CartController.removeCartItem - error restoring stock', restoreErr);
            req.flash('error', 'Unable to update cart');
            return res.redirect('/cart');
          }

          const deleteSql = 'DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?';
          db.query(deleteSql, [cart.id, productId], (deleteErr) => {
            if (deleteErr) {
              console.error('CartController.removeCartItem - error deleting cart row', deleteErr);
              req.flash('error', 'Unable to update cart');
              return res.redirect('/cart');
            }

            req.flash('success', 'Item removed from cart');
            return res.redirect('/cart');
          });
        });
      });
    });
  },

  // POST /cart/clear
  clearCart(req, res) {
    const user = req.session && req.session.user;
    if (!user) {
      req.flash('error', 'Please log in to update your cart');
      return res.redirect('/login');
    }

    Cart.getOrCreateCart(user.id, (cartErr, cart) => {
      if (cartErr) {
        console.error('CartController.clearCart - error getting cart', cartErr);
        req.flash('error', 'Unable to clear cart');
        return res.redirect('/cart');
      }

      const selectSql = 'SELECT product_id, quantity FROM cart_items WHERE cart_id = ?';
      db.query(selectSql, [cart.id], (selectErr, rows) => {
        if (selectErr) {
          console.error('CartController.clearCart - error selecting cart rows', selectErr);
          req.flash('error', 'Unable to clear cart');
          return res.redirect('/cart');
        }

        const items = Array.isArray(rows) ? rows : [];
        const restorePromises = items.map(item => new Promise((resolve, reject) => {
          const restoreStockSql = 'UPDATE products SET quantity = quantity + ? WHERE id = ?';
          db.query(restoreStockSql, [item.quantity, item.product_id], (restoreErr) => {
            if (restoreErr) return reject(restoreErr);
            resolve();
          });
        }));

        Promise.allSettled(restorePromises).then(() => {
          const deleteSql = 'DELETE FROM cart_items WHERE cart_id = ?';
          db.query(deleteSql, [cart.id], (deleteErr) => {
            if (deleteErr) {
              console.error('CartController.clearCart - error deleting cart rows', deleteErr);
              req.flash('error', 'Unable to clear cart');
              return res.redirect('/cart');
            }
            req.flash('success', 'Cart cleared');
            return res.redirect('/cart');
          });
        }).catch((restoreErr) => {
          console.error('CartController.clearCart - error restoring stock', restoreErr);
          req.flash('error', 'Unable to clear cart');
          return res.redirect('/cart');
        });
      });
    });
  }
};

module.exports = CartController;
