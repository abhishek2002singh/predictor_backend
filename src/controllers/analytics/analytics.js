const UserData = require('../../model/userData/user');
const Cutoff = require('../../model/uploadData/Cutoff');
const logger = require("../../config/logger");
const User = require("../../model/auth/auth");



exports.analyticsUserData = async (req, res) => {
    try {

        const [
            totalUsers,
            activeUsers,
            newUsersThisWeek,
            todayNewUsers,
            usersByGender,
            usersByState
        ] = await Promise.all([
            // Total users
            UserData.countDocuments(),

            // Active users
            UserData.countDocuments({ role: "USER", isActive: true }),

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

            // Users by gender
            UserData.aggregate([
                { $match: { gender: { $exists: true, $ne: null } } },
                { $group: { _id: "$gender", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]),

            // Top states by user count
            UserData.aggregate([
                { $match: { state: { $exists: true, $ne: null } } },
                { $group: { _id: "$state", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 } // Top 10 states only
            ])
        ]);

        // Calculate inactive users (avoid negative values)
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

        // User distribution by age group (if age field exists)
        const usersByAgeGroup = await UserData.aggregate([
            { $match: { age: { $exists: true, $ne: null } } },
            {
                $bucket: {
                    groupBy: "$age",
                    boundaries: [0, 18, 25, 35, 45, 55, 100],
                    default: "Other",
                    output: {
                        count: { $sum: 1 },
                        avgAge: { $avg: "$age" }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Device/browser stats (if available)
        const userDeviceStats = await UserData.aggregate([
            { $match: { deviceType: { $exists: true, $ne: null } } },
            { $group: { _id: "$deviceType", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Response time calculation
        const startTime = Date.now();

        // Prepare response data
        const analyticsData = {
            summary: {
                totalUsers,
                activeUsers,
                inactiveUsers,
                todayNewUsers,
                newUsersThisWeek,
                growthRate: `${growthRate}%`,
                lastUpdated: new Date().toISOString()
            },
            trends: {
                dailyGrowth,
                weekOverWeekGrowth: {
                    previousWeek: previousWeekUsers,
                    currentWeek: currentWeekUsers,
                    percentageChange: parseFloat(growthRate)
                }
            },
            demographics: {
                byGender: usersByGender,
                byState: usersByState,
                byAgeGroup: usersByAgeGroup
            },
            technical: {
                deviceStats: userDeviceStats,
                queryTime: `${Date.now() - startTime}ms`
            }
        };

        // Set cache headers for better performance
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes cache
        res.setHeader('X-Query-Time', `${Date.now() - startTime}ms`);

        res.status(200).json({
            success: true,
            message: "User analytics fetched successfully",
            data: analyticsData,
            meta: {
                generatedAt: new Date().toISOString(),
                dataPoints: totalUsers,
                performance: {
                    queryTime: `${Date.now() - startTime}ms`,
                    queriesExecuted: 9
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

        // Different error types for different scenarios
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

        const [
            totalAssistants,
            activeAssistants,
            inactiveAssistants
        ] = await Promise.all([
            User.countDocuments({ role: "ASSISTANT" }),

            User.countDocuments({ role: "ASSISTANT", isActive: true }),

            User.countDocuments({ role: "ASSISTANT", isActive: false })
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