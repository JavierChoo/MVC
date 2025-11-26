const fs = require('fs');
const path = require('path');

const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const viewsDir = path.join(__dirname, '..', 'views');

function viewOrders(req, res) {
  try {
    const user = req.session && req.session.user;
    if (!user) {
      req.flash('error', 'Please log in to view orders');
      return res.redirect('/login');
    }

    const fetchFn = (user.role === 'admin')
      ? (cb) => Order.getAllOrders(cb)
      : (cb) => Order.getOrdersByUser(user.id, cb);

    fetchFn((err, orders) => {
      if (err) {
        console.error(`OrderController.viewOrders - failed for user ${user.id}:`, err);
        req.flash('error', `Unable to load orders: ${err.message || 'server error'}`);

        const fallbackView = fs.existsSync(path.join(viewsDir, 'orderHistory.ejs')) ? 'orderHistory' : null;
        if (fallbackView) {
          return res.render(fallbackView, { orders: [], messages: req.flash('success'), errors: req.flash('error') });
        }

        req.flash('error', 'Orders view not available');
        return res.redirect('/shopping');
      }

      const viewName = fs.existsSync(path.join(viewsDir, 'orderHistory.ejs')) ? 'orderHistory' : null;
      if (!viewName) {
        console.error('OrderController.viewOrders - view "orderHistory.ejs" not found in views directory.');
        req.flash('error', 'Orders view not found');
        return res.redirect('/shopping');
      }

      return res.render(viewName, {
        orders: Array.isArray(orders) ? orders : [],
        messages: req.flash('success'),
        errors: req.flash('error')
      });
    });
  } catch (ex) {
    console.error('OrderController.viewOrders - unexpected error', ex);
    req.flash('error', 'Unexpected server error');
    return res.redirect('/shopping');
  }
}

function viewOrderDetails(req, res) {
  try {
    const user = req.session && req.session.user;
    if (!user) {
      req.flash('error', 'Please log in to view order details');
      return res.redirect('/login');
    }

    const orderId = parseInt(req.params.id, 10);
    if (Number.isNaN(orderId)) {
      req.flash('error', 'Invalid order id');
      return res.redirect('/orders');
    }

    const isAdmin = user.role === 'admin';
    const userScope = isAdmin ? null : user.id;

    Order.getOrderById(orderId, userScope, (orderErr, order) => {
      if (orderErr) {
        console.error('OrderController.viewOrderDetails - error fetching order', orderId, orderErr);
        req.flash('error', 'Unable to load order');
        return res.redirect('/orders');
      }
      if (!order) {
        req.flash('error', 'Order not found');
        return res.redirect('/orders');
      }

      Order.getOrderItems(orderId, (err, items) => {
        if (err) {
          console.error('OrderController.viewOrderDetails - error fetching items for order', orderId, err);
          req.flash('error', 'Unable to load order items');
          return res.redirect('/orders');
        }

        const detailViewPath = path.join(viewsDir, 'orderDetails.ejs');
        const fallbackHistoryPath = path.join(viewsDir, 'orderHistory.ejs');

        if (fs.existsSync(detailViewPath)) {
          return res.render('orderDetails', { order, items: items || [], messages: req.flash('success'), errors: req.flash('error') });
        }

        if (fs.existsSync(fallbackHistoryPath)) {
          req.flash('info', 'Order details view not available; showing order history instead.');
          return res.render('orderHistory', { orders: [order], messages: req.flash('success'), errors: req.flash('error'), items: items || [], orderId });
        }

        console.error('OrderController.viewOrderDetails - neither orderDetails.ejs nor orderHistory.ejs found in views directory.');
        req.flash('error', 'Order details view not found');
        return res.redirect('/orders');
      });
    });
  } catch (ex) {
    console.error('OrderController.viewOrderDetails - unexpected error', ex);
    req.flash('error', 'Unexpected server error');
    return res.redirect('/orders');
  }
}

module.exports = { viewOrders, viewOrderDetails };
