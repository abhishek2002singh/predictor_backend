const User = require("../model/auth/auth");
const logger = require("../config/logger");
const { adminSignupValidator, adminLoginValidator, assistanceLogin } = require("../validators/adminvalidator");

const adminSignup = async (req, res) => {
  try {
    const { firstName, lastName, mobileNumber, emailId, password } = req.body;

    // Validate input using validator.js
    const { errors, isValid } = adminSignupValidator(req.body);
    
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors
      });
    }

    // Convert email to lowercase
    const lowerCaseEmail = emailId.toLowerCase();

    // Check total admin count in database (max 2 allowed)
    const adminCount = await User.countDocuments({ role: "ADMIN" });
    
    if (adminCount >= 2) {
      logger.warn(`Admin registration blocked: Maximum admin limit (2) reached. Attempted by: ${lowerCaseEmail}`);
      return res.status(400).json({
        success: false,
        message: "Maximum admin limit reached. Only 2 admins are allowed.",
      });
    }

    // Check if admin already exists with same email or mobile
    const existingUser = await User.findOne({
      $or: [{ emailId: lowerCaseEmail }, { mobileNumber }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.emailId === lowerCaseEmail 
          ? "Admin with this email already exists" 
          : "Admin with this mobile number already exists",
      });
    }

    // Create admin user
    const admin = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      mobileNumber,
      emailId: lowerCaseEmail,
      password,
      role: "ADMIN",
    });

    // Generate token using model method
    const token = admin.generateToken();

    logger.info(`New admin registered: ${lowerCaseEmail}. Total admins: ${adminCount + 1}`);

    res.status(201).json({
      success: true,
      message: "Admin registration successful",
      token,
      user: admin.toJSON(),
    });
  } catch (error) {
    logger.error("Admin signup error", {
      message: error.message,
      stack: error.stack,
      email: req.body?.emailId,
    });

    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `Admin with this ${field} already exists`,
      });
    }

    res.status(500).json({
      success: false,
      message: "Admin registration failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const adminLogin = async (req, res) => {
  try {
    const { emailId, password } = req.body;

    // Validate input
    const { errors, isValid } = adminLoginValidator(req.body);
    
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors
      });
    }

    // Convert email to lowercase
    const lowerCaseEmail = emailId.toLowerCase();

    // Find admin user with password field
    const admin = await User.findOne({ 
      emailId: lowerCaseEmail, 
      role: "ADMIN" 
    }).select("+password");

    if (!admin) {
      logger.warn(`Admin login failed: Invalid email - ${lowerCaseEmail}`);
      return res.status(401).json({
        success: false,
        message: "Invalid credentials or not an admin",
      });
    }

    // Check if admin is active
    if (!admin.isActive) {
      logger.warn(`Admin login blocked: Account deactivated - ${lowerCaseEmail}`);
      return res.status(401).json({
        success: false,
        message: "Admin account is deactivated",
      });
    }

    // Compare password using model method
    const isPasswordValid = await admin.comparePassword(password);

    if (!isPasswordValid) {
      logger.warn(`Admin login failed: Invalid password - ${lowerCaseEmail}`);
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Update last login
    admin.lastLoginAt = new Date();
    await admin.save({ validateBeforeSave: false });

    // Generate token using model method
    const token = admin.generateToken();

    logger.info(`Admin logged in successfully: ${lowerCaseEmail}`);

    res.status(200).json({
      success: true,
      message: "Admin login successful",
      token,
      user: admin.toJSON(),
    });
  } catch (error) {
    logger.error("Admin login error", {
      message: error.message,
      stack: error.stack,
      email: req.body?.emailId,
    });

    res.status(500).json({
      success: false,
      message: "Admin login failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const assistantLogin = async (req, res) => {
  try {
    const { emailId, password } = req.body;

    // Validate input
    const { errors, isValid } = assistanceLogin(req.body);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors
      });
    }

    // Convert email to lowercase
    const lowerCaseEmail = emailId.toLowerCase();

    // Find assistant user with password field
    const assistant = await User.findOne({
      emailId: lowerCaseEmail,
      role: "ASSISTANCE"
    }).select("+password");

    if (!assistant) {
      logger.warn(`Assistant login failed: Invalid email - ${lowerCaseEmail}`);
      return res.status(401).json({
        success: false,
        message: "Invalid credentials or not an assistant",
      });
    }

    // Check if assistant is active
    if (!assistant.isActive) {
      logger.warn(`Assistant login blocked: Account deactivated - ${lowerCaseEmail}`);
      return res.status(401).json({
        success: false,
        message: "Assistant account is deactivated",
      });
    }

    // Compare password using model method
    const isPasswordValid = await assistant.comparePassword(password);

    if (!isPasswordValid) {
      logger.warn(`Assistant login failed: Invalid password - ${lowerCaseEmail}`);
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Update last login
    assistant.lastLoginAt = new Date();
    await assistant.save({ validateBeforeSave: false });

    // Generate token using model method
    const token = assistant.generateToken();

    logger.info(`Assistant logged in successfully: ${lowerCaseEmail}`);

    res.status(200).json({
      success: true,
      message: "Assistant login successful",
      token,
      user: assistant.toJSON(),
    });
  } catch (error) {
    logger.error("Assistant login error", {
      message: error.message,
      stack: error.stack,
      email: req.body?.emailId,
    });

    res.status(500).json({
      success: false,
      message: "Assistant login failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user: user.toJSON(),
    });
  } catch (error) {
    logger.error("Get me error", { 
      message: error.message,
      userId: req.user?.id 
    });

    res.status(500).json({
      success: false,
      message: "Failed to get user profile",
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, mobileNumber, rank, category, gender, homeState } =
      req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        firstName,
        lastName,
        mobileNumber,
        rank,
        category,
        gender,
        homeState,
        profileCompleted: true,
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    logger.info(`Profile updated: ${user.emailId}`);

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: user.toJSON(),
    });
  } catch (error) {
    logger.error("Update profile error", { 
      message: error.message,
      userId: req.user?.id 
    });

    res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};

module.exports = {
  adminSignup,
  adminLogin,
  assistantLogin,
  getMe,
  updateProfile,
};