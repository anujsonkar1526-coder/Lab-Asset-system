const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Maintenance = require('../models/Maintenance');
const Asset = require('../models/Asset');
const { isLoggedIn } = require('../middleware/auth');

// Middleware to ensure user is Admin or Lab In-charge
const isStaffOrAdmin = (req, res, next) => {
  if (req.session && req.session.user && (req.session.user.role === 'admin' || req.session.user.role === 'lab_incharge')) {
    return next();
  }
  return res.status(403).render('index', {
    title: 'Access Denied',
    error: 'Access Denied: Staff or Administrator privileges required for Maintenance records.',
  });
};

router.use(isLoggedIn, isStaffOrAdmin);

// -------------------------------------------------------------
// GET /maintenance - List all maintenance records & expenditures
// -------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const [maintenanceLogs, costAgg, totalAssets] = await Promise.all([
      Maintenance.find()
        .populate('asset')
        .sort({ serviceDate: -1 }),
      Maintenance.aggregate([
        {
          $group: {
            _id: null,
            totalCost: { $sum: '$cost' },
            count: { $sum: 1 },
          },
        },
      ]),
      Asset.countDocuments(),
    ]);

    const totalCost = costAgg.length > 0 ? costAgg[0].totalCost : 0;
    const success = req.query.success || null;
    const error = req.query.error || null;

    res.render('maintenance/index', {
      title: 'Equipment Maintenance Logs & Service History',
      logs: maintenanceLogs,
      totalCost,
      totalAssets,
      success,
      error,
      now: new Date(),
    });
  } catch (err) {
    console.error('Error fetching maintenance records:', err);
    res.status(500).render('index', {
      title: 'Error',
      error: 'Unable to retrieve maintenance records.',
    });
  }
});

// -------------------------------------------------------------
// GET /maintenance/new - Form to create a new maintenance log
// -------------------------------------------------------------
router.get('/new', async (req, res) => {
  try {
    const preselectedAssetId = req.query.assetId || null;
    const assets = await Asset.find().sort({ name: 1 });

    let preselectedAsset = null;
    if (preselectedAssetId && mongoose.Types.ObjectId.isValid(preselectedAssetId)) {
      preselectedAsset = await Asset.findById(preselectedAssetId);
    }

    res.render('maintenance/new', {
      title: 'Log Equipment Maintenance Service',
      assets,
      preselectedAsset,
      preselectedAssetId,
      error: null,
      formData: {},
    });
  } catch (err) {
    console.error('Error loading maintenance form:', err);
    res.redirect('/maintenance?error=' + encodeURIComponent('Failed to load maintenance form.'));
  }
});

// -------------------------------------------------------------
// POST /maintenance - Save maintenance service log
// -------------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    const { assetId, serviceDate, cost, description, nextServiceDue, technician, status, updateCondition } = req.body;

    if (!assetId || !mongoose.Types.ObjectId.isValid(assetId)) {
      return res.redirect('/maintenance/new?error=' + encodeURIComponent('Please select a valid equipment asset.'));
    }

    const asset = await Asset.findById(assetId);
    if (!asset) {
      return res.redirect('/maintenance/new?error=' + encodeURIComponent('Selected equipment asset not found.'));
    }

    const parsedCost = parseFloat(cost);
    if (isNaN(parsedCost) || parsedCost < 0) {
      return res.render('maintenance/new', {
        title: 'Log Equipment Maintenance Service',
        assets: await Asset.find().sort({ name: 1 }),
        preselectedAsset: asset,
        preselectedAssetId: assetId,
        error: 'Please enter a valid non-negative maintenance cost.',
        formData: req.body,
      });
    }

    if (!description || !description.trim()) {
      return res.render('maintenance/new', {
        title: 'Log Equipment Maintenance Service',
        assets: await Asset.find().sort({ name: 1 }),
        preselectedAsset: asset,
        preselectedAssetId: assetId,
        error: 'Please describe the service / repairs performed.',
        formData: req.body,
      });
    }

    if (!nextServiceDue) {
      return res.render('maintenance/new', {
        title: 'Log Equipment Maintenance Service',
        assets: await Asset.find().sort({ name: 1 }),
        preselectedAsset: asset,
        preselectedAssetId: assetId,
        error: 'Please specify the next service due date.',
        formData: req.body,
      });
    }

    // Create Maintenance log
    const maintenance = new Maintenance({
      asset: assetId,
      serviceDate: serviceDate ? new Date(serviceDate) : new Date(),
      cost: parsedCost,
      description: description.trim(),
      nextServiceDue: new Date(nextServiceDue),
      technician: technician ? technician.trim() : 'Authorized Service Center',
      status: status || 'Completed',
    });

    // Optionally update asset condition if specified
    if (updateCondition && ['OK', 'Maintenance', 'Damaged', 'Lost'].includes(updateCondition)) {
      asset.condition = updateCondition;
      await asset.save();
    }

    await maintenance.save();

    res.redirect('/maintenance?success=' + encodeURIComponent(`Maintenance log for "${asset.name}" (${asset.assetTag}) recorded successfully.`));
  } catch (err) {
    console.error('Error saving maintenance log:', err);
    res.redirect('/maintenance?error=' + encodeURIComponent('An error occurred while saving the maintenance log.'));
  }
});

// -------------------------------------------------------------
// GET /maintenance/:id - View maintenance certificate details
// -------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.redirect('/maintenance?error=' + encodeURIComponent('Invalid log ID.'));
    }

    const log = await Maintenance.findById(id).populate('asset');
    if (!log) {
      return res.redirect('/maintenance?error=' + encodeURIComponent('Maintenance record not found.'));
    }

    res.render('maintenance/show', {
      title: `Maintenance Record #${log._id.toString().slice(-6).toUpperCase()}`,
      log,
    });
  } catch (err) {
    console.error('Error viewing maintenance record:', err);
    res.redirect('/maintenance?error=' + encodeURIComponent('Failed to load maintenance record.'));
  }
});

module.exports = router;
