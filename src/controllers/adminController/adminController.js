
const User = require("../../model/auth/auth");
const UserData = require("../../model/userData/user");

const logger = require("../../config/logger");



exports.allAdmin =  async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;

        const query = {
            role: "ADMIN",
        };


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
};
