const logger = require("../../config/logger");
const Cutoff = require('../../model/uploadData/Cutoff');

exports.rankPredictionOfCollege = async (req, res) => {
  try {
    console.log("hello jii app kaise hai")
    const { institute, CounselingType } = req.body;
    console.log(req.body)

    console.log("reach here")

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

    // Case-insensitive institute match
    const cutoffData = await Cutoff.find({
      institute: { $regex: `^${institute}$`, $options: "i" },
    })
      .sort({ year: -1, round: -1 })
      .lean();

    if (!cutoffData || cutoffData.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No cutoff data found for this institute",
      });
    }

    // Basic rank range calculation
    const openingRanks = cutoffData.map(d => d.openingRank);
    const closingRanks = cutoffData.map(d => d.closingRank);

    const response = {
      institute,
      counseling: "JoSAA",
      totalRecords: cutoffData.length,
      rankRange: {
        bestOpeningRank: Math.min(...openingRanks),
        worstClosingRank: Math.max(...closingRanks),
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
    });
  }
};
