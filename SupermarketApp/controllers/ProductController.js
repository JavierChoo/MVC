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

      const isAdmin = req.session.user && req.session.user.role === 'admin';
      const allProducts = (products || []).map(p => {
        const isOutOfStock = (p.quantity <= 0);
        const isArchived = isOutOfStock && (p.productName || '').toLowerCase().includes('(deleted)');
        return { ...p, isOutOfStock, isArchived };
      });

      // Shoppers see all active products, including out-of-stock ones (for visibility),
      // but we hide archived entries that admins used to preserve order history.
      const shopperView = allProducts.filter(p => !p.isArchived);

      if (isAdmin) {
        const adminView = allProducts.filter(p => !p.isArchived);
        return res.render('inventory', { products: adminView, messages: req.flash('success'), errors: req.flash('error') });
      }
      return res.render('shopping', { products: shopperView, messages: req.flash('success'), errors: req.flash('error') });
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

      // Clear carts so shoppers do not see archived product in cart
      db.query('DELETE FROM cart_items WHERE product_id = ?', [id], (cartErr) => {
        if (cartErr) {
          req.flash('error', 'Failed to delete product from carts');
          return res.redirect('/inventory');
        }

        // Soft-delete the product to preserve order history while removing it from shopping.
        const archivedName = existing.productName.endsWith(' (deleted)') ? existing.productName : `${existing.productName} (deleted)`;
        const archivedProduct = {
          productName: archivedName,
          price: existing.price,
          quantity: 0, // mark unavailable
          image: imagePath
        };

        Product.update(id, archivedProduct, (err2) => {
          if (err2) {
            req.flash('error', 'Failed to archive product');
            return res.redirect('/inventory');
          }

          // Remove image file only if it was freshly uploaded and we're cleaning up
          if (imagePath) {
            const filename = imagePath.startsWith('/images/') ? imagePath.replace('/images/', '') : imagePath;
            const fullPath = path.join(__dirname, '..', 'public', 'images', filename);
            fs.unlink(fullPath, () => {});
          }

          req.flash('success', 'Product archived to preserve order history');
          return res.redirect('/inventory');
        });
      });
    });
  }
};

module.exports = ProductController;
// ...existing code...
