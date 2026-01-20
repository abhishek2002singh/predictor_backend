const express = require('express');
const router = express.Router();
const cutoffController = require('../controllers/cutoffController/cutoffController');
const {
 
  updateUserData,
 
} = require("../controllers/UserController/userDataController");
const { API_ROUTES_FOR_ROUTER } = require("../utils/routePath");






// Public routes (no auth required)

router.get('/predictions', cutoffController.getCutoffs);


router.put(API_ROUTES_FOR_ROUTER?.USER_ROUTER?.UPDATE_USER_OWN,updateUserData)
// router.get('/filter-options', cutoffController.getFilterOptions);
// // router.get('/stats', cutoffController.getCutoffStats);
// router.get('/health', cutoffController.healthCheck);

module.exports = router;