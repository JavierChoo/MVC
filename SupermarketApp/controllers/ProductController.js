// ...existing code...
const Product = require('../models/Product');

const ProductController = {
  list(req, res) {
    Product.getAll((err, products) => {
      if (err) {
        req.flash('error', 'Unable to load products');
        return res.status(500).render('inventory', { products: [], user: req.session.user, messages: req.flash('error') });
      }

      // Render inventory for admins, shopping for regular users
      const user = req.session.user || null;
      if (user && user.role === 'admin') {
        res.render('inventory', { products, user, messages: req.flash('success') });
      } else {
        res.render('shopping', { products, user, messages: req.flash('success') });
      }
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

      // If admin viewing a single product page you might want edit view; default to product view
      res.render('product', { product, user: req.session.user, messages: req.flash('success') });
    });
  },

  create(req, res) {
    const product = {
      productName: req.body.productName,
      quantity: req.body.quantity != null ? Number(req.body.quantity) : null,
      price: req.body.price != null ? Number(req.body.price) : null,
      image: req.body.image || null
    };

    Product.create(product, (err, created) => {
      if (err) {
        req.flash('error', 'Failed to add product');
        return res.status(500).redirect('/addProduct');
      }
      req.flash('success', 'Product added successfully');
      res.redirect('/inventory');
    });
  },

  update(req, res) {
    const id = parseInt(req.params.id, 10);
    const product = {
      productName: req.body.productName,
      quantity: req.body.quantity != null ? Number(req.body.quantity) : null,
      price: req.body.price != null ? Number(req.body.price) : null,
      image: req.body.image || null
    };

    Product.update(id, product, (err, result) => {
      if (err) {
        req.flash('error', 'Failed to update product');
        return res.status(500).redirect(`/updateProduct/${id}`);
      }
      if (result && result.affectedRows === 0) {
        req.flash('error', 'Product not found');
        return res.status(404).redirect('/inventory');
      }
      req.flash('success', 'Product updated');
      res.redirect('/inventory');
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
      res.redirect('/inventory');
    });
  }
};

module.exports = ProductController;
// ...existing code...