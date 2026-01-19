const User = require("../../../model/auth/auth");
const Permission = require("../../../model/permission/permission");
const logger = require("../../../config/logger");
const validator = require("validator");

// Create a new assistant (Admin only)
const createAssistant = async (req, res) => {
  try {
    const { firstName, lastName, emailId, mobileNumber, password, permissions } = req.body;

    // Validation
    if (!firstName || !lastName || !emailId || !mobileNumber || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (!validator.isEmail(emailId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ emailId: emailId.toLowerCase() }, { mobileNumber }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email or mobile number already exists",
      });
    }

    // Create assistant user
    const assistant = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      emailId: emailId.toLowerCase(),
      mobileNumber,
      password,
      role: "ASSISTANCE",
      isActive: true,
    });

    // Create permissions for the assistant
    const permissionData = {
      assistantId: assistant._id,
      grantedBy: req.user._id,
      canViewUsers: permissions?.canViewUsers || false,
      canEditUsers: permissions?.canEditUsers || false,
      canDeleteUsers: permissions?.canDeleteUsers || false,
      canViewPredictions: permissions?.canViewPredictions || false,
      canExportData: permissions?.canExportData || false,
      canViewDashboard: permissions?.canViewDashboard || true,
      canViewStats: permissions?.canViewStats || false,
    };

    const assistantPermissions = await Permission.create(permissionData);

    logger.info(`Assistant created: ${assistant.emailId} by admin: ${req.user.emailId}`);

    res.status(201).json({
      success: true,
      message: "Assistant created successfully",
      data: {
        assistant: assistant.toJSON(),
        permissions: assistantPermissions,
      },
    });
  } catch (error) {
    logger.error("Create assistant error", {
      message: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      success: false,
      message: "Failed to create assistant",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get all assistants with their permissions
const getAllAssistants = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    const filter = { role: "ASSISTANCE" };

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { emailId: { $regex: search, $options: "i" } },
      ];
    }

    const assistants = await User.find(filter)
      .select("-password")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const count = await User.countDocuments(filter);

    // Get permissions for all assistants
    const assistantIds = assistants.map((a) => a._id);
    const permissions = await Permission.find({
      assistantId: { $in: assistantIds },
    });

    // Map permissions to assistants
    const assistantsWithPermissions = assistants.map((assistant) => {
      const assistantPermission = permissions.find(
        (p) => p.assistantId.toString() === assistant._id.toString()
      );
      return {
        ...assistant.toJSON(),
        permissions: assistantPermission || null,
      };
    });

    res.status(200).json({
      success: true,
      data: assistantsWithPermissions,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      totalRecords: count,
    });
  } catch (error) {
    logger.error("Get all assistants error", {
      message: error.message,
    });

    res.status(500).json({
      success: false,
      message: "Failed to get assistants",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get single assistant with permissions
const getAssistant = async (req, res) => {
  try {
    const { id } = req.params;

    const assistant = await User.findOne({ _id: id, role: "ASSISTANCE" }).select("-password");

    if (!assistant) {
      return res.status(404).json({
        success: false,
        message: "Assistant not found",
      });
    }

    const permissions = await Permission.findOne({ assistantId: id });

    res.status(200).json({
      success: true,
      data: {
        ...assistant.toJSON(),
        permissions: permissions || null,
      },
    });
  } catch (error) {
    logger.error("Get assistant error", {
      message: error.message,
      assistantId: req.params?.id,
    });

    res.status(500).json({
      success: false,
      message: "Failed to get assistant",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update assistant permissions
const updatePermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      canViewUsers,
      canEditUsers,
      canDeleteUsers,
      canViewPredictions,
      canExportData,
      canViewDashboard,
      canViewStats,
    } = req.body;

    // Check if assistant exists
    const assistant = await User.findOne({ _id: id, role: "ASSISTANCE" });

    if (!assistant) {
      return res.status(404).json({
        success: false,
        message: "Assistant not found",
      });
    }

    // Update or create permissions
    const permissions = await Permission.findOneAndUpdate(
      { assistantId: id },
      {
        canViewUsers,
        canEditUsers,
        canDeleteUsers,
        canViewPredictions,
        canExportData,
        canViewDashboard,
        canViewStats,
        lastUpdatedBy: req.user._id,
      },
      { new: true, upsert: true, runValidators: true }
    );

    logger.info(`Permissions updated for assistant: ${assistant.emailId} by admin: ${req.user.emailId}`);

    res.status(200).json({
      success: true,
      message: "Permissions updated successfully",
      data: permissions,
    });
  } catch (error) {
    logger.error("Update permissions error", {
      message: error.message,
      assistantId: req.params?.id,
    });

    res.status(500).json({
      success: false,
      message: "Failed to update permissions",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update assistant status (activate/deactivate)
const updateAssistantStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const assistant = await User.findOneAndUpdate(
      { _id: id, role: "ASSISTANCE" },
      { isActive },
      { new: true }
    ).select("-password");

    if (!assistant) {
      return res.status(404).json({
        success: false,
        message: "Assistant not found",
      });
    }

    logger.info(`Assistant status updated: ${assistant.emailId} - Active: ${isActive}`);

    res.status(200).json({
      success: true,
      message: `Assistant ${isActive ? "activated" : "deactivated"} successfully`,
      data: assistant,
    });
  } catch (error) {
    logger.error("Update assistant status error", {
      message: error.message,
      assistantId: req.params?.id,
    });

    res.status(500).json({
      success: false,
      message: "Failed to update assistant status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Delete assistant
const deleteAssistant = async (req, res) => {
  try {
    const { id } = req.params;

    const assistant = await User.findOneAndDelete({ _id: id, role: "ASSISTANCE" });

    if (!assistant) {
      return res.status(404).json({
        success: false,
        message: "Assistant not found",
      });
    }

    // Delete associated permissions
    await Permission.findOneAndDelete({ assistantId: id });

    logger.info(`Assistant deleted: ${assistant.emailId} by admin: ${req.user.emailId}`);

    res.status(200).json({
      success: true,
      message: "Assistant deleted successfully",
    });
  } catch (error) {
    logger.error("Delete assistant error", {
      message: error.message,
      assistantId: req.params?.id,
    });

    res.status(500).json({
      success: false,
      message: "Failed to delete assistant",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


module.exports = {
  createAssistant,
  getAllAssistants,
  getAssistant,
  updatePermissions,
  updateAssistantStatus,
  deleteAssistant,
};
