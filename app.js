require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const methodOverride = require('method-override');
const path = require('path');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const SESSION_SECRET = process.env.SESSION_SECRET || 'lab_asset_fallback_secret_key';

// -------------------------------------------------------------
// Database Connection
// -------------------------------------------------------------
if (MONGO_URI) {
  mongoose
    .connect(MONGO_URI)
    .then(() => {
      console.log('MongoDB Connected');
    })
    .catch((err) => {
      console.error('MongoDB Connection Error:', err.message);
    });
} else {
  console.error('CRITICAL: MONGO_URI environment variable is not defined!');
}

// -------------------------------------------------------------
// Trust reverse proxy in production (Render, Vercel, etc.)
// -------------------------------------------------------------
app.set('trust proxy', 1);

// View Engine & Static Files Setup
// -------------------------------------------------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// Middleware
// -------------------------------------------------------------
// Body parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Method override for PUT / DELETE in HTML forms
app.use(methodOverride('_method'));

// Session configuration
const sessionConfig = {
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // 1 day in milliseconds
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  },
};

if (MONGO_URI) {
  sessionConfig.store = MongoStore.create({
    mongoUrl: MONGO_URI,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60, // 1 day in seconds
  });
}

app.use(session(sessionConfig));

// Global middleware to expose authenticated user to all EJS views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// -------------------------------------------------------------
// Routes
// -------------------------------------------------------------
const authRoutes = require('./routes/auth');
const indexRoutes = require('./routes/index');
const assetRoutes = require('./routes/assets');
const requestRoutes = require('./routes/requestRoutes');
const labInchargeRoutes = require('./routes/labInchargeRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');

app.use('/auth', authRoutes);
app.use('/assets', assetRoutes);
app.use('/requests', requestRoutes);
app.use('/maintenance', maintenanceRoutes);
app.use('/lab-incharge', labInchargeRoutes);
app.use('/', dashboardRoutes);
app.use('/', indexRoutes);

// -------------------------------------------------------------
// 404 & Global Error Handling
// -------------------------------------------------------------
// 404 Handler
app.use((req, res) => {
  res.status(404).render('index', {
    title: '404 - Page Not Found',
    error: 'The page you requested does not exist.',
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).render('index', {
    title: '500 - Server Error',
    error: 'Something went wrong on the server. Please try again later.',
  });
});

// -------------------------------------------------------------
// Start Server
// -------------------------------------------------------------
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
