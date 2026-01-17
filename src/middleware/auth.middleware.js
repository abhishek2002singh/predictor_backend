const jwt = require("jsonwebtoken");
const User = require("../model/auth/auth");
const Permission = require("../model/permission/permission");
const logger = require("../config/logger");

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, no token provided",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated",
      });
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    logger.error("Auth middleware error", { message: error.message });

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired",
      });
    }

    res.status(401).json({
      success: false,
      message: "Not authorized",
    });
  }
};

// Restrict to specific roles
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    }
    next();
  };
};

// Admin only middleware
const adminOnly = (req, res, next) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }
  next();
};

// Check specific permission for assistants
const checkPermission = (permissionKey) => {
  return async (req, res, next) => {
    try {
      // Admins have all permissions
      if (req.user.role === "ADMIN") {
        return next();
      }

      // For assistants, check their permissions
      if (req.user.role === "ASSISTANCE") {
        const permissions = await Permission.findOne({ assistantId: req.user._id });

        if (!permissions) {
          return res.status(403).json({
            success: false,
            message: "No permissions assigned",
          });
        }

        if (!permissions[permissionKey]) {
          return res.status(403).json({
            success: false,
            message: `Permission denied: ${permissionKey} is not granted`,
          });
        }

        // Attach permissions to request for later use
        req.permissions = permissions;
        return next();
      }

      // Regular users don't have these permissions
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    } catch (error) {
      logger.error("Permission check error", { message: error.message });
      return res.status(500).json({
        success: false,
        message: "Error checking permissions",
      });
    }
  };
};

// Admin or Assistant middleware
const adminOrAssistant = (req, res, next) => {
  if (req.user.role !== "ADMIN" && req.user.role !== "ASSISTANCE") {
    return res.status(403).json({
      success: false,
      message: "Admin or Assistant access required",
    });
  }
  next();
};

module.exports = {
  protect,
  restrictTo,
  adminOnly,
  checkPermission,
  adminOrAssistant,
};
