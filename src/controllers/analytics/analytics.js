const UserData = require('../../model/userData/user');
const Cutoff = require('../../model/uploadData/Cutoff');
const logger = require("../../config/logger");
const User = require("../../model/auth/auth");



exports.analyticsUserData = async (req, res) => {
    try {
        const startTime = Date.now();

        const [
            totalUsers,
            activeUsers,
            newUsersThisWeek,
            todayNewUsers,
            usersByGender,
            usersByState,
            usersByExamType,
            totalChecks
        ] = await Promise.all([
            // Total users
            UserData.countDocuments(),

            // Active users (assuming all are active since no isActive field)
            UserData.countDocuments(), // Or you can add isActive field if needed

            // Users registered in last 7 days
            (async () => {
                const lastWeek = new Date();
                lastWeek.setDate(lastWeek.getDate() - 7);
                return UserData.countDocuments({
                    createdAt: { $gte: lastWeek }
                });
            })(),

            // Users registered today
            (async () => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return UserData.countDocuments({
                    createdAt: { $gte: today }
                });
            })(),

            // Users by gender (from checkHistory)
            UserData.aggregate([
                { $unwind: "$checkHistory" },
                { $match: { "checkHistory.gender": { $exists: true, $ne: null } } },
                { $group: { _id: "$checkHistory.gender", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),

            // Top states by user count (from checkHistory)
            UserData.aggregate([
                { $unwind: "$checkHistory" },
                { $match: { "checkHistory.homeState": { $exists: true, $ne: null } } },
                { $group: { _id: "$checkHistory.homeState", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]),

            // Users by exam type
            UserData.aggregate([
                { $unwind: "$checkHistory" },
                { $match: { "checkHistory.examType": { $exists: true, $ne: null } } },
                { $group: { _id: "$checkHistory.examType", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),

            // Total checks across all users
            UserData.aggregate([
                {
                    $group: {
                        _id: null,
                        totalChecks: { $sum: "$totalChecks" },
                        avgChecksPerUser: { $avg: "$totalChecks" },
                        maxChecks: { $max: "$totalChecks" },
                        minChecks: { $min: "$totalChecks" }
                    }
                }
            ])
        ]);

        // Calculate inactive users (if you have isActive field, otherwise set to 0)
        const inactiveUsers = Math.max(0, totalUsers - activeUsers);

        // Daily user growth for last 30 days
        const dailyGrowth = await UserData.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(new Date().setDate(new Date().getDate() - 30))
                    }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$createdAt" },
                        month: { $month: "$createdAt" },
                        day: { $dayOfMonth: "$createdAt" }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    date: {
                        $dateFromParts: {
                            year: "$_id.year",
                            month: "$_id.month",
                            day: "$_id.day"
                        }
                    },
                    count: 1
                }
            },
            { $sort: { date: 1 } }
        ]);

        // User growth rate (percentage increase from previous week)
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        const lastWeekStart = new Date();
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);

        const [previousWeekUsers, currentWeekUsers] = await Promise.all([
            UserData.countDocuments({
                createdAt: { $gte: twoWeeksAgo, $lt: lastWeekStart }
            }),
            UserData.countDocuments({
                createdAt: { $gte: lastWeekStart }
            })
        ]);

        const growthRate = previousWeekUsers > 0
            ? ((currentWeekUsers - previousWeekUsers) / previousWeekUsers * 100).toFixed(2)
            : currentWeekUsers > 0 ? 100 : 0;

        // Check frequency analysis
        const checkFrequency = await UserData.aggregate([
            {
                $bucket: {
                    groupBy: "$totalChecks",
                    boundaries: [0, 1, 2, 5, 10, 20, 50],
                    default: "50+",
                    output: {
                        count: { $sum: 1 },
                        users: { $push: "$mobileNumber" }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Category distribution (from checkHistory)
        const usersByCategory = await UserData.aggregate([
            { $unwind: "$checkHistory" },
            { $match: { "checkHistory.category": { $exists: true, $ne: null } } },
            { $group: { _id: "$checkHistory.category", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Response analysis
        const responseAnalysis = await UserData.aggregate([
            {
                $group: {
                    _id: null,
                    totalUsers: { $sum: 1 },
                    positiveResponses: { $sum: { $cond: ["$isPositiveResponse", 1, 0] } },
                    negativeResponses: { $sum: { $cond: ["$isNegativeResponse", 1, 0] } },
                    hasCheckData: { $sum: { $cond: ["$isCheckData", 1, 0] } }
                }
            }
        ]);

        // Recent checks (last 7 days)
        const recentChecks = await UserData.aggregate([
            { $unwind: "$checkHistory" },
            {
                $match: {
                    "checkHistory.checkedAt": {
                        $gte: new Date(new Date().setDate(new Date().getDate() - 7))
                    }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: "$checkHistory.checkedAt" },
                        month: { $month: "$checkHistory.checkedAt" },
                        day: { $dayOfMonth: "$checkHistory.checkedAt" }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    date: {
                        $dateFromParts: {
                            year: "$_id.year",
                            month: "$_id.month",
                            day: "$_id.day"
                        }
                    },
                    count: 1
                }
            },
            { $sort: { date: 1 } }
        ]);

        const queryTime = Date.now() - startTime;

        // Prepare response data
        const analyticsData = {
            summary: {
                totalUsers,
                activeUsers,
                inactiveUsers,
                todayNewUsers,
                newUsersThisWeek,
                growthRate: `${growthRate}%`,
                totalChecks: totalChecks[0]?.totalChecks || 0,
                avgChecksPerUser: (totalChecks[0]?.avgChecksPerUser || 0).toFixed(2),
                lastUpdated: new Date().toISOString()
            },
            trends: {
                dailyGrowth,
                recentChecks,
                weekOverWeekGrowth: {
                    previousWeek: previousWeekUsers,
                    currentWeek: currentWeekUsers,
                    percentageChange: parseFloat(growthRate)
                }
            },
            demographics: {
                byGender: usersByGender,
                byState: usersByState,
                byCategory: usersByCategory,
                byExamType: usersByExamType
            },
            usage: {
                checkFrequency,
                responseAnalysis: responseAnalysis[0] || {},
                maxChecks: totalChecks[0]?.maxChecks || 0,
                minChecks: totalChecks[0]?.minChecks || 0
            },
            performance: {
                queryTime: `${queryTime}ms`,
                dataPoints: totalUsers
            }
        };

        // Set cache headers
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.setHeader('X-Query-Time', `${queryTime}ms`);

        res.status(200).json({
            success: true,
            message: "User analytics fetched successfully",
            data: analyticsData,
            meta: {
                generatedAt: new Date().toISOString(),
                dataPoints: totalUsers,
                performance: {
                    queryTime: `${queryTime}ms`,
                    queriesExecuted: 12
                }
            }
        });

    } catch (err) {
        logger.error("Get stats error", { message: err.message });
        console.error("Analytics User Data Error:", {
            message: err.message,
            stack: err.stack,
            timestamp: new Date().toISOString()
        });

        if (err.name === 'MongoError') {
            return res.status(503).json({
                success: false,
                message: "Database connection error",
                suggestion: "Please try again in a few moments"
            });
        }

        if (err.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: "Data validation error",
                errors: err.errors
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to fetch user analytics",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
};

exports.uploadDataAnalytics = async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin privileges required"
            });
        }
        const [
            totalCutoffEntries,
            yearWiseUpload,
            yearWiseRoundAnalytics
        ] = await Promise.all([

            // Total uploaded cutoff rows
            Cutoff.countDocuments(),

            // Year-wise total entries (Line / Bar Chart)
            Cutoff.aggregate([
                {
                    $group: {
                        _id: "$year",
                        totalEntries: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),

            // Year + Round analytics (Stacked Bar Chart)
            Cutoff.aggregate([
                {
                    $group: {
                        _id: {
                            year: "$year",
                            round: "$round"
                        },
                        count: { $sum: 1 }
                    }
                },
                {
                    $group: {
                        _id: "$_id.year",
                        rounds: {
                            $push: {
                                round: "$_id.round",
                                count: "$count"
                            }
                        },
                        totalEntries: { $sum: "$count" }
                    }
                },
                { $sort: { _id: 1 } }
            ])
        ]);

        return res.status(200).json({
            success: true,
            message: "Upload analytics fetched successfully",
            data: {
                totalCutoffEntries,
                yearWiseUpload,
                yearWiseRoundAnalytics
            }
        });

    } catch (error) {
        console.error("Upload Analytics Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch upload analytics",
            error: error.message
        });
    }
};

exports.assistanceAnalysis = async (req, res) => {
    try {
        // Admin authorization check
        if (req.user.role !== "ADMIN") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin privileges required"
            });
        }

        console.log("check data")

        const [
            totalAssistants,
            activeAssistants,
            inactiveAssistants
        ] = await Promise.all([
            User.countDocuments({ role: "ASSISTANCE" }),

            User.countDocuments({ role: "ASSISTANCE", isActive: true }),

            User.countDocuments({ role: "ASSISTANCE", isActive: false })
        ]);

        return res.status(200).json({
            success: true,
            message: "Assistant analytics fetched successfully",
            data: {
                totalAssistants,
                activeAssistants,
                inactiveAssistants
            }
        });

    } catch (error) {
        console.error("Assistant Analytics Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch assistant analytics",
            error: error.message
        });
    }
};


exports.allAdminAnalysis = async (req, res) => {
    try {
        if (req.user.role !== "ADMIN") {
            return res.status(403).json({
                success: false,
                message: "Access denied. Admin privileges required"
            });
        }

        const [
            totalAssistants,
            activeAssistants,
            inactiveAssistants
        ] = await Promise.all([
            User.countDocuments({ role: "ADMIN" }),

            User.countDocuments({ role: "ADMIN", isActive: true }),

            User.countDocuments({ role: "ADMINS", isActive: false })
        ]);

        return res.status(200).json({
            success: true,
            message: "Assistant analytics fetched successfully",
            data: {
                totalAssistants,
                activeAssistants,
                inactiveAssistants
            }
        });

    } catch (error) {
        console.error("Assistant Analytics Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch assistant analytics",
            error: error.message
        });
    }
}

exports.summaryData =  async (req, res) => {
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
}

