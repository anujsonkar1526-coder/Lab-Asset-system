const express = require('express');
const router = express.Router();

// GET / - Home Page
router.get('/', (req, res) => {
  res.render('index', {
    title: 'Lab Equipment & Asset Issue-Return Tracking System',
  });
});

module.exports = router;
