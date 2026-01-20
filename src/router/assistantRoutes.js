const express = require("express");
const router = express.Router();

const {
  getMyPermissions,
} = require("../controllers/assistantController");

const {
  createAssistant,
  getAllAssistants,
  getAssistant,
  updatePermissions,
  updateAssistantStatus,
  deleteAssistant,} = require('../controllers/adminController/assistanceManageByAdmin/assistanceManageByAdmin')

const { protect, adminOnly, adminOrAssistant } = require("../middleware/auth.middleware");
const { API_ROUTES_FOR_ROUTER, } = require("../utils/routePath");

// All routes require authentication
router.use(protect);

// Assistant can check their own permissions
router.get(API_ROUTES_FOR_ROUTER?.ASSISTANCE_ROUTER_PATH?.PERMISSION_OF_ASSISTANCE, adminOrAssistant, getMyPermissions);

// Admin only routes for managing assistants
router.post(API_ROUTES_FOR_ROUTER?.ASSISTANCE_ROUTER_PATH?.CREATE_ASSISTANCE, adminOnly, createAssistant);
router.get(API_ROUTES_FOR_ROUTER?.ASSISTANCE_ROUTER_PATH?.GET_ALL_ASSISTANCE, adminOnly, getAllAssistants);
router.get(API_ROUTES_FOR_ROUTER?.ASSISTANCE_ROUTER_PATH?.GET_ASSISTANCE_DETAILS, adminOnly, getAssistant);
router.put(API_ROUTES_FOR_ROUTER?.ASSISTANCE_ROUTER_PATH?.UPDATE_PERMISSION, adminOnly, updatePermissions);
router.put(API_ROUTES_FOR_ROUTER?.ASSISTANCE_ROUTER_PATH?.UPDATE_ASSISTANCE_STATUS, adminOnly, updateAssistantStatus);
router.delete(API_ROUTES_FOR_ROUTER?.ASSISTANCE_ROUTER_PATH?.DELETE_ASSISTANCE, adminOnly, deleteAssistant);

module.exports = router
