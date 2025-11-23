const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const path = require('path');

const ProductController = require('./controllers/ProductController');
const UserController = require('./controllers/UserController');
const CartController = require('./controllers/CartController');
const OrderController = require('./controllers/OrderController');
const CheckoutController = require('./controllers/CheckoutController');

const { checkAuthenticated, checkAdmin } = require('./middleware/auth');
const { validateRegistration, validateProduct } = require('./middleware/validation');

const app = express();

/* -------------------------
   Multer (image uploads)
   ------------------------- */
const imagesDir = path.join(__dirname, 'public', 'images');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, imagesDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `image-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, name);
  }
});
const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png/;
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();
  if (allowed.test(ext) && (mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/png')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpg, jpeg, png) are allowed'));
  }
};
const upload = multer({ storage, fileFilter });

/* -------------------------
   Express / view settings
   ------------------------- */
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

/* -------------------------
   Session & flash
   ------------------------- */
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 1 week
}));
app.use(flash());

/* -------------------------
   Make flash & user available in all views
   ------------------------- */
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.messages = req.flash('success');
  res.locals.errors = req.flash('error');
  next();
});

/* -------------------------
   Routes (MVC delegates)
   ------------------------- */

/* Home */
app.get('/', (req, res) => {
  res.render('index', { user: req.session.user });
});

/* User auth */
app.get('/register', UserController.showRegisterForm);
app.post('/register', validateRegistration, UserController.registerUser);

app.get('/login', UserController.showLoginForm);
app.post('/login', UserController.loginUser);

app.get('/logout', UserController.logoutUser);

/* Products / Inventory */
app.get('/inventory', checkAuthenticated, checkAdmin, ProductController.list);
app.get('/shopping', checkAuthenticated, ProductController.list);

/* Single product view */
app.get('/product/:id', checkAuthenticated, ProductController.getById);

/* Add product form (render) */
app.get('/addProduct', checkAuthenticated, checkAdmin, (req, res) => {
  res.render('addProduct', { user: req.session.user, formData: req.flash('formData')[0] });
});

/* Create product */
app.post(
  '/addProduct',
  checkAuthenticated,
  checkAdmin,
  upload.single('image'),
  validateProduct,
  (req, res) => ProductController.create(req, res)
);

/* Render update product form */
app.get('/updateProduct/:id', checkAuthenticated, checkAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const Product = require('./models/Product');
  Product.getById(id, (err, product) => {
    if (err) {
      req.flash('error', 'Server error');
      return res.redirect('/inventory');
    }
    if (!product) {
      req.flash('error', 'Product not found');
      return res.redirect('/inventory');
    }
    res.render('updateProduct', { product, user: req.session.user });
  });
});

/* Update product */
app.post(
  '/updateProduct/:id',
  checkAuthenticated,
  checkAdmin,
  upload.single('image'),      // multer will not error when no file is present
  validateProduct,
  (req, res) => ProductController.update(req, res)
);

/* Delete product */
app.get('/deleteProduct/:id', checkAuthenticated, checkAdmin, (req, res) => {
  ProductController.delete(req, res);
});

/* Cart (persistent cart via CartController) */
app.post('/add-to-cart/:id', checkAuthenticated, (req, res) => CartController.addToCart(req, res));
app.get('/cart', checkAuthenticated, (req, res) => CartController.viewCart(req, res));
app.post('/cart/update/:id', checkAuthenticated, (req, res) => CartController.updateCartItem(req, res));
app.post('/cart/clear', checkAuthenticated, (req, res) => CartController.clearCart(req, res));

/* Checkout */
app.get('/checkout', checkAuthenticated, (req, res) => {
  // render confirmation page using cart items (controller could be extended)
  const Cart = require('./models/Cart');
  const user = req.session.user;
  Cart.getOrCreateCart(user.id, (err, cart) => {
    if (err) {
      req.flash('error', 'Unable to load cart');
      return res.redirect('/cart');
    }
    Cart.getCartItems(cart.id, (err2, items) => {
      if (err2) {
        req.flash('error', 'Unable to load cart');
        return res.redirect('/cart');
      }
      res.render('checkout', { cart: items || [], user, messages: req.flash('success'), errors: req.flash('error') });
    });
  });
});
app.post('/checkout', checkAuthenticated, (req, res) => CheckoutController.checkout(req, res));

/* Orders */
app.get('/orders', checkAuthenticated, (req, res) => OrderController.viewOrders(req, res));
app.get('/orders/:id', checkAuthenticated, (req, res) => OrderController.viewOrderDetails(req, res));

/* Fallback / 404 */
app.use((req, res) => {
  res.status(404).render('index', { user: req.session.user, messages: [], errors: ['Page not found'] });
});

/* -------------------------
   Start server
   ------------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
