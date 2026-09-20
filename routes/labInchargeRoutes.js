const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Request = require('../models/Request');
const Asset = require('../models/Asset');
const { isLoggedIn, isLabIncharge } = require('../middleware/auth');

// Protect all /lab-incharge/* routes
router.use(isLoggedIn, isLabIncharge);

// -------------------------------------------------------------
// GET /lab-incharge/requests - View all equipment requests
// -------------------------------------------------------------
router.get('/requests', async (req, res) => {
  try {
    const filterStatus = req.query.status || null;
    let query = {};
    const now = new Date();

    if (filterStatus) {
      if (filterStatus === 'Overdue') {
        query = { status: 'Issued', expectedReturnDate: { $lt: now } };
      } else {
        query = { status: filterStatus };
      }
    }

    const requests = await Request.find(query)
      .populate('requester', 'name email')
      .populate('asset')
      .sort({ createdAt: -1 });

    const success = req.query.success || null;
    const error = req.query.error || null;

    res.render('requests/incharge-index', {
      title: 'Manage Equipment Requests - Lab In-charge',
      requests,
      activeFilter: filterStatus,
      success,
      error,
    });
  } catch (err) {
    console.error('Error fetching requests for in-charge:', err);
    res.status(500).render('index', {
      title: 'Error',
      error: 'Failed to retrieve equipment requests.',
    });
  }
});

// -------------------------------------------------------------
// GET /lab-incharge/requests/:id - View specific request details
// -------------------------------------------------------------
router.get('/requests/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.redirect('/lab-incharge/requests?error=' + encodeURIComponent('Invalid Request ID format.'));
    }

    const request = await Request.findById(id)
      .populate('requester', 'name email')
      .populate('asset');

    if (!request) {
      return res.redirect('/lab-incharge/requests?error=' + encodeURIComponent('Request not found.'));
    }

    const success = req.query.success || null;
    const error = req.query.error || null;

    res.render('requests/incharge-show', {
      title: `Review Request #${request._id.toString().slice(-6).toUpperCase()} - Lab In-charge`,
      request,
      success,
      error,
    });
  } catch (err) {
    console.error('Error viewing request:', err);
    res.redirect('/lab-incharge/requests?error=' + encodeURIComponent('Failed to load request details.'));
  }
});

// -------------------------------------------------------------
// POST /lab-incharge/requests/:id/approve - Approve a Pending request
// -------------------------------------------------------------
router.post('/requests/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.redirect('/lab-incharge/requests?error=' + encodeURIComponent('Invalid Request ID.'));
    }

    const request = await Request.findById(id);
    if (!request) {
      return res.redirect('/lab-incharge/requests?error=' + encodeURIComponent('Request not found.'));
    }

    if (request.status !== 'Pending') {
      return res.redirect(`/lab-incharge/requests/${id}?error=` + encodeURIComponent(`Cannot approve request with status "${request.status}". Only Pending requests can be approved.`));
    }

    // Check live asset stock from MongoDB
    const asset = await Asset.findById(request.asset);
    if (!asset) {
      return res.redirect(`/lab-incharge/requests/${id}?error=` + encodeURIComponent('Associated asset no longer exists.'));
    }

    if (asset.availableQuantity < request.quantity) {
      return res.redirect(`/lab-incharge/requests/${id}?error=` + encodeURIComponent(`Not enough equipment available. Required: ${request.quantity}, Available in stock: ${asset.availableQuantity}.`));
    }

    // Set request status to Approved (Do NOT decrement stock yet)
    request.status = 'Approved';
    await request.save();

    res.redirect('/lab-incharge/requests?success=' + encodeURIComponent(`Request #${request._id.toString().slice(-6).toUpperCase()} approved successfully.`));
  } catch (err) {
    console.error('Error approving request:', err);
    res.redirect('/lab-incharge/requests?error=' + encodeURIComponent('An error occurred while approving the request.'));
  }
});

// -------------------------------------------------------------
// POST /lab-incharge/requests/:id/reject - Reject a Pending request
// -------------------------------------------------------------
router.post('/requests/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.redirect('/lab-incharge/requests?error=' + encodeURIComponent('Invalid Request ID.'));
    }

    const request = await Request.findById(id);
    if (!request) {
      return res.redirect('/lab-incharge/requests?error=' + encodeURIComponent('Request not found.'));
    }

    if (request.status !== 'Pending') {
      return res.redirect(`/lab-incharge/requests/${id}?error=` + encodeURIComponent(`Cannot reject request with status "${request.status}". Only Pending requests can be rejected.`));
    }

    request.status = 'Rejected';
    await request.save();

    res.redirect('/lab-incharge/requests?success=' + encodeURIComponent(`Request #${request._id.toString().slice(-6).toUpperCase()} has been rejected.`));
  } catch (err) {
    console.error('Error rejecting request:', err);
    res.redirect('/lab-incharge/requests?error=' + encodeURIComponent('An error occurred while rejecting the request.'));
  }
});

// -------------------------------------------------------------
// POST /lab-incharge/requests/:id/issue - Issue equipment (Decreases available stock)
// -------------------------------------------------------------
router.post('/requests/:id/issue', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.redirect('/lab-incharge/requests?error=' + encodeURIComponent('Invalid Request ID.'));
    }

    const request = await Request.findById(id);
    if (!request) {
      return res.redirect('/lab-incharge/requests?error=' + encodeURIComponent('Request not found.'));
    }

    if (request.status !== 'Approved') {
      return res.redirect(`/lab-incharge/requests/${id}?error=` + encodeURIComponent(`Cannot issue equipment for request with status "${request.status}". Only Approved requests can be issued.`));
    }

    // Verify fresh asset stock from MongoDB
    const asset = await Asset.findById(request.asset);
    if (!asset) {
      return res.redirect(`/lab-incharge/requests/${id}?error=` + encodeURIComponent('Associated asset not found in database.'));
    }

    if (asset.availableQuantity < request.quantity) {
      return res.redirect(`/lab-incharge/requests/${id}?error=` + encodeURIComponent('Cannot issue equipment. Requested quantity is greater than available quantity.'));
    }

    // Deduct quantity from asset inventory
    asset.availableQuantity = asset.availableQuantity - request.quantity;
    if (asset.availableQuantity < 0) {
      asset.availableQuantity = 0;
    }

    // Update request state
    request.status = 'Issued';
    request.issueDate = new Date();

    // Save both documents
    await Promise.all([asset.save(), request.save()]);

    res.redirect('/lab-incharge/requests?success=' + encodeURIComponent(`Equipment issued successfully! Available units updated to ${asset.availableQuantity}.`));
  } catch (err) {
    console.error('Error issuing equipment:', err);
    res.redirect('/lab-incharge/requests?error=' + encodeURIComponent('An error occurred while issuing the equipment.'));
  }
});

// -------------------------------------------------------------
// GET /lab-incharge/requests/:id/return - Form to record equipment return
// -------------------------------------------------------------
router.get('/requests/:id/return', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.redirect('/lab-incharge/requests?error=' + encodeURIComponent('Invalid Request ID.'));
    }

    const request = await Request.findById(id)
      .populate('requester', 'name email')
      .populate('asset');

    if (!request) {
      return res.redirect('/lab-incharge/requests?error=' + encodeURIComponent('Request not found.'));
    }

    if (request.status !== 'Issued') {
      return res.redirect(`/lab-incharge/requests/${id}?error=` + encodeURIComponent(`Cannot record return for request with status "${request.status}". Only Issued equipment can be returned.`));
    }

    res.render('requests/return', {
      title: `Record Return for Request #${request._id.toString().slice(-6).toUpperCase()}`,
      request,
      error: null,
    });
  } catch (err) {
    console.error('Error opening return form:', err);
    res.redirect('/lab-incharge/requests?error=' + encodeURIComponent('Failed to load return form.'));
  }
});

// -------------------------------------------------------------
// POST /lab-incharge/requests/:id/return - Process equipment return & update inventory
// -------------------------------------------------------------
router.post('/requests/:id/return', async (req, res) => {
  try {
    const { id } = req.params;
    const { returnCondition } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.redirect('/lab-incharge/requests?error=' + encodeURIComponent('Invalid Request ID.'));
    }

    const validConditions = ['OK', 'Damaged', 'Lost'];
    if (!validConditions.includes(returnCondition)) {
      return res.redirect(`/lab-incharge/requests/${id}/return?error=` + encodeURIComponent('Please select a valid return condition (OK, Damaged, or Lost).'));
    }

    const request = await Request.findById(id);
    if (!request) {
      return res.redirect('/lab-incharge/requests?error=' + encodeURIComponent('Request not found.'));
    }

    if (request.status !== 'Issued') {
      return res.redirect(`/lab-incharge/requests/${id}?error=` + encodeURIComponent(`Cannot record return for request with status "${request.status}".`));
    }

    const asset = await Asset.findById(request.asset);
    if (!asset) {
      return res.redirect(`/lab-incharge/requests/${id}?error=` + encodeURIComponent('Associated asset not found in database.'));
    }

    // Update Request
    request.status = 'Returned';
    request.returnDate = new Date();
    request.returnCondition = returnCondition;

    // Apply Return Stock & Condition Rules
    if (returnCondition === 'OK') {
      // Usable item -> Restore available quantity
      asset.availableQuantity = Math.min(asset.totalQuantity, asset.availableQuantity + request.quantity);
      asset.condition = 'OK';
    } else if (returnCondition === 'Damaged') {
      // Damaged item -> Do NOT increase available quantity, mark asset condition
      asset.condition = 'Damaged';
    } else if (returnCondition === 'Lost') {
      // Lost item -> Do NOT increase available quantity, mark asset condition
      asset.condition = 'Lost';
    }

    // Save both documents
    await Promise.all([request.save(), asset.save()]);

    res.redirect('/lab-incharge/requests?success=' + encodeURIComponent(`Return recorded successfully (Condition: ${returnCondition}). Inventory updated.`));
  } catch (err) {
    console.error('Error processing return:', err);
    res.redirect('/lab-incharge/requests?error=' + encodeURIComponent('An error occurred while processing the return.'));
  }
});

module.exports = router;
