// Authentication & Role-based Authorization Middleware

// Ensures that the user is logged in with an active session
const isLoggedIn = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  return res.redirect('/auth/login?error=' + encodeURIComponent('Please log in to access this page.'));
};

// Ensures that the logged-in user is an Admin
const isAdmin = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  return res.status(403).render('index', {
    error: 'Access Denied: Admin privileges required.',
    title: 'Access Denied',
  });
};

// Ensures that the logged-in user is a Lab In-charge
const isLabIncharge = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'lab_incharge') {
    return next();
  }
  return res.status(403).render('index', {
    error: 'Access Denied: Lab In-charge privileges required.',
    title: 'Access Denied',
  });
};

// Ensures that the logged-in user is a Requester (Student/Staff)
const isRequester = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'requester') {
    return next();
  }
  return res.status(403).render('index', {
    error: 'Access Denied: Requester access only.',
    title: 'Access Denied',
  });
};

module.exports = {
  isLoggedIn,
  isAdmin,
  isLabIncharge,
  isRequester,
};
