const express = require("express");
const authRouter = express.Router();
const {
  adminSignup,
  adminLogin,
  assistantLogin,
  getMe,
  updateProfile,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth.middleware");
const { API_ROUTES_FOR_ROUTER, } = require("../utils/routePath");

// Admin authentication routes (public)
authRouter.post(API_ROUTES_FOR_ROUTER?.AUTH_ROUTER?.ADMIN_SIGNUP, adminSignup);
authRouter.post(API_ROUTES_FOR_ROUTER?.AUTH_ROUTER?.ADMIN_LOGIN, adminLogin);

// Assistant authentication routes (public)
authRouter.post("/assistant/login", assistantLogin);

// Protected routes
authRouter.get(API_ROUTES_FOR_ROUTER?.AUTH_ROUTER?.GET_PROFILE, protect, getMe);
authRouter.put(API_ROUTES_FOR_ROUTER?.AUTH_ROUTER?.UPDATE_PROFILE, protect, updateProfile);

module.exports = authRouter;
