const User = require("../model/auth/auth");
const Permission = require("../model/permission/permission");
const logger = require("../config/logger");




// Get current assistant's permissions (for assistant to check their own permissions)
const getMyPermissions = async (req, res) => {
  try {
    const permissions = await Permission.findOne({ assistantId: req.user._id });

    if (!permissions) {
      return res.status(404).json({
        success: false,
        message: "Permissions not found",
      });
    }

    res.status(200).json({
      success: true,
      data: permissions,
    });
  } catch (error) {
    logger.error("Get my permissions error", {
      message: error.message,
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: "Failed to get permissions",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  getMyPermissions,
};
