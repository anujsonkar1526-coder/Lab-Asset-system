const express = require('express');
const router = express.Router();
const Asset = require('../models/Asset');
const Maintenance = require('../models/Maintenance');
const { isLoggedIn, isAdmin } = require('../middleware/auth');

// Protect all asset routes with isLoggedIn and isAdmin middleware
router.use(isLoggedIn, isAdmin);

// -------------------------------------------------------------
// GET /assets - List all assets
// -------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const assets = await Asset.find().sort({ createdAt: -1 });
    const success = req.query.success || null;
    const error = req.query.error || null;

    res.render('assets/index', {
      title: 'Asset Management - Lab Equipment & Assets',
      assets,
      success,
      error,
    });
  } catch (err) {
    console.error('Error fetching assets:', err);
    res.status(500).render('index', {
      title: 'Error',
      error: 'Failed to retrieve asset list.',
    });
  }
});

// -------------------------------------------------------------
// GET /assets/new - Form to create a new asset
// -------------------------------------------------------------
router.get('/new', (req, res) => {
  res.render('assets/new', {
    title: 'Add New Asset - Lab Equipment & Assets',
    error: null,
    formData: {},
  });
});

// -------------------------------------------------------------
// POST /assets - Create a new asset
// -------------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    let { assetTag, name, category, lab, condition, totalQuantity, availableQuantity } = req.body;

    // Sanitize & format inputs
    assetTag = assetTag ? assetTag.trim().toUpperCase() : '';
    name = name ? name.trim() : '';
    category = category ? category.trim() : '';
    lab = lab ? lab.trim() : '';
    condition = condition || 'OK';
    const parsedTotal = parseInt(totalQuantity, 10);
    const parsedAvailable = parseInt(availableQuantity, 10);

    const formData = { assetTag, name, category, lab, condition, totalQuantity, availableQuantity };

    // Validation 1: Required fields
    if (!assetTag || !name || !category || !lab || isNaN(parsedTotal) || isNaN(parsedAvailable)) {
      return res.render('assets/new', {
        title: 'Add New Asset - Lab Equipment & Assets',
        error: 'Please fill in all required fields with valid values.',
        formData,
      });
    }

    // Validation 2: Non-negative quantities
    if (parsedTotal < 0) {
      return res.render('assets/new', {
        title: 'Add New Asset - Lab Equipment & Assets',
        error: 'Total quantity cannot be negative.',
        formData,
      });
    }

    if (parsedAvailable < 0) {
      return res.render('assets/new', {
        title: 'Add New Asset - Lab Equipment & Assets',
        error: 'Available quantity cannot be negative.',
        formData,
      });
    }

    // Validation 3: Available cannot exceed Total
    if (parsedAvailable > parsedTotal) {
      return res.render('assets/new', {
        title: 'Add New Asset - Lab Equipment & Assets',
        error: 'Available quantity cannot be greater than total quantity.',
        formData,
      });
    }

    // Validation 4: Valid condition enum
    const validConditions = ['OK', 'Damaged', 'Lost', 'Maintenance'];
    if (!validConditions.includes(condition)) {
      return res.render('assets/new', {
        title: 'Add New Asset - Lab Equipment & Assets',
        error: 'Please select a valid equipment condition.',
        formData,
      });
    }

    // Validation 5: Unique assetTag
    const existingAsset = await Asset.findOne({ assetTag });
    if (existingAsset) {
      return res.render('assets/new', {
        title: 'Add New Asset - Lab Equipment & Assets',
        error: `Asset Tag "${assetTag}" already exists. Asset Tags must be unique.`,
        formData,
      });
    }

    // Create & Save Asset
    const newAsset = new Asset({
      assetTag,
      name,
      category,
      lab,
      condition,
      totalQuantity: parsedTotal,
      availableQuantity: parsedAvailable,
    });

    await newAsset.save();

    res.redirect('/assets?success=' + encodeURIComponent(`Asset "${name}" (${assetTag}) created successfully.`));
  } catch (err) {
    console.error('Error creating asset:', err);
    res.render('assets/new', {
      title: 'Add New Asset - Lab Equipment & Assets',
      error: err.message || 'An error occurred while creating the asset.',
      formData: req.body,
    });
  }
});

// -------------------------------------------------------------
// GET /assets/:id - View asset details
// -------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      return res.redirect('/assets?error=' + encodeURIComponent('Asset not found.'));
    }

    const maintenanceLogs = await Maintenance.find({ asset: req.params.id }).sort({ serviceDate: -1 });

    const success = req.query.success || null;
    const error = req.query.error || null;

    res.render('assets/show', {
      title: `${asset.name} (${asset.assetTag}) - Asset Details`,
      asset,
      maintenanceLogs,
      success,
      error,
    });
  } catch (err) {
    console.error('Error viewing asset:', err);
    res.redirect('/assets?error=' + encodeURIComponent('Invalid asset ID or asset not found.'));
  }
});

// -------------------------------------------------------------
// GET /assets/:id/edit - Render edit form
// -------------------------------------------------------------
router.get('/:id/edit', async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) {
      return res.redirect('/assets?error=' + encodeURIComponent('Asset not found.'));
    }

    res.render('assets/edit', {
      title: `Edit ${asset.name} - Lab Equipment & Assets`,
      asset,
      error: null,
      formData: asset,
    });
  } catch (err) {
    console.error('Error opening edit form:', err);
    res.redirect('/assets?error=' + encodeURIComponent('Invalid asset ID or asset not found.'));
  }
});

// -------------------------------------------------------------
// POST /assets/:id/update - Update an asset
// -------------------------------------------------------------
router.post('/:id/update', async (req, res) => {
  try {
    const { id } = req.params;
    let { assetTag, name, category, lab, condition, totalQuantity, availableQuantity } = req.body;

    const asset = await Asset.findById(id);
    if (!asset) {
      return res.redirect('/assets?error=' + encodeURIComponent('Asset not found.'));
    }

    // Sanitize & format inputs
    assetTag = assetTag ? assetTag.trim().toUpperCase() : '';
    name = name ? name.trim() : '';
    category = category ? category.trim() : '';
    lab = lab ? lab.trim() : '';
    condition = condition || 'OK';
    const parsedTotal = parseInt(totalQuantity, 10);
    const parsedAvailable = parseInt(availableQuantity, 10);

    const formData = { _id: id, assetTag, name, category, lab, condition, totalQuantity, availableQuantity };

    // Validation 1: Required fields
    if (!assetTag || !name || !category || !lab || isNaN(parsedTotal) || isNaN(parsedAvailable)) {
      return res.render('assets/edit', {
        title: `Edit ${name || 'Asset'} - Lab Equipment & Assets`,
        asset,
        error: 'Please fill in all required fields with valid values.',
        formData,
      });
    }

    // Validation 2: Non-negative quantities
    if (parsedTotal < 0) {
      return res.render('assets/edit', {
        title: `Edit ${name} - Lab Equipment & Assets`,
        asset,
        error: 'Total quantity cannot be negative.',
        formData,
      });
    }

    if (parsedAvailable < 0) {
      return res.render('assets/edit', {
        title: `Edit ${name} - Lab Equipment & Assets`,
        asset,
        error: 'Available quantity cannot be negative.',
        formData,
      });
    }

    // Validation 3: Available cannot exceed Total
    if (parsedAvailable > parsedTotal) {
      return res.render('assets/edit', {
        title: `Edit ${name} - Lab Equipment & Assets`,
        asset,
        error: 'Available quantity cannot be greater than total quantity.',
        formData,
      });
    }

    // Validation 4: Valid condition enum
    const validConditions = ['OK', 'Damaged', 'Lost', 'Maintenance'];
    if (!validConditions.includes(condition)) {
      return res.render('assets/edit', {
        title: `Edit ${name} - Lab Equipment & Assets`,
        asset,
        error: 'Please select a valid equipment condition.',
        formData,
      });
    }

    // Validation 5: Unique assetTag (check if changed and taken by another asset)
    if (assetTag !== asset.assetTag) {
      const duplicateTag = await Asset.findOne({ assetTag, _id: { $ne: id } });
      if (duplicateTag) {
        return res.render('assets/edit', {
          title: `Edit ${name} - Lab Equipment & Assets`,
          asset,
          error: `Asset Tag "${assetTag}" is already assigned to another asset.`,
          formData,
        });
      }
    }

    // Update document
    asset.assetTag = assetTag;
    asset.name = name;
    asset.category = category;
    asset.lab = lab;
    asset.condition = condition;
    asset.totalQuantity = parsedTotal;
    asset.availableQuantity = parsedAvailable;

    await asset.save();

    res.redirect(`/assets/${id}?success=` + encodeURIComponent(`Asset "${name}" updated successfully.`));
  } catch (err) {
    console.error('Error updating asset:', err);
    res.render('assets/edit', {
      title: 'Edit Asset - Lab Equipment & Assets',
      asset: { _id: req.params.id },
      error: err.message || 'An error occurred while updating the asset.',
      formData: req.body,
    });
  }
});

// -------------------------------------------------------------
// POST /assets/:id/delete - Delete an asset
// -------------------------------------------------------------
router.post('/:id/delete', async (req, res) => {
  try {
    const { id } = req.params;
    const asset = await Asset.findByIdAndDelete(id);

    if (!asset) {
      return res.redirect('/assets?error=' + encodeURIComponent('Asset not found or already deleted.'));
    }

    res.redirect('/assets?success=' + encodeURIComponent(`Asset "${asset.name}" (${asset.assetTag}) was deleted successfully.`));
  } catch (err) {
    console.error('Error deleting asset:', err);
    res.redirect('/assets?error=' + encodeURIComponent('Failed to delete asset.'));
  }
});

module.exports = router;
