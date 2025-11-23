const Cart = require('../models/Cart');
const Product = require('../models/Product');

const CartController = {
  addToCart(req, res) {
    const user = req.session.user;
    if (!user) {
      req.flash('error', 'Please log in to add items to cart');
      return res.redirect('/login');
    }

    const productId = parseInt(req.params.id || req.body.productId, 10);
    const quantity = parseInt(req.body.quantity, 10) || 1;
    const redirectTo = req.body.redirectTo === 'cart' ? '/cart' : '/shopping';

    Product.getById(productId, (err, product) => {
      if (err || !product) {
        req.flash('error', 'Product not found');
        return res.redirect(redirectTo);
      }
      if (product.quantity <= 0) {
        req.flash('error', 'Product is out of stock');
        return res.redirect(redirectTo);
      }

      Cart.getOrCreateCart(user.id, (err, cart) => {
        if (err) {
          req.flash('error', 'Unable to access cart');
          return res.redirect(redirectTo);
        }

        Cart.addItem(cart.id, productId, quantity, (err2) => {
          if (err2) {
            req.flash('error', 'Failed to add item to cart');
            return res.redirect(redirectTo);
          }
          req.flash('success', 'Item added to cart');
          return res.redirect(redirectTo);
        });
      });
    });
  },

  viewCart(req, res) {
    const user = req.session.user;
    if (!user) {
      req.flash('error', 'Please log in to view your cart');
      return res.redirect('/login');
    }

    Cart.getOrCreateCart(user.id, (err, cart) => {
      if (err) {
        req.flash('error', 'Unable to load cart');
        return res.redirect('/shopping');
      }

      Cart.getCartItems(cart.id, (err2, items) => {
        if (err2) {
          req.flash('error', 'Unable to load cart items');
          return res.redirect('/shopping');
        }
        return res.render('cart', { cart: items || [], messages: req.flash('success'), errors: req.flash('error') });
      });
    });
  },

  updateCartItem(req, res) {
    const cartItemId = parseInt(req.params.id || req.body.cartItemId, 10);
    const quantity = parseInt(req.body.quantity, 10);

    if (!cartItemId || Number.isNaN(quantity) || quantity < 1) {
      req.flash('error', 'Invalid quantity');
      return res.redirect('/cart');
    }

    Cart.updateItem(cartItemId, quantity, (err, result) => {
      if (err) {
        req.flash('error', 'Failed to update item');
        return res.redirect('/cart');
      }
      if (result && result.affectedRows === 0) {
        req.flash('error', 'Cart item not found');
        return res.redirect('/cart');
      }
      req.flash('success', 'Cart updated');
      return res.redirect('/cart');
    });
  },

  clearCart(req, res) {
    const user = req.session.user;
    if (!user) {
      req.flash('error', 'Please log in to clear your cart');
      return res.redirect('/login');
    }

    Cart.getOrCreateCart(user.id, (err, cart) => {
      if (err) {
        req.flash('error', 'Unable to access cart');
        return res.redirect('/cart');
      }

      Cart.clear(cart.id, (err2) => {
        if (err2) {
          req.flash('error', 'Failed to clear cart');
          return res.redirect('/cart');
        }
        req.flash('success', 'Cart cleared');
        return res.redirect('/cart');
      });
    });
  }
};

module.exports = CartController;