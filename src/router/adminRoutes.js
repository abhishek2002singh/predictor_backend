const express = require("express");
const router = express.Router();
const User = require("../model/auth/auth");
const { protect, adminOnly } = require("../middleware/auth.middleware");
const logger = require("../config/logger");

// All admin routes require authentication and admin role
router.use(protect);
router.use(adminOnly);

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Admin
router.get("/users", async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;

    const query = {};

    if (role) {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { emailId: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error("Get users error", { message: error.message });
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
});

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
    const totalUsers = await User.countDocuments({ role: "USER" });
    const activeUsers = await User.countDocuments({ role: "USER", isActive: true });
    const totalAdmins = await User.countDocuments({ role: "ADMIN" });

    // Users registered in last 7 days
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const newUsersThisWeek = await User.countDocuments({
      role: "USER",
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
