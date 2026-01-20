const express = require("express");
const router = express.Router();
const User = require("../model/auth/auth");
const UserData = require("../model/userData/user");
const { protect, adminOnly } = require("../middleware/auth.middleware");
const logger = require("../config/logger");
const {allAdmin} = require('../controllers/adminController/adminController')
const { API_ROUTES_FOR_ROUTER, } = require("../utils/routePath");

// All admin routes require authentication and admin role
router.use(protect);
router.use(adminOnly);

// @desc    Get all admin
// @route   GET /api/admin/users
// @access  Admin
router.get(API_ROUTES_FOR_ROUTER.ADMIN_ROUTER_PATH.ALL_ADMIN , allAdmin)

// 




// @desc    Get single user
// @route   GET /api/admin/users/:id
// @access  Admin
router.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error("Get user error", { message: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch user",
    });
  }
});

// @desc    Update user status
// @route   PUT /api/admin/users/:id/status
// @access  Admin
router.put("/users/:id/status", async (req, res) => {
  try {
    const { isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    logger.info(`User status updated: ${user.emailId} - Active: ${isActive}`);

    res.status(200).json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      data: user,
    });
  } catch (error) {
    logger.error("Update user status error", { message: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to update user status",
    });
  }
});

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Admin
router.delete("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent deleting admins
    if (user.role === "ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Cannot delete admin users",
      });
    }

    await User.findByIdAndDelete(req.params.id);

    logger.info(`User deleted: ${user.emailId}`);

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    logger.error("Delete user error", { message: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to delete user",
    });
  }
});

// @desc    Get dashboard stats
// @route   GET /api/admin/stats
// @access  Admin
router.get("/stats", async (req, res) => {
  try {
    const totalUsers = await UserData.countDocuments();
    const activeUsers = await User.countDocuments({ role: "USER", isActive: true });
    const totalAdmins = await User.countDocuments({ role: "ADMIN" });
    const totalAssistance = await User.countDocuments({role: "ASSISTANCE" ,isActive: true})
    const activeAssistance = await User.countDocuments({role: "ASSISTANCE" })

    // Users registered in last 7 day
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const newUsersThisWeek = await UserData.countDocuments({
      // role: "USER",
      createdAt: { $gte: lastWeek },
    });

    // Users by category
    const usersByCategory = await User.aggregate([
      { $match: { role: "USER", category: { $exists: true, $ne: null } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        totalAdmins,
        newUsersThisWeek,
        usersByCategory,
        totalAssistance,
        activeAssistance,
        inactiveAssistance:totalAssistance-activeAssistance,
      },
    });
  } catch (error) {
    logger.error("Get stats error", { message: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch stats",
    });
  }
});

module.exports = router;
