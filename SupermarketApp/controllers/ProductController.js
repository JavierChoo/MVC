// ...existing code...
const fs = require('fs');
const path = require('path');
const db = require('../db');
const Product = require('../models/Product');

const ProductController = {
  list(req, res) {
    Product.getAll((err, products) => {
      if (err) {
        req.flash('error', 'Unable to load products');
        return res.status(500).render('inventory', { products: [], messages: req.flash('error'), errors: req.flash('error') });
      }

      products = (products || []).map(p => ({
        ...p,
        isOutOfStock: (p.quantity <= 0)
      }));

      if (req.session.user && req.session.user.role === 'admin') {
        return res.render('inventory', { products, messages: req.flash('success'), errors: req.flash('error') });
      }
      return res.render('shopping', { products, messages: req.flash('success'), errors: req.flash('error') });
    });
  },

  getById(req, res) {
    const id = parseInt(req.params.id, 10);
    Product.getById(id, (err, product) => {
      if (err) {
        req.flash('error', 'Server error retrieving product');
        return res.status(500).redirect('/shopping');
      }
      if (!product) {
        req.flash('error', 'Product not found');
        return res.status(404).redirect('/shopping');
      }

      product.isOutOfStock = (product.quantity <= 0);
      return res.render('product', { product, messages: req.flash('success'), errors: req.flash('error') });
    });
  },

  create(req, res) {
    // Derive image path from multer upload (required for NOT NULL image column)
    const imagePath = req.file && req.file.filename
      ? '/images/' + req.file.filename
      : (req.body.image || null);

    const product = {
      productName: req.body.productName,
      quantity: req.body.quantity != null ? Number(req.body.quantity) : null,
      price: req.body.price != null ? Number(req.body.price) : null,
      image: imagePath
    };

    Product.create(product, (err) => {
      if (err) {
        // Clean up uploaded file on failure to avoid orphaned images
        if (req.file && req.file.path) {
          fs.unlink(req.file.path, () => {});
        }
        req.flash('error', 'Failed to add product');
        return res.status(500).redirect('/addProduct');
      }
      req.flash('success', 'Product added successfully');
      return res.redirect('/inventory');
    });
  },

  update(req, res) {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      req.flash('error', 'Invalid product id');
      return res.redirect('/inventory');
    }

    Product.getById(id, (err, existing) => {
      if (err) {
        console.error('Error fetching product:', err);
        req.flash('error', 'Server error');
        return res.redirect('/inventory');
      }
      if (!existing) {
        req.flash('error', 'Product not found');
        return res.redirect('/inventory');
      }

      let imagePath = existing.image || null;
      if (req.file && req.file.filename) {
        imagePath = '/images/' + req.file.filename;
      } else if (req.body && req.body.currentImage) {
        imagePath = req.body.currentImage || imagePath;
      }

      const updatedProduct = {
        productName: req.body.name || req.body.productName || existing.productName,
        price: req.body.price != null ? Number(req.body.price) : existing.price,
        quantity: req.body.quantity != null ? Number(req.body.quantity) : existing.quantity,
        image: imagePath
      };

      Product.update(id, updatedProduct, (err2) => {
        if (err2) {
          console.error('Error updating product:', err2);
          req.flash('error', 'Failed to update product');
          return res.redirect('/inventory');
        }
        req.flash('success', 'Product updated successfully');
        return res.redirect('/inventory');
      });
    });
  },

  delete(req, res) {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      req.flash('error', 'Invalid product id');
      return res.redirect('/inventory');
    }

    Product.getById(id, (fetchErr, existing) => {
      if (fetchErr) {
        req.flash('error', 'Failed to delete product');
        return res.redirect('/inventory');
      }
      if (!existing) {
        req.flash('error', 'Product not found');
        return res.redirect('/inventory');
      }

      const imagePath = existing.image;

      // Remove order items and cart items first to avoid FK constraint blocks
      db.query('DELETE FROM order_items WHERE product_id = ?', [id], (orderErr) => {
        if (orderErr) {
          req.flash('error', 'Failed to delete product from orders');
          return res.redirect('/inventory');
        }

        db.query('DELETE FROM cart_items WHERE product_id = ?', [id], (cartErr) => {
          if (cartErr) {
            req.flash('error', 'Failed to delete product from carts');
            return res.redirect('/inventory');
          }

          Product.delete(id, (err, result) => {
            if (err) {
              if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
                req.flash('error', 'Cannot delete product because it is linked to past orders.');
              } else {
                req.flash('error', 'Failed to delete product');
              }
              return res.status(500).redirect('/inventory');
            }
            if (result && result.affectedRows === 0) {
              req.flash('error', 'Product not found');
              return res.status(404).redirect('/inventory');
            }

            // Remove image file if we created and stored it locally
            if (imagePath) {
              const filename = imagePath.startsWith('/images/') ? imagePath.replace('/images/', '') : imagePath;
              const fullPath = path.join(__dirname, '..', 'public', 'images', filename);
              fs.unlink(fullPath, () => {});
            }

            req.flash('success', 'Product deleted');
            return res.redirect('/inventory');
          });
        });
      });
    });
  }
};

module.exports = ProductController;
// ...existing code...
