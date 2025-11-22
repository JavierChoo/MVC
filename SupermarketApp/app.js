const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const path = require('path');
const app = express();

const ProductController = require('./controllers/ProductController'); // per request
const Product = require('./models/Product'); // used for session-cart lookups

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'public', 'images')); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        // keep original name but prefix with timestamp to avoid collisions
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'));
    }
});
const upload = multer({ storage: storage });

// Set up view engine
app.set('view engine', 'ejs');
//  enable static files
app.use(express.static('public'));
// enable form processing
app.use(express.urlencoded({
    extended: false
}));
app.use(express.json());

// Session & flash
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } 
}));
app.use(flash());

// Middleware to check if user is logged in
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login');
    }
};

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/shopping');
    }
};

// Middleware for form validation
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact, role } = req.body;

    if (!username || !email || !password || !address || !contact || !role) {
        return res.status(400).send('All fields are required.');
    }
    
    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

// Define routes
app.get('/',  (req, res) => {
    res.render('index', {user: req.session.user} );
});

// Inventory - delegate to controller (controller should handle rendering/redirecting)
app.get('/inventory', checkAuthenticated, checkAdmin, (req, res) => {
    ProductController.list(req, res);
});

app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});

app.post('/register', validateRegistration, (req, res) => {
    const { username, email, password, address, contact, role } = req.body;

    // keep registration logic here (not product-related)
    const db = require('./db');
    const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    db.query(sql, [username, email, password, address, contact, role], (err, result) => {
        if (err) {
            throw err;
        }
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

app.get('/login', (req, res) => {
    res.render('login', { messages: req.flash('success'), errors: req.flash('error') });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Validate email and password
    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const db = require('./db');
    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    db.query(sql, [email, password], (err, results) => {
        if (err) {
            throw err;
        }

        if (results.length > 0) {
            // Successful login
            req.session.user = results[0]; 
            req.flash('success', 'Login successful!');
            if(req.session.user.role == 'user')
                res.redirect('/shopping');
            else
                res.redirect('/inventory');
        } else {
            // Invalid credentials
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

// Shopping - use controller to list products (controller should render shopping view)
app.get('/shopping', checkAuthenticated, (req, res) => {
    ProductController.list(req, res);
});

// Add to cart uses model to fetch single product and store in session cart
app.post('/add-to-cart/:id', checkAuthenticated, (req, res) => {
    const productId = parseInt(req.params.id, 10);
    const quantity = parseInt(req.body.quantity, 10) || 1;

    Product.getById(productId, (err, product) => {
        if (err) return res.status(500).send('Server error');
        if (!product) return res.status(404).send('Product not found');

        if (!req.session.cart) req.session.cart = [];

        const existingItem = req.session.cart.find(item => item.productId === productId);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            req.session.cart.push({
                productId: productId,
                productName: product.productName,
                price: product.price,
                quantity: quantity,
                image: product.image
            });
        }

        res.redirect('/cart');
    });
});

app.get('/cart', checkAuthenticated, (req, res) => {
    const cart = req.session.cart || [];
    res.render('cart', { cart, user: req.session.user });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/product/:id', checkAuthenticated, (req, res) => {
    // delegate to controller to show single product (controller should render product view)
    ProductController.getById(req, res);
});

app.get('/addProduct', checkAuthenticated, checkAdmin, (req, res) => {
    res.render('addProduct', {user: req.session.user } ); 
});

// Add product - handle file upload then delegate to controller.create
app.post('/addProduct', upload.single('image'),  (req, res) => {
    // normalize form field names expected by controller/model
    req.body.productName = req.body.name;
    req.body.quantity = req.body.quantity ? Number(req.body.quantity) : null;
    req.body.price = req.body.price ? Number(req.body.price) : null;
    if (req.file) {
        req.body.image = '/images/' + req.file.filename;
    } else {
        req.body.image = req.body.image || null;
    }

    ProductController.create(req, res);
});

// Render update product form - fetch product via model and render (keeps existing behavior)
app.get('/updateProduct/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const productId = parseInt(req.params.id, 10);
    Product.getById(productId, (err, product) => {
        if (err) return res.status(500).send('Server error');
        if (!product) return res.status(404).send('Product not found');
        res.render('updateProduct', { product, user: req.session.user });
    });
});

// Update product - handle file upload and delegate to controller.update
app.post('/updateProduct/:id', upload.single('image'), (req, res) => {
    const productId = req.params.id;
    req.body.productName = req.body.name;
    req.body.quantity = req.body.quantity ? Number(req.body.quantity) : null;
    req.body.price = req.body.price ? Number(req.body.price) : null;

    // preserve current image if no new file uploaded
    if (req.file) {
        req.body.image = '/images/' + req.file.filename;
    } else {
        req.body.image = req.body.currentImage || null;
    }

    // ensure req.params.id is available to controller
    req.params.id = productId;
    ProductController.update(req, res);
});

// Delete product - delegate to controller.delete (controller should redirect)
app.get('/deleteProduct/:id', checkAuthenticated, checkAdmin, (req, res) => {
    // Prefer controller to handle deletion and redirecting
    ProductController.delete(req, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
