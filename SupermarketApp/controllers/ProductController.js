// ...existing code...
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
    const product = {
      productName: req.body.productName,
      quantity: req.body.quantity != null ? Number(req.body.quantity) : null,
      price: req.body.price != null ? Number(req.body.price) : null,
      image: req.body.image || null
    };

    Product.create(product, (err) => {
      if (err) {
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
    Product.delete(id, (err, result) => {
      if (err) {
        req.flash('error', 'Failed to delete product');
        return res.status(500).redirect('/inventory');
      }
      if (result && result.affectedRows === 0) {
        req.flash('error', 'Product not found');
        return res.status(404).redirect('/inventory');
      }
      req.flash('success', 'Product deleted');
      return res.redirect('/inventory');
    });
  }
};

module.exports = ProductController;
// ...existing code...