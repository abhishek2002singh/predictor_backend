const UserData = require("../../model/userData/user");
const logger = require("../../config/logger");



const createUserData = async (req, res) => {
  try {
    const {
      firstName,
      emailId,
      mobileNumber,
      rank,
      homeState,
      examType,
      city
    } = req.body;

    // Validate examType is provided
    if (!examType) {
      return res.status(400).json({
        success: false,
        message: "Exam type is required",
      });
    }

    const normalizedExamType = examType.toUpperCase();

    // Create the check history entry
    const checkEntry = {
      examType: normalizedExamType,
      rank,
      checkedAt: new Date(),
      gainLeedFrom: "FROM_STUDENT_RANK" 
    };

    // Try to find existing user by mobile
    let existingUser = await UserData.findOne({ mobileNumber });

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

      

      // ✅ CRITICAL: Reset isDataExport to false for new data
      // This marks that there's new data to be exported
      existingUser.isDataExport = false;

      userData = await existingUser.save();

      logger.info(`Check history added for user: ${existingUser.mobileNumber}, exam: ${normalizedExamType}, total checks: ${userData.totalChecks}, isDataExport reset to: ${userData.isDataExport}`);
    } else {
      // New user - create with first check
      isNewUser = true;
      userData = await UserData.create({
        mobileNumber,
        checkHistory: [checkEntry],
        totalChecks: 1,
        firstName,
        emailId,
         city,
         homeState,
        examsChecked: [normalizedExamType],
       
        // New users start with isDataExport = false (default)
        isDataExport: false,
      });

      logger.info(`New user created: ${userData.mobileNumber} for ${normalizedExamType}`);
    }

    res.status(201).json({
      success: true,
      message: isNewUser
        ? "User data created successfully"
        : `Prediction check recorded. This is check #${userData.totalChecks} for this user.`,
      data: userData,
      isNewUser,
      totalChecks: userData.totalChecks,
      isDataExport: userData.isDataExport,
    });
  } catch (error) {
    logger.error("Create user data error", {
      message: error.message,
      stack: error.stack,
      mobileNumber: req.body?.mobileNumber,
    });

    if (error.code === 11000) {
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

    // Get comprehensive stats for dashboard
    const stats = await UserData.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          totalChecks: { $sum: "$totalChecks" },
          avgChecksPerUser: { $avg: "$totalChecks" },
          totalExportedData: { 
            $sum: { 
              $cond: [{ $eq: ["$isDataExport", true] }, 1, 0] 
            } 
          },
          totalUnexportedData: { 
            $sum: { 
              $cond: [
                { $or: [
                  { $eq: ["$isDataExport", false] },
                  { $eq: ["$isDataExport", null] },
                  { $eq: ["$isDataExport", undefined] }
                ]}, 
                1, 
                0 
              ] 
            } 
          },
          totalNegativeResponses: { 
            $sum: { 
              $cond: [{ $eq: ["$isNegativeResponse", true] }, 1, 0] 
            } 
          },
          totalPositiveResponses: { 
            $sum: { 
              $cond: [{ $eq: ["$isPositiveResponse", true] }, 1, 0] 
            } 
          }
        }
      }
    ]);

    // Get exam-wise breakdown
    const examStats = await UserData.aggregate([
      { $unwind: "$examsChecked" },
      {
        $group: {
          _id: "$examsChecked",
          userCount: { $sum: 1 },
          checksCount: { $sum: "$totalChecks" }
        }
      },
      { $sort: { userCount: -1 } }
    ]);

    // Get export status breakdown
    const exportStats = await UserData.aggregate([
      {
        $group: {
          _id: {
            $cond: {
              if: { $eq: ["$isDataExport", true] },
              then: "Exported",
              else: "Not Exported"
            }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    const statsResult = stats[0] || { 
      totalUsers: 0, 
      totalChecks: 0, 
      avgChecksPerUser: 0,
      totalExportedData: 0,
      totalUnexportedData: 0,
      totalNegativeResponses: 0,
      totalPositiveResponses: 0
    };

    // Calculate percentages for better insights
    const enhancedStats = {
      ...statsResult,
      exportPercentage: statsResult.totalUsers > 0 
        ? Math.round((statsResult.totalExportedData / statsResult.totalUsers) * 100) 
        : 0,
      negativeResponsePercentage: statsResult.totalUsers > 0 
        ? Math.round((statsResult.totalNegativeResponses / statsResult.totalUsers) * 100) 
        : 0,
      positiveResponsePercentage: statsResult.totalUsers > 0 
        ? Math.round((statsResult.totalPositiveResponses / statsResult.totalUsers) * 100) 
        : 0,
    };

    res.status(200).json({
      success: true,
      data: userData,
      totalPages: Math.ceil(count / parseInt(limit)),
      currentPage: parseInt(page),
      totalRecords: count,
      stats: enhancedStats,
      examStats,
      exportStats,
      filters: {
        examType,
        minChecks,
        maxChecks,
        fromDate,
        toDate,
        isNegativeResponse,
        isPositiveResponse,
        isDataExport,
        search
      }
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


// In your export function (backend):
// Add this function BEFORE the exportUserData function
// Add this function BEFORE the exportUserData function
// Add this function BEFORE the exportUserData function
// Add this function BEFORE the exportUserData function
const generateCSVContentUpdated = (users, examType = null) => {
  const headers = [
    'first Name','city', 'Mobile Number', 'Exam Type', 'Email ID',  
    'Home State'
  ];

  const rows = users.flatMap(user => {
    // If specific exam type is provided, filter checkHistory
    let checksToInclude = user.checkHistory;
    
    if (examType) {
      checksToInclude = user.checkHistory.filter(check => 
        check.examType === examType
      );
    }
    
    // If no matching checks, skip this user
    if (checksToInclude.length === 0) {
      return [];
    }
    
    return checksToInclude.map(check => [
      user.firstName,
      user.city,
      user.mobileNumber,
      check.examType,
      user.emailId,
      user.homeState,
      
    ].join(','));
  });

  // If no rows, return empty string
  if (rows.length === 0) {
    return '';
  }

  return [headers.join(','), ...rows].join('\n');
};

const exportUserData = async (req, res) => {
  try {
    // Get examType from request BODY (POST request)
    const { examType } = req.body;
    
    console.log(`Export request for exam type: "${examType || 'ALL'}"`);
    console.log('Full request body:', req.body);
    
    // If examType is "ALL" or empty string, treat as null (export all exams)
    const effectiveExamType = (examType === "ALL" || examType === "") ? null : examType;
    console.log(`Effective exam type: ${effectiveExamType || 'ALL'}`);
    
    // Build query based on isDataExport flag at user level
    let query = { isDataExport: { $ne: true } }; // Users not yet exported
    
    // If specific exam type, we need a more complex query
    if (effectiveExamType) {
      query = {
        $and: [
          { isDataExport: { $ne: true } }, // Not exported
          { "examsChecked": effectiveExamType } // Has this exam type
        ]
      };
    }
    
    // Get users with unexported data
    const usersToExport = await UserData.find(query);
    console.log(`Found ${usersToExport.length} users with unexported data`);
    
    if (usersToExport.length === 0) {
      console.log('No unexported data found');
      return res.status(200).json({
        success: true,
        message: "No new data to export",
        exportedCount: 0
      });
    }

    // Generate CSV content
    const csvContent = generateCSVContentUpdated(usersToExport, effectiveExamType);
    
    if (!csvContent || csvContent.trim() === '') {
      console.log('Generated CSV is empty');
      return res.status(200).json({
        success: true,
        message: "No new data to export",
        exportedCount: 0
      });
    }
    
    console.log(`Generated CSV with ${csvContent.split('\n').length - 1} data rows`);

    // Update database: Mark user as exported
    const userIds = usersToExport.map(user => user._id);
    await UserData.updateMany(
      { _id: { $in: userIds } },
      { $set: { isDataExport: true } }
    );

    logger.info(`Exported ${usersToExport.length} users for exam: ${effectiveExamType || 'all'}`);

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    const filename = effectiveExamType 
      ? `user-data-export-${effectiveExamType}-${new Date().toISOString().split('T')[0]}.csv`
      : `user-data-export-all-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    
    // Send CSV content
    res.send(csvContent);

  } catch (error) {
    logger.error("Export user data error", error);
    console.error('Export error details:', error);
    res.status(500).json({
      success: false,
      message: "Failed to export user data",
      error: error.message
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
  updateUserByAdminOrAssistance,
  exportUserData
};
