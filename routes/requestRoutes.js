const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Request = require('../models/Request');
const Asset = require('../models/Asset');
const { isLoggedIn, isRequester } = require('../middleware/auth');

// -------------------------------------------------------------
// GET /requests - View all available equipment for requesters
// -------------------------------------------------------------
router.get('/', isLoggedIn, isRequester, async (req, res) => {
  try {
    // Only fetch assets that have at least 1 unit available
    const availableAssets = await Asset.find({ availableQuantity: { $gt: 0 } }).sort({ name: 1 });
    const success = req.query.success || null;
    const error = req.query.error || null;

    res.render('requests/available', {
      title: 'Available Equipment - Lab Equipment & Assets',
      assets: availableAssets,
      success,
      error,
    });
  } catch (err) {
    console.error('Error fetching available equipment:', err);
    res.status(500).render('index', {
      title: 'Error',
      error: 'Unable to load available equipment. Please try again later.',
    });
  }
});

// -------------------------------------------------------------
// GET /requests/my - View all requests created by the current requester
// (Must be defined before /requests/:id to avoid matching 'my' as an ID)
// -------------------------------------------------------------
const renderMyRequests = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const requests = await Request.find({ requester: userId })
      .populate('asset')
      .sort({ createdAt: -1 });

    const success = req.query.success || null;
    const error = req.query.error || null;

    res.render('requests/my', {
      title: 'My Equipment Requests - Lab Asset Tracker',
      requests,
      success,
      error,
    });
  } catch (err) {
    console.error('Error fetching user requests:', err);
    res.status(500).render('index', {
      title: 'Error',
      error: 'Unable to load your requests.',
    });
  }
};

router.get('/my', isLoggedIn, isRequester, renderMyRequests);
router.get('/my-requests', isLoggedIn, isRequester, renderMyRequests);

// -------------------------------------------------------------
// GET /requests/new/:assetId - Form to raise an equipment request
// -------------------------------------------------------------
router.get('/new/:assetId', isLoggedIn, isRequester, async (req, res) => {
  try {
    const { assetId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(assetId)) {
      return res.redirect('/requests?error=' + encodeURIComponent('Invalid equipment ID specified.'));
    }

    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.redirect('/requests?error=' + encodeURIComponent('Selected equipment not found.'));
    }

    if (asset.availableQuantity <= 0) {
      return res.redirect('/requests?error=' + encodeURIComponent(`"${asset.name}" currently has 0 units available.`));
    }

    res.render('requests/new', {
      title: `Request Equipment: ${asset.name}`,
      asset,
      error: null,
      formData: {},
    });
  } catch (err) {
    console.error('Error loading request form:', err);
    res.redirect('/requests?error=' + encodeURIComponent('Failed to open request form.'));
  }
});

// -------------------------------------------------------------
// POST /requests - Submit a new equipment issue request
// -------------------------------------------------------------
router.post('/', isLoggedIn, isRequester, async (req, res) => {
  try {
    const { quantity, purpose, expectedReturnDate } = req.body;
    const assetId = req.body.assetId || req.body.asset;

    // Validate asset ID format
    if (!assetId || !mongoose.Types.ObjectId.isValid(assetId)) {
      return res.redirect('/requests?error=' + encodeURIComponent('Invalid equipment selected.'));
    }

    // Always fetch fresh asset record from MongoDB (Do not trust client-submitted data)
    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.redirect('/requests?error=' + encodeURIComponent('The requested asset no longer exists.'));
    }

    const parsedQuantity = parseInt(quantity, 10);
    const formData = { quantity, purpose, expectedReturnDate };

    // Validation 1: Quantity must be valid integer >= 1
    if (isNaN(parsedQuantity) || parsedQuantity < 1) {
      return res.render('requests/new', {
        title: `Request Equipment: ${asset.name}`,
        asset,
        error: 'Quantity must be at least 1.',
        formData,
      });
    }

    // Validation 2: Quantity must not exceed live available stock in MongoDB
    if (parsedQuantity > asset.availableQuantity) {
      return res.render('requests/new', {
        title: `Request Equipment: ${asset.name}`,
        asset,
        error: 'Requested quantity is greater than available quantity.',
        formData,
      });
    }

    // Validation 3: Purpose is required
    if (!purpose || !purpose.trim()) {
      return res.render('requests/new', {
        title: `Request Equipment: ${asset.name}`,
        asset,
        error: 'Please state the purpose for requesting this equipment.',
        formData,
      });
    }

    // Validation 4: Expected return date is required
    if (!expectedReturnDate) {
      return res.render('requests/new', {
        title: `Request Equipment: ${asset.name}`,
        asset,
        error: 'Please specify an expected return date.',
        formData,
      });
    }

    const returnDateObj = new Date(expectedReturnDate);
    if (isNaN(returnDateObj.getTime())) {
      return res.render('requests/new', {
        title: `Request Equipment: ${asset.name}`,
        asset,
        error: 'Please enter a valid expected return date.',
        formData,
      });
    }

    // Create the Request document (Status defaults to 'Pending')
    // IMPORTANT: Do NOT reduce asset.availableQuantity at this stage.
    const newRequest = new Request({
      requester: req.session.user.id,
      asset: asset._id,
      quantity: parsedQuantity,
      purpose: purpose.trim(),
      requestDate: new Date(),
      expectedReturnDate: returnDateObj,
      status: 'Pending',
    });

    await newRequest.save();

    res.redirect('/requests/my?success=' + encodeURIComponent(`Request for ${parsedQuantity}x "${asset.name}" submitted successfully!`));
  } catch (err) {
    console.error('Error creating request:', err);
    res.redirect('/requests?error=' + encodeURIComponent('An unexpected error occurred while processing your request.'));
  }
});

// -------------------------------------------------------------
// GET /requests/:id - View details of a specific request
// -------------------------------------------------------------
router.get('/:id', isLoggedIn, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).render('index', {
        title: 'Not Found',
        error: 'Invalid Request ID format.',
      });
    }

    const request = await Request.findById(id)
      .populate('asset')
      .populate('requester', 'name email role');

    if (!request) {
      return res.status(404).render('index', {
        title: 'Not Found',
        error: 'Equipment request not found.',
      });
    }

    // Security Check: Requesters can ONLY view their own requests
    const loggedInUser = req.session.user;
    const isOwner = request.requester && request.requester._id.toString() === loggedInUser.id;
    const isStaffOrAdmin = loggedInUser.role === 'admin' || loggedInUser.role === 'lab_incharge';

    if (!isOwner && !isStaffOrAdmin) {
      return res.status(403).render('index', {
        title: 'Access Denied',
        error: 'Access Denied: You are not authorized to view another user\'s request.',
      });
    }

    res.render('requests/show', {
      title: `Request #${request._id.toString().slice(-6).toUpperCase()} Details`,
      request,
      isOwner,
    });
  } catch (err) {
    console.error('Error viewing request:', err);
    res.status(500).render('index', {
      title: 'Error',
      error: 'Failed to retrieve request details.',
    });
  }
});

module.exports = router;
