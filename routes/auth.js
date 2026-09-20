const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// GET /auth/register - Render registration page
router.get('/register', (req, res) => {
  // If already logged in, redirect to home page
  if (req.session && req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/register', {
    title: 'Register - Lab Equipment & Asset System',
    error: null,
    formData: {},
  });
});

// POST /auth/register - Process new user registration
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // Basic form validation
    if (!name || !email || !password) {
      return res.render('auth/register', {
        title: 'Register - Lab Equipment & Asset System',
        error: 'Please fill in all required fields.',
        formData: { name, email },
      });
    }

    if (password.length < 6) {
      return res.render('auth/register', {
        title: 'Register - Lab Equipment & Asset System',
        error: 'Password must be at least 6 characters long.',
        formData: { name, email },
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.render('auth/register', {
        title: 'Register - Lab Equipment & Asset System',
        error: 'Passwords do not match.',
        formData: { name, email },
      });
    }

    // Check if user already exists
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.render('auth/register', {
        title: 'Register - Lab Equipment & Asset System',
        error: 'An account with this email already exists.',
        formData: { name, email },
      });
    }

    // Hash password with bcryptjs
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user strictly with role = 'requester' (no public elevation)
    const newUser = new User({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'requester', // Automatic assignment
    });

    await newUser.save();

    // Redirect to login with success message
    res.redirect('/auth/login?success=' + encodeURIComponent('Registration successful! Please log in.'));
  } catch (err) {
    console.error('Registration Error:', err);
    res.render('auth/register', {
      title: 'Register - Lab Equipment & Asset System',
      error: 'An error occurred during registration. Please try again.',
      formData: { name: req.body.name, email: req.body.email },
    });
  }
});

// GET /auth/login - Render login page
router.get('/login', (req, res) => {
  // If already logged in, redirect to home page
  if (req.session && req.session.user) {
    return res.redirect('/');
  }

  const successMessage = req.query.success || null;
  const errorMessage = req.query.error || null;

  res.render('auth/login', {
    title: 'Login - Lab Equipment & Asset System',
    success: successMessage,
    error: errorMessage,
    formData: {},
  });
});

// POST /auth/login - Process user login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render('auth/login', {
        title: 'Login - Lab Equipment & Asset System',
        error: 'Please enter both email and password.',
        success: null,
        formData: { email },
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    // Find user by email
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.render('auth/login', {
        title: 'Login - Lab Equipment & Asset System',
        error: 'Invalid email or password.',
        success: null,
        formData: { email },
      });
    }

    // Verify password with bcryptjs
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render('auth/login', {
        title: 'Login - Lab Equipment & Asset System',
        error: 'Invalid email or password.',
        success: null,
        formData: { email },
      });
    }

    // Set safe session user data (NEVER store password in session)
    req.session.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };

    // Save session explicitly before redirecting
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
      }
      
      // Role-based dashboard redirect
      if (user.role === 'admin') {
        return res.redirect('/dashboard/admin');
      } else if (user.role === 'lab_incharge') {
        return res.redirect('/dashboard/lab-incharge');
      } else {
        return res.redirect('/dashboard/requester');
      }
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.render('auth/login', {
      title: 'Login - Lab Equipment & Asset System',
      error: 'An unexpected error occurred. Please try again.',
      success: null,
      formData: { email: req.body.email },
    });
  }
});

// GET /auth/logout - Destroy session and log out
router.get('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
      }
      res.clearCookie('connect.sid');
      res.redirect('/auth/login?success=' + encodeURIComponent('You have been logged out successfully.'));
    });
  } else {
    res.redirect('/auth/login');
  }
});

module.exports = router;
