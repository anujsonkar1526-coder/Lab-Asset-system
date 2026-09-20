const express = require('express');
const router = express.Router();
const Asset = require('../models/Asset');
const Request = require('../models/Request');
const { isLoggedIn, isAdmin, isLabIncharge, isRequester } = require('../middleware/auth');

// -------------------------------------------------------------
// GET /dashboard - Role-based Dispatcher
// -------------------------------------------------------------
router.get('/dashboard', isLoggedIn, (req, res) => {
  const role = req.session.user.role;
  if (role === 'admin') {
    return res.redirect('/dashboard/admin');
  } else if (role === 'lab_incharge') {
    return res.redirect('/dashboard/lab-incharge');
  } else if (role === 'requester') {
    return res.redirect('/dashboard/requester');
  }
  return res.redirect('/');
});

// -------------------------------------------------------------
// GET /dashboard/admin - Admin Dashboard with Analytics & Audits
// -------------------------------------------------------------
router.get('/dashboard/admin', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const now = new Date();

    // Execute queries in parallel using Promise.all for high performance
    const [
      totalAssets,
      unitsAgg,
      pendingCount,
      overdueCount,
      damagedCount,
      lostCount,
      recentRequests,
      recentIssued,
      overdueRequests,
      damagedLostRequests,
    ] = await Promise.all([
      // 1. Total distinct asset documents
      Asset.countDocuments(),

      // 2. Sum of totalQuantity and availableQuantity across all assets
      Asset.aggregate([
        {
          $group: {
            _id: null,
            totalUnits: { $sum: '$totalQuantity' },
            availableUnits: { $sum: '$availableQuantity' },
          },
        },
      ]),

      // 3. Pending requests
      Request.countDocuments({ status: 'Pending' }),

      // 4. Overdue returns (Issued & past expected return date)
      Request.countDocuments({ status: 'Issued', expectedReturnDate: { $lt: now } }),

      // 5. Damaged items count
      Request.countDocuments({ returnCondition: 'Damaged' }),

      // 6. Lost items count
      Request.countDocuments({ returnCondition: 'Lost' }),

      // 7. Latest 10 requests sorted by newest first
      Request.find()
        .populate('requester', 'name email')
        .populate('asset')
        .sort({ requestDate: -1 })
        .limit(10),

      // 8. Latest issued equipment sorted by issueDate descending
      Request.find({ issueDate: { $ne: null } })
        .populate('requester', 'name email')
        .populate('asset')
        .sort({ issueDate: -1 })
        .limit(10),

      // 9. All currently overdue requests
      Request.find({ status: 'Issued', expectedReturnDate: { $lt: now } })
        .populate('requester', 'name email')
        .populate('asset')
        .sort({ expectedReturnDate: 1 }),

      // 10. All damaged & lost return records
      Request.find({ returnCondition: { $in: ['Damaged', 'Lost'] } })
        .populate('requester', 'name email')
        .populate('asset')
        .sort({ returnDate: -1 }),
    ]);

    const totalUnits = unitsAgg.length > 0 ? unitsAgg[0].totalUnits : 0;
    const availableUnits = unitsAgg.length > 0 ? unitsAgg[0].availableUnits : 0;
    const issuedUnits = Math.max(0, totalUnits - availableUnits);

    res.render('dashboard/admin', {
      title: 'Admin Dashboard & Analytics - Lab Asset Tracker',
      metrics: {
        totalAssets,
        totalUnits,
        availableUnits,
        issuedUnits,
        pendingRequests: pendingCount,
        overdueReturns: overdueCount,
        damagedItems: damagedCount,
        lostItems: lostCount,
      },
      recentRequests,
      recentIssued,
      overdueRequests,
      damagedLostRequests,
      now,
    });
  } catch (err) {
    console.error('Error loading Admin dashboard:', err);
    res.status(500).render('index', {
      title: 'Error',
      error: 'Unable to load Admin dashboard metrics. Please check server logs.',
    });
  }
});

// -------------------------------------------------------------
// GET /dashboard/lab-incharge - Lab In-charge Dashboard Overview
// -------------------------------------------------------------
router.get('/dashboard/lab-incharge', isLoggedIn, isLabIncharge, async (req, res) => {
  try {
    const now = new Date();

    const [
      pendingCount,
      approvedCount,
      issuedCount,
      returnedCount,
      overdueCount,
      pendingRequests,
      recentIssued,
      overdueRequests,
    ] = await Promise.all([
      Request.countDocuments({ status: 'Pending' }),
      Request.countDocuments({ status: 'Approved' }),
      Request.countDocuments({ status: 'Issued' }),
      Request.countDocuments({ status: 'Returned' }),
      Request.countDocuments({ status: 'Issued', expectedReturnDate: { $lt: now } }),
      Request.find({ status: 'Pending' })
        .populate('requester', 'name email')
        .populate('asset')
        .sort({ requestDate: -1 })
        .limit(10),
      Request.find({ status: 'Issued' })
        .populate('requester', 'name email')
        .populate('asset')
        .sort({ issueDate: -1 })
        .limit(10),
      Request.find({ status: 'Issued', expectedReturnDate: { $lt: now } })
        .populate('requester', 'name email')
        .populate('asset')
        .sort({ expectedReturnDate: 1 }),
    ]);

    res.render('dashboard/labIncharge', {
      title: 'Lab In-charge Dashboard - Lab Asset Tracker',
      metrics: {
        pending: pendingCount,
        approved: approvedCount,
        issued: issuedCount,
        returned: returnedCount,
        overdue: overdueCount,
      },
      pendingRequests,
      recentIssued,
      overdueRequests,
      now,
    });
  } catch (err) {
    console.error('Error loading Lab In-charge dashboard:', err);
    res.status(500).render('index', {
      title: 'Error',
      error: 'Unable to load Lab In-charge dashboard metrics.',
    });
  }
});

// -------------------------------------------------------------
// GET /dashboard/requester - Requester Personal Dashboard
// -------------------------------------------------------------
router.get('/dashboard/requester', isLoggedIn, isRequester, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const now = new Date();

    const [
      totalRequests,
      pendingCount,
      approvedCount,
      issuedCount,
      returnedCount,
      overdueCount,
      recentRequests,
    ] = await Promise.all([
      Request.countDocuments({ requester: userId }),
      Request.countDocuments({ requester: userId, status: 'Pending' }),
      Request.countDocuments({ requester: userId, status: 'Approved' }),
      Request.countDocuments({ requester: userId, status: 'Issued' }),
      Request.countDocuments({ requester: userId, status: 'Returned' }),
      Request.countDocuments({ requester: userId, status: 'Issued', expectedReturnDate: { $lt: now } }),
      Request.find({ requester: userId })
        .populate('asset')
        .sort({ requestDate: -1 })
        .limit(10),
    ]);

    res.render('dashboard/requester', {
      title: 'Student/Staff Portal - Lab Asset Tracker',
      metrics: {
        totalRequests,
        pending: pendingCount,
        approved: approvedCount,
        issued: issuedCount,
        returned: returnedCount,
        overdue: overdueCount,
      },
      recentRequests,
      now,
    });
  } catch (err) {
    console.error('Error loading Requester dashboard:', err);
    res.status(500).render('index', {
      title: 'Error',
      error: 'Unable to load Requester dashboard metrics.',
    });
  }
});

module.exports = router;
