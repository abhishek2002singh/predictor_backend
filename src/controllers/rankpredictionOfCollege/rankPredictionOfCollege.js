

const logger = require("../../config/logger");
const Cutoff = require('../../model/uploadData/Cutoff');
const UserData = require("../../model/userData/user");

exports.rankPredictionOfCollege = async (req, res) => {
  try {
    console.log("Rank prediction API called");
    
    const { 
      institute, 
      CounselingType,
      // Filter parameters
      gender,
      seatType,
      category,
      quota,
      year,
      round,
      // Pagination
      page = 1,
      limit = 20,
      // Sorting
      sortBy = 'year',
      sortOrder = 'desc'
    } = req.body;

    console.log("Request body:", req.body);

    if (!institute || !CounselingType) {
      return res.status(400).json({
        success: false,
        message: "Please provide institute name and counseling type",
      });
    }

    // Currently only JoSAA supported
    if (CounselingType !== "JOSAA") {
      return res.status(400).json({
        success: false,
        message: "Only JoSAA counseling is supported currently",
      });
    }

    // Build query filter
    const queryFilter = {
      institute: { $regex: `^${institute}$`, $options: "i" },
    };

    // Add optional filters
    if (gender && gender !== 'all') {
      queryFilter.gender = { $regex: `^${gender}$`, $options: "i" };
    }
    
    if (seatType && seatType !== 'all') {
      queryFilter.seatType = { $regex: `^${seatType}$`, $options: "i" };
    }
    
    if (category && category !== 'all') {
      queryFilter.category = { $regex: `^${category}$`, $options: "i" };
    }
    
    if (quota && quota !== 'all') {
      queryFilter.quota = { $regex: `^${quota}$`, $options: "i" };
    }
    
    if (year && year !== 'all') {
      queryFilter.year = parseInt(year);
    }
    
    if (round && round !== 'all') {
      queryFilter.round = parseInt(round);
    }

    console.log("Query filter:", queryFilter);

    // Define sort order
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    
    // Define sorting based on sortBy parameter
    let sortOptions = {};
    switch(sortBy) {
      case 'year':
        sortOptions = { year: sortDirection, round: -1 };
        break;
      case 'openingRank':
        sortOptions = { openingRank: sortDirection, year: -1 };
        break;
      case 'closingRank':
        sortOptions = { closingRank: sortDirection, year: -1 };
        break;
      case 'round':
        sortOptions = { round: sortDirection, year: -1 };
        break;
      default:
        sortOptions = { year: -1, round: -1 };
    }

    // Get total count for pagination
    const totalCount = await Cutoff.countDocuments(queryFilter);
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    const totalPages = Math.ceil(totalCount / limit);

    // Fetch data with pagination
    const cutoffData = await Cutoff.find(queryFilter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    if (!cutoffData || cutoffData.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No cutoff data found for this institute with the given filters",
      });
    }

    // Basic rank range calculation
    const openingRanks = cutoffData.map(d => d.openingRank).filter(rank => rank);
    const closingRanks = cutoffData.map(d => d.closingRank).filter(rank => rank);

    // Get unique values for filters (for frontend dropdowns)
    const uniqueFilters = await Cutoff.aggregate([
      { $match: { institute: { $regex: `^${institute}$`, $options: "i" } } },
      {
        $group: {
          _id: null,
          genders: { $addToSet: "$gender" },
          seatTypes: { $addToSet: "$seatType" },
          categories: { $addToSet: "$category" },
          quotas: { $addToSet: "$quota" },
          years: { $addToSet: "$year" },
          rounds: { $addToSet: "$round" }
        }
      }
    ]);

    const filters = uniqueFilters[0] || {
      genders: [],
      seatTypes: [],
      categories: [],
      quotas: [],
      years: [],
      rounds: []
    };

    // Get statistics for each category
    const categoryStats = await Cutoff.aggregate([
      { $match: queryFilter },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          avgOpeningRank: { $avg: "$openingRank" },
          avgClosingRank: { $avg: "$closingRank" },
          minOpeningRank: { $min: "$openingRank" },
          maxClosingRank: { $max: "$closingRank" }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const genderStats = await Cutoff.aggregate([
      { $match: queryFilter },
      {
        $group: {
          _id: "$gender",
          count: { $sum: 1 },
          avgOpeningRank: { $avg: "$openingRank" },
          avgClosingRank: { $avg: "$closingRank" }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const seatTypeStats = await Cutoff.aggregate([
      { $match: queryFilter },
      {
        $group: {
          _id: "$seatType",
          count: { $sum: 1 },
          avgOpeningRank: { $avg: "$openingRank" },
          avgClosingRank: { $avg: "$closingRank" }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const yearWiseStats = await Cutoff.aggregate([
      { $match: queryFilter },
      {
        $group: {
          _id: "$year",
          count: { $sum: 1 },
          avgOpeningRank: { $avg: "$openingRank" },
          avgClosingRank: { $avg: "$closingRank" },
          rounds: { $addToSet: "$round" }
        }
      },
      { $sort: { _id: -1 } }
    ]);

    const response = {
      institute,
      counseling: "JoSAA",
      totalRecords: totalCount,
      currentPage: parseInt(page),
      totalPages,
      limit: parseInt(limit),
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      rankRange: {
        bestOpeningRank: openingRanks.length > 0 ? Math.min(...openingRanks) : null,
        worstClosingRank: closingRanks.length > 0 ? Math.max(...closingRanks) : null,
        averageOpeningRank: openingRanks.length > 0 ? 
          Math.round(openingRanks.reduce((a, b) => a + b, 0) / openingRanks.length) : null,
        averageClosingRank: closingRanks.length > 0 ? 
          Math.round(closingRanks.reduce((a, b) => a + b, 0) / closingRanks.length) : null,
      },
      filters: {
        genders: filters.genders.filter(g => g).sort(),
        seatTypes: filters.seatTypes.filter(s => s).sort(),
        categories: filters.categories.filter(c => c).sort(),
        quotas: filters.quotas.filter(q => q).sort(),
        years: filters.years.filter(y => y).sort((a, b) => b - a),
        rounds: filters.rounds.filter(r => r).sort((a, b) => b - a),
      },
      statistics: {
        byCategory: categoryStats,
        byGender: genderStats,
        bySeatType: seatTypeStats,
        byYear: yearWiseStats,
      },
      appliedFilters: {
        gender: gender || 'all',
        seatType: seatType || 'all',
        category: category || 'all',
        quota: quota || 'all',
        year: year || 'all',
        round: round || 'all',
        sortBy,
        sortOrder
      },
      data: cutoffData,
    };

    return res.status(200).json({
      success: true,
      message: "Rank prediction data fetched successfully",
      result: response,
    });

  } catch (error) {
    logger.error("Rank Prediction Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Helper function to get all available filter options
exports.getFilterOptions = async (req, res) => {
  try {
    const { institute } = req.query;

    if (!institute) {
      return res.status(400).json({
        success: false,
        message: "Institute name is required",
      });
    }

    const filters = await Cutoff.aggregate([
      { $match: { institute: { $regex: `^${institute}$`, $options: "i" } } },
      {
        $group: {
          _id: null,
          genders: { $addToSet: "$gender" },
          seatTypes: { $addToSet: "$seatType" },
          categories: { $addToSet: "$category" },
          quotas: { $addToSet: "$quota" },
          years: { $addToSet: "$year" },
          rounds: { $addToSet: "$round" }
        }
      }
    ]);

    if (!filters || filters.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No data found for this institute",
      });
    }

    const response = {
      institute,
      filters: {
        genders: filters[0].genders.filter(g => g).sort(),
        seatTypes: filters[0].seatTypes.filter(s => s).sort(),
        categories: filters[0].categories.filter(c => c).sort(),
        quotas: filters[0].quotas.filter(q => q).sort(),
        years: filters[0].years.filter(y => y).sort((a, b) => b - a),
        rounds: filters[0].rounds.filter(r => r).sort((a, b) => b - a),
      }
    };

    return res.status(200).json({
      success: true,
      message: "Filter options fetched successfully",
      result: response,
    });

  } catch (error) {
    logger.error("Get Filter Options Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.userDetailsFromRankPredictions = async (req, res) => {
  try {
    const { mobileNumber, firstName,lastName, emailId } = req.body;

    // ✅ Validation
    if (!mobileNumber || !firstName || !emailId || !lastName) {
      return res.status(400).json({
        success: false,
        message: "Please fill all required fields correctly",
      });
    }

      const checkEntry = {
      mobileNumber,
       firstName,
       lastName,
        emailId,
        gainLeedFrom :"FROM_COLLEGE_SEARCH"
        
    };

    // ✅ Check if user already exists
    const existingUser = await UserData.findOne({ mobileNumber });

    if (existingUser) {

       existingUser.checkHistory.push(checkEntry);
      existingUser.totalChecks += 1;
      // ❌ Do NOT create new entry
      return res.status(200).json({
        success: true,
        message: "User already exists",
        data: existingUser,
        isNewUser: false,
      });
    }

  

    // ✅ Create NEW user if mobile not found
    const userData = await UserData.create({
      mobileNumber,
      firstName,
      lastName,
      emailId,
      checkHistory: [checkEntry],
      totalChecks: 1,
      isDataExport: false,
    });

    logger.info(`New user created for mobile: ${mobileNumber}`);

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: userData,
      isNewUser: true,
      totalChecks: 1,
      isDataExport: false,
    });
  } catch (error) {
    logger.error("Create user data error", {
      message: error.message,
      stack: error.stack,
      mobileNumber: req.body?.mobileNumber,
    });

    return res.status(500).json({
      success: false,
      message: "Failed to create user data",
    });
  }
};

