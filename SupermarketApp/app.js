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
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/*
  Ensure res.locals.user is populated for every request so all views
  (including navbar) can access user via the `user` variable automatically.
  Also expose flash messages as arrays for EJS checks.
*/
app.use((req, res, next) => {
  res.locals.user = req.session && req.session.user ? req.session.user : null;
  res.locals.messages = req.flash('success') || [];
  res.locals.errors = req.flash('error') || [];
  next();
});

/* -------------------------
   Safe handler wrapper
   ------------------------- */
/**
 * Returns a request handler that calls controller[fnName] if available,
 * otherwise responds with a safe redirect and flash message.
 */
function safeHandler(controller, fnName) {
  return function (req, res, next) {
    if (controller && typeof controller[fnName] === 'function') {
      try {
        return controller[fnName](req, res, next);
      } catch (err) {
        console.error(`Error in handler ${fnName}:`, err);
        req.flash('error', 'Server error');
        return res.redirect('/');
      }
    }
    console.error(`Missing handler: ${fnName} on controller`, controller && controller.constructor && controller.constructor.name);
    req.flash('error', 'Server error: handler not available');
    return res.redirect('/');
  };
}

/* Log missing controllers early (helps debugging if require failed) */
[
  ['ProductController', ProductController],
  ['UserController', UserController],
  ['CartController', CartController],
  ['OrderController', OrderController],
  ['CheckoutController', CheckoutController]
].forEach(([name, ctrl]) => {
  if (!ctrl) console.error(`${name} is undefined after require`);
});

/* -------------------------
   Routes (MVC delegates)
   ------------------------- */

/* Home */
app.get('/', (req, res) => {
  // simple home render; res.locals.user is available in views
  res.render('index', { messages: req.flash('success'), errors: req.flash('error') });
});

/* User auth */
app.get('/register', safeHandler(UserController, 'showRegister'));
app.post('/register', validateRegistration, safeHandler(UserController, 'registerUser'));

// Some projects use alternative function names; safeHandler will catch missing ones.
// Login routes
app.get('/login', safeHandler(UserController, 'showLogin'));
app.post('/login', safeHandler(UserController, 'loginUser'));

app.get('/logout', safeHandler(UserController, 'logoutUser'));

/* Products / Inventory */
app.get('/inventory', checkAuthenticated, checkAdmin, safeHandler(ProductController, 'list'));
app.get('/shopping', checkAuthenticated, safeHandler(ProductController, 'list'));

/* Single product view */
app.get('/product/:id', checkAuthenticated, safeHandler(ProductController, 'getById'));

/* Add product form (render) */
app.get('/addProduct', checkAuthenticated, checkAdmin, (req, res) => {
  // render add product form; res.locals.user is available
  res.render('addProduct', { formData: req.flash('formData')[0], messages: req.flash('success'), errors: req.flash('error') });
});

/* Create product */
app.post(
  '/addProduct',
  checkAuthenticated,
  checkAdmin,
  upload.single('image'),
  validateProduct,
  safeHandler(ProductController, 'create')
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
    res.render('updateProduct', { product, messages: req.flash('success'), errors: req.flash('error') });
  });
});

/* Update product */
app.post(
  '/updateProduct/:id',
  checkAuthenticated,
  checkAdmin,
  upload.single('image'),
  validateProduct,
  safeHandler(ProductController, 'update')
);

/* Delete product */
app.get('/deleteProduct/:id', checkAuthenticated, checkAdmin, (req, res) => {
  // call safely
  return safeHandler(ProductController, 'delete')(req, res);
});

/* Cart (persistent cart via CartController) */
app.post('/add-to-cart/:id', checkAuthenticated, safeHandler(CartController, 'addToCart'));
app.get('/cart', checkAuthenticated, safeHandler(CartController, 'viewCart'));
app.post('/cart/update/:id', checkAuthenticated, safeHandler(CartController, 'updateCartItem'));
app.post('/cart/clear', checkAuthenticated, safeHandler(CartController, 'clearCart'));

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
      res.render('checkout', { cart: items || [], messages: req.flash('success'), errors: req.flash('error') });
    });
  });
});
app.post('/checkout', checkAuthenticated, safeHandler(CheckoutController, 'checkout'));

/* Orders */
app.get('/orders', checkAuthenticated, safeHandler(OrderController, 'viewOrders'));
app.get('/orders/:id', checkAuthenticated, safeHandler(OrderController, 'viewOrderDetails'));

/* Fallback / 404 */
app.use((req, res) => {
  res.status(404).render('index', { messages: [], errors: ['Page not found'] });
});

/* -------------------------
   Start server
   ------------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
