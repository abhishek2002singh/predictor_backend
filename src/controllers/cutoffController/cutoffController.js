const Cutoff = require('../../model/uploadData/Cutoff');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const UserData = require("../../model/userData/user");
const logger = require("../../config/logger");
const CuetCutoff = require('../../model/uploadData/CuetCutoffData');




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


// exports.uploadCutoffCSV = async (req, res) => {
//   let filePath = null;
  
//   try {
//     console.log('Upload request received');
    
//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: 'No CSV file uploaded'
//       });
//     }

//     filePath = req.file.path;
    
//     // Verify file exists
//     if (!fs.existsSync(filePath)) {
//       console.error('File does not exist at path:', filePath);
//       return res.status(400).json({
//         success: false,
//         message: 'Uploaded file not found'
//       });
//     }

//     const { year, round, typeOfExam } = req.body;
    
//     // Validate inputs
//     const parsedYear = parseInt(year) || new Date().getFullYear();
//     const parsedRound = parseInt(round) || 1;
    
//     if (parsedYear < 2015 || parsedYear > new Date().getFullYear() + 1) {
//       return res.status(400).json({
//         success: false,
//         message: `Invalid year. Must be between 2015 and ${new Date().getFullYear() + 1}`
//       });
//     }
    
//     if (parsedRound < 1 || parsedRound > 7) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid round. Must be between 1 and 7'
//       });
//     }

//     // Validate exam type
//     const examType = (typeOfExam || '').toUpperCase();
//     let Model;
    
//     switch(examType) {
//       case 'JEE_MAINS':
//       case 'JEE':
//         Model = Cutoff; // JEE Main cutoff model
//         break;
//       case 'CUET':
//         Model = CuetCutoff; // CUET cutoff model
//         break;
//       default:
//         return res.status(400).json({
//           success: false,
//           message: 'Invalid exam type. Must be either "JEE_Mains" or "CUET"'
//         });
//     }

//     console.log(`Starting CSV parsing for ${filePath}. Exam type: ${examType}, Model: ${Model.modelName}`);

//     // Parse CSV
//     const results = [];
//     let rowCount = 0;
//     let errorCount = 0;
    
//     const parsePromise = new Promise((resolve, reject) => {
//       const stream = fs.createReadStream(filePath)
//         .pipe(csv())
//         .on('data', (row) => {
//           rowCount++;
          
//           try {
//             // Extract and clean data
//             const seatType = cleanSeatType(row['Seat Type'] || row['Seat Type'] || 'OPEN');
//             const category = getCategoryFromSeatType(seatType);
            
//             const cleanedRow = {
//               institute: (row.Institute || row.institute || '').toString().trim().slice(0, 500),
//               academicProgramName: (row['Academic Program Name'] || 
//                                    row.academicProgramName ||
//                                    row.Program || 
//                                    '').toString().trim().slice(0, 500),
//               typeOfExam: examType, // Use the validated exam type
//               seatType: seatType,
//               gender: cleanGender(row.Gender || row.gender || 'Gender-Neutral'),
//               openingRank: cleanRank(row['Opening Rank'] || row.openingRank),
//               closingRank: cleanRank(row['Closing Rank'] || row.closingRank),
//               year: parsedYear,
//               round: parsedRound,
//               category: category,
//               isPwd: seatType.includes('PwD')
//             };
            
//             // Add uploadedBy if available
//             if (req.user && req.user.id) {
//               cleanedRow.uploadedBy = req.user.id;
//             }
            
//             // Basic validation
//             if (!cleanedRow.institute || !cleanedRow.academicProgramName) {
//               console.warn(`Row ${rowCount} skipped - missing required fields`);
//               errorCount++;
//               return;
//             }
            
//             // Validate ranks
//             if (cleanedRow.openingRank === 999999 || cleanedRow.closingRank === 999999) {
//               console.warn(`Row ${rowCount} skipped - invalid ranks:`, {
//                 opening: row['Opening Rank'],
//                 closing: row['Closing Rank']
//               });
//               errorCount++;
//               return;
//             }
            
//             // Ensure closing rank >= opening rank
//             if (cleanedRow.closingRank < cleanedRow.openingRank) {
//               // Swap if they're reversed
//               [cleanedRow.openingRank, cleanedRow.closingRank] = 
//               [cleanedRow.closingRank, cleanedRow.openingRank];
//             }
            
//             results.push(cleanedRow);
            
//           } catch (rowError) {
//             console.error(`Error processing row ${rowCount}:`, rowError);
//             errorCount++;
//           }
//         })
//         .on('end', () => {
//           console.log(`CSV parsing completed. Total rows: ${rowCount}, Valid records: ${results.length}, Errors: ${errorCount}`);
          
//           // Clean up file
//           try {
//             if (fs.existsSync(filePath)) {
//               fs.unlinkSync(filePath);
//               console.log('Temporary file cleaned up');
//             }
//           } catch (cleanupError) {
//             console.warn('Could not delete temp file:', cleanupError.message);
//           }
          
//           resolve();
//         })
//         .on('error', (error) => {
//           console.error('CSV parsing stream error:', error);
//           reject(error);
//         });
//     });

//     await parsePromise;
    
//     if (results.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'No valid data found in CSV',
//         stats: {
//           totalRows: rowCount,
//           validRows: results.length,
//           errorRows: errorCount
//         }
//       });
//     }

//     console.log(`Processing ${results.length} records for ${Model.modelName}...`);
    
//     // Process in smaller batches to avoid memory issues
//     const batchSize = 100;
//     let insertedCount = 0;
//     let modifiedCount = 0;
//     let failedCount = 0;
    
//     for (let i = 0; i < results.length; i += batchSize) {
//       const batch = results.slice(i, i + batchSize);
//       console.log(`Processing batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(results.length/batchSize)}`);
      
//       for (const record of batch) {
//         try {
//           // Find existing record - search criteria includes exam type
//           const existing = await Model.findOne({
//             institute: record.institute,
//             academicProgramName: record.academicProgramName,
//             typeOfExam: record.typeOfExam, // Include exam type in search
//             seatType: record.seatType,
//             gender: record.gender,
//             year: record.year,
//             round: record.round
//           });

//           if (existing) {
//             // Update existing record
//             existing.openingRank = record.openingRank;
//             existing.closingRank = record.closingRank;
//             existing.category = record.category;
//             existing.isPwd = record.isPwd;
//             await existing.save();
//             modifiedCount++;
//           } else {
//             // Create new record
//             const cutoff = new Model(record);
            
//             // Manually set derived fields to ensure consistency
//             cutoff.category = record.category;
//             cutoff.isPwd = record.isPwd;
            
//             await cutoff.save();
//             insertedCount++;
//           }
//         } catch (saveError) {
//           console.error('Failed to save record:', {
//             institute: record.institute,
//             program: record.academicProgramName,
//             examType: record.typeOfExam,
//             error: saveError.message
//           });
//           failedCount++;
//         }
//       }
      
//       // Small delay between batches to prevent overwhelming the database
//       if (i + batchSize < results.length) {
//         await new Promise(resolve => setTimeout(resolve, 100));
//       }
//     }
    
//     console.log('Database operation completed:', {
//       model: Model.modelName,
//       inserted: insertedCount,
//       modified: modifiedCount,
//       failed: failedCount
//     });

//     res.status(200).json({
//       success: true,
//       message: `CSV data uploaded successfully to ${Model.modelName}`,
//       data: {
//         examType: examType,
//         model: Model.modelName,
//         inserted: insertedCount,
//         modified: modifiedCount,
//         failed: failedCount,
//         total: insertedCount + modifiedCount,
//         parsedRows: rowCount,
//         validRows: results.length,
//         errorRows: errorCount
//       }
//     });
    
//   } catch (error) {
//     console.error('CSV upload error:', error);
    
//     // Clean up file on error
//     if (filePath && fs.existsSync(filePath)) {
//       try {
//         fs.unlinkSync(filePath);
//         console.log('Cleaned up temp file after error');
//       } catch (cleanupError) {
//         console.warn('Could not delete temp file after error:', cleanupError.message);
//       }
//     }
    
//     res.status(500).json({
//       success: false,
//       message: 'Error uploading CSV data',
//       error: error.message
//     });
//   }
// };

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




exports.getCutoffs = async (req, res) => {
  try {
    const {
      rank,
      category,
      gender,
      typeOfExam,
      page = 1,
      limit = 20,
      year,
      round,
      branch,
      institute,
      quota
    } = req.query;

    console.log('Received query params:', { 
      rank, category, gender, typeOfExam, 
      year, round, branch, institute, quota 
    });

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

    // Function to perform search with given filters
    const performSearch = async (filters, searchMode = 'STRICT') => {
      console.log(`Search Mode: ${searchMode}`);
      console.log('Filters:', JSON.stringify(filters, null, 2));
      
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // Use aggregation for better performance and sorting
      const aggregationPipeline = [
        { $match: filters },
        { 
          $addFields: {
            // Calculate rank difference for sorting
            rankDifference: {
              $abs: {
                $subtract: [userRank, { $divide: [{ $add: ["$openingRank", "$closingRank"] }, 2] }]
              }
            }
          }
        },
        { $sort: { rankDifference: 1 } }, // Sort by closest rank
        { $skip: skip },
        { $limit: parseInt(limit) }
      ];

      const [cutoffs, total] = await Promise.all([
        Cutoff.aggregate(aggregationPipeline),
        Cutoff.countDocuments(filters)
      ]);

      console.log(`Found ${cutoffs.length} cutoffs in ${searchMode} mode, Total: ${total}`);
      
      return { cutoffs, total };
    };

    // FIXED: Correct category to seatType mapping
    const categorySeatTypeMap = {
      'GENERAL': ['OPEN', 'General', 'OPEN (PwD)', 'GEN-PwD'],
      'EWS': ['EWS', 'Economically Weaker Section', 'EWS-PwD', 'EWS (PwD)'],
      'OBC-NCL': ['OBC-NCL', 'OBC', 'Other Backward Classes', 'OBC-NCL-PwD', 'OBC-NCL (PwD)'],
      'SC': ['SC', 'Scheduled Caste', 'SC-PwD', 'SC (PwD)'],
      'ST': ['ST', 'Scheduled Tribe', 'ST-PwD', 'ST (PwD)'],
      'GENERAL-PWD': ['OPEN (PwD)', 'OPEN-PwD', 'GEN-PwD'],
      'EWS-PWD': ['EWS-PwD', 'EWS (PwD)'],
      'OBC-NCL-PWD': ['OBC-NCL-PwD', 'OBC-NCL (PwD)'],
      'SC-PWD': ['SC-PwD', 'SC (PwD)'],
      'ST-PWD': ['ST-PwD', 'ST (PwD)']
    };

    // Search with FALLBACK STRATEGY
    let results = null;
    let searchMode = 'STRICT';
    let minResultsRequired = 5; // Minimum results we want to show
    
    // STRICT MODE: Exact rank match with all filters
    let baseFilters = {
      seatType: { $in: categorySeatTypeMap[category] || [category] }
    };

    // Add rank filter with initial strict range
    const rankBufferPercentage = 0.10; // 10% buffer initially
    const rankBuffer = Math.max(100, Math.round(userRank * rankBufferPercentage));
    
    baseFilters.openingRank = { $lte: userRank + rankBuffer };
    baseFilters.closingRank = { $gte: userRank - rankBuffer };

    // Add gender filter
    if (gender && gender !== 'All') {
      const genderFilterMap = {
        'Male': ['Gender-Neutral', 'Male-only', 'M', 'BOYS', 'Male (including Supernumerary)'],
        'Female': ['Gender-Neutral', 'Female-only', 'F', 'GIRLS', 'Female-only (including Supernumerary)'],
        'Female-only': ['Gender-Neutral', 'Female-only', 'F', 'GIRLS', 'Female-only (including Supernumerary)'],
        'Other': ['Gender-Neutral', 'Other', 'Transgender'],
        'Gender-neutral': ['Gender-Neutral', 'Gender-neutral'],
        'All': ['Gender-Neutral', 'Male-only', 'Female-only', 'Other', 
                'Male (including Supernumerary)', 'Female-only (including Supernumerary)']
      };
      
      baseFilters.gender = { $in: genderFilterMap[gender] || ['Gender-Neutral'] };
    }

    // Add additional filters
    if (year && year !== 'all') {
      baseFilters.year = parseInt(year);
    }
    
    if (round && round !== 'all') {
      baseFilters.round = parseInt(round);
    }
    
    if (branch && branch !== 'all') {
      baseFilters.academicProgramName = { $regex: branch, $options: 'i' };
    }
    
    if (institute && institute !== 'all') {
      baseFilters.institute = { $regex: institute, $options: 'i' };
    }
    
    if (quota && quota !== 'all') {
      baseFilters.quota = quota;
    }

    // Apply exam type filter
    if (typeOfExam === 'JEE_ADVANCED') {
      baseFilters.institute = /indian institute of technology|iit/i;
    } else if (typeOfExam === 'JEE_MAINS') {
      baseFilters.institute = { $not: /indian institute of technology|iit/i };
    }

    // Try STRICT search first
    results = await performSearch(baseFilters, 'STRICT');
    
    // FALLBACK 1: If too few results, expand rank range to 20%
    if (results.total < minResultsRequired && searchMode === 'STRICT') {
      searchMode = 'FALLBACK_1';
      const expandedRankBuffer = Math.max(200, Math.round(userRank * 0.20));
      baseFilters.openingRank = { $lte: userRank + expandedRankBuffer };
      baseFilters.closingRank = { $gte: userRank - expandedRankBuffer };
      
      console.log(`Expanding rank range to ±${expandedRankBuffer} (20%)`);
      results = await performSearch(baseFilters, 'FALLBACK_1');
    }

    // FALLBACK 2: If still too few, remove gender filter (if applied)
    if (results.total < minResultsRequired && searchMode === 'FALLBACK_1' && baseFilters.gender) {
      searchMode = 'FALLBACK_2';
      delete baseFilters.gender;
      console.log('Removing gender filter');
      results = await performSearch(baseFilters, 'FALLBACK_2');
    }

    // FALLBACK 3: If still too few, remove institute type filter
    if (results.total < minResultsRequired && searchMode === 'FALLBACK_2') {
      searchMode = 'FALLBACK_3';
      if (baseFilters.institute && (typeOfExam === 'JEE_ADVANCED' || typeOfExam === 'JEE_MAINS')) {
        delete baseFilters.institute;
        console.log('Removing institute type filter');
      }
      results = await performSearch(baseFilters, 'FALLBACK_3');
    }

    // FALLBACK 4: If still too few, use broader category mapping
    if (results.total < minResultsRequired && searchMode === 'FALLBACK_3') {
      searchMode = 'FALLBACK_4';
      // Use broader category matching
      const broaderCategoryMap = {
        'GENERAL': ['OPEN', 'General', 'GEN', 'OPEN (PwD)', 'GEN-PwD', 'OPEN-PWD'],
        'EWS': ['EWS', 'Economically Weaker Section', 'EWS-PwD', 'EWS (PwD)', 'EWS-PWD'],
        'OBC-NCL': ['OBC-NCL', 'OBC', 'OBC (NCL)', 'Other Backward Classes', 'OBC-NCL-PwD', 'OBC-NCL-PWD'],
        'SC': ['SC', 'Scheduled Caste', 'SC-PwD', 'SC (PwD)', 'SC-PWD'],
        'ST': ['ST', 'Scheduled Tribe', 'ST-PwD', 'ST (PwD)', 'ST-PWD']
      };
      
      baseFilters.seatType = { $in: broaderCategoryMap[category] || [category] };
      console.log('Using broader category mapping');
      results = await performSearch(baseFilters, 'FALLBACK_4');
    }

    // FALLBACK 5: Last resort - show any colleges within rank range regardless of other filters
    if (results.total < minResultsRequired && searchMode === 'FALLBACK_4') {
      searchMode = 'FALLBACK_5';
      const lastResortFilters = {
        openingRank: { $lte: userRank + 500 },
        closingRank: { $gte: userRank - 500 },
        seatType: { $regex: category, $options: 'i' }
      };
      
      // Keep only essential filters
      if (year && year !== 'all') lastResortFilters.year = parseInt(year);
      if (round && round !== 'all') lastResortFilters.round = parseInt(round);
      
      console.log('Using last resort fallback with wide rank range');
      results = await performSearch(lastResortFilters, 'FALLBACK_5');
    }

    const { cutoffs, total } = results;
    
    // Calculate probability for each cutoff
const cutoffsWithProbability = cutoffs.map(cutoff => {
  const cutoffObj = cutoff;

  const openingRank = cutoff.openingRank;
  const closingRank = cutoff.closingRank;

  let probabilityPercentage = 0;

  if (!openingRank || !closingRank) {
    probabilityPercentage = 20;
  } else {
    const range = closingRank - openingRank;

    // 🥇 1️⃣ DOMINANT ZONE (TOPPER LOGIC)
    if (userRank <= openingRank) {
      const dominance = Math.min(1, (openingRank - userRank) / Math.max(range, 1));
      probabilityPercentage = 80 + dominance * 15; // 80–95
    }

    // ✅ 2️⃣ SAFE ZONE (INSIDE CUTOFF)
    else if (userRank > openingRank && userRank <= closingRank) {
      const closeness = 1 - (userRank - openingRank) / Math.max(range, 1);
      probabilityPercentage = 60 + closeness * 30; // 60–90
    }

    // ⚠️ 3️⃣ RISK ZONE (OUTSIDE CUTOFF)
    else {
      const distance = userRank - closingRank;
      const tolerance = Math.max(range * 0.6, userRank * 0.08);

      if (distance <= tolerance) {
        probabilityPercentage = 35 + (1 - distance / tolerance) * 25; // 35–60
      } else {
        probabilityPercentage = 15 + Math.max(0, 1 - distance / (tolerance * 2)) * 15; // 15–30
      }
    }
  }

  // 🧠 Mild search-mode adjustment (NO harsh penalty)
  const modeFactor = {
    STRICT: 1.05,
    FALLBACK_1: 1.0,
    FALLBACK_2: 0.97,
    FALLBACK_3: 0.94,
    FALLBACK_4: 0.9,
    FALLBACK_5: 0.85
  };

  probabilityPercentage *= modeFactor[searchMode] || 0.95;

  probabilityPercentage = Math.round(
    Math.max(15, Math.min(probabilityPercentage, 95))
  );

  // Labels
  let probability, probabilityColor;
  if (probabilityPercentage >= 70) {
    probability = "High Chance";
    probabilityColor = "green";
  } else if (probabilityPercentage >= 45) {
    probability = "Moderate Chance";
    probabilityColor = "yellow";
  } else {
    probability = "Low Chance";
    probabilityColor = "orange";
  }

  cutoffObj.probabilityPercentage = probabilityPercentage;
  cutoffObj.probability = probability;
  cutoffObj.probabilityColor = probabilityColor;
  cutoffObj.searchMode = searchMode;

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
        : 0,
      searchModeUsed: searchMode
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
