const express = require("express");
const userDataRouter = express.Router();
const {
  createUserData,
  getUserData,
  getAllUserData,
  updateUserData,
  deleteUserData,
  updateUserByAdminOrAssistance
} = require("../controllers/UserController/userDataController");
const { API_ROUTES_FOR_ROUTER } = require("../utils/routePath");
const { protect, checkPermission } = require("../middleware/auth.middleware");

// Public route - anyone can create user data (for prediction form)
userDataRouter.post(API_ROUTES_FOR_ROUTER?.USER_ROUTER?.CREATE_USER, createUserData);

// Protected routes - require authentication and permission
// Admin has full access, Assistant needs 'canViewUsers' permission
userDataRouter.get(
  API_ROUTES_FOR_ROUTER?.USER_ROUTER?.GET_ALL_USER_DATA,
  protect,
  checkPermission("canViewUsers"),
  getAllUserData
);

userDataRouter.get(
  API_ROUTES_FOR_ROUTER?.USER_ROUTER?.USER_DETAILS,
  protect,
  checkPermission("canViewUsers"),
  getUserData
);

userDataRouter.put(
  API_ROUTES_FOR_ROUTER?.USER_ROUTER?.UPDATE_USER,
  protect,
  checkPermission("canEditUsers"),
  updateUserData
);

// userDataRouter.delete("/:id", protect, checkPermission("canDeleteUsers"), deleteUserData);
userDataRouter.put(API_ROUTES_FOR_ROUTER?.USER_ROUTER?.UPDATE_USER_BY_ADMIN_ASSISTANCE, protect,
  checkPermission("canEditUsers"),
  updateUserByAdminOrAssistance)

module.exports = userDataRouter;
