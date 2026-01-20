const express = require('express');
const router = express.Router();
const cutoffController = require('../controllers/cutoffController/cutoffController');
const upload = require('../middleware/upload');
const {protect} = require('../middleware/auth.middleware'); // Make sure you have this

// Apply auth middleware to protect upload routes
router.post('/upload', 
  protect, // Check if user is authenticated
  upload.single('csvfile'), 
  cutoffController.uploadCutoffCSV
);

// Public routes (no auth required)
// router.get('/predictions', cutoffController.getCutoffs);
// router.get('/filter-options', cutoffController.getFilterOptions);
// // router.get('/stats', cutoffController.getCutoffStats);
// router.get('/health', cutoffController.healthCheck);

module.exports = router;