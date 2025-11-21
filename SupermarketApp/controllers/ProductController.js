// ...existing code...
const Product = require('../models/Product');

const ProductController = {
  list(req, res) {
    Product.getAll((err, products) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(products);
    });
  },

  getById(req, res) {
    const id = req.params.id;
    Product.getById(id, (err, product) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!product) return res.status(404).json({ error: 'Product not found' });
      res.json(product);
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
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json(created);
    });
  },

  update(req, res) {
    const id = req.params.id;
    const product = {
      productName: req.body.productName,
      quantity: req.body.quantity != null ? Number(req.body.quantity) : null,
      price: req.body.price != null ? Number(req.body.price) : null,
      image: req.body.image || null
    };

    Product.update(id, product, (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      // MySQL result may contain affectedRows
      if (result && result.affectedRows === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.json({ message: 'Product updated' });
    });
  },

  delete(req, res) {
    const id = req.params.id;
    Product.delete(id, (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result && result.affectedRows === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.json({ message: 'Product deleted' });
    });
  }
};

module.exports = ProductController;
// ...existing code...