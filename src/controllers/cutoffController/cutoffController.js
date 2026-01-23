const Cutoff = require('../../model/uploadData/Cutoff');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const UserData = require("../../model/userData/user");
const logger = require("../../config/logger");


// Seat type to category mapping (same as in model)
const seatTypeToCategory = {
  'OPEN': 'GENERAL',
  'EWS': 'EWS',
  'OBC-NCL': 'OBC-NCL',
  'SC': 'SC',
  'ST': 'ST',
  'OPEN (PwD)': 'GENERAL-PwD',
  'OPEN-PwD': 'GENERAL-PwD',
  'EWS-PwD': 'EWS-PwD',
  'EWS (PwD)': 'EWS-PwD',
  'OBC-NCL-PwD': 'OBC-NCL-PwD',
  'OBC-NCL (PwD)': 'OBC-NCL-PwD',
  'SC-PwD': 'SC-PwD',
  'SC (PwD)': 'SC-PwD',
  'ST-PwD': 'ST-PwD',
  'ST (PwD)': 'ST-PwD'
};

// Helper functions
const getCategoryFromSeatType = (seatType) => {
  return seatTypeToCategory[seatType] || 'GENERAL';
};

const cleanSeatType = (seatType) => {
  if (!seatType) return 'OPEN';
  
  // Normalize common variations
  const normalized = seatType.trim().toUpperCase();
  
  if (normalized.includes('OPEN') && normalized.includes('PWD')) {
    return 'OPEN (PwD)';
  }
  if (normalized.includes('EWS') && normalized.includes('PWD')) {
    return 'EWS-PwD';
  }
  if (normalized.includes('OBC') && normalized.includes('PWD')) {
    return 'OBC-NCL-PwD';
  }
  if (normalized.includes('SC') && normalized.includes('PWD')) {
    return 'SC-PwD';
  }
  if (normalized.includes('ST') && normalized.includes('PWD')) {
    return 'ST-PwD';
  }
  
  // Map simple types
  const typeMap = {
    'OPEN': 'OPEN',
    'EWS': 'EWS', 
    'OBC-NCL': 'OBC-NCL',
    'SC': 'SC',
    'ST': 'ST',
    'OPEN (PWD)': 'OPEN (PwD)',
    'OPEN-PWD': 'OPEN (PwD)',
    'EWS-PWD': 'EWS-PwD',
    'EWS (PWD)': 'EWS-PwD',
    'OBC-NCL-PWD': 'OBC-NCL-PwD',
    'OBC-NCL (PWD)': 'OBC-NCL-PwD',
    'SC-PWD': 'SC-PwD',
    'SC (PWD)': 'SC-PwD',
    'ST-PWD': 'ST-PwD',
    'ST (PWD)': 'ST-PwD'
  };
  
  return typeMap[normalized] || seatType;
};

const cleanGender = (gender) => {
  if (!gender) return 'Gender-Neutral';
  
  const normalized = gender.trim().toLowerCase();
  
  if (normalized.includes('female')) {
    return 'Female-only (including Supernumerary)';
  }
  if (normalized.includes('male')) {
    return 'Male-only';
  }
  
  return 'Gender-Neutral';
};

const cleanRank = (rank) => {
  if (!rank && rank !== 0) return 999999;
  
  // Remove 'P' suffix and any non-numeric characters
  const cleaned = String(rank).replace(/[Pp\s]/g, '');
  const num = parseInt(cleaned);
  
  return isNaN(num) ? 999999 : num;
};

// SIMPLIFIED UPLOAD FUNCTION - Focus on getting it working first
exports.uploadCutoffCSV = async (req, res) => {
  let filePath = null;
  
  try {
    console.log('Upload request received');
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No CSV file uploaded'
      });
    }

    filePath = req.file.path;
    
    // Verify file exists
    if (!fs.existsSync(filePath)) {
      console.error('File does not exist at path:', filePath);
      return res.status(400).json({
        success: false,
        message: 'Uploaded file not found'
      });
    }

    const { year, round, typeOfExam } = req.body;
    
    // Validate inputs
    const parsedYear = parseInt(year) || new Date().getFullYear();
    const parsedRound = parseInt(round) || 1;
    
    if (parsedYear < 2015 || parsedYear > new Date().getFullYear() + 1) {
      return res.status(400).json({
        success: false,
        message: `Invalid year. Must be between 2015 and ${new Date().getFullYear() + 1}`
      });
    }
    
    if (parsedRound < 1 || parsedRound > 7) {
      return res.status(400).json({
        success: false,
        message: 'Invalid round. Must be between 1 and 7'
      });
    }

    console.log(`Starting CSV parsing for ${filePath}`);
    
    // Parse CSV
    const results = [];
    let rowCount = 0;
    let errorCount = 0;
    
    const parsePromise = new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          rowCount++;
          
          try {
            // Extract and clean data
            const seatType = cleanSeatType(row['Seat Type'] || row['Seat Type'] || 'OPEN');
            const category = getCategoryFromSeatType(seatType);
            
            const cleanedRow = {
              institute: (row.Institute || row.institute || '').toString().trim().slice(0, 500),
              academicProgramName: (row['Academic Program Name'] || 
                                   row.academicProgramName ||
                                   row.Program || 
                                   '').toString().trim().slice(0, 500),
              seatType: seatType,
              gender: cleanGender(row.Gender || row.gender || 'Gender-Neutral'),
              openingRank: cleanRank(row['Opening Rank'] || row.openingRank),
              closingRank: cleanRank(row['Closing Rank'] || row.closingRank),
              year: parsedYear,
              round: parsedRound,
              typeOfExam: row['Exam Type'] || row['typeOfExam'] || typeOfExam || 'JEE_MAINS',
              category: category,
              isPwd: seatType.includes('PwD')
            };
            
            // Add uploadedBy if available
            if (req.user && req.user.id) {
              cleanedRow.uploadedBy = req.user.id;
            }
            
            // Basic validation
            if (!cleanedRow.institute || !cleanedRow.academicProgramName) {
              console.warn(`Row ${rowCount} skipped - missing required fields`);
              errorCount++;
              return;
            }
            
            // Validate ranks
            if (cleanedRow.openingRank === 999999 || cleanedRow.closingRank === 999999) {
              console.warn(`Row ${rowCount} skipped - invalid ranks:`, {
                opening: row['Opening Rank'],
                closing: row['Closing Rank']
              });
              errorCount++;
              return;
            }
            
            // Ensure closing rank >= opening rank
            if (cleanedRow.closingRank < cleanedRow.openingRank) {
              // Swap if they're reversed
              [cleanedRow.openingRank, cleanedRow.closingRank] = 
              [cleanedRow.closingRank, cleanedRow.openingRank];
            }
            
            results.push(cleanedRow);
            
          } catch (rowError) {
            console.error(`Error processing row ${rowCount}:`, rowError);
            errorCount++;
          }
        })
        .on('end', () => {
          console.log(`CSV parsing completed. Total rows: ${rowCount}, Valid records: ${results.length}, Errors: ${errorCount}`);
          
          // Clean up file
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log('Temporary file cleaned up');
            }
          } catch (cleanupError) {
            console.warn('Could not delete temp file:', cleanupError.message);
          }
          
          resolve();
        })
        .on('error', (error) => {
          console.error('CSV parsing stream error:', error);
          reject(error);
        });
    });

    await parsePromise;
    
    if (results.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid data found in CSV',
        stats: {
          totalRows: rowCount,
          validRows: results.length,
          errorRows: errorCount
        }
      });
    }

    console.log(`Processing ${results.length} records...`);
    
    // Process in smaller batches to avoid memory issues
    const batchSize = 100;
    let insertedCount = 0;
    let modifiedCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(results.length/batchSize)}`);
      
      for (const record of batch) {
        try {
          // Find existing record
          const existing = await Cutoff.findOne({
            institute: record.institute,
            academicProgramName: record.academicProgramName,
            seatType: record.seatType,
            gender: record.gender,
            year: record.year,
            round: record.round
          });

          if (existing) {
            // Update existing
            existing.openingRank = record.openingRank;
            existing.closingRank = record.closingRank;
            existing.category = record.category;
            existing.isPwd = record.isPwd;
            await existing.save();
            modifiedCount++;
          } else {
            // Create new - use the static method approach
            const cutoff = new Cutoff(record);
            
            // Manually set derived fields to avoid middleware issues
            cutoff.category = record.category;
            cutoff.isPwd = record.isPwd;
            
            await cutoff.save();
            insertedCount++;
          }
        } catch (saveError) {
          console.error('Failed to save record:', {
            institute: record.institute,
            program: record.academicProgramName,
            error: saveError.message
          });
          failedCount++;
        }
      }
      
      // Small delay between batches to prevent overwhelming the database
      if (i + batchSize < results.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('Database operation completed:', {
      inserted: insertedCount,
      modified: modifiedCount,
      failed: failedCount
    });

    res.status(200).json({
      success: true,
      message: 'CSV data uploaded successfully',
      data: {
        inserted: insertedCount,
        modified: modifiedCount,
        failed: failedCount,
        total: insertedCount + modifiedCount,
        parsedRows: rowCount,
        validRows: results.length,
        errorRows: errorCount
      }
    });
    
  } catch (error) {
    console.error('CSV upload error:', error);
    
    // Clean up file on error
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log('Cleaned up temp file after error');
      } catch (cleanupError) {
        console.warn('Could not delete temp file after error:', cleanupError.message);
      }
    }
    
    res.status(500).json({
      success: false,
      message: 'Error uploading CSV data',
      error: error.message
    });
  }
};

// Alternative: Direct database insertion without middleware issues
exports.uploadCutoffCSVDirect = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { year, round } = req.body;
    const parsedYear = parseInt(year) || new Date().getFullYear();
    const parsedRound = parseInt(round) || 1;
    
    const results = [];
    let rowCount = 0;
    
    // Parse CSV
    const parsePromise = new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (row) => {
          rowCount++;
          
          const seatType = cleanSeatType(row['Seat Type'] || 'OPEN');
          const category = getCategoryFromSeatType(seatType);
          
          const record = {
            institute: (row.Institute || '').trim(),
            academicProgramName: (row['Academic Program Name'] || '').trim(),
            seatType: seatType,
            gender: cleanGender(row.Gender || 'Gender-Neutral'),
            openingRank: cleanRank(row['Opening Rank']),
            closingRank: cleanRank(row['Closing Rank']),
            year: parsedYear,
            round: parsedRound,
            category: category,
            isPwd: seatType.includes('PwD'),
            uploadedBy: req.user?.id || null
          };
          
          if (record.institute && record.academicProgramName) {
            results.push(record);
          }
        })
        .on('end', () => {
          fs.unlinkSync(req.file.path);
          resolve();
        })
        .on('error', reject);
    });
    
    await parsePromise;
    
    if (results.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'No valid data found' 
      });
    }
    
    // Use insertMany with validateBeforeSave: false to bypass middleware
    let insertedCount = 0;
    
    try {
      // First try insertMany
      const insertResult = await Cutoff.insertMany(results, {
        ordered: false,
        validateBeforeSave: false // This bypasses middleware
      });
      insertedCount = insertResult.length;
    } catch (insertError) {
      console.error('Bulk insert failed, trying individual inserts:', insertError);
      
      // Fallback to individual inserts
      for (const record of results) {
        try {
          await Cutoff.create(record, { validateBeforeSave: false });
          insertedCount++;
        } catch (error) {
          console.error('Failed to insert record:', error.message);
        }
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Data uploaded successfully',
      data: {
        inserted: insertedCount,
        total: results.length
      }
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Upload failed',
      error: error.message
    });
  }
};

// Rest of your controller functions (getCutoffs, getFilterOptions, etc.) remain the same
// Get cutoff predictions (public endpoint)
// exports.getCutoffs = async (req, res) => {
//   try {
//     const {
//       rank,
//       category,
//       gender,
//       // year = new Date().getFullYear(),
//       // round = 6,
//       // institute,
//       // branch,
//       typeOfExam,
//       page = 1,
//       limit = 20
//     } = req.query;

//     const filter = {};
    
//     if (year) filter.year = parseInt(year);
//     if (round) filter.round = parseInt(round);
    
//     if (category) {
//       const categoryMap = {
//         'GENERAL': ['OPEN'],
//         'EWS': ['EWS'],
//         'OBC-NCL': ['OBC-NCL'],
//         'SC': ['SC'],
//         'ST': ['ST'],
//         'GENERAL-PwD': ['OPEN (PwD)', 'OPEN-PwD'],
//         'EWS-PwD': ['EWS-PwD', 'EWS (PwD)'],
//         'OBC-NCL-PwD': ['OBC-NCL-PwD', 'OBC-NCL (PwD)'],
//         'SC-PwD': ['SC-PwD', 'SC (PwD)'],
//         'ST-PwD': ['ST-PwD', 'ST (PwD)']
//       };
      
//       filter.seatType = { $in: categoryMap[category] || [category] };
//     }
    
//     if (gender) filter.gender = gender;
//     if (institute) filter.institute = { $regex: institute, $options: 'i' };
//     if (branch) filter.academicProgramName = { $regex: branch, $options: 'i' };
    
//     if (rank) {
//       const userRank = parseInt(rank);
//       filter.openingRank = { $lte: userRank };
//       filter.closingRank = { $gte: userRank };
//     }

//     const skip = (parseInt(page) - 1) * parseInt(limit);
    
//     const cutoffs = await Cutoff.find(filter)
//       .sort({ closingRank: 1 })
//       .skip(skip)
//       .limit(parseInt(limit));
    
//     const total = await Cutoff.countDocuments(filter);
    
//     const cutoffsWithProbability = cutoffs.map(cutoff => {
//       const cutoffObj = cutoff.toObject();
      
//       if (rank) {
//         const userRank = parseInt(rank);
//         const totalSeats = cutoff.closingRank - cutoff.openingRank + 1;
//         const position = userRank - cutoff.openingRank + 1;
//         const probability = (position / totalSeats) * 100;
        
//         if (probability >= 70) {
//           cutoffObj.probability = 'High Chance';
//           cutoffObj.probabilityColor = 'green';
//         } else if (probability >= 30) {
//           cutoffObj.probability = 'Medium Chance';
//           cutoffObj.probabilityColor = 'yellow';
//         } else {
//           cutoffObj.probability = 'Low Chance';
//           cutoffObj.probabilityColor = 'red';
//         }
        
//         cutoffObj.probabilityPercentage = Math.round(probability);
//       }
      
//       return cutoffObj;
//     });
    
//     res.status(200).json({
//       success: true,
//       data: cutoffsWithProbability,
//       pagination: {
//         page: parseInt(page),
//         limit: parseInt(limit),
//         total,
//         pages: Math.ceil(total / parseInt(limit))
//       }
//     });
    
//   } catch (error) {
//     console.error('Get cutoffs error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error fetching cutoff data',
//       error: error.message
//     });
//   }
// };

// controllers/cutoffController.js


// exports.getCutoffs = async (req, res) => {
//   try {
//     const {
//       rank,
//       category,
//       gender,
//       typeOfExam,
//       page = 1,
//       limit = 20
//     } = req.query;

//     console.log('Received query params:', { rank, category, gender, typeOfExam }); // Debug

//     // Validate required fields
//     if (!rank) {
//       return res.status(400).json({
//         success: false,
//         message: "Rank is required",
//       });
//     }

//     if (!category) {
//       return res.status(400).json({
//         success: false,
//         message: "Category is required",
//       });
//     }

//     if (!typeOfExam) {
//       return res.status(400).json({
//         success: false,
//         message: "Exam type is required",
//       });
//     }

//     const userRank = parseInt(rank);
//     if (isNaN(userRank) || userRank <= 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid rank value",
//       });
//     }

//     // Build filter - using exact field names from your database
//     const filter = {
//       typeOfExam: typeOfExam // Use the exact field name from your database
//     };

//     // Category to seatType mapping based on your actual database data
//     // Based on your data, seatType values are: 'OBC-NCL', 'SC', 'ST', etc.
//     const categorySeatTypeMap = {
//       'GENERAL': ['OPEN', 'General', 'OPEN (PwD)', 'GEN-PwD'],
//       'EWS': ['EWS', 'Economically Weaker Section', 'EWS-PwD', 'EWS (PwD)'],
//       'OBC': ['OBC-NCL', 'OBC', 'Other Backward Classes', 'OBC-NCL-PwD', 'OBC-NCL (PwD)'],
//       'OBC-NCL': ['OBC-NCL', 'OBC', 'Other Backward Classes', 'OBC-NCL-PwD', 'OBC-NCL (PwD)'],
//       'SC': ['SC', 'Scheduled Caste', 'SC-PwD', 'SC (PwD)'],
//       'ST': ['ST', 'Scheduled Tribe', 'ST-PwD', 'ST (PwD)'],
//       'GENERAL-PwD': ['OPEN (PwD)', 'OPEN-PwD', 'GEN-PwD'],
//       'EWS-PwD': ['EWS-PwD', 'EWS (PwD)'],
//       'OBC-NCL-PwD': ['OBC-NCL-PwD', 'OBC-NCL (PwD)'],
//       'SC-PwD': ['SC-PwD', 'SC (PwD)'],
//       'ST-PwD': ['ST-PwD', 'ST (PwD)']
//     };

//     filter.seatType = { $in: categorySeatTypeMap[category] || [category] };
//     console.log('Seat type filter:', filter.seatType); // Debug

//     // Gender filter based on your actual database values
//     if (gender && gender !== 'All') {
//       const genderFilterMap = {
//         'Male': ['Gender-Neutral', 'Male-only', 'M', 'BOYS', 'Male (including Supernumerary)'],
//         'Female': ['Gender-Neutral', 'Female-only', 'F', 'GIRLS', 'Female-only (including Supernumerary)'],
//         'Other': ['Gender-Neutral', 'Other', 'Transgender'],
//         // For general gender filter (if user doesn't specify or wants all)
//         'All': ['Gender-Neutral', 'Male-only', 'Female-only', 'Other', 
//                 'Male (including Supernumerary)', 'Female-only (including Supernumerary)']
//       };
      
//       filter.gender = { $in: genderFilterMap[gender] || ['Gender-Neutral'] };
//       console.log('Gender filter:', filter.gender); // Debug
//     }

//     // Rank filter - find colleges where the rank falls within opening-closing range
//     filter.openingRank = { $lte: userRank };
//     filter.closingRank = { $gte: userRank };
//     console.log('Rank filter - opening:', filter.openingRank, 'closing:', filter.closingRank); // Debug

//     // Add IIT filtering based on exam type - CORRECTED FIELD NAME
//     if (typeOfExam === 'JEE_MAINS') {
//       // For JEE Mains: Exclude records containing "Indian Institute of Technology"
//       filter.institute = { $not: /Indian Institute of Technology/i };
//       console.log('Filtering: Excluding IITs for JEE Mains'); // Debug
//     } else if (typeOfExam === 'JEE_ADVANCED') {
//       // For JEE Advanced: Include only records containing "Indian Institute of Technology"
//       filter.institute = /Indian Institute of Technology/i;
//       console.log('Filtering: Including only IITs for JEE Advanced'); // Debug
//     }
//     // Note: If typeOfExam is neither of these, no institute filter is applied

//     const skip = (parseInt(page) - 1) * parseInt(limit);
    
//     console.log('Final filter:', JSON.stringify(filter, null, 2)); // Debug
    
//     // Fetch cutoffs with pagination
//     const cutoffs = await Cutoff.find(filter)
//       .sort({ closingRank: 1 })
//       .skip(skip)
//       .limit(parseInt(limit));
    
//     const total = await Cutoff.countDocuments(filter);
    
//     console.log('Found cutoffs:', cutoffs.length, 'Total:', total); // Debug
    
//     // Calculate probability for each cutoff
//     // const cutoffsWithProbability = cutoffs.map(cutoff => {
//     //   const cutoffObj = cutoff.toObject();
      
//     //   // Calculate probability based on rank position within range
//     //   const rankRange = cutoff.closingRank - cutoff.openingRank + 1;
//     //   const rankPosition = userRank - cutoff.openingRank + 1;
//     //   const probabilityPercentage = Math.round((rankPosition / rankRange) * 100);
      
//     //   // Determine probability category
//     //   let probability, probabilityColor;
//     //   if (probabilityPercentage >= 70) {
//     //     probability = 'High Chance';
//     //     probabilityColor = 'green';
//     //   } else if (probabilityPercentage >= 40) {
//     //     probability = 'Medium Chance';
//     //     probabilityColor = 'yellow';
//     //   } else if (probabilityPercentage >= 20) {
//     //     probability = 'Low Chance';
//     //     probabilityColor = 'orange';
//     //   } else {
//     //     probability = 'Very Low Chance';
//     //     probabilityColor = 'red';
//     //   }
      
//     //   cutoffObj.probability = probability;
//     //   cutoffObj.probabilityColor = probabilityColor;
//     //   cutoffObj.probabilityPercentage = probabilityPercentage;
      
//     //   return cutoffObj;
//     // });
//     // Calculate probability for each cutoff
// const cutoffsWithProbability = cutoffs.map(cutoff => {
//   const cutoffObj = cutoff.toObject();

//   const openingRank = cutoff.openingRank;
//   const closingRank = cutoff.closingRank;

//   // Safety check
//   if (
//     !openingRank ||
//     !closingRank ||
//     userRank < openingRank ||
//     userRank > closingRank
//   ) {
//     cutoffObj.probability = "Very Low Chance";
//     cutoffObj.probabilityColor = "red";
//     cutoffObj.probabilityPercentage = 5;
//     return cutoffObj;
//   }

//   // Rank range
//   const range = closingRank - openingRank;

//   // Distance from closing rank (higher is better)
//   const distanceFromClosing = closingRank - userRank;

//   // Base probability (reverse linear)
//   let probabilityPercentage =
//     (distanceFromClosing / range) * 100;

//   // Smooth curve (realistic)
//   probabilityPercentage = Math.pow(probabilityPercentage / 100, 0.75) * 100;

//   // Clamp values (avoid extremes)
//   probabilityPercentage = Math.max(5, Math.min(Math.round(probabilityPercentage), 95));

//   // Probability label
//   let probability, probabilityColor;

//   if (probabilityPercentage >= 75) {
//     probability = "High Chance";
//     probabilityColor = "green";
//   } else if (probabilityPercentage >= 50) {
//     probability = "Medium Chance";
//     probabilityColor = "yellow";
//   } else if (probabilityPercentage >= 30) {
//     probability = "Low Chance";
//     probabilityColor = "orange";
//   } else {
//     probability = "Very Low Chance";
//     probabilityColor = "red";
//   }

//   cutoffObj.probability = probability;
//   cutoffObj.probabilityColor = probabilityColor;
//   cutoffObj.probabilityPercentage = probabilityPercentage;

//   return cutoffObj;
// });

    
//     // Get summary statistics
//     const summary = {
//       totalColleges: total,
//       collegesShown: cutoffs.length,
//       highestProbability: cutoffsWithProbability.length > 0 
//         ? Math.max(...cutoffsWithProbability.map(c => c.probabilityPercentage))
//         : 0,
//       lowestProbability: cutoffsWithProbability.length > 0 
//         ? Math.min(...cutoffsWithProbability.map(c => c.probabilityPercentage))
//         : 0,
//       averageProbability: cutoffsWithProbability.length > 0 
//         ? Math.round(cutoffsWithProbability.reduce((sum, c) => sum + c.probabilityPercentage, 0) / cutoffsWithProbability.length)
//         : 0
//     };
    
//     res.status(200).json({
//       success: true,
//       data: cutoffsWithProbability,
//       summary,
//       pagination: {
//         page: parseInt(page),
//         limit: parseInt(limit),
//         total,
//         pages: Math.ceil(total / parseInt(limit))
//       }
//     });
    
//   } catch (error) {
//     console.error('Get cutoffs error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error fetching cutoff data',
//       error: process.env.NODE_ENV === "development" ? error.message : undefined,
//     });
//   }
// };
// Get filter options



exports.getCutoffs = async (req, res) => {
  try {
    const {
      rank,
      category,
      gender,
      typeOfExam,
      page = 1,
      limit = 20
    } = req.query;

    console.log('Received query params:', { rank, category, gender, typeOfExam });

    // Validate required fields
    if (!rank) {
      return res.status(400).json({
        success: false,
        message: "Rank is required",
      });
    }

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    const userRank = parseInt(rank);
    if (isNaN(userRank) || userRank <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid rank value",
      });
    }

    // Build filter
    const filter = {};
    
    // IMPORTANT: Don't filter by typeOfExam from database field
    // Instead, we'll use institute-based filtering for JEE Advanced vs Mains
    
    // Category to seatType mapping
    const categorySeatTypeMap = {
      'GENERAL': ['OPEN', 'General', 'OPEN (PwD)', 'GEN-PwD'],
      'EWS': ['EWS', 'Economically Weaker Section', 'EWS-PwD', 'EWS (PwD)'],
      'OBC': ['OBC-NCL', 'OBC', 'Other Backward Classes', 'OBC-NCL-PwD', 'OBC-NCL (PwD)'],
      'OBC-NCL': ['OBC-NCL', 'OBC', 'Other Backward Classes', 'OBC-NCL-PwD', 'OBC-NCL (PwD)'],
      'SC': ['SC', 'Scheduled Caste', 'SC-PwD', 'SC (PwD)'],
      'ST': ['ST', 'Scheduled Tribe', 'ST-PwD', 'ST (PwD)'],
      'GENERAL-PwD': ['OPEN (PwD)', 'OPEN-PwD', 'GEN-PwD'],
      'EWS-PwD': ['EWS-PwD', 'EWS (PwD)'],
      'OBC-NCL-PwD': ['OBC-NCL-PwD', 'OBC-NCL (PwD)'],
      'SC-PwD': ['SC-PwD', 'SC (PwD)'],
      'ST-PwD': ['ST-PwD', 'ST (PwD)']
    };

    filter.seatType = { $in: categorySeatTypeMap[category] || [category] };
    console.log('Seat type filter:', filter.seatType);

    // Gender filter
    if (gender && gender !== 'All') {
      const genderFilterMap = {
        'Male': ['Gender-Neutral', 'Male-only', 'M', 'BOYS', 'Male (including Supernumerary)'],
        'Female': ['Gender-Neutral', 'Female-only', 'F', 'GIRLS', 'Female-only (including Supernumerary)'],
        'Other': ['Gender-Neutral', 'Other', 'Transgender'],
        // For general gender filter (if user doesn't specify or wants all)
        'All': ['Gender-Neutral', 'Male-only', 'Female-only', 'Other', 
                'Male (including Supernumerary)', 'Female-only (including Supernumerary)']
      };
      
      filter.gender = { $in: genderFilterMap[gender] || ['Gender-Neutral'] };
      console.log('Gender filter:', filter.gender);
    }

    // Rank filter
    filter.openingRank = { $lte: userRank };
    filter.closingRank = { $gte: userRank };
    console.log('Rank filter - opening <=', userRank, 'closing >=', userRank);

    // KEY FIX: Filter based on institute type, NOT the typeOfExam field
    // JEE Advanced = Only IITs
    // JEE Mains = All except IITs
    // BOTH = Show all colleges (both IITs and non-IITs)
    
    if (typeOfExam === 'JEE_ADVANCED') {
      // For JEE Advanced: Include ONLY IITs
      filter.institute = /indian institute of technology|iit/i;
      console.log('Filtering: Including only IITs for JEE Advanced');
    } else if (typeOfExam === 'JEE_MAINS') {
      // For JEE Mains: Exclude IITs
      filter.institute = { $not: /indian institute of technology|iit/i };
      console.log('Filtering: Excluding IITs for JEE Mains');
    } else if (typeOfExam === 'BOTH') {
      // For BOTH: Show all colleges (no institute filter)
      console.log('Filtering: Showing all colleges (IITs and non-IITs)');
    } else {
      // Default: Show all colleges
      console.log('No specific exam type filter applied, showing all colleges');
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    console.log('Final filter:', JSON.stringify(filter, null, 2));
    
    // Fetch cutoffs with pagination
    const cutoffs = await Cutoff.find(filter)
      .sort({ closingRank: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Cutoff.countDocuments(filter);
    
    console.log('Found cutoffs:', cutoffs.length, 'Total:', total);
    
    // Calculate probability for each cutoff
    const cutoffsWithProbability = cutoffs.map(cutoff => {
      const cutoffObj = cutoff.toObject();

      const openingRank = cutoff.openingRank;
      const closingRank = cutoff.closingRank;

      // Safety check
      if (
        !openingRank ||
        !closingRank ||
        userRank < openingRank ||
        userRank > closingRank
      ) {
        cutoffObj.probability = "Very Low Chance";
        cutoffObj.probabilityColor = "red";
        cutoffObj.probabilityPercentage = 5;
        return cutoffObj;
      }

      // Rank range
      const range = closingRank - openingRank;

      // Distance from closing rank (higher is better)
      const distanceFromClosing = closingRank - userRank;

      // Base probability (reverse linear)
      let probabilityPercentage = (distanceFromClosing / range) * 100;

      // Smooth curve
      probabilityPercentage = Math.pow(probabilityPercentage / 100, 0.75) * 100;

      // Clamp values
      probabilityPercentage = Math.max(5, Math.min(Math.round(probabilityPercentage), 95));

      // Probability label
      let probability, probabilityColor;

      if (probabilityPercentage >= 75) {
        probability = "High Chance";
        probabilityColor = "green";
      } else if (probabilityPercentage >= 50) {
        probability = "Medium Chance";
        probabilityColor = "yellow";
      } else if (probabilityPercentage >= 30) {
        probability = "Low Chance";
        probabilityColor = "orange";
      } else {
        probability = "Very Low Chance";
        probabilityColor = "red";
      }

      cutoffObj.probability = probability;
      cutoffObj.probabilityColor = probabilityColor;
      cutoffObj.probabilityPercentage = probabilityPercentage;

      return cutoffObj;
    });
    
    // Get summary statistics
    const summary = {
      totalColleges: total,
      collegesShown: cutoffs.length,
      highestProbability: cutoffsWithProbability.length > 0 
        ? Math.max(...cutoffsWithProbability.map(c => c.probabilityPercentage))
        : 0,
      lowestProbability: cutoffsWithProbability.length > 0 
        ? Math.min(...cutoffsWithProbability.map(c => c.probabilityPercentage))
        : 0,
      averageProbability: cutoffsWithProbability.length > 0 
        ? Math.round(cutoffsWithProbability.reduce((sum, c) => sum + c.probabilityPercentage, 0) / cutoffsWithProbability.length)
        : 0
    };
    
    res.status(200).json({
      success: true,
      data: cutoffsWithProbability,
      summary,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Get cutoffs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching cutoff data',
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
exports.getFilterOptions = async (req, res) => {
  try {
    const institutes = await Cutoff.distinct('institute');
    const branches = await Cutoff.distinct('academicProgramName');
    const years = await Cutoff.distinct('year').sort((a, b) => b - a);
    
    res.status(200).json({
      success: true,
      data: {
        institutes,
        branches,
        years
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching filter options'
    });
  }
};

// Health check
exports.healthCheck = (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Cutoff controller is working',
    timestamp: new Date().toISOString()
  });
};

exports.updateUserForMoreResult = async (req, res) => {
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
