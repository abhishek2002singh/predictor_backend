const UserData = require("../../model/userData/user");
const logger = require("../../config/logger");

// Map incoming category values to valid schema enum values
const categoryMap = {
  "GENERAL": "GENERAL",
  "OBC": "OBC",
  "OBC-NCL": "OBC",
  "SC": "SC",
  "ST": "ST",
  "EWS": "EWS",
  "GENERAL-PwD": "GENERAL",
  "EWS-PwD": "EWS",
  "OBC-NCL-PwD": "OBC",
  "SC-PwD": "SC",
  "ST-PwD": "ST",
};

// Map incoming gender values to valid schema enum values
const genderMap = {
  "Male": "Male",
  "Female": "Female",
  "Other": "GENERAL",
  // "GENERAL": "GENERAL",
  // "EWS": "EWS",
  // "OBC-NCL": "OBC-NCL",
  // "SC": "SC",
  // "ST": "ST",
  // "GENERAL-PwD": "GENERAL-PwD",
  // "EWS-PwD": "EWS-PwD",
  // "OBC-NCL-PwD": "OBC-NCL-PwD",
  // "SC-PwD": "SC-PwD",
  // "ST-PwD": "ST-PwD"
};

const createUserData = async (req, res) => {
  try {
    const {
      mobileNumber,
     
      rank,
      category,
      gender,
      homeState,
      examType
    } = req.body;

    // Validate examType is provided
    if (!examType) {
      return res.status(400).json({
        success: false,
        message: "Exam type is required",
      });
    }

    // const normalizedEmail = emailId.toLowerCase();
    const normalizedExamType = examType.toUpperCase();

    // Normalize category and gender to valid enum values
    const normalizedCategory = categoryMap[category] || "GENERAL";
    const normalizedGender = genderMap[gender] || "GENERAL";

    // Create the check history entry
    const checkEntry = {
      examType: normalizedExamType,
      rank,
      category: normalizedCategory,
       gender: normalizedGender,
      homeState,
      
      checkedAt: new Date(),
    };

    // Try to find existing user by email or mobile
    let existingUser = await UserData.findOne({
      $or: [ { mobileNumber }],
    });

    let isNewUser = false;
    let userData;

    if (existingUser) {
      // User exists - add new check to history
      existingUser.checkHistory.push(checkEntry);
      existingUser.totalChecks += 1;

      // Add exam to examsChecked if not already present
      if (!existingUser.examsChecked.includes(normalizedExamType)) {
        existingUser.examsChecked.push(normalizedExamType);
      }

      // Update name if different (user might have corrected it)
      // existingUser.firstName = firstName.trim();
      // existingUser.lastName = lastName.trim();

      userData = await existingUser.save();

      logger.info(`Check history added for user: ${userData.emailId}, exam: ${normalizedExamType}, total checks: ${userData.totalChecks}`);
    } else {
      // New user - create with first check
      isNewUser = true;
      userData = await UserData.create({
        // firstName: firstName.trim(),
        // lastName: lastName.trim(),
        mobileNumber,
        // emailId: normalizedEmail,
        checkHistory: [checkEntry],
        totalChecks: 1,
        examsChecked: [normalizedExamType],
      });

      logger.info(`New user created: ${userData.emailId} for ${normalizedExamType}`);
    }

    res.status(201).json({
      success: true,
      message: isNewUser
        ? "User data created successfully"
        : `Prediction check recorded. This is check #${userData.totalChecks} for this user.`,
      data: userData,
      isNewUser,
      totalChecks: userData.totalChecks,
    });
  } catch (error) {
    logger.error("Create user data error", {
      message: error.message,
      stack: error.stack,
      email: req.body?.emailId,
    });

    if (error.code === 11000) {
      // Handle race condition where user was created between findOne and create
      return res.status(400).json({
        success: false,
        message: "User data conflict. Please try again.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to create user data",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const getUserData = async (req, res) => {
  try {
    const { id } = req.params;

    const userData = await UserData.findById(id);

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: "User data not found",
      });
    }

    res.status(200).json({
      success: true,
      data: userData,
    });
  } catch (error) {
    logger.error("Get user data error", {
      message: error.message,
      userId: req.params?.id,
    });

    res.status(500).json({
      success: false,
      message: "Failed to get user data",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const getAllUserData = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      examType, 
      minChecks, 
      maxChecks,
      fromDate,
      toDate,
      isNegativeResponse,
      isPositiveResponse,
      isDataExport,
      search
    } = req.query;


    console.log(req.query)

    const filter = {};

    // Filter by exam type (users who have checked this exam at least once)
    if (examType) {
      filter.examsChecked = examType.toUpperCase();
    }

    // Filter by total check count
    if (minChecks || maxChecks) {
      filter.totalChecks = {};
      if (minChecks) filter.totalChecks.$gte = parseInt(minChecks);
      if (maxChecks) filter.totalChecks.$lte = parseInt(maxChecks);
    }

    // Filter by date range
    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate);
      if (toDate) filter.createdAt.$lte = new Date(toDate + 'T23:59:59.999Z'); // End of day
    }

    // Filter by boolean fields
    if (isNegativeResponse !== undefined) {
      filter.isNegativeResponse = isNegativeResponse === 'true';
    }
    if (isPositiveResponse !== undefined) {
      filter.isPositiveResponse = isPositiveResponse === 'true';
    }
    if (isDataExport !== undefined) {
      filter.isDataExport = isDataExport === 'true';
    }

    // Search filter
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { emailId: searchRegex },
        { mobileNumber: searchRegex }
      ];
    }

    const userData = await UserData.find(filter)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .sort({ createdAt: -1 });

    const count = await UserData.countDocuments(filter);

    // Get stats for dashboard
    const stats = await UserData.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          totalChecks: { $sum: "$totalChecks" },
          avgChecksPerUser: { $avg: "$totalChecks" },
        }
      }
    ]);

    // Get exam-wise breakdown
    const examStats = await UserData.aggregate([
      { $unwind: "$examsChecked" },
      {
        $group: {
          _id: "$examsChecked",
          userCount: { $sum: 1 }
        }
      },
      { $sort: { userCount: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: userData,
      totalPages: Math.ceil(count / parseInt(limit)),
      currentPage: parseInt(page),
      totalRecords: count,
      stats: stats[0] || { totalUsers: 0, totalChecks: 0, avgChecksPerUser: 0 },
      examStats,
    });
  } catch (error) {
    logger.error("Get all user data error", {
      message: error.message,
    });

    res.status(500).json({
      success: false,
      message: "Failed to get user data",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const updateUserData = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      emailId,
      isNegativeResponse,
      isPositiveResponse,
      isCheckData,
    } = req.body;

    const userData = await UserData.findByIdAndUpdate(
      id,
      {
        firstName,
        lastName,
        emailId,
        isNegativeResponse,
        isPositiveResponse,
        isCheckData,
      },
      { new: true, runValidators: true }
    );

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: "User data not found",
      });
    }

    logger.info(`User data updated: ${userData.emailId}`);

    res.status(200).json({
      success: true,
      message: "User data updated successfully",
      data: userData,
    });
  } catch (error) {
    logger.error("Update user data error", {
      message: error.message,
      userId: req.params?.id,
    });

    res.status(500).json({
      success: false,
      message: "Failed to update user data",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};



const updateUserByAdminOrAssistance = async (req, res) => {
  try {
    const { id } = req.params;

    let {
      isNegativeResponse,
      isPositiveResponse,
      isCheckData,
      isDataExport,
    } = req.body;

    // 🔐 ROLE CHECK
    if (
      req.user.role !== "ADMIN" &&
      req.user.role !== "ASSISTANCE"
    ) {
      return res.status(403).json({
        success: false,
        message: "Only Admin or Assistance can update user data",
      });
    }

    // 🧠 FORCE BOOLEAN CONVERSION (KEY FIX 🔥)
    const toBoolean = (val) =>
      val === true || val === "true";

    const updateFields = {};

    if (isNegativeResponse !== undefined) {
      updateFields.isNegativeResponse = toBoolean(isNegativeResponse);
    }

    if (isPositiveResponse !== undefined) {
      updateFields.isPositiveResponse = toBoolean(isPositiveResponse);
    }

    if (isCheckData !== undefined) {
      updateFields.isCheckData = toBoolean(isCheckData);
    }

    if (isDataExport !== undefined) {
      updateFields.isDataExport = toBoolean(isDataExport); // ✅ WILL WORK NOW
    }

    // ❗ Business rule
    if (updateFields.isPositiveResponse === true) {
      updateFields.isNegativeResponse = false;
    }
    if (updateFields.isNegativeResponse === true) {
      updateFields.isPositiveResponse = false;
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
    }

    const updatedUser = await UserData.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};






const deleteUserData = async (req, res) => {
  try {
    const { id } = req.params;

    const userData = await UserData.findByIdAndDelete(id);

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: "User data not found",
      });
    }

    logger.info(`User data deleted: ${userData.emailId}`);

    res.status(200).json({
      success: true,
      message: "User data deleted successfully",
    });
  } catch (error) {
    logger.error("Delete user data error", {
      message: error.message,
      userId: req.params?.id,
    });

    res.status(500).json({
      success: false,
      message: "Failed to delete user data",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  createUserData,
  getUserData,
  getAllUserData,
  updateUserData,
  deleteUserData,
  updateUserByAdminOrAssistance
};
