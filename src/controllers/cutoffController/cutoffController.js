const Cutoff = require('../../model/uploadData/Cutoff');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const UserData = require("../../model/userData/user");
const logger = require("../../config/logger");
const CuetCutoffData = require('../../model/uploadData/cuetCutoffData');




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

// CUET Category Parser
const getCategoryFromSeatTypeCUET = (seatType) => {
  if (!seatType || typeof seatType !== 'string') {
    return 'GENERAL';
  }
  
  const normalized = seatType.trim().toUpperCase();
  
  // Map CUET seat types
  const cuetCategoryMap = {
    'GENERAL': 'GENERAL',
    'OPEN': 'GENERAL',
    'OPEN(AF)': 'GENERAL',
    'OPEN(FF)': 'GENERAL',
    'OPEN(PH)': 'GENERAL',
    'EWS': 'EWS',
    'EWS(OPEN)': 'EWS',
    'EWS(GL)': 'EWS',
    'EWS(AF)': 'EWS',
    'EWS(PH)': 'EWS',
    'BC': 'OBC-NCL',
    'BC(GIRL)': 'OBC-NCL',
    'BC(AF)': 'OBC-NCL',
    'BC(FF)': 'OBC-NCL',
    'BC(PH)': 'OBC-NCL',
    'OBC': 'OBC-NCL',
    'OBC-NCL': 'OBC-NCL',
    'SC': 'SC',
    'SC(GIRL)': 'SC',
    'SC(AF)': 'SC',
    'SC(PH)': 'SC',
    'ST': 'ST',
    'ST(GIRL)': 'ST',
    'ST(AF)': 'ST',
    'ST(PH)': 'ST'
  };
  
  // Direct lookup
  if (cuetCategoryMap[normalized]) {
    return cuetCategoryMap[normalized];
  }
  
  // Try pattern matching for unrecognized patterns
  const match = normalized.match(/^([A-Z]+)(?:\([A-Z]+\))?$/);
  if (match) {
    const base = match[1];
    if (base === 'BC' || base === 'OBC') return 'OBC-NCL';
    if (base === 'SC') return 'SC';
    if (base === 'ST') return 'ST';
    if (base === 'EWS') return 'EWS';
  }
  
  return 'GENERAL';
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

//     const existingCutoff = await Cutoff.findOne({
//       year: parseInt(year),
//       round: parseInt(round),
//       typeOfExam: typeOfExam || 'JEE_MAINS'
//     });

//     if (existingCutoff) {
//       return res.status(400).json({
//         success: false,
//         message: `Jossa cutoff data already exists for year ${year}, round ${round}, and exam type ${typeOfExam || 'JEE_MAINS'}`
//       });
//     }

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

//     console.log(`Starting CSV parsing for ${filePath}`);
    
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
//               seatType: seatType,
//               gender: cleanGender(row.Gender || row.gender || 'Gender-Neutral'),
//               openingRank: cleanRank(row['Opening Rank'] || row.openingRank),
//               closingRank: cleanRank(row['Closing Rank'] || row.closingRank),
//               year: parsedYear,
//               round: parsedRound,
//               typeOfExam: row['Exam Type'] || row['typeOfExam'] || typeOfExam || 'JEE_MAINS',
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

//     console.log(`Processing ${results.length} records...`);
    
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
//           // Find existing record
//           const existing = await Cutoff.findOne({
//             institute: record.institute,
//             academicProgramName: record.academicProgramName,
//             seatType: record.seatType,
//             gender: record.gender,
//             year: record.year,
//             round: record.round
//           });

//           if (existing) {
//             // Update existing
//             existing.openingRank = record.openingRank;
//             existing.closingRank = record.closingRank;
//             existing.category = record.category;
//             existing.isPwd = record.isPwd;
//             await existing.save();
//             modifiedCount++;
//           } else {
//             // Create new - use the static method approach
//             const cutoff = new Cutoff(record);
            
//             // Manually set derived fields to avoid middleware issues
//             cutoff.category = record.category;
//             cutoff.isPwd = record.isPwd;
            
//             await cutoff.save();
//             insertedCount++;
//           }
//         } catch (saveError) {
//           console.error('Failed to save record:', {
//             institute: record.institute,
//             program: record.academicProgramName,
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
//       inserted: insertedCount,
//       modified: modifiedCount,
//       failed: failedCount
//     });

//     res.status(200).json({
//       success: true,
//       message: 'CSV data uploaded successfully',
//       data: {
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
    console.log("haha for check only")
    console.log(typeOfExam)

    switch(typeOfExam){
      case 'JEE_MAINS':
        {
          const existingCutoff = await Cutoff.findOne({
            year: parseInt(year),
            round: parseInt(round),
            typeOfExam: typeOfExam
          });
          
          if (existingCutoff) {
            return res.status(400).json({
              success: false,
              message: `JoSSA cutoff data already exists for year ${year}, round ${round}, and exam type ${typeOfExam}`
            });
          }
          break;

        }
      case 'CUET':
        {
          const exiestingCuetCutoff = await CuetCutoffData.findOne({
            year: parseInt(year),
            round: parseInt(round),
            typeOfExam: typeOfExam
          });
          if(exiestingCuetCutoff){
            return res.status(400).json({
              success: false,
              message: `CUET cutoff data already exists for year ${year}, round ${round}, and exam type ${typeOfExam}`
            })
          }
          break;
        }
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid exam type. Must be either "JEE_Mains" or "CUET"'
          });

    }
    
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

    // Validate exam type
    const examType = (typeOfExam || '').toUpperCase();
    let Model;

    console.log("check exam type ")
    console.log(examType)
    
    switch(examType) {
      case 'JEE_MAINS':
      case 'JEE':
        Model = Cutoff; // JEE Main cutoff model
        break;
      case 'CUET':
        Model = CuetCutoffData; // CUET cutoff model
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid exam type. Must be either "JEE_Mains" or "CUET"'
        });
    }

    console.log(`Starting CSV parsing for ${filePath}. Exam type: ${examType}, Model: ${Model.modelName}`);

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
            // Extract and clean data. CSVs sometimes use different headers: prefer explicit `Seat Type`, `Category`, and `Seat Gender`.
            const seatTypeRaw = (row['Seat Type'] || row['seatType'] || row['Category'] || row['category'] || '').toString().trim();
            const seatType = seatTypeRaw || 'OPEN';

            // Category from CSV `Category` column should be authoritative when present
            const categoryRaw = (row['Category'] || row['category'] || '').toString().trim();
            const category = categoryRaw
              ? getCategoryFromSeatTypeCUET(categoryRaw)
              : (examType === 'CUET' ? getCategoryFromSeatTypeCUET(seatType) : getCategoryFromSeatType(cleanSeatType(seatType)));

            // Gender may be in `Seat Gender` column in CUET CSVs
            const genderRaw = (row['Seat Gender'] || row['SeatGender'] || row.Gender || row.gender || '').toString().trim();
            const gender = cleanGender(genderRaw || 'Gender-Neutral');

            const cleanedRow = {
              institute: (row.Institute || row.institute || '').toString().trim().slice(0, 500),
              academicProgramName: (row['Academic Program Name'] || 
                                   row.academicProgramName ||
                                   row.Program || 
                                   '').toString().trim().slice(0, 500),
              typeOfExam: examType, // Use the validated exam type
              seatType: seatType,
              gender: gender,
              openingRank: cleanRank(row['Opening Rank'] || row.openingRank),
              closingRank: cleanRank(row['Closing Rank'] || row.closingRank),
              year: parsedYear,
              round: parsedRound,
              category: category,
              isPwd: seatType.toUpperCase().includes('PH') || seatType.toUpperCase().includes('PWD')
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

    console.log(`Processing ${results.length} records for ${Model.modelName}...`);
    
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
          // Find existing record - search criteria includes ranks to allow multiple seat allocations
          // Different opening/closing ranks = different seat allocations (not duplicates)
          const existing = await Model.findOne({
            institute: record.institute,
            academicProgramName: record.academicProgramName,
            typeOfExam: record.typeOfExam,
            seatType: record.seatType,
            gender: record.gender,
            year: record.year,
            round: record.round,
            openingRank: record.openingRank,
            closingRank: record.closingRank
          });

          if (existing) {
            // Update existing record
            existing.openingRank = record.openingRank;
            existing.closingRank = record.closingRank;
            existing.category = record.category;
            existing.isPwd = record.isPwd;
            await existing.save();
            modifiedCount++;
          } else {
            // Create new record
            const cutoff = new Model(record);
            
            // Manually set derived fields to ensure consistency
            cutoff.category = record.category;
            cutoff.isPwd = record.isPwd;
            
            await cutoff.save();
            insertedCount++;
          }
        } catch (saveError) {
          console.error('Failed to save record:', {
            institute: record.institute,
            program: record.academicProgramName,
            examType: record.typeOfExam,
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
      model: Model.modelName,
      inserted: insertedCount,
      modified: modifiedCount,
      failed: failedCount
    });

    res.status(200).json({
      success: true,
      message: `CSV data uploaded successfully to ${Model.modelName}`,
      data: {
        examType: examType,
        model: Model.modelName,
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
          
          // Prefer CSV `Category` and `Seat Gender` when available
          const seatTypeRaw = (row['Seat Type'] || row['seatType'] || row['Category'] || row['category'] || '').toString().trim();
          const seatType = seatTypeRaw || 'OPEN';

          const categoryRaw = (row['Category'] || row['category'] || '').toString().trim();
          const category = categoryRaw ? getCategoryFromSeatTypeCUET(categoryRaw) : getCategoryFromSeatType(seatType);

          const genderRaw = (row['Seat Gender'] || row['SeatGender'] || row.Gender || row.gender || '').toString().trim();
          const gender = cleanGender(genderRaw || 'Gender-Neutral');

          const record = {
            institute: (row.Institute || '').trim(),
            academicProgramName: (row['Academic Program Name'] || '').trim(),
            seatType: seatType,
            gender: gender,
            openingRank: cleanRank(row['Opening Rank']),
            closingRank: cleanRank(row['Closing Rank']),
            year: parsedYear,
            round: parsedRound,
            category: category,
            isPwd: (seatType || '').toUpperCase().includes('PH') || (seatType || '').toUpperCase().includes('PWD'),
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




// exports.getCutoffs = async (req, res) => {
//   try {
//     const {
//       rank,
//       category,
//       gender,
//       typeOfExam,
//       page = 1,
//       limit = 20,
//       year,
//       round,
//       branch,
//       institute,
//       quota
//     } = req.query;

//     console.log('Received query params:', { 
//       rank, category, gender, typeOfExam, 
//       year, round, branch, institute, quota 
//     });

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

//     const userRank = parseInt(rank);
//     if (isNaN(userRank) || userRank <= 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid rank value",
//       });
//     }

//     // Function to perform search with given filters
//     const performSearch = async (filters, searchMode = 'STRICT') => {
//       console.log(`Search Mode: ${searchMode}`);
//       console.log('Filters:', JSON.stringify(filters, null, 2));
      
//       const skip = (parseInt(page) - 1) * parseInt(limit);
      
//       // Use aggregation for better performance and sorting
//       const aggregationPipeline = [
//         { $match: filters },
//         { 
//           $addFields: {
//             // Calculate rank difference for sorting
//             rankDifference: {
//               $abs: {
//                 $subtract: [userRank, { $divide: [{ $add: ["$openingRank", "$closingRank"] }, 2] }]
//               }
//             }
//           }
//         },
//         { $sort: { rankDifference: 1 } }, // Sort by closest rank
//         { $skip: skip },
//         { $limit: parseInt(limit) }
//       ];

//       const [cutoffs, total] = await Promise.all([
//         Cutoff.aggregate(aggregationPipeline),
//         Cutoff.countDocuments(filters)
//       ]);

//       console.log(`Found ${cutoffs.length} cutoffs in ${searchMode} mode, Total: ${total}`);
      
//       return { cutoffs, total };
//     };

//     // FIXED: Correct category to seatType mapping
//     const categorySeatTypeMap = {
//       'GENERAL': ['OPEN', 'General', 'OPEN (PwD)', 'GEN-PwD'],
//       'EWS': ['EWS', 'Economically Weaker Section', 'EWS-PwD', 'EWS (PwD)'],
//       'OBC-NCL': ['OBC-NCL', 'OBC', 'Other Backward Classes', 'OBC-NCL-PwD', 'OBC-NCL (PwD)'],
//       'SC': ['SC', 'Scheduled Caste', 'SC-PwD', 'SC (PwD)'],
//       'ST': ['ST', 'Scheduled Tribe', 'ST-PwD', 'ST (PwD)'],
//       'GENERAL-PWD': ['OPEN (PwD)', 'OPEN-PwD', 'GEN-PwD'],
//       'EWS-PWD': ['EWS-PwD', 'EWS (PwD)'],
//       'OBC-NCL-PWD': ['OBC-NCL-PwD', 'OBC-NCL (PwD)'],
//       'SC-PWD': ['SC-PwD', 'SC (PwD)'],
//       'ST-PWD': ['ST-PwD', 'ST (PwD)']
//     };

//     // Search with FALLBACK STRATEGY
//     let results = null;
//     let searchMode = 'STRICT';
//     let minResultsRequired = 5; // Minimum results we want to show
    
//     // STRICT MODE: Exact rank match with all filters
//     let baseFilters = {
//       seatType: { $in: categorySeatTypeMap[category] || [category] }
//     };

//     // Add rank filter with initial strict range
//     const rankBufferPercentage = 0.10; // 10% buffer initially
//     const rankBuffer = Math.max(100, Math.round(userRank * rankBufferPercentage));
    
//     baseFilters.openingRank = { $lte: userRank + rankBuffer };
//     baseFilters.closingRank = { $gte: userRank - rankBuffer };

//     // Add gender filter
//     if (gender && gender !== 'All') {
//       const genderFilterMap = {
//         'Male': ['Gender-Neutral', 'Male-only', 'M', 'BOYS', 'Male (including Supernumerary)'],
//         'Female': ['Gender-Neutral', 'Female-only', 'F', 'GIRLS', 'Female-only (including Supernumerary)'],
//         'Female-only': ['Gender-Neutral', 'Female-only', 'F', 'GIRLS', 'Female-only (including Supernumerary)'],
//         'Other': ['Gender-Neutral', 'Other', 'Transgender'],
//         'Gender-neutral': ['Gender-Neutral', 'Gender-neutral'],
//         'All': ['Gender-Neutral', 'Male-only', 'Female-only', 'Other', 
//                 'Male (including Supernumerary)', 'Female-only (including Supernumerary)']
//       };
      
//       baseFilters.gender = { $in: genderFilterMap[gender] || ['Gender-Neutral'] };
//     }

//     // Add additional filters
//     if (year && year !== 'all') {
//       baseFilters.year = parseInt(year);
//     }
    
//     if (round && round !== 'all') {
//       baseFilters.round = parseInt(round);
//     }
    
//     if (branch && branch !== 'all') {
//       baseFilters.academicProgramName = { $regex: branch, $options: 'i' };
//     }
    
//     if (institute && institute !== 'all') {
//       baseFilters.institute = { $regex: institute, $options: 'i' };
//     }
    
//     if (quota && quota !== 'all') {
//       baseFilters.quota = quota;
//     }

//     // Apply exam type filter
//     if (typeOfExam === 'JEE_ADVANCED') {
//       baseFilters.institute = /indian institute of technology|iit/i;
//     } else if (typeOfExam === 'JEE_MAINS') {
//       baseFilters.institute = { $not: /indian institute of technology|iit/i };
//     }

//     // Try STRICT search first
//     results = await performSearch(baseFilters, 'STRICT');
    
//     // FALLBACK 1: If too few results, expand rank range to 20%
//     if (results.total < minResultsRequired && searchMode === 'STRICT') {
//       searchMode = 'FALLBACK_1';
//       const expandedRankBuffer = Math.max(200, Math.round(userRank * 0.20));
//       baseFilters.openingRank = { $lte: userRank + expandedRankBuffer };
//       baseFilters.closingRank = { $gte: userRank - expandedRankBuffer };
      
//       console.log(`Expanding rank range to ±${expandedRankBuffer} (20%)`);
//       results = await performSearch(baseFilters, 'FALLBACK_1');
//     }

//     // FALLBACK 2: If still too few, remove gender filter (if applied)
//     if (results.total < minResultsRequired && searchMode === 'FALLBACK_1' && baseFilters.gender) {
//       searchMode = 'FALLBACK_2';
//       delete baseFilters.gender;
//       console.log('Removing gender filter');
//       results = await performSearch(baseFilters, 'FALLBACK_2');
//     }

//     // FALLBACK 3: If still too few, remove institute type filter
//     if (results.total < minResultsRequired && searchMode === 'FALLBACK_2') {
//       searchMode = 'FALLBACK_3';
//       if (baseFilters.institute && (typeOfExam === 'JEE_ADVANCED' || typeOfExam === 'JEE_MAINS')) {
//         delete baseFilters.institute;
//         console.log('Removing institute type filter');
//       }
//       results = await performSearch(baseFilters, 'FALLBACK_3');
//     }

//     // FALLBACK 4: If still too few, use broader category mapping
//     if (results.total < minResultsRequired && searchMode === 'FALLBACK_3') {
//       searchMode = 'FALLBACK_4';
//       // Use broader category matching
//       const broaderCategoryMap = {
//         'GENERAL': ['OPEN', 'General', 'GEN', 'OPEN (PwD)', 'GEN-PwD', 'OPEN-PWD'],
//         'EWS': ['EWS', 'Economically Weaker Section', 'EWS-PwD', 'EWS (PwD)', 'EWS-PWD'],
//         'OBC-NCL': ['OBC-NCL', 'OBC', 'OBC (NCL)', 'Other Backward Classes', 'OBC-NCL-PwD', 'OBC-NCL-PWD'],
//         'SC': ['SC', 'Scheduled Caste', 'SC-PwD', 'SC (PwD)', 'SC-PWD'],
//         'ST': ['ST', 'Scheduled Tribe', 'ST-PwD', 'ST (PwD)', 'ST-PWD']
//       };
      
//       baseFilters.seatType = { $in: broaderCategoryMap[category] || [category] };
//       console.log('Using broader category mapping');
//       results = await performSearch(baseFilters, 'FALLBACK_4');
//     }

//     // FALLBACK 5: Last resort - show any colleges within rank range regardless of other filters
//     if (results.total < minResultsRequired && searchMode === 'FALLBACK_4') {
//       searchMode = 'FALLBACK_5';
//       const lastResortFilters = {
//         openingRank: { $lte: userRank + 500 },
//         closingRank: { $gte: userRank - 500 },
//         seatType: { $regex: category, $options: 'i' }
//       };
      
//       // Keep only essential filters
//       if (year && year !== 'all') lastResortFilters.year = parseInt(year);
//       if (round && round !== 'all') lastResortFilters.round = parseInt(round);
      
//       console.log('Using last resort fallback with wide rank range');
//       results = await performSearch(lastResortFilters, 'FALLBACK_5');
//     }

//     const { cutoffs, total } = results;
    
//     // Calculate probability for each cutoff
// const cutoffsWithProbability = cutoffs.map(cutoff => {
//   const cutoffObj = cutoff;

//   const openingRank = cutoff.openingRank;
//   const closingRank = cutoff.closingRank;

//   let probabilityPercentage = 0;

//   if (!openingRank || !closingRank) {
//     probabilityPercentage = 20;
//   } else {
//     const range = closingRank - openingRank;

//     // 🥇 1️⃣ DOMINANT ZONE (TOPPER LOGIC)
//     if (userRank <= openingRank) {
//       const dominance = Math.min(1, (openingRank - userRank) / Math.max(range, 1));
//       probabilityPercentage = 80 + dominance * 15; // 80–95
//     }

//     // ✅ 2️⃣ SAFE ZONE (INSIDE CUTOFF)
//     else if (userRank > openingRank && userRank <= closingRank) {
//       const closeness = 1 - (userRank - openingRank) / Math.max(range, 1);
//       probabilityPercentage = 60 + closeness * 30; // 60–90
//     }

//     // ⚠️ 3️⃣ RISK ZONE (OUTSIDE CUTOFF)
//     else {
//       const distance = userRank - closingRank;
//       const tolerance = Math.max(range * 0.6, userRank * 0.08);

//       if (distance <= tolerance) {
//         probabilityPercentage = 35 + (1 - distance / tolerance) * 25; // 35–60
//       } else {
//         probabilityPercentage = 15 + Math.max(0, 1 - distance / (tolerance * 2)) * 15; // 15–30
//       }
//     }
//   }

//   // 🧠 Mild search-mode adjustment (NO harsh penalty)
//   const modeFactor = {
//     STRICT: 1.05,
//     FALLBACK_1: 1.0,
//     FALLBACK_2: 0.97,
//     FALLBACK_3: 0.94,
//     FALLBACK_4: 0.9,
//     FALLBACK_5: 0.85
//   };

//   probabilityPercentage *= modeFactor[searchMode] || 0.95;

//   probabilityPercentage = Math.round(
//     Math.max(15, Math.min(probabilityPercentage, 95))
//   );

//   // Labels
//   let probability, probabilityColor;
//   if (probabilityPercentage >= 70) {
//     probability = "High Chance";
//     probabilityColor = "green";
//   } else if (probabilityPercentage >= 45) {
//     probability = "Moderate Chance";
//     probabilityColor = "yellow";
//   } else {
//     probability = "Low Chance";
//     probabilityColor = "orange";
//   }

//   cutoffObj.probabilityPercentage = probabilityPercentage;
//   cutoffObj.probability = probability;
//   cutoffObj.probabilityColor = probabilityColor;
//   cutoffObj.searchMode = searchMode;

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
//         : 0,
//       searchModeUsed: searchMode
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


// exports.getCutoffs = async (req, res) => {
//   try {
//     const {
//       rank,
//       category,
//       gender,
//       typeOfExam,
//       page = 1,
//       limit = 20,
//       year,
//       round,
//       branch,
//       institute,
//       quota
//     } = req.query;

//     console.log('Received query params:', { 
//       rank, category, gender, typeOfExam, 
//       year, round, branch, institute, quota 
//     });

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

//     const userRank = parseInt(rank);
//     if (isNaN(userRank) || userRank <= 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid rank value",
//       });
//     }

//     // Determine which model to use based on exam type
//     let CutoffModel;
//     let examSpecificConfig = {};
    
//     if (typeOfExam === 'CUET') {
//       CutoffModel = CuetCutoffData
      
//       // CUET specific configuration
//       examSpecificConfig = {
//         rankField: 'closingRank', // CUET might use different field names
//         categoryField: 'category',
//         genderField: 'gender',
//         hasQuota: true
//       };
//     } else {
//       // Default to JEE model
//       CutoffModel = Cutoff;
      
//       // JEE specific configuration
//       examSpecificConfig = {
//         rankField: 'closingRank',
//         categoryField: 'seatType',
//         genderField: 'gender',
//         hasQuota: true
//       };
//     }

//     // Function to perform search with given filters
//     const performSearch = async (filters, searchMode = 'STRICT') => {
//       console.log(`Search Mode: ${searchMode} for ${typeOfExam}`);
//       console.log('Filters:', JSON.stringify(filters, null, 2));
      
//       const skip = (parseInt(page) - 1) * parseInt(limit);
      
//       // Use aggregation for better performance and sorting
//       const aggregationPipeline = [
//         { $match: filters },
//         { 
//           $addFields: {
//             // Calculate rank difference for sorting based on exam type
//             rankDifference: typeOfExam === 'CUET' 
//               ? {
//                   $abs: {
//                     $subtract: [userRank, "$closingRank"]
//                   }
//                 }
//               : {
//                   $abs: {
//                     $subtract: [userRank, { $divide: [{ $add: ["$openingRank", "$closingRank"] }, 2] }]
//                   }
//                 }
//           }
//         },
//         { $sort: { rankDifference: 1 } }, // Sort by closest rank
//         { $skip: skip },
//         { $limit: parseInt(limit) }
//       ];

//       const [cutoffs, total] = await Promise.all([
//         CutoffModel.aggregate(aggregationPipeline),
//         CutoffModel.countDocuments(filters)
//       ]);

//       console.log(`Found ${cutoffs.length} cutoffs in ${searchMode} mode, Total: ${total}`);
      
//       return { cutoffs, total };
//     };

//     // Define category mapping based on exam type
//     let categorySeatTypeMap;
    
//     if (typeOfExam === 'CUET') {
//       // CUET category mapping
//       categorySeatTypeMap = {
//         'GENERAL': ['UR', 'UNRESERVED', 'General', 'OPEN'],
//         'EWS': ['EWS'],
//         'OBC-NCL': ['OBC', 'OBC-NCL', 'Other Backward Classes'],
//         'SC': ['SC', 'Scheduled Caste'],
//         'ST': ['ST', 'Scheduled Tribe'],
//         'GENERAL-PWD': ['UR-PWD', 'GEN-PWD'],
//         'EWS-PWD': ['EWS-PWD'],
//         'OBC-NCL-PWD': ['OBC-NCL-PWD', 'OBC-PWD'],
//         'SC-PWD': ['SC-PWD'],
//         'ST-PWD': ['ST-PWD']
//       };
//     } else {
//       // JEE category mapping
//       categorySeatTypeMap = {
//         'GENERAL': ['OPEN', 'General', 'OPEN (PwD)', 'GEN-PwD'],
//         'EWS': ['EWS', 'Economically Weaker Section', 'EWS-PwD', 'EWS (PwD)'],
//         'OBC-NCL': ['OBC-NCL', 'OBC', 'Other Backward Classes', 'OBC-NCL-PwD', 'OBC-NCL (PwD)'],
//         'SC': ['SC', 'Scheduled Caste', 'SC-PwD', 'SC (PwD)'],
//         'ST': ['ST', 'Scheduled Tribe', 'ST-PwD', 'ST (PwD)'],
//         'GENERAL-PWD': ['OPEN (PwD)', 'OPEN-PwD', 'GEN-PwD'],
//         'EWS-PWD': ['EWS-PwD', 'EWS (PwD)'],
//         'OBC-NCL-PWD': ['OBC-NCL-PwD', 'OBC-NCL (PwD)'],
//         'SC-PWD': ['SC-PwD', 'SC (PwD)'],
//         'ST-PWD': ['ST-PwD', 'ST (PwD)']
//       };
//     }

//     // Search with FALLBACK STRATEGY
//     let results = null;
//     let searchMode = 'STRICT';
//     let minResultsRequired = 5;

//     // Base filters based on exam type
//     let baseFilters = {
//       [examSpecificConfig.categoryField]: { 
//         $in: categorySeatTypeMap[category] || [category] 
//       }
//     };

//     // Add rank filter based on exam type
//     const rankBufferPercentage = typeOfExam === 'CUET' ? 0.15 : 0.10;
//     const rankBuffer = Math.max(100, Math.round(userRank * rankBufferPercentage));
    
//     if (typeOfExam === 'CUET') {
//       // CUET uses only closingRank typically
//       baseFilters.closingRank = { 
//         $gte: userRank - rankBuffer,
//         $lte: userRank + rankBuffer
//       };
//     } else {
//       // JEE uses both opening and closing rank
//       baseFilters.openingRank = { $lte: userRank + rankBuffer };
//       baseFilters.closingRank = { $gte: userRank - rankBuffer };
//     }

//     // Add gender filter
//     if (gender && gender !== 'All') {
//       let genderFilterMap;
      
//       if (typeOfExam === 'CUET') {
//         genderFilterMap = {
//           'Male': ['Male', 'M', 'BOYS'],
//           'Female': ['Female', 'F', 'GIRLS'],
//           'Female-only': ['Female-only', 'F'],
//           'Other': ['Other', 'Transgender'],
//           'Gender-neutral': ['Gender-neutral', 'Neutral'],
//           'All': ['Male', 'Female', 'Other', 'Gender-neutral']
//         };
//       } else {
//         genderFilterMap = {
//           'Male': ['Gender-Neutral', 'Male-only', 'M', 'BOYS', 'Male (including Supernumerary)'],
//           'Female': ['Gender-Neutral', 'Female-only', 'F', 'GIRLS', 'Female-only (including Supernumerary)'],
//           'Female-only': ['Gender-Neutral', 'Female-only', 'F', 'GIRLS', 'Female-only (including Supernumerary)'],
//           'Other': ['Gender-Neutral', 'Other', 'Transgender'],
//           'Gender-neutral': ['Gender-Neutral', 'Gender-neutral'],
//           'All': ['Gender-Neutral', 'Male-only', 'Female-only', 'Other', 
//                   'Male (including Supernumerary)', 'Female-only (including Supernumerary)']
//         };
//       }
      
//       baseFilters[examSpecificConfig.genderField] = { 
//         $in: genderFilterMap[gender] || ['Gender-Neutral'] 
//       };
//     }

//     // Add additional filters
//     if (year && year !== 'all') {
//       baseFilters.year = parseInt(year);
//     }
    
//     if (round && round !== 'all') {
//       baseFilters.round = parseInt(round);
//     }
    
//     if (branch && branch !== 'all') {
//       if (typeOfExam === 'CUET') {
//         baseFilters.courseName = { $regex: branch, $options: 'i' };
//       } else {
//         baseFilters.academicProgramName = { $regex: branch, $options: 'i' };
//       }
//     }
    
//     if (institute && institute !== 'all') {
//       if (typeOfExam === 'CUET') {
//         baseFilters.collegeName = { $regex: institute, $options: 'i' };
//       } else {
//         baseFilters.institute = { $regex: institute, $options: 'i' };
//       }
//     }
    
//     if (quota && quota !== 'all') {
//       baseFilters.quota = quota;
//     }

//     // Apply exam type specific filtering for JEE
//     if (typeOfExam === 'JEE_ADVANCED') {
//       baseFilters.institute = /indian institute of technology|iit/i;
//     } else if (typeOfExam === 'JEE_MAINS') {
//       baseFilters.institute = { $not: /indian institute of technology|iit/i };
//     }

//     // Try STRICT search first
//     results = await performSearch(baseFilters, 'STRICT');
    
//     // FALLBACK 1: If too few results, expand rank range
//     if (results.total < minResultsRequired && searchMode === 'STRICT') {
//       searchMode = 'FALLBACK_1';
//       const expandedRankBuffer = Math.max(200, Math.round(userRank * 0.20));
      
//       if (typeOfExam === 'CUET') {
//         baseFilters.closingRank = { 
//           $gte: userRank - expandedRankBuffer,
//           $lte: userRank + expandedRankBuffer
//         };
//       } else {
//         baseFilters.openingRank = { $lte: userRank + expandedRankBuffer };
//         baseFilters.closingRank = { $gte: userRank - expandedRankBuffer };
//       }
      
//       console.log(`Expanding rank range to ±${expandedRankBuffer}`);
//       results = await performSearch(baseFilters, 'FALLBACK_1');
//     }

//     // FALLBACK 2: If still too few, remove gender filter (if applied)
//     if (results.total < minResultsRequired && searchMode === 'FALLBACK_1' && baseFilters[examSpecificConfig.genderField]) {
//       searchMode = 'FALLBACK_2';
//       delete baseFilters[examSpecificConfig.genderField];
//       console.log('Removing gender filter');
//       results = await performSearch(baseFilters, 'FALLBACK_2');
//     }

//     // FALLBACK 3: If still too few, remove institute type filter for JEE
//     if (results.total < minResultsRequired && searchMode === 'FALLBACK_2') {
//       searchMode = 'FALLBACK_3';
//       if (baseFilters.institute && (typeOfExam === 'JEE_ADVANCED' || typeOfExam === 'JEE_MAINS')) {
//         delete baseFilters.institute;
//         console.log('Removing institute type filter');
//       }
//       results = await performSearch(baseFilters, 'FALLBACK_3');
//     }

//     // FALLBACK 4: If still too few, use broader category mapping
//     if (results.total < minResultsRequired && searchMode === 'FALLBACK_3') {
//       searchMode = 'FALLBACK_4';
      
//       let broaderCategoryMap;
//       if (typeOfExam === 'CUET') {
//         broaderCategoryMap = {
//           'GENERAL': ['UR', 'UNRESERVED', 'General', 'OPEN', 'GEN'],
//           'EWS': ['EWS'],
//           'OBC-NCL': ['OBC', 'OBC-NCL', 'Other Backward Classes'],
//           'SC': ['SC', 'Scheduled Caste'],
//           'ST': ['ST', 'Scheduled Tribe']
//         };
//       } else {
//         broaderCategoryMap = {
//           'GENERAL': ['OPEN', 'General', 'GEN', 'OPEN (PwD)', 'GEN-PwD', 'OPEN-PWD'],
//           'EWS': ['EWS', 'Economically Weaker Section', 'EWS-PwD', 'EWS (PwD)', 'EWS-PWD'],
//           'OBC-NCL': ['OBC-NCL', 'OBC', 'OBC (NCL)', 'Other Backward Classes', 'OBC-NCL-PwD', 'OBC-NCL-PWD'],
//           'SC': ['SC', 'Scheduled Caste', 'SC-PwD', 'SC (PwD)', 'SC-PWD'],
//           'ST': ['ST', 'Scheduled Tribe', 'ST-PwD', 'ST (PwD)', 'ST-PWD']
//         };
//       }
      
//       baseFilters[examSpecificConfig.categoryField] = { 
//         $in: broaderCategoryMap[category] || [category] 
//       };
//       console.log('Using broader category mapping');
//       results = await performSearch(baseFilters, 'FALLBACK_4');
//     }

//     // FALLBACK 5: Last resort - show any colleges within rank range regardless of other filters
//     if (results.total < minResultsRequired && searchMode === 'FALLBACK_4') {
//       searchMode = 'FALLBACK_5';
//       let lastResortFilters = {};
      
//       if (typeOfExam === 'CUET') {
//         lastResortFilters = {
//           closingRank: { 
//             $gte: userRank - 1000,
//             $lte: userRank + 1000
//           },
//           [examSpecificConfig.categoryField]: { $regex: category, $options: 'i' }
//         };
//       } else {
//         lastResortFilters = {
//           openingRank: { $lte: userRank + 500 },
//           closingRank: { $gte: userRank - 500 },
//           [examSpecificConfig.categoryField]: { $regex: category, $options: 'i' }
//         };
//       }
      
//       // Keep only essential filters
//       if (year && year !== 'all') lastResortFilters.year = parseInt(year);
//       if (round && round !== 'all') lastResortFilters.round = parseInt(round);
      
//       console.log('Using last resort fallback with wide rank range');
//       results = await performSearch(lastResortFilters, 'FALLBACK_5');
//     }

//     const { cutoffs, total } = results;
    
//     // Calculate probability for each cutoff (exam specific logic)
//     const cutoffsWithProbability = cutoffs.map(cutoff => {
//       const cutoffObj = cutoff;

//       let probabilityPercentage = 0;

//       if (typeOfExam === 'CUET') {
//         // CUET probability calculation (simpler, based on closing rank)
//         const closingRank = cutoff.closingRank;
        
//         if (!closingRank) {
//           probabilityPercentage = 20;
//         } else {
//           const rankDifference = userRank - closingRank;
          
//           if (rankDifference <= 0) {
//             // User rank is better than or equal to closing rank
//             probabilityPercentage = 85 - (rankDifference * 0.05);
//           } else {
//             // User rank is worse than closing rank
//             const relativeDifference = rankDifference / Math.max(closingRank, 1);
//             probabilityPercentage = Math.max(15, 60 - (relativeDifference * 100));
//           }
//         }
//       } else {
//         // JEE probability calculation (original logic)
//         const openingRank = cutoff.openingRank;
//         const closingRank = cutoff.closingRank;

//         if (!openingRank || !closingRank) {
//           probabilityPercentage = 20;
//         } else {
//           const range = closingRank - openingRank;

//           // DOMINANT ZONE (TOPPER LOGIC)
//           if (userRank <= openingRank) {
//             const dominance = Math.min(1, (openingRank - userRank) / Math.max(range, 1));
//             probabilityPercentage = 80 + dominance * 15; // 80–95
//           }
//           // SAFE ZONE (INSIDE CUTOFF)
//           else if (userRank > openingRank && userRank <= closingRank) {
//             const closeness = 1 - (userRank - openingRank) / Math.max(range, 1);
//             probabilityPercentage = 60 + closeness * 30; // 60–90
//           }
//           // RISK ZONE (OUTSIDE CUTOFF)
//           else {
//             const distance = userRank - closingRank;
//             const tolerance = Math.max(range * 0.6, userRank * 0.08);

//             if (distance <= tolerance) {
//               probabilityPercentage = 35 + (1 - distance / tolerance) * 25; // 35–60
//             } else {
//               probabilityPercentage = 15 + Math.max(0, 1 - distance / (tolerance * 2)) * 15; // 15–30
//             }
//           }
//         }
//       }

//       // Search-mode adjustment
//       const modeFactor = {
//         STRICT: 1.05,
//         FALLBACK_1: 1.0,
//         FALLBACK_2: 0.97,
//         FALLBACK_3: 0.94,
//         FALLBACK_4: 0.9,
//         FALLBACK_5: 0.85
//       };

//       probabilityPercentage *= modeFactor[searchMode] || 0.95;

//       probabilityPercentage = Math.round(
//         Math.max(15, Math.min(probabilityPercentage, 95))
//       );

//       // Labels
//       let probability, probabilityColor;
//       if (probabilityPercentage >= 70) {
//         probability = "High Chance";
//         probabilityColor = "green";
//       } else if (probabilityPercentage >= 45) {
//         probability = "Moderate Chance";
//         probabilityColor = "yellow";
//       } else {
//         probability = "Low Chance";
//         probabilityColor = "orange";
//       }

//       cutoffObj.probabilityPercentage = probabilityPercentage;
//       cutoffObj.probability = probability;
//       cutoffObj.probabilityColor = probabilityColor;
//       cutoffObj.searchMode = searchMode;
//       cutoffObj.examType = typeOfExam;

//       return cutoffObj;
//     });

//     // Get summary statistics
//     const summary = {
//       examType: typeOfExam || 'JEE',
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
//         : 0,
//       searchModeUsed: searchMode
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



// exports.getCutoffs = async (req, res) => {
//   try {
//     const {
//       rank,
//       category,
//       gender,
//       typeOfExam,
//       page = 1,
//       limit = 20,
//       year,
//       round,
//       branch,
//       institute,
//       quota
//     } = req.query;

//     console.log('Received query params:', { 
//       rank, category, gender, typeOfExam, 
//       year, round, branch, institute, quota 
//     });

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

//     const userRank = parseInt(rank);
//     if (isNaN(userRank) || userRank <= 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid rank value",
//       });
//     }

//     // Determine which model to use based on exam type
//     let CutoffModel;
//     let examSpecificConfig = {};
    
//     if (typeOfExam === 'CUET') {
//       CutoffModel = CuetCutoffData;
      
//       // CUET specific configuration - UPDATED
//       examSpecificConfig = {
//         rankField: 'closingRank',
//         categoryField: 'seatType',  // CHANGED: Use seatType for CUET
//         genderField: 'gender',
//         instituteField: 'institute', // CHANGED: Use institute field
//         programField: 'academicProgramName' // CHANGED: Use academicProgramName
//       };
//     } else {
//       // Default to JEE model
//       CutoffModel = Cutoff;
      
//       // JEE specific configuration
//       examSpecificConfig = {
//         rankField: 'closingRank',
//         categoryField: 'seatType',
//         genderField: 'gender',
//         instituteField: 'institute',
//         programField: 'academicProgramName'
//       };
//     }

//     // Function to perform search with given filters
//     const performSearch = async (filters, searchMode = 'STRICT') => {
//       console.log(`Search Mode: ${searchMode} for ${typeOfExam}`);
//       console.log('Filters:', JSON.stringify(filters, null, 2));
      
//       const skip = (parseInt(page) - 1) * parseInt(limit);
      
//       // Build match stage
//       const matchStage = { $match: filters };
      
//       // Use aggregation for better performance and sorting
//       const aggregationPipeline = [matchStage];
      
//       // Add fields for sorting
//       aggregationPipeline.push({
//         $addFields: {
//           // Calculate rank difference based on exam type
//           rankDifference: {
//             $abs: {
//               $subtract: [userRank, "$closingRank"]
//             }
//           },
//           // Add a score for better sorting (lower closing rank is better)
//           rankScore: {
//             $cond: {
//               if: { $lte: [userRank, "$closingRank"] },
//               then: {
//                 $subtract: ["$closingRank", userRank]
//               },
//               else: {
//                 $subtract: [userRank, "$closingRank"]
//               }
//             }
//           }
//         }
//       });
      
//       // Sort by rankScore (closest matches first)
//       aggregationPipeline.push({ $sort: { rankScore: 1, rankDifference: 1 } });
      
//       // Skip and limit
//       aggregationPipeline.push({ $skip: skip });
//       aggregationPipeline.push({ $limit: parseInt(limit) });
      
//       // Execute query
//       const [cutoffs, total] = await Promise.all([
//         CutoffModel.aggregate(aggregationPipeline),
//         CutoffModel.countDocuments(filters)
//       ]);

//       console.log(`Found ${cutoffs.length} cutoffs in ${searchMode} mode, Total: ${total}`);
      
//       return { cutoffs, total };
//     };

//     // Define category mapping based on exam type
//     let categorySeatTypeMap;
    
//     if (typeOfExam === 'CUET') {
//       // UPDATED CUET category mapping based on your data structure
//       categorySeatTypeMap = {
//         'GENERAL': ['GENERAL', 'UR', 'UNRESERVED', 'General', 'OPEN', 'GEN'],
//         'EWS': ['EWS(OPEN)', 'EWS(GL)', 'EWS(AF)', 'EWS'],
//         'OBC-NCL': ['BC', 'BC(Girl)', 'BC(AF)', 'OBC', 'OBC-NCL', 'Other Backward Classes'],
//         'SC': ['SC', 'SC(Girl)', 'SC(AF)', 'Scheduled Caste'],
//         'ST': ['ST', 'ST(Girl)', 'Scheduled Tribe'],
//         'OPEN': ['OPEN(AF)', 'OPEN(FF)', 'OPEN'],
//         // Add mappings for sub-categories
//         'BC': ['BC', 'BC(Girl)', 'BC(AF)'],
//         'SC(Girl)': ['SC(Girl)'],
//         'BC(Girl)': ['BC(Girl)'],
//         'EWS(OPEN)': ['EWS(OPEN)'],
//         'EWS(GL)': ['EWS(GL)'],
//         'OPEN(AF)': ['OPEN(AF)']
//       };
//     } else {
//       // JEE category mapping
//       categorySeatTypeMap = {
//         'GENERAL': ['OPEN', 'General', 'OPEN (PwD)', 'GEN-PwD'],
//         'EWS': ['EWS', 'Economically Weaker Section', 'EWS-PwD', 'EWS (PwD)'],
//         'OBC-NCL': ['OBC-NCL', 'OBC', 'Other Backward Classes', 'OBC-NCL-PwD', 'OBC-NCL (PwD)'],
//         'SC': ['SC', 'Scheduled Caste', 'SC-PwD', 'SC (PwD)'],
//         'ST': ['ST', 'Scheduled Tribe', 'ST-PwD', 'ST (PwD)'],
//         'GENERAL-PWD': ['OPEN (PwD)', 'OPEN-PwD', 'GEN-PwD'],
//         'EWS-PWD': ['EWS-PwD', 'EWS (PwD)'],
//         'OBC-NCL-PWD': ['OBC-NCL-PwD', 'OBC-NCL (PwD)'],
//         'SC-PWD': ['SC-PwD', 'SC (PwD)'],
//         'ST-PWD': ['ST-PwD', 'ST (PwD)']
//       };
//     }

//     // Search with FALLBACK STRATEGY
//     let results = null;
//     let searchMode = 'STRICT';
//     let minResultsRequired = 5;

//     // Base filters based on exam type
//     let baseFilters = {};
    
//     // IMPORTANT: For CUET, use the normalized category from the model
//     // Check if we're searching for a main category or sub-category
//     let categoryFilterValue;
//     if (typeOfExam === 'CUET') {
//       // If category has parentheses (like BC(Girl)), search for exact match
//       // Otherwise search for main category
//       if (category.includes('(')) {
//         categoryFilterValue = [category];
//       } else {
//         categoryFilterValue = categorySeatTypeMap[category] || [category];
//       }
//     } else {
//       categoryFilterValue = categorySeatTypeMap[category] || [category];
//     }
    
//     baseFilters[examSpecificConfig.categoryField] = { 
//       $in: categoryFilterValue 
//     };

//     // Add rank filter - UPDATED for CUET
//     const rankBufferPercentage = typeOfExam === 'CUET' ? 0.20 : 0.10;
//     const rankBuffer = Math.max(100, Math.round(userRank * rankBufferPercentage));
    
//     // For CUET, we need to check both opening and closing ranks
//     baseFilters.$or = [
//       {
//         openingRank: { $lte: userRank + rankBuffer },
//         closingRank: { $gte: userRank - rankBuffer }
//       },
//       {
//         closingRank: { 
//           $gte: userRank - (rankBuffer * 2),
//           $lte: userRank + (rankBuffer * 2)
//         }
//       }
//     ];

//     // Add gender filter - UPDATED for CUET
//     if (gender && gender !== 'All') {
//       let genderFilterMap;
      
//       if (typeOfExam === 'CUET') {
//         // UPDATED CUET gender mapping based on your data
//         genderFilterMap = {
//           'Male': ['Gender-Neutral', 'Male', 'M', 'BOYS'],
//           'Female': ['Female-only', 'Female', 'F', 'GIRLS', 'Female-only (including Supernumerary)'],
//           'Female-only': ['Female-only', 'Female', 'F', 'GIRLS', 'Female-only (including Supernumerary)'],
//           'Other': ['Other', 'Transgender'],
//           'Gender-neutral': ['Gender-Neutral', 'Gender-neutral', 'Gender-Neutral'],
//           'All': ['Gender-Neutral', 'Female-only', 'Male', 'Other']
//         };
//       } else {
//         genderFilterMap = {
//           'Male': ['Gender-Neutral', 'Male-only', 'M', 'BOYS', 'Male (including Supernumerary)'],
//           'Female': ['Gender-Neutral', 'Female-only', 'F', 'GIRLS', 'Female-only (including Supernumerary)'],
//           'Female-only': ['Gender-Neutral', 'Female-only', 'F', 'GIRLS', 'Female-only (including Supernumerary)'],
//           'Other': ['Gender-Neutral', 'Other', 'Transgender'],
//           'Gender-neutral': ['Gender-Neutral', 'Gender-neutral'],
//           'All': ['Gender-Neutral', 'Male-only', 'Female-only', 'Other', 
//                   'Male (including Supernumerary)', 'Female-only (including Supernumerary)']
//         };
//       }
      
//       baseFilters[examSpecificConfig.genderField] = { 
//         $in: genderFilterMap[gender] || ['Gender-Neutral'] 
//       };
//     } else {
//       // If gender is 'All' or not specified, include all genders for CUET
//       if (typeOfExam === 'CUET') {
//         baseFilters[examSpecificConfig.genderField] = { 
//           $in: ['Gender-Neutral', 'Female-only', 'Male', 'Female-only (including Supernumerary)'] 
//         };
//       }
//     }

//     // Add additional filters
//     if (year && year !== 'all') {
//       baseFilters.year = parseInt(year);
//     } else {
//       // Default to 2025 for CUET if not specified
//       if (typeOfExam === 'CUET') {
//         baseFilters.year = 2025;
//       }
//     }
    
//     if (round && round !== 'all') {
//       baseFilters.round = parseInt(round);
//     } else {
//       // Default to round 1 for CUET if not specified
//       if (typeOfExam === 'CUET') {
//         baseFilters.round = 1;
//       }
//     }
    
//     if (branch && branch !== 'all') {
//       baseFilters[examSpecificConfig.programField] = { $regex: branch, $options: 'i' };
//     }
    
//     if (institute && institute !== 'all') {
//       baseFilters[examSpecificConfig.instituteField] = { $regex: institute, $options: 'i' };
//     }
    
//     if (quota && quota !== 'all') {
//       baseFilters.quota = quota;
//     }

//     // For CUET, always include Home State quota if not specified
//     if (typeOfExam === 'CUET' && (!quota || quota === 'all')) {
//       baseFilters.quota = 'Home State';
//     }

//     // Try STRICT search first
//     results = await performSearch(baseFilters, 'STRICT');
    
//     // FALLBACK 1: If too few results, relax gender filter for CUET
//     if (results.total < minResultsRequired && searchMode === 'STRICT' && typeOfExam === 'CUET') {
//       searchMode = 'FALLBACK_1';
//       // For CUET, include Gender-Neutral in all cases
//       if (baseFilters[examSpecificConfig.genderField]) {
//         const currentGenderFilters = baseFilters[examSpecificConfig.genderField].$in || [];
//         if (!currentGenderFilters.includes('Gender-Neutral')) {
//           baseFilters[examSpecificConfig.genderField].$in = [...currentGenderFilters, 'Gender-Neutral'];
//         }
//       }
//       console.log('Expanding gender filter to include Gender-Neutral');
//       results = await performSearch(baseFilters, 'FALLBACK_1');
//     }

//     // FALLBACK 2: If still too few, expand rank range
//     if (results.total < minResultsRequired && searchMode === 'FALLBACK_1') {
//       searchMode = 'FALLBACK_2';
//       const expandedRankBuffer = Math.max(500, Math.round(userRank * 0.30));
      
//       // Update the rank filters
//       baseFilters.$or = [
//         {
//           openingRank: { $lte: userRank + expandedRankBuffer },
//           closingRank: { $gte: userRank - expandedRankBuffer }
//         },
//         {
//           closingRank: { 
//             $gte: userRank - (expandedRankBuffer * 2),
//             $lte: userRank + (expandedRankBuffer * 2)
//           }
//         }
//       ];
      
//       console.log(`Expanding rank range to ±${expandedRankBuffer}`);
//       results = await performSearch(baseFilters, 'FALLBACK_2');
//     }

//     // FALLBACK 3: If still too few, remove gender filter completely
//     if (results.total < minResultsRequired && searchMode === 'FALLBACK_2' && baseFilters[examSpecificConfig.genderField]) {
//       searchMode = 'FALLBACK_3';
//       delete baseFilters[examSpecificConfig.genderField];
//       console.log('Removing gender filter completely');
//       results = await performSearch(baseFilters, 'FALLBACK_3');
//     }

//     // FALLBACK 4: If still too few, use broader category matching
//     if (results.total < minResultsRequired && searchMode === 'FALLBACK_3') {
//       searchMode = 'FALLBACK_4';
      
//       // For CUET, use regex for category matching
//       if (typeOfExam === 'CUET') {
//         delete baseFilters[examSpecificConfig.categoryField].$in;
//         baseFilters[examSpecificConfig.categoryField] = { 
//           $regex: category.replace(/[()]/g, '.*'), 
//           $options: 'i' 
//         };
//       } else {
//         // Broader mapping for JEE
//         let broaderCategoryMap = {
//           'GENERAL': ['OPEN', 'General', 'GEN', 'OPEN (PwD)', 'GEN-PwD', 'OPEN-PWD'],
//           'EWS': ['EWS', 'Economically Weaker Section', 'EWS-PwD', 'EWS (PwD)', 'EWS-PWD'],
//           'OBC-NCL': ['OBC-NCL', 'OBC', 'OBC (NCL)', 'Other Backward Classes', 'OBC-NCL-PwD', 'OBC-NCL-PWD'],
//           'SC': ['SC', 'Scheduled Caste', 'SC-PwD', 'SC (PwD)', 'SC-PWD'],
//           'ST': ['ST', 'Scheduled Tribe', 'ST-PwD', 'ST (PwD)', 'ST-PWD']
//         };
        
//         baseFilters[examSpecificConfig.categoryField] = { 
//           $in: broaderCategoryMap[category] || [category] 
//         };
//       }
      
//       console.log('Using broader category matching');
//       results = await performSearch(baseFilters, 'FALLBACK_4');
//     }

//     // FALLBACK 5: Last resort - show any colleges within wider rank range
//     if (results.total < minResultsRequired && searchMode === 'FALLBACK_4') {
//       searchMode = 'FALLBACK_5';
      
//       // Wide rank filter
//       const wideRankBuffer = typeOfExam === 'CUET' ? 100000 : 5000;
//       let lastResortFilters = {
//         closingRank: { 
//           $gte: userRank - wideRankBuffer,
//           $lte: userRank + wideRankBuffer
//         }
//       };
      
//       // Keep essential filters
//       if (year && year !== 'all') lastResortFilters.year = parseInt(year);
//       if (round && round !== 'all') lastResortFilters.round = parseInt(round);
//       if (typeOfExam === 'CUET') lastResortFilters.quota = 'Home State';
      
//       // Category filter (case-insensitive partial match)
//       if (category) {
//         lastResortFilters[examSpecificConfig.categoryField] = { 
//           $regex: category.replace(/[()]/g, '.*'), 
//           $options: 'i' 
//         };
//       }
      
//       console.log('Using last resort fallback with wide rank range');
//       results = await performSearch(lastResortFilters, 'FALLBACK_5');
//     }

//     const { cutoffs, total } = results;
    
//     // Calculate probability for each cutoff
//     const cutoffsWithProbability = cutoffs.map(cutoff => {
//       const cutoffObj = cutoff;
//       let probabilityPercentage = 0;

//       if (typeOfExam === 'CUET') {
//         // CUET probability calculation
//         const closingRank = cutoff.closingRank;
//         const openingRank = cutoff.openingRank || closingRank;
        
//         if (!closingRank) {
//           probabilityPercentage = 20;
//         } else {
//           // If user rank is within opening-closing range
//           if (userRank >= openingRank && userRank <= closingRank) {
//             const range = closingRank - openingRank;
//             if (range === 0) {
//               probabilityPercentage = 80;
//             } else {
//               const positionInRange = (userRank - openingRank) / range;
//               probabilityPercentage = 80 - (positionInRange * 40); // 80-40%
//             }
//           } 
//           // If user rank is better than opening rank
//           else if (userRank < openingRank) {
//             const distance = openingRank - userRank;
//             const relativeDistance = distance / Math.max(openingRank, 1);
//             probabilityPercentage = Math.min(95, 85 + (relativeDistance * 50));
//           }
//           // If user rank is worse than closing rank
//           else {
//             const distance = userRank - closingRank;
//             const relativeDistance = distance / Math.max(closingRank, 1);
//             probabilityPercentage = Math.max(15, 60 - (relativeDistance * 100));
//           }
//         }
//       } else {
//         // JEE probability calculation (original logic)
//         const openingRank = cutoff.openingRank;
//         const closingRank = cutoff.closingRank;

//         if (!openingRank || !closingRank) {
//           probabilityPercentage = 20;
//         } else {
//           const range = closingRank - openingRank;

//           // DOMINANT ZONE (TOPPER LOGIC)
//           if (userRank <= openingRank) {
//             const dominance = Math.min(1, (openingRank - userRank) / Math.max(range, 1));
//             probabilityPercentage = 80 + dominance * 15; // 80–95
//           }
//           // SAFE ZONE (INSIDE CUTOFF)
//           else if (userRank > openingRank && userRank <= closingRank) {
//             const closeness = 1 - (userRank - openingRank) / Math.max(range, 1);
//             probabilityPercentage = 60 + closeness * 30; // 60–90
//           }
//           // RISK ZONE (OUTSIDE CUTOFF)
//           else {
//             const distance = userRank - closingRank;
//             const tolerance = Math.max(range * 0.6, userRank * 0.08);

//             if (distance <= tolerance) {
//               probabilityPercentage = 35 + (1 - distance / tolerance) * 25; // 35–60
//             } else {
//               probabilityPercentage = 15 + Math.max(0, 1 - distance / (tolerance * 2)) * 15; // 15–30
//             }
//           }
//         }
//       }

//       // Search-mode adjustment
//       const modeFactor = {
//         STRICT: 1.05,
//         FALLBACK_1: 1.0,
//         FALLBACK_2: 0.97,
//         FALLBACK_3: 0.94,
//         FALLBACK_4: 0.9,
//         FALLBACK_5: 0.85
//       };

//       probabilityPercentage *= modeFactor[searchMode] || 0.95;

//       probabilityPercentage = Math.round(
//         Math.max(15, Math.min(probabilityPercentage, 95))
//       );

//       // Labels
//       let probability, probabilityColor;
//       if (probabilityPercentage >= 70) {
//         probability = "High Chance";
//         probabilityColor = "green";
//       } else if (probabilityPercentage >= 45) {
//         probability = "Moderate Chance";
//         probabilityColor = "yellow";
//       } else {
//         probability = "Low Chance";
//         probabilityColor = "orange";
//       }

//       cutoffObj.probabilityPercentage = probabilityPercentage;
//       cutoffObj.probability = probability;
//       cutoffObj.probabilityColor = probabilityColor;
//       cutoffObj.searchMode = searchMode;
//       cutoffObj.examType = typeOfExam;

//       return cutoffObj;
//     });

//     // Get summary statistics
//     const summary = {
//       examType: typeOfExam || 'JEE',
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
//         : 0,
//       searchModeUsed: searchMode,
//       userRank: userRank,
//       category: category
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

// exports.getCutoffs = async (req, res) => {
//   try {
//     const {
//       rank,
//       category, // Keep category as optional parameter
//       gender,
//       typeOfExam,
//       page = 1,
//       limit = 20,
//       year,
//       round,
//       branch,
//       institute,
//       quota
//     } = req.query;

//     console.log('Received query params:', { 
//       rank, category, gender, typeOfExam, 
//       year, round, branch, institute, quota 
//     });

//     if (!rank) {
//       return res.status(400).json({ success: false, message: "Rank is required" });
//     }

//     const userRank = parseInt(rank);
//     if (isNaN(userRank) || userRank < 0) {
//       return res.status(400).json({ success: false, message: "Invalid rank value" });
//     }

//     // Determine model
//     let CutoffModel = Cutoff;
//     let examSpecificConfig = {
//       rankField: 'closingRank',
//       categoryField: 'seatType',
//       genderField: 'gender',
//       instituteField: 'institute',
//       programField: 'academicProgramName'
//     };

//     if (String(typeOfExam).toUpperCase() === 'CUET') {
//       CutoffModel = CuetCutoffData;
//       // CUET uses `category` field (not `seatType`) for normalized categories
//       examSpecificConfig.categoryField = 'category';
//     }

//     // Helper: build categorySeatTypeMap only once and keep keys consistent
//     let categorySeatTypeMap = {};
//     if (String(typeOfExam).toUpperCase() === 'CUET') {
//       categorySeatTypeMap = {
//         'GENERAL': ['GENERAL', 'UR', 'UNRESERVED', 'General', 'OPEN', 'GEN'],
//         'EWS': ['EWS(OPEN)', 'EWS(GL)', 'EWS(AF)', 'EWS'],
//         'OBC-NCL': ['BC', 'BC(Girl)', 'BC(AF)', 'OBC', 'OBC-NCL', 'Other Backward Classes'],
//         'SC': ['SC', 'SC(Girl)', 'SC(AF)', 'Scheduled Caste'],
//         'ST': ['ST', 'ST(Girl)', 'Scheduled Tribe'],
//         'OPEN': ['OPEN(AF)', 'OPEN(FF)', 'OPEN'],
//         'BC': ['BC', 'BC(Girl)', 'BC(AF)'],
//         'SC(Girl)': ['SC(Girl)'],
//         'BC(Girl)': ['BC(Girl)'],
//         'EWS(OPEN)': ['EWS(OPEN)'],
//         'EWS(GL)': ['EWS(GL)'],
//         'OPEN(AF)': ['OPEN(AF)']
//       };
//     } else {
//       categorySeatTypeMap = {
//         'GENERAL': ['OPEN', 'General', 'OPEN (PwD)', 'GEN-PwD', 'UR'],
//         'EWS': ['EWS', 'Economically Weaker Section', 'EWS-PwD', 'EWS (PwD)'],
//         'OBC-NCL': ['OBC-NCL', 'OBC', 'Other Backward Classes', 'OBC-NCL-PwD', 'OBC-NCL (PwD)', 'BC'],
//         'SC': ['SC', 'Scheduled Caste', 'SC-PwD', 'SC (PwD)'],
//         'ST': ['ST', 'Scheduled Tribe', 'ST-PwD', 'ST (PwD)'],
//         'GENERAL-PWD': ['OPEN (PwD)', 'OPEN-PwD', 'GEN-PwD'],
//         'EWS-PWD': ['EWS-PwD', 'EWS (PwD)'],
//         'OBC-NCL-PWD': ['OBC-NCL-PwD', 'OBC-NCL (PwD)'],
//         'SC-PWD': ['SC-PwD', 'SC (PwD)'],
//         'ST-PWD': ['ST-PwD', 'ST (PwD)']
//       };
//     }

//     // Normalize category input to canonical key (case-insensitive + synonyms)
//     let normalizedCategory = null;
//     if (category) {
//       const c = String(category).trim();
//       const synonyms = {
//         'GEN': 'GENERAL', 'OPEN': 'GENERAL', 'UR': 'GENERAL', 'GENERAL': 'GENERAL',
//         'BC': 'OBC-NCL', 'OBC': 'OBC-NCL', 'OBC-NCL': 'OBC-NCL',
//         'SC': 'SC', 'ST': 'ST', 'EWS': 'EWS'
//       };
//       const key = c.toUpperCase();
//       if (synonyms[key]) normalizedCategory = synonyms[key];
//       else {
//         // Try direct key match in map
//         normalizedCategory = Object.keys(categorySeatTypeMap).find(k => k.toUpperCase() === key);
//         if (!normalizedCategory) {
//           // Try partial match
//           normalizedCategory = Object.keys(categorySeatTypeMap).find(k => k.toUpperCase().includes(key)) || null;
//         }
//       }
//     }

//     // Function to perform search with given filters
//     const performSearch = async (filters, searchMode = 'STRICT') => {
//       console.log(`Search Mode: ${searchMode} for ${typeOfExam}`);
//       console.log('Filters:', JSON.stringify(filters, null, 2));

//       const skip = (parseInt(page) - 1) * parseInt(limit);
//       const matchStage = { $match: filters };
//       const aggregationPipeline = [matchStage];

//       aggregationPipeline.push({
//         $addFields: {
//           rankDifference: { $abs: { $subtract: [userRank, "$closingRank"] } },
//           rankScore: {
//             $cond: {
//               if: { $lte: [userRank, "$closingRank"] },
//               then: { $subtract: ["$closingRank", userRank] },
//               else: { $subtract: [userRank, "$closingRank"] }
//             }
//           }
//         }
//       });

//       aggregationPipeline.push({ $sort: { rankScore: 1, rankDifference: 1 } });
//       aggregationPipeline.push({ $skip: skip });
//       aggregationPipeline.push({ $limit: parseInt(limit) });

//       const [cutoffs, total] = await Promise.all([
//         CutoffModel.aggregate(aggregationPipeline),
//         CutoffModel.countDocuments(filters)
//       ]);

//       console.log(`Found ${cutoffs.length} cutoffs in ${searchMode} mode, Total: ${total}`);
//       return { cutoffs, total };
//     };

//     // Base filters
//     let baseFilters = {};

//     // Apply category filter (normalized) if we found a canonical mapping
//     if (normalizedCategory && categorySeatTypeMap[normalizedCategory]) {
//       baseFilters[examSpecificConfig.categoryField] = { $in: categorySeatTypeMap[normalizedCategory] };
//       console.log(`Using normalized category: ${normalizedCategory}`);
//     } else if (category) {
//       // If we couldn't normalize, try a fuzzy seatType match to avoid dropping results entirely
//       baseFilters.$or = baseFilters.$or || [];
//       baseFilters.$or.push({ [examSpecificConfig.categoryField]: { $regex: category, $options: 'i' } });
//       console.log(`Category '${category}' not normalized, using fuzzy seatType match`);
//     }

//     // Add rank filter - widen buffer for reserved categories (SC/ST/OBC)
//     const baseRankBufferPercentage = String(typeOfExam).toUpperCase() === 'CUET' ? 0.20 : 0.10;
//     let rankBuffer = Math.max(100, Math.round(userRank * baseRankBufferPercentage));

//     if (normalizedCategory && ['SC', 'ST', 'OBC-NCL'].includes(normalizedCategory)) {
//       rankBuffer = Math.round(rankBuffer * 1.5);
//       console.log(`Widened rank buffer for reserved category ${normalizedCategory}: ${rankBuffer}`);
//     }

//     baseFilters.$or = baseFilters.$or || [];
//     baseFilters.$or.push({
//       openingRank: { $lte: userRank + rankBuffer },
//       closingRank: { $gte: userRank - rankBuffer }
//     });
//     baseFilters.$or.push({
//       closingRank: {
//         $gte: userRank - (rankBuffer * 2),
//         $lte: userRank + (rankBuffer * 2)
//       }
//     });

//     // Gender filter handling (unchanged, but kept here)
//     if (gender && gender !== 'All') {
//       let genderFilterMap;
//       if (String(typeOfExam).toUpperCase() === 'CUET') {
//         genderFilterMap = {
//           'Male': ['Gender-Neutral', 'Male', 'M', 'BOYS'],
//           'Female': ['Female-only', 'Female', 'F', 'GIRLS', 'Female-only (including Supernumerary)'],
//           'Female-only': ['Female-only', 'Female', 'F', 'GIRLS', 'Female-only (including Supernumerary)'],
//           'Other': ['Other', 'Transgender'],
//           'Gender-neutral': ['Gender-Neutral', 'Gender-neutral', 'Gender-Neutral'],
//           'All': ['Gender-Neutral', 'Female-only', 'Male', 'Other']
//         };
//       } else {
//         genderFilterMap = {
//           'Male': ['Gender-Neutral', 'Male-only', 'M', 'BOYS', 'Male (including Supernumerary)'],
//           'Female': ['Gender-Neutral', 'Female-only', 'F', 'GIRLS', 'Female-only (including Supernumerary)'],
//           'Female-only': ['Gender-Neutral', 'Female-only', 'F', 'GIRLS', 'Female-only (including Supernumerary)'],
//           'Other': ['Gender-Neutral', 'Other', 'Transgender'],
//           'Gender-neutral': ['Gender-Neutral', 'Gender-neutral'],
//           'All': ['Gender-Neutral', 'Male-only', 'Female-only', 'Other', 'Male (including Supernumerary)', 'Female-only (including Supernumerary)']
//         };
//       }

//       baseFilters[examSpecificConfig.genderField] = { $in: genderFilterMap[gender] || ['Gender-Neutral'] };
//     } else {
//       if (String(typeOfExam).toUpperCase() === 'CUET') {
//         baseFilters[examSpecificConfig.genderField] = { $in: ['Gender-Neutral', 'Female-only', 'Male', 'Female-only (including Supernumerary)'] };
//       }
//     }

//     // Additional filters
//     if (year && year !== 'all') baseFilters.year = parseInt(year);
//     else if (String(typeOfExam).toUpperCase() === 'CUET') baseFilters.year = 2025;

//     if (round && round !== 'all') baseFilters.round = parseInt(round);
//     else if (String(typeOfExam).toUpperCase() === 'CUET') baseFilters.round = 1;

//     if (branch && branch !== 'all') baseFilters[examSpecificConfig.programField] = { $regex: branch, $options: 'i' };
//     if (institute && institute !== 'all') baseFilters[examSpecificConfig.instituteField] = { $regex: institute, $options: 'i' };
//     if (quota && quota !== 'all') baseFilters.quota = quota;
//     // NOTE: For CUET, only add quota filter if explicitly provided by user.
//     // Don't force 'Home State' as default because many stored documents lack quota field.

//     // Try STRICT search first
//     let results = await performSearch(baseFilters, 'STRICT');
//     let searchMode = 'STRICT';
//     const minResultsRequired = 5;

//     // FALLBACK 1: relax gender for CUET
//     if (results.total < minResultsRequired && searchMode === 'STRICT' && String(typeOfExam).toUpperCase() === 'CUET') {
//       searchMode = 'FALLBACK_1';
//       if (baseFilters[examSpecificConfig.genderField]) {
//         const current = baseFilters[examSpecificConfig.genderField].$in || [];
//         if (!current.includes('Gender-Neutral')) baseFilters[examSpecificConfig.genderField].$in = [...current, 'Gender-Neutral'];
//       }
//       results = await performSearch(baseFilters, 'FALLBACK_1');
//     }

//     // FALLBACK 2: expand rank range
//     if (results.total < minResultsRequired && searchMode === 'FALLBACK_1') {
//       searchMode = 'FALLBACK_2';
//       const expandedRankBuffer = Math.max(500, Math.round(userRank * 0.30));
//       baseFilters.$or = [
//         { openingRank: { $lte: userRank + expandedRankBuffer }, closingRank: { $gte: userRank - expandedRankBuffer } },
//         { closingRank: { $gte: userRank - (expandedRankBuffer * 2), $lte: userRank + (expandedRankBuffer * 2) } }
//       ];
//       results = await performSearch(baseFilters, 'FALLBACK_2');
//     }

//     // FALLBACK 3: remove gender
//     if (results.total < minResultsRequired && searchMode === 'FALLBACK_2' && baseFilters[examSpecificConfig.genderField]) {
//       searchMode = 'FALLBACK_3';
//       delete baseFilters[examSpecificConfig.genderField];
//       results = await performSearch(baseFilters, 'FALLBACK_3');
//     }

//     // FALLBACK 4: remove category
//     if (results.total < minResultsRequired && searchMode === 'FALLBACK_3' && baseFilters[examSpecificConfig.categoryField]) {
//       searchMode = 'FALLBACK_4';
//       delete baseFilters[examSpecificConfig.categoryField];
//       results = await performSearch(baseFilters, 'FALLBACK_4');
//     }

//     // FALLBACK 5: wide rank range
//     if (results.total < minResultsRequired && searchMode === 'FALLBACK_4') {
//       searchMode = 'FALLBACK_5';
//       const wideRankBuffer = String(typeOfExam).toUpperCase() === 'CUET' ? 100000 : 5000;
//       let lastResortFilters = { closingRank: { $gte: userRank - wideRankBuffer, $lte: userRank + wideRankBuffer } };
//       if (year && year !== 'all') lastResortFilters.year = parseInt(year);
//       if (round && round !== 'all') lastResortFilters.round = parseInt(round);
//       results = await performSearch(lastResortFilters, 'FALLBACK_5');
//     }

//     // NEW: If still no results, try top-rank snapshot for very small ranks, a HIGH_RANKS fallback for very large JEE ranks, or remove category as last attempt
//     if (results.total === 0) {
//       // TOP_RANKS: for ambitious users (very small ranks)
//       if (userRank <= 1000) {
//         searchMode = 'TOP_RANKS';
//         const match = {};
//         if (year && year !== 'all') match.year = parseInt(year);
//         if (round && round !== 'all') match.round = parseInt(round);

//         const topAgg = [ { $match: match }, { $addFields: { useRank: { $ifNull: ["$openingRank", "$closingRank"] } } }, { $sort: { useRank: 1 } }, { $limit: parseInt(limit) } ];
//         const cutoffsTop = await CutoffModel.aggregate(topAgg);
//         results = { cutoffs: cutoffsTop, total: cutoffsTop.length };
//         console.log('TOP_RANKS fallback used for very small rank');
//       }
//       // HIGH_RANKS: for very large JEE ranks, return colleges with highest closingRank (easier seats)
//       else if ((String(typeOfExam).toUpperCase() === 'JEE_MAINS' || String(typeOfExam).toUpperCase() === 'JEE_ADVANCE' || String(typeOfExam).toUpperCase() === 'JEE') && userRank >= 125000) {
//         searchMode = 'HIGH_RANKS';

//         // Build filters from non-rank base filters to keep user's preferences (year, round, branch, institute, quota, category, gender)
//         const highFilters = {};
//         if (year && year !== 'all') highFilters.year = parseInt(year);
//         if (round && round !== 'all') highFilters.round = parseInt(round);
//         if (branch && branch !== 'all') highFilters[examSpecificConfig.programField] = { $regex: branch, $options: 'i' };
//         if (institute && institute !== 'all') highFilters[examSpecificConfig.instituteField] = { $regex: institute, $options: 'i' };
//         if (quota && quota !== 'all') highFilters.quota = quota;
//         if (baseFilters[examSpecificConfig.categoryField]) highFilters[examSpecificConfig.categoryField] = baseFilters[examSpecificConfig.categoryField];
//         if (baseFilters[examSpecificConfig.genderField]) highFilters[examSpecificConfig.genderField] = baseFilters[examSpecificConfig.genderField];

//         // Return records with the highest closingRank values (easiest seats) to help high-ranked users
//         const highAgg = [ { $match: highFilters }, { $sort: { closingRank: -1 } }, { $limit: parseInt(limit) } ];
//         const cutoffsHigh = await CutoffModel.aggregate(highAgg);
//         results = { cutoffs: cutoffsHigh, total: cutoffsHigh.length };
//         console.log('HIGH_RANKS fallback used for very large JEE rank');
//       }
//       // RELAXED_NO_CATEGORY: remove category filter as last resort
//       else if (baseFilters[examSpecificConfig.categoryField]) {
//         searchMode = 'RELAXED_NO_CATEGORY';
//         delete baseFilters[examSpecificConfig.categoryField];
//         results = await performSearch(baseFilters, 'RELAXED_NO_CATEGORY');
//         console.log('RELAXED_NO_CATEGORY fallback used');
//       }
//     }

//     let { cutoffs, total } = results;

//     // Calculate probability for each cutoff (unchanged logic)
//     const cutoffsWithProbability = cutoffs.map(cutoff => {
//       const cutoffObj = cutoff;
//       let probabilityPercentage = 0;

//       if (String(typeOfExam).toUpperCase() === 'CUET') {
//         const closingRank = cutoff.closingRank;
//         const openingRank = cutoff.openingRank || closingRank;
//         if (!closingRank) {
//           probabilityPercentage = 20;
//         } else {
//           if (userRank >= openingRank && userRank <= closingRank) {
//             const range = closingRank - openingRank;
//             if (range === 0) probabilityPercentage = 80;
//             else {
//               const positionInRange = (userRank - openingRank) / range;
//               probabilityPercentage = 80 - (positionInRange * 40);
//             }
//           } else if (userRank < openingRank) {
//             const distance = openingRank - userRank;
//             const relativeDistance = distance / Math.max(openingRank, 1);
//             probabilityPercentage = Math.min(95, 85 + (relativeDistance * 50));
//           } else {
//             const distance = userRank - closingRank;
//             const relativeDistance = distance / Math.max(closingRank, 1);
//             probabilityPercentage = Math.max(15, 60 - (relativeDistance * 100));
//           }
//         }
//       } else {
//         const openingRank = cutoff.openingRank;
//         const closingRank = cutoff.closingRank;
//         if (!openingRank || !closingRank) probabilityPercentage = 20;
//         else {
//           const range = closingRank - openingRank;
//           if (userRank <= openingRank) {
//             const dominance = Math.min(1, (openingRank - userRank) / Math.max(range, 1));
//             probabilityPercentage = 80 + dominance * 15;
//           } else if (userRank > openingRank && userRank <= closingRank) {
//             const closeness = 1 - (userRank - openingRank) / Math.max(range, 1);
//             probabilityPercentage = 60 + closeness * 30;
//           } else {
//             const distance = userRank - closingRank;
//             const tolerance = Math.max(range * 0.6, userRank * 0.08);
//             if (distance <= tolerance) probabilityPercentage = 35 + (1 - distance / tolerance) * 25;
//             else probabilityPercentage = 15 + Math.max(0, 1 - distance / (tolerance * 2)) * 15;
//           }
//         }
//       }

//       const modeFactor = { STRICT: 1.05, FALLBACK_1: 1.0, FALLBACK_2: 0.97, FALLBACK_3: 0.94, FALLBACK_4: 0.9, FALLBACK_5: 0.85, TOP_RANKS: 1.0, RELAXED_NO_CATEGORY: 0.95 };
//       probabilityPercentage *= modeFactor[searchMode] || 0.95;
//       probabilityPercentage = Math.round(Math.max(15, Math.min(probabilityPercentage, 95)));

//       let probability, probabilityColor;
//       if (probabilityPercentage >= 70) { probability = "High Chance"; probabilityColor = "green"; }
//       else if (probabilityPercentage >= 45) { probability = "Moderate Chance"; probabilityColor = "yellow"; }
//       else { probability = "Low Chance"; probabilityColor = "red"; }

//       cutoffObj.probabilityPercentage = probabilityPercentage;
//       cutoffObj.probability = probability;
//       cutoffObj.probabilityColor = probabilityColor;
//       cutoffObj.searchMode = searchMode;
//       cutoffObj.examType = typeOfExam;
//       return cutoffObj;
//     });

//     const summary = {
//       examType: typeOfExam || 'JEE',
//       totalColleges: total,
//       collegesShown: cutoffs.length,
//       highestProbability: cutoffsWithProbability.length > 0 ? Math.max(...cutoffsWithProbability.map(c => c.probabilityPercentage)) : 0,
//       lowestProbability: cutoffsWithProbability.length > 0 ? Math.min(...cutoffsWithProbability.map(c => c.probabilityPercentage)) : 0,
//       averageProbability: cutoffsWithProbability.length > 0 ? Math.round(cutoffsWithProbability.reduce((sum, c) => sum + c.probabilityPercentage, 0) / cutoffsWithProbability.length) : 0,
//       searchModeUsed: searchMode,
//       userRank: userRank,
//       category: normalizedCategory || category || 'Not Specified'
//     };

//     res.status(200).json({ success: true, data: cutoffsWithProbability, summary, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });

//   } catch (error) {
//     console.error('Get cutoffs error:', error);
//     res.status(500).json({ success: false, message: 'Error fetching cutoff data', error: process.env.NODE_ENV === "development" ? error.message : undefined });
//   }
// };



// exports.getCutoffs = async (req, res) => {
//   try {
//     const {
//       rank,
//       category,
//       gender,
//       typeOfExam,
//       page = 1,
//       limit = 20,
//       year,
//       round,
//       branch,
//       institute,
//       quota
//     } = req.query;

//     console.log('Received query params:', { 
//       rank, category, gender, typeOfExam, 
//       year, round, branch, institute, quota 
//     });

//     if (!rank) {
//       return res.status(400).json({ success: false, message: "Rank is required" });
//     }

//     const userRank = parseInt(rank);
//     if (isNaN(userRank) || userRank < 0) {
//       return res.status(400).json({ success: false, message: "Invalid rank value" });
//     }

//     // Determine model
//     let CutoffModel = Cutoff;
//     let examSpecificConfig = {
//       rankField: 'closingRank',
//       categoryField: 'seatType',
//       genderField: 'gender',
//       instituteField: 'institute',
//       programField: 'academicProgramName'
//     };

//     const isCUET = String(typeOfExam).toUpperCase() === 'CUET';
//     const isJEE = !isCUET && (
//       String(typeOfExam).toUpperCase() === 'JEE' || 
//       String(typeOfExam).toUpperCase() === 'JEE_MAINS' || 
//       String(typeOfExam).toUpperCase() === 'JEE_ADVANCE'
//     );

//     if (isCUET) {
//       CutoffModel = CuetCutoffData;
//       examSpecificConfig.categoryField = 'category';
//     }

//     // Helper: build categorySeatTypeMap only once and keep keys consistent
//     let categorySeatTypeMap = {};
//     if (isCUET) {
//       categorySeatTypeMap = {
//         'GENERAL': ['GENERAL', 'UR', 'UNRESERVED', 'General', 'OPEN', 'GEN'],
//         'EWS': ['EWS(OPEN)', 'EWS(GL)', 'EWS(AF)', 'EWS'],
//         'OBC-NCL': ['BC', 'BC(Girl)', 'BC(AF)', 'OBC', 'OBC-NCL', 'Other Backward Classes'],
//         'SC': ['SC', 'SC(Girl)', 'SC(AF)', 'Scheduled Caste'],
//         'ST': ['ST', 'ST(Girl)', 'Scheduled Tribe'],
//         'OPEN': ['OPEN(AF)', 'OPEN(FF)', 'OPEN'],
//         'BC': ['BC', 'BC(Girl)', 'BC(AF)'],
//         'SC(Girl)': ['SC(Girl)'],
//         'BC(Girl)': ['BC(Girl)'],
//         'EWS(OPEN)': ['EWS(OPEN)'],
//         'EWS(GL)': ['EWS(GL)'],
//         'OPEN(AF)': ['OPEN(AF)']
//       };
//     } else {
//       categorySeatTypeMap = {
//         'GENERAL': ['OPEN', 'General', 'OPEN (PwD)', 'GEN-PwD', 'UR'],
//         'EWS': ['EWS', 'Economically Weaker Section', 'EWS-PwD', 'EWS (PwD)'],
//         'OBC-NCL': ['OBC-NCL', 'OBC', 'Other Backward Classes', 'OBC-NCL-PwD', 'OBC-NCL (PwD)', 'BC'],
//         'SC': ['SC', 'Scheduled Caste', 'SC-PwD', 'SC (PwD)'],
//         'ST': ['ST', 'Scheduled Tribe', 'ST-PwD', 'ST (PwD)'],
//         'GENERAL-PWD': ['OPEN (PwD)', 'OPEN-PwD', 'GEN-PwD'],
//         'EWS-PWD': ['EWS-PwD', 'EWS (PwD)'],
//         'OBC-NCL-PWD': ['OBC-NCL-PwD', 'OBC-NCL (PwD)'],
//         'SC-PWD': ['SC-PwD', 'SC (PwD)'],
//         'ST-PWD': ['ST-PwD', 'ST (PwD)']
//       };
//     }

//     // Normalize category input
//     let normalizedCategory = null;
//     if (category) {
//       const c = String(category).trim();
//       const synonyms = {
//         'GEN': 'GENERAL', 'OPEN': 'GENERAL', 'UR': 'GENERAL', 'GENERAL': 'GENERAL',
//         'BC': 'OBC-NCL', 'OBC': 'OBC-NCL', 'OBC-NCL': 'OBC-NCL',
//         'SC': 'SC', 'ST': 'ST', 'EWS': 'EWS'
//       };
//       const key = c.toUpperCase();
//       if (synonyms[key]) normalizedCategory = synonyms[key];
//       else {
//         normalizedCategory = Object.keys(categorySeatTypeMap).find(k => k.toUpperCase() === key);
//         if (!normalizedCategory) {
//           normalizedCategory = Object.keys(categorySeatTypeMap).find(k => k.toUpperCase().includes(key)) || null;
//         }
//       }
//     }

//     // Function to perform search with given filters
//     const performSearch = async (filters, searchMode = 'STRICT', modelOverride = null) => {
//       console.log(`Search Mode: ${searchMode} for ${typeOfExam}`);
      
//       const ModelToUse = modelOverride || CutoffModel;
//       const skip = (parseInt(page) - 1) * parseInt(limit);
      
//       const aggregationPipeline = [
//         { $match: filters },
//         {
//           $addFields: {
//             rankDifference: { $abs: { $subtract: [userRank, "$closingRank"] } },
//             rankScore: {
//               $cond: {
//                 if: { $lte: [userRank, "$closingRank"] },
//                 then: { $subtract: ["$closingRank", userRank] },
//                 else: { $subtract: [userRank, "$closingRank"] }
//               }
//             }
//           }
//         },
//         { $sort: { rankScore: 1, rankDifference: 1 } },
//         { $skip: skip },
//         { $limit: parseInt(limit) }
//       ];

//       const [cutoffs, total] = await Promise.all([
//         ModelToUse.aggregate(aggregationPipeline),
//         ModelToUse.countDocuments(filters)
//       ]);

//       console.log(`Found ${cutoffs.length} cutoffs in ${searchMode} mode, Total: ${total}`);
//       return { cutoffs, total, modelUsed: ModelToUse.modelName };
//     };

//     // Base filters
//     let baseFilters = {};

//     // Apply category filter
//     if (normalizedCategory && categorySeatTypeMap[normalizedCategory]) {
//       baseFilters[examSpecificConfig.categoryField] = { $in: categorySeatTypeMap[normalizedCategory] };
//       console.log(`Using normalized category: ${normalizedCategory}`);
//     } else if (category) {
//       baseFilters.$or = baseFilters.$or || [];
//       baseFilters.$or.push({ [examSpecificConfig.categoryField]: { $regex: category, $options: 'i' } });
//       console.log(`Category '${category}' not normalized, using fuzzy match`);
//     }

//     // CRITICAL FIX: Adjust rank buffer based on category
//     let rankBuffer;
    
//     if (isCUET) {
//       if (normalizedCategory === 'SC' || normalizedCategory === 'ST') {
//         rankBuffer = Math.max(50000, Math.round(userRank * 0.30));
//       } else if (normalizedCategory === 'OBC-NCL') {
//         rankBuffer = Math.max(30000, Math.round(userRank * 0.25));
//       } else {
//         rankBuffer = Math.max(10000, Math.round(userRank * 0.20));
//       }
//     } else {
//       if (normalizedCategory === 'SC' || normalizedCategory === 'ST') {
//         rankBuffer = Math.max(20000, Math.round(userRank * 1.0));
//       } else if (normalizedCategory === 'OBC-NCL') {
//         rankBuffer = Math.max(10000, Math.round(userRank * 0.50));
//       } else if (normalizedCategory === 'EWS') {
//         rankBuffer = Math.max(500, Math.round(userRank * 0.15));
//       } else {
//         rankBuffer = Math.max(100, Math.round(userRank * 0.10));
//       }
//     }

//     console.log(`Category: ${normalizedCategory || 'Not specified'}, Rank buffer: ${rankBuffer} for rank ${userRank}`);

//     // IMPORTANT: For reserved categories, we should search for HIGHER closing ranks
//     if (normalizedCategory && ['SC', 'ST', 'OBC-NCL'].includes(normalizedCategory)) {
//       baseFilters.$or = [
//         {
//           openingRank: { $lte: userRank + rankBuffer },
//           closingRank: { $gte: userRank }
//         },
//         {
//           closingRank: {
//             $gte: userRank,
//             $lte: userRank + (rankBuffer * 2)
//           }
//         }
//       ];
//     } else {
//       baseFilters.$or = [
//         {
//           openingRank: { $lte: userRank + rankBuffer },
//           closingRank: { $gte: userRank - rankBuffer }
//         },
//         {
//           closingRank: {
//             $gte: userRank - rankBuffer,
//             $lte: userRank + rankBuffer
//           }
//         }
//       ];
//     }

//     // Gender filter handling
//     if (gender && gender !== 'All') {
//       let genderFilterMap;
//       if (isCUET) {
//         genderFilterMap = {
//           'Male': ['Gender-Neutral', 'Male', 'M', 'BOYS'],
//           'Female': ['Female-only', 'Female', 'F', 'GIRLS', 'Female-only (including Supernumerary)'],
//           'Female-only': ['Female-only', 'Female', 'F', 'GIRLS', 'Female-only (including Supernumerary)'],
//           'Other': ['Other', 'Transgender'],
//           'Gender-neutral': ['Gender-Neutral', 'Gender-neutral', 'Gender-Neutral'],
//           'All': ['Gender-Neutral', 'Female-only', 'Male', 'Other']
//         };
//       } else {
//         genderFilterMap = {
//           'Male': ['Gender-Neutral', 'Male-only', 'M', 'BOYS', 'Male (including Supernumerary)'],
//           'Female': ['Gender-Neutral', 'Female-only', 'F', 'GIRLS', 'Female-only (including Supernumerary)'],
//           'Female-only': ['Gender-Neutral', 'Female-only', 'F', 'GIRLS', 'Female-only (including Supernumerary)'],
//           'Other': ['Gender-Neutral', 'Other', 'Transgender'],
//           'Gender-neutral': ['Gender-Neutral', 'Gender-neutral'],
//           'All': ['Gender-Neutral', 'Male-only', 'Female-only', 'Other', 'Male (including Supernumerary)', 'Female-only (including Supernumerary)']
//         };
//       }

//       baseFilters[examSpecificConfig.genderField] = { $in: genderFilterMap[gender] || ['Gender-Neutral'] };
//     } else {
//       if (isCUET) {
//         baseFilters[examSpecificConfig.genderField] = { $in: ['Gender-Neutral', 'Female-only', 'Male', 'Female-only (including Supernumerary)'] };
//       }
//     }

//     // Additional filters
//     if (year && year !== 'all') baseFilters.year = parseInt(year);
//     else if (isCUET) baseFilters.year = 2025;

//     if (round && round !== 'all') baseFilters.round = parseInt(round);
//     else if (isCUET) baseFilters.round = 1;

//     if (branch && branch !== 'all') baseFilters[examSpecificConfig.programField] = { $regex: branch, $options: 'i' };
//     if (institute && institute !== 'all') baseFilters[examSpecificConfig.instituteField] = { $regex: institute, $options: 'i' };
//     if (quota && quota !== 'all') baseFilters.quota = quota;

//     // SPECIAL CASE: Check if this is a very high JEE rank that might have few/no results
//     const isHighJEERank = isJEE && userRank > 300000;
//     let showCUETAlternative = false;
//     let cuetAlternativeResults = null;
//     let cuetAlternativeMessage = '';

//     // First, try normal JEE search
//     let results = await performSearch(baseFilters, 'STRICT');
//     let searchMode = 'STRICT';
//     const minResultsRequired = 5;

//     // If JEE results are very low or zero and rank is high, prepare CUET alternative
//     if (isHighJEERank && results.total < 10) {
//       console.log(`High JEE rank (${userRank}) with only ${results.total} results. Preparing CUET alternative...`);
      
//       // Create CUET filters for the same user preferences
//       const cuetFilters = {};
      
//       // Map JEE category to CUET category if possible
//       if (normalizedCategory) {
//         const categoryMap = {
//           'GENERAL': 'GENERAL',
//           'EWS': 'EWS',
//           'OBC-NCL': 'OBC-NCL',
//           'SC': 'SC',
//           'ST': 'ST'
//         };
//         const cuetCategory = categoryMap[normalizedCategory] || 'GENERAL';
//         cuetFilters.category = cuetCategory;
//       }
      
//       // Apply other filters
//       if (year && year !== 'all') cuetFilters.year = parseInt(year);
//       else cuetFilters.year = 2025; // Default for CUET
      
//       cuetFilters.round = 1; // Default round for CUET
      
//       if (branch && branch !== 'all') {
//         cuetFilters.academicProgramName = { $regex: branch, $options: 'i' };
//       }
      
//       if (institute && institute !== 'all') {
//         cuetFilters.institute = { $regex: institute, $options: 'i' };
//       }
      
//       if (quota && quota !== 'all') {
//         cuetFilters.quota = quota;
//       } else {
//         cuetFilters.quota = 'Home State'; // Default for CUET
//       }
      
//       // For CUET, we need to adjust the rank since CUET ranks work differently
//       // CUET ranks can go into millions, so a 950,000 JEE rank might be decent for CUET
//       const cuetAdjustedRank = Math.min(userRank * 0.5, 500000); // Scale down for CUET
      
//       // Search in CUET with generous buffer
//       const cuetRankBuffer = Math.max(100000, Math.round(cuetAdjustedRank * 0.30));
//       cuetFilters.$or = [
//         {
//           openingRank: { $lte: cuetAdjustedRank + cuetRankBuffer },
//           closingRank: { $gte: cuetAdjustedRank - cuetRankBuffer }
//         },
//         {
//           closingRank: {
//             $gte: cuetAdjustedRank - cuetRankBuffer,
//             $lte: cuetAdjustedRank + cuetRankBuffer
//           }
//         }
//       ];
      
//       // Perform CUET search
//       cuetAlternativeResults = await performSearch(
//         cuetFilters, 
//         'CUET_ALTERNATIVE', 
//         CuetCutoffData
//       );
      
//       if (cuetAlternativeResults.total > 0) {
//         showCUETAlternative = true;
//         cuetAlternativeMessage = `We found ${cuetAlternativeResults.total} opportunities in CUET-based colleges.`;
//       }
//     }

//     // Continue with normal fallback logic for JEE
//     if (results.total < minResultsRequired) {
//       const fallbackAttempts = [
//         {
//           name: 'FALLBACK_1',
//           action: () => {
//             console.log('FALLBACK_1: Expanding rank range based on category');
//             let expandedBuffer;
            
//             if (normalizedCategory && ['SC', 'ST'].includes(normalizedCategory)) {
//               expandedBuffer = isCUET 
//                 ? Math.max(100000, Math.round(userRank * 0.50))
//                 : Math.max(50000, Math.round(userRank * 2.0));
//             } else if (normalizedCategory === 'OBC-NCL') {
//               expandedBuffer = isCUET
//                 ? Math.max(75000, Math.round(userRank * 0.40))
//                 : Math.max(30000, Math.round(userRank * 1.0));
//             } else {
//               expandedBuffer = isCUET
//                 ? Math.max(50000, Math.round(userRank * 0.30))
//                 : Math.max(10000, Math.round(userRank * 0.50));
//             }
            
//             if (normalizedCategory && ['SC', 'ST', 'OBC-NCL'].includes(normalizedCategory)) {
//               baseFilters.$or = [
//                 {
//                   openingRank: { $lte: userRank + expandedBuffer },
//                   closingRank: { $gte: userRank }
//                 },
//                 {
//                   closingRank: {
//                     $gte: userRank,
//                     $lte: userRank + (expandedBuffer * 2)
//                   }
//                 }
//               ];
//             } else {
//               baseFilters.$or = [
//                 {
//                   openingRank: { $lte: userRank + expandedBuffer },
//                   closingRank: { $gte: userRank - expandedBuffer }
//                 },
//                 {
//                   closingRank: {
//                     $gte: userRank - expandedBuffer,
//                     $lte: userRank + expandedBuffer
//                   }
//                 }
//               ];
//             }
//           }
//         },
//         {
//           name: 'FALLBACK_2',
//           action: () => {
//             console.log('FALLBACK_2: Removing gender filter');
//             delete baseFilters[examSpecificConfig.genderField];
//           }
//         },
//         {
//           name: 'FALLBACK_3',
//           action: () => {
//             console.log('FALLBACK_3: Removing category-specific rank logic');
//             const wideBuffer = isCUET ? 200000 : 100000;
//             baseFilters.$or = [
//               {
//                 openingRank: { $lte: userRank + wideBuffer },
//                 closingRank: { $gte: userRank - wideBuffer }
//               },
//               {
//                 closingRank: {
//                   $gte: userRank - wideBuffer,
//                   $lte: userRank + wideBuffer
//                 }
//               }
//             ];
//           }
//         },
//         {
//           name: 'FALLBACK_4',
//           action: () => {
//             console.log('FALLBACK_4: Removing category filter');
//             delete baseFilters[examSpecificConfig.categoryField];
//           }
//         }
//       ];

//       for (const fallback of fallbackAttempts) {
//         if (results.total >= minResultsRequired) break;
        
//         searchMode = fallback.name;
//         fallback.action();
//         results = await performSearch(baseFilters, searchMode);
//       }
//     }

//     // SPECIAL FALLBACK: If still no results for high JEE rank
//     if (isHighJEERank && results.total === 0) {
//       searchMode = 'JEE_HIGH_RANK_CUET_GUIDANCE';
      
//       // Show easiest JEE colleges (highest closing ranks)
//       const easyFilters = {};
//       if (year && year !== 'all') easyFilters.year = parseInt(year);
//       if (round && round !== 'all') easyFilters.round = parseInt(round);
//       if (branch && branch !== 'all') easyFilters[examSpecificConfig.programField] = { $regex: branch, $options: 'i' };
//       if (normalizedCategory && categorySeatTypeMap[normalizedCategory]) {
//         easyFilters[examSpecificConfig.categoryField] = { $in: categorySeatTypeMap[normalizedCategory] };
//       }
      
//       const skip = (parseInt(page) - 1) * parseInt(limit);
//       const cutoffs = await Cutoff.aggregate([
//         { $match: easyFilters },
//         { $sort: { closingRank: -1 } }, // Highest closing ranks first (easiest)
//         { $skip: skip },
//         { $limit: parseInt(limit) }
//       ]);
      
//       const total = await Cutoff.countDocuments(easyFilters);
//       results = { cutoffs, total };
//     }

//     let { cutoffs, total } = results;

//     // Calculate probability
//     const cutoffsWithProbability = cutoffs.map(cutoff => {
//       const cutoffObj = cutoff;
//       let probabilityPercentage = 0;

//       if (isCUET) {
//         const closingRank = cutoff.closingRank;
//         const openingRank = cutoff.openingRank || closingRank;
        
//         if (!closingRank) {
//           probabilityPercentage = 20;
//         } else {
//           const isReservedCategory = normalizedCategory && ['SC', 'ST', 'OBC-NCL'].includes(normalizedCategory);
          
//           if (isReservedCategory) {
//             if (userRank <= closingRank) {
//               if (userRank <= openingRank) {
//                 probabilityPercentage = 90;
//               } else {
//                 const position = (userRank - openingRank) / (closingRank - openingRank);
//                 probabilityPercentage = 85 - (position * 30);
//               }
//             } else {
//               const distance = userRank - closingRank;
//               const relativeDistance = distance / Math.max(closingRank, 1);
//               probabilityPercentage = Math.max(30, 70 - (relativeDistance * 100));
//             }
//           } else {
//             if (userRank <= openingRank) {
//               probabilityPercentage = 85;
//             } else if (userRank <= closingRank) {
//               const position = (userRank - openingRank) / (closingRank - openingRank);
//               probabilityPercentage = 75 - (position * 40);
//             } else {
//               const distance = userRank - closingRank;
//               const relativeDistance = distance / Math.max(closingRank, 1);
//               probabilityPercentage = Math.max(15, 60 - (relativeDistance * 100));
//             }
//           }
//         }
//       } else {
//         const openingRank = cutoff.openingRank;
//         const closingRank = cutoff.closingRank;
        
//         if (!openingRank || !closingRank) {
//           probabilityPercentage = 20;
//         } else {
//           const isReservedCategory = normalizedCategory && ['SC', 'ST', 'OBC-NCL'].includes(normalizedCategory);
          
//           if (isReservedCategory) {
//             if (userRank <= closingRank) {
//               if (userRank <= openingRank) {
//                 probabilityPercentage = 95;
//               } else {
//                 const position = (userRank - openingRank) / (closingRank - openingRank);
//                 probabilityPercentage = 90 - (position * 30);
//               }
//             } else {
//               const distance = userRank - closingRank;
//               const tolerance = Math.max(closingRank * 0.8, userRank * 0.15);
//               if (distance <= tolerance) {
//                 probabilityPercentage = 50 + (1 - distance / tolerance) * 30;
//               } else {
//                 probabilityPercentage = 30 + Math.max(0, 1 - distance / (tolerance * 2)) * 20;
//               }
//             }
//           } else {
//             const range = closingRank - openingRank;
//             if (userRank <= openingRank) {
//               probabilityPercentage = 85;
//             } else if (userRank <= closingRank) {
//               const position = (userRank - openingRank) / range;
//               probabilityPercentage = 70 - (position * 35);
//             } else {
//               const distance = userRank - closingRank;
//               const tolerance = Math.max(range * 0.6, userRank * 0.08);
//               if (distance <= tolerance) {
//                 probabilityPercentage = 40 + (1 - distance / tolerance) * 25;
//               } else {
//                 probabilityPercentage = 20 + Math.max(0, 1 - distance / (tolerance * 2)) * 15;
//               }
//             }
//           }
//         }
//       }

//       const modeFactor = { 
//         STRICT: 1.05, 
//         FALLBACK_1: 1.0, 
//         FALLBACK_2: 0.97, 
//         FALLBACK_3: 0.94, 
//         FALLBACK_4: 0.9, 
//         JEE_HIGH_RANK_CUET_GUIDANCE: 0.7
//       };
      
//       probabilityPercentage *= modeFactor[searchMode] || 0.95;
//       probabilityPercentage = Math.round(Math.max(10, Math.min(probabilityPercentage, 95)));

//       let probability, probabilityColor;
//       if (probabilityPercentage >= 70) { 
//         probability = "High Chance"; 
//         probabilityColor = "green"; 
//       } else if (probabilityPercentage >= 40) { 
//         probability = "Moderate Chance"; 
//         probabilityColor = "yellow"; 
//       } else { 
//         probability = "Low Chance"; 
//         probabilityColor = "red"; 
//       }

//       cutoffObj.probabilityPercentage = probabilityPercentage;
//       cutoffObj.probability = probability;
//       cutoffObj.probabilityColor = probabilityColor;
//       cutoffObj.searchMode = searchMode;
//       cutoffObj.examType = typeOfExam;
//       return cutoffObj;
//     });

//     // Prepare response
//     const summary = {
//       examType: typeOfExam || 'JEE',
//       totalColleges: total,
//       collegesShown: cutoffs.length,
//       highestProbability: cutoffsWithProbability.length > 0 ? 
//         Math.max(...cutoffsWithProbability.map(c => c.probabilityPercentage)) : 0,
//       lowestProbability: cutoffsWithProbability.length > 0 ? 
//         Math.min(...cutoffsWithProbability.map(c => c.probabilityPercentage)) : 0,
//       averageProbability: cutoffsWithProbability.length > 0 ? 
//         Math.round(cutoffsWithProbability.reduce((sum, c) => sum + c.probabilityPercentage, 0) / cutoffsWithProbability.length) : 0,
//       searchModeUsed: searchMode,
//       userRank: userRank,
//       category: normalizedCategory || category || 'Not Specified',
//       rankBufferUsed: rankBuffer,
//     };

//     // Add special messages based on search mode
//     if (searchMode === 'JEE_HIGH_RANK_CUET_GUIDANCE') {
//       summary.note = 
//         "Your JEE Main rank is above typical counselling cutoffs. " +
//         "Don't worry — many universities accept students through CUET. " +
//         "Below are CUET-based colleges you can still target.";
      
//       // Include CUET alternative results if available
//       if (cuetAlternativeResults && cuetAlternativeResults.total > 0) {
//         summary.cuetOpportunities = {
//           message: `We found ${cuetAlternativeResults.total} opportunities in CUET-based colleges.`,
//           total: cuetAlternativeResults.total,
//           note: "Consider exploring CUET-based universities as they often have different admission criteria."
//         };
//       }
//     } else if (showCUETAlternative) {
//       summary.alternativePath = {
//         available: true,
//         exam: "CUET",
//         message: cuetAlternativeMessage,
//         totalOpportunities: cuetAlternativeResults.total,
//         note: "CUET offers additional admission pathways. Try searching specifically for CUET colleges."
//       };
//     } else if (normalizedCategory && ['SC', 'ST', 'OBC-NCL'].includes(normalizedCategory)) {
//       summary.note = 'Note: Reserved categories typically have higher (worse) cutoff ranks, so more colleges may be available.';
//     }

//     // Prepare final response
//     const response = {
//       success: true,
//       data: cutoffsWithProbability,
//       summary,
//       pagination: { 
//         page: parseInt(page), 
//         limit: parseInt(limit), 
//         total, 
//         pages: Math.ceil(total / parseInt(limit)) 
//       }
//     };

//     // Include CUET alternative data if requested and available
//     if (req.query.includeCuetAlternative === 'true' && cuetAlternativeResults) {
//       response.cuetAlternative = {
//         data: cuetAlternativeResults.cutoffs.slice(0, 10), // Include first 10 CUET results
//         total: cuetAlternativeResults.total,
//         message: "CUET-based college opportunities"
//       };
//     }

//     res.status(200).json(response);

//   } catch (error) {
//     console.error('Get cutoffs error:', error);
//     res.status(500).json({ 
//       success: false, 
//       message: 'Error fetching cutoff data', 
//       error: process.env.NODE_ENV === "development" ? error.message : undefined 
//     });
//   }
// };



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

    if (!rank) {
      return res.status(400).json({ success: false, message: "Rank is required" });
    }

    const userRank = parseInt(rank);
    if (isNaN(userRank) || userRank < 0) {
      return res.status(400).json({ success: false, message: "Invalid rank value" });
    }

    const isCUET = String(typeOfExam).toUpperCase() === 'CUET';
    const isJEE = !isCUET && (
      String(typeOfExam).toUpperCase() === 'JEE' || 
      String(typeOfExam).toUpperCase() === 'JEE_MAINS' || 
      String(typeOfExam).toUpperCase() === 'JEE_ADVANCE'
    );

    // PROFESSIONAL THRESHOLDS
    const JEE_PROBABILITY_CUTOFF = 500000; // Above this, skip low probability calculations
    const JEE_CONTEXT_SWITCH_CUTOFF = 1000000; // Above this, show CUET as primary
    const JEE_HYBRID_THRESHOLD = 300000; // Above this, consider hybrid results

    // Check if we should skip detailed probability calculations for high JEE ranks
    const shouldSkipLowProbabilityCalc = isJEE && userRank > JEE_PROBABILITY_CUTOFF;

    // PROFESSIONAL CONTEXT SWITCHING
    if (isJEE && userRank > JEE_CONTEXT_SWITCH_CUTOFF && req.query.showCuetInstead !== 'false') {
      console.log(`Professional context switch: JEE rank ${userRank} → showing CUET opportunities`);
      
      // Build CUET filters with professional defaults
      const cuetFilters = {
        typeOfExam: 'CUET',
        year: year ? parseInt(year) : 2025,
        round: round ? parseInt(round) : 1,
        quota: quota || 'Home State'
      };
      
      // Smart category mapping
      if (category) {
        const categoryMap = {
          'GENERAL': 'GENERAL', 'GEN': 'GENERAL', 'OPEN': 'GENERAL',
          'EWS': 'EWS',
          'OBC-NCL': 'OBC-NCL', 'OBC': 'OBC-NCL', 'BC': 'OBC-NCL',
          'SC': 'SC',
          'ST': 'ST'
        };
        const normalizedCat = (category || '').toUpperCase();
        cuetFilters.category = categoryMap[normalizedCat] || 'GENERAL';
      }
      
      // Branch and institute filters
      if (branch && branch !== 'all') {
        cuetFilters.academicProgramName = { $regex: branch, $options: 'i' };
      }
      
      if (institute && institute !== 'all') {
        cuetFilters.institute = { $regex: institute, $options: 'i' };
      }
      
      // Smart rank adjustment for CUET search
      let cuetSearchRank;
      if (userRank > 2000000) {
        cuetSearchRank = 1500000;
      } else if (userRank > 1000000) {
        cuetSearchRank = 800000;
      } else {
        cuetSearchRank = Math.round(userRank * 0.4);
      }
      
      // Generous buffer for high ranks
      const cuetRankBuffer = Math.max(300000, Math.round(cuetSearchRank * 0.3));
      cuetFilters.$or = [
        {
          closingRank: {
            $gte: cuetSearchRank - cuetRankBuffer,
            $lte: cuetSearchRank + cuetRankBuffer
          }
        },
        {
          openingRank: { $lte: cuetSearchRank + cuetRankBuffer },
          closingRank: { $gte: cuetSearchRank - cuetRankBuffer }
        }
      ];
      
      // Gender filter
      if (gender && gender !== 'All') {
        const genderMap = {
          'Male': ['Gender-Neutral', 'Male-only', 'Male'],
          'Female': ['Female-only', 'Female'],
          'Female-only': ['Female-only', 'Female'],
          'Gender-neutral': ['Gender-Neutral']
        };
        cuetFilters.gender = { $in: genderMap[gender] || ['Gender-Neutral'] };
      }
      
      // Perform search with professional limits
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [cuetResults, total] = await Promise.all([
        CuetCutoffData.find(cuetFilters)
          .sort({ closingRank: 1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        CuetCutoffData.countDocuments(cuetFilters)
      ]);
      
      // PROFESSIONAL PROBABILITY CALCULATION - Always optimistic
      const cutoffsWithProbability = cuetResults.map(college => {
        const closingRank = college.closingRank || 0;
        const openingRank = college.openingRank || closingRank;
        
        // Base optimistic probability
        let probabilityPercentage = 60;
        
        if (closingRank > 0) {
          if (cuetSearchRank <= openingRank) {
            probabilityPercentage = 85;
          } else if (cuetSearchRank <= closingRank) {
            // Within range - good chance
            const position = (cuetSearchRank - openingRank) / (closingRank - openingRank);
            probabilityPercentage = 75 - (position * 20);
          } else {
            // Above cutoff but with buffer consideration
            const distance = cuetSearchRank - closingRank;
            const relativeDistance = Math.min(1, distance / (closingRank * 2));
            probabilityPercentage = Math.max(50, 70 - (relativeDistance * 40));
          }
        }
        
        // Ensure reasonable range
        probabilityPercentage = Math.round(Math.max(50, Math.min(probabilityPercentage, 90)));
        
        // Professional probability labels
        let probability, probabilityColor;
        if (probabilityPercentage >= 70) {
          probability = "Good Fit";
          probabilityColor = "green";
        } else if (probabilityPercentage >= 55) {
          probability = "Potential Match";
          probabilityColor = "blue";
        } else {
          probability = "Worth Exploring";
          probabilityColor = "yellow";
        }
        
        return {
          ...college,
          probabilityPercentage,
          probability,
          probabilityColor,
          searchMode: 'PROFESSIONAL_CONTEXT_SWITCH',
          examType: 'CUET',
          contextNote: 'CUET-based admission pathway'
        };
      });
      
      // Professional summary
      const summary = {
        examType: 'CUET',
        opportunitiesFound: total,
        opportunitiesShown: cuetResults.length,
        averageProbability: cutoffsWithProbability.length > 0 ? 
          Math.round(cutoffsWithProbability.reduce((sum, c) => sum + c.probabilityPercentage, 0) / cutoffsWithProbability.length) : 0,
        userRank: userRank,
        originalRequest: 'JEE',
        professionalContext: 'context_switched'
      };
      
      // Professional guidance message
      const guidance = {
        primaryMessage: `We found ${total} excellent college opportunities for you`,
        contextExplanation: `Your JEE rank indicates CUET-based universities could be a great fit. CUET is accepted by 250+ universities including Delhi University, JNU, BHU, and many central universities.`,
        whyThisIsGood: [
          "Different exam pattern might align better with your strengths",
          "Broader range of programs and universities",
          "Multiple exam attempts throughout the year"
        ],
        nextSteps: [
          "Explore CUET preparation resources",
          "Check application cycles for target universities",
          "Consider this as your primary admission pathway"
        ]
      };
      
      return res.status(200).json({
        success: true,
        data: cutoffsWithProbability,
        summary,
        guidance,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        professionalNote: "Showing CUET opportunities as they align better with your profile. To view JEE colleges, add 'showCuetInstead=false'."
      });
    }

    // Continue with normal flow for other cases
    let CutoffModel = Cutoff;
    let examSpecificConfig = {
      rankField: 'closingRank',
      categoryField: 'seatType',
      genderField: 'gender',
      instituteField: 'institute',
      programField: 'academicProgramName'
    };

    if (isCUET) {
      CutoffModel = CuetCutoffData;
      examSpecificConfig.categoryField = 'category';
    }

    // Category mapping (unchanged)
    let categorySeatTypeMap = {};
    if (isCUET) {
      categorySeatTypeMap = {
        'GENERAL': ['GENERAL', 'UR', 'UNRESERVED', 'General', 'OPEN', 'GEN'],
        'EWS': ['EWS(OPEN)', 'EWS(GL)', 'EWS(AF)', 'EWS'],
        'OBC-NCL': ['BC', 'BC(Girl)', 'BC(AF)', 'OBC', 'OBC-NCL', 'Other Backward Classes'],
        'SC': ['SC', 'SC(Girl)', 'SC(AF)', 'Scheduled Caste'],
        'ST': ['ST', 'ST(Girl)', 'Scheduled Tribe'],
        'OPEN': ['OPEN(AF)', 'OPEN(FF)', 'OPEN'],
        'BC': ['BC', 'BC(Girl)', 'BC(AF)'],
        'SC(Girl)': ['SC(Girl)'],
        'BC(Girl)': ['BC(Girl)'],
        'EWS(OPEN)': ['EWS(OPEN)'],
        'EWS(GL)': ['EWS(GL)'],
        'OPEN(AF)': ['OPEN(AF)']
      };
    } else {
      categorySeatTypeMap = {
        'GENERAL': ['OPEN', 'General', 'OPEN (PwD)', 'GEN-PwD', 'UR'],
        'EWS': ['EWS', 'Economically Weaker Section', 'EWS-PwD', 'EWS (PwD)'],
        'OBC-NCL': ['OBC-NCL', 'OBC', 'Other Backward Classes', 'OBC-NCL-PwD', 'OBC-NCL (PwD)', 'BC'],
        'SC': ['SC', 'Scheduled Caste', 'SC-PwD', 'SC (PwD)'],
        'ST': ['ST', 'Scheduled Tribe', 'ST-PwD', 'ST (PwD)'],
        'GENERAL-PWD': ['OPEN (PwD)', 'OPEN-PwD', 'GEN-PwD'],
        'EWS-PWD': ['EWS-PwD', 'EWS (PwD)'],
        'OBC-NCL-PWD': ['OBC-NCL-PwD', 'OBC-NCL (PwD)'],
        'SC-PWD': ['SC-PwD', 'SC (PwD)'],
        'ST-PWD': ['ST-PwD', 'ST (PwD)']
      };
    }

    // Normalize category
    let normalizedCategory = null;
    if (category) {
      const c = String(category).trim();
      const synonyms = {
        'GEN': 'GENERAL', 'OPEN': 'GENERAL', 'UR': 'GENERAL', 'GENERAL': 'GENERAL',
        'BC': 'OBC-NCL', 'OBC': 'OBC-NCL', 'OBC-NCL': 'OBC-NCL',
        'SC': 'SC', 'ST': 'ST', 'EWS': 'EWS'
      };
      const key = c.toUpperCase();
      if (synonyms[key]) normalizedCategory = synonyms[key];
      else {
        normalizedCategory = Object.keys(categorySeatTypeMap).find(k => k.toUpperCase() === key);
        if (!normalizedCategory) {
          normalizedCategory = Object.keys(categorySeatTypeMap).find(k => k.toUpperCase().includes(key)) || null;
        }
      }
    }

    // Search function
    const performSearch = async (filters, searchMode = 'STRICT') => {
      console.log(`Search Mode: ${searchMode} for ${typeOfExam}`);
      
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const aggregationPipeline = [
        { $match: filters },
        {
          $addFields: {
            rankDifference: { $abs: { $subtract: [userRank, "$closingRank"] } },
            rankScore: {
              $cond: {
                if: { $lte: [userRank, "$closingRank"] },
                then: { $subtract: ["$closingRank", userRank] },
                else: { $subtract: [userRank, "$closingRank"] }
              }
            }
          }
        },
        { $sort: { rankScore: 1, rankDifference: 1 } },
        { $skip: skip },
        { $limit: parseInt(limit) }
      ];

      const [cutoffs, total] = await Promise.all([
        CutoffModel.aggregate(aggregationPipeline),
        CutoffModel.countDocuments(filters)
      ]);

      console.log(`Found ${cutoffs.length} cutoffs in ${searchMode} mode, Total: ${total}`);
      return { cutoffs, total };
    };

    // Build base filters
    let baseFilters = {};

    // Category filter
    if (normalizedCategory && categorySeatTypeMap[normalizedCategory]) {
      baseFilters[examSpecificConfig.categoryField] = { $in: categorySeatTypeMap[normalizedCategory] };
    } else if (category) {
      baseFilters.$or = baseFilters.$or || [];
      baseFilters.$or.push({ [examSpecificConfig.categoryField]: { $regex: category, $options: 'i' } });
    }

    // Smart rank buffer based on exam type and rank
    let rankBuffer;
    if (isCUET) {
      rankBuffer = Math.max(50000, Math.round(userRank * 0.25));
    } else {
      // JEE rank buffer
      if (userRank > JEE_PROBABILITY_CUTOFF) {
        // For high JEE ranks, use very generous buffer
        rankBuffer = Math.max(100000, Math.round(userRank * 0.6));
      } else if (normalizedCategory === 'SC' || normalizedCategory === 'ST') {
        rankBuffer = Math.max(20000, Math.round(userRank * 0.8));
      } else if (normalizedCategory === 'OBC-NCL') {
        rankBuffer = Math.max(10000, Math.round(userRank * 0.4));
      } else {
        rankBuffer = Math.max(1000, Math.round(userRank * 0.15));
      }
    }

    console.log(`Rank buffer: ${rankBuffer} for rank ${userRank} (${isCUET ? 'CUET' : 'JEE'})`);

    // Rank filter
    if (normalizedCategory && ['SC', 'ST', 'OBC-NCL'].includes(normalizedCategory)) {
      baseFilters.$or = [
        {
          openingRank: { $lte: userRank + rankBuffer },
          closingRank: { $gte: userRank }
        },
        {
          closingRank: {
            $gte: userRank,
            $lte: userRank + (rankBuffer * 2)
          }
        }
      ];
    } else {
      baseFilters.$or = [
        {
          openingRank: { $lte: userRank + rankBuffer },
          closingRank: { $gte: userRank - rankBuffer }
        },
        {
          closingRank: {
            $gte: userRank - rankBuffer,
            $lte: userRank + rankBuffer
          }
        }
      ];
    }

    // Gender filter
    if (gender && gender !== 'All') {
      let genderFilterMap;
      if (isCUET) {
        genderFilterMap = {
          'Male': ['Gender-Neutral', 'Male', 'M', 'BOYS'],
          'Female': ['Female-only', 'Female', 'F', 'GIRLS', 'Female-only (including Supernumerary)'],
          'Female-only': ['Female-only', 'Female', 'F', 'GIRLS', 'Female-only (including Supernumerary)'],
          'Other': ['Other', 'Transgender'],
          'Gender-neutral': ['Gender-Neutral', 'Gender-neutral', 'Gender-Neutral'],
          'All': ['Gender-Neutral', 'Female-only', 'Male', 'Other']
        };
      } else {
        genderFilterMap = {
          'Male': ['Gender-Neutral', 'Male-only', 'M', 'BOYS', 'Male (including Supernumerary)'],
          'Female': ['Gender-Neutral', 'Female-only', 'F', 'GIRLS', 'Female-only (including Supernumerary)'],
          'Female-only': ['Gender-Neutral', 'Female-only', 'F', 'GIRLS', 'Female-only (including Supernumerary)'],
          'Other': ['Gender-Neutral', 'Other', 'Transgender'],
          'Gender-neutral': ['Gender-Neutral', 'Gender-neutral'],
          'All': ['Gender-Neutral', 'Male-only', 'Female-only', 'Other', 'Male (including Supernumerary)', 'Female-only (including Supernumerary)']
        };
      }
      baseFilters[examSpecificConfig.genderField] = { $in: genderFilterMap[gender] || ['Gender-Neutral'] };
    }

    // Additional filters
    if (year && year !== 'all') baseFilters.year = parseInt(year);
    else if (isCUET) baseFilters.year = 2025;

    if (round && round !== 'all') baseFilters.round = parseInt(round);
    else if (isCUET) baseFilters.round = 1;

    if (branch && branch !== 'all') baseFilters[examSpecificConfig.programField] = { $regex: branch, $options: 'i' };
    if (institute && institute !== 'all') baseFilters[examSpecificConfig.instituteField] = { $regex: institute, $options: 'i' };
    if (quota && quota !== 'all') baseFilters.quota = quota;

    // Perform search
    let results = await performSearch(baseFilters, 'STRICT');
    let searchMode = 'STRICT';
    const minResultsRequired = 5;

    // Fallback logic for JEE with few results
    if (isJEE && results.total < minResultsRequired) {
      const fallbackAttempts = [
        {
          name: 'FALLBACK_EXPAND_RANK',
          action: () => {
            const expandedBuffer = Math.max(100000, Math.round(userRank * 0.8));
            baseFilters.$or = [
              {
                openingRank: { $lte: userRank + expandedBuffer },
                closingRank: { $gte: userRank - expandedBuffer }
              },
              {
                closingRank: {
                  $gte: userRank - expandedBuffer,
                  $lte: userRank + expandedBuffer
                }
              }
            ];
          }
        },
        {
          name: 'FALLBACK_REMOVE_GENDER',
          action: () => {
            delete baseFilters[examSpecificConfig.genderField];
          }
        },
        {
          name: 'FALLBACK_REMOVE_CATEGORY',
          action: () => {
            delete baseFilters[examSpecificConfig.categoryField];
          }
        }
      ];

      for (const fallback of fallbackAttempts) {
        if (results.total >= minResultsRequired) break;
        searchMode = fallback.name;
        fallback.action();
        results = await performSearch(baseFilters, searchMode);
      }
    }

    // If still few results for high JEE rank, get CUET suggestions
    let cuetSuggestions = null;
    if (isJEE && userRank > JEE_HYBRID_THRESHOLD && results.total < 15) {
      const cuetSuggestionFilters = {
        year: 2025,
        round: 1,
        quota: 'Home State',
        category: normalizedCategory || 'GENERAL',
        typeOfExam: 'CUET'
      };
      
      if (branch && branch !== 'all') {
        cuetSuggestionFilters.academicProgramName = { $regex: branch, $options: 'i' };
      }
      
      cuetSuggestions = await CuetCutoffData.find(cuetSuggestionFilters)
        .sort({ closingRank: -1 })
        .limit(5)
        .lean();
    }

    let { cutoffs, total } = results;

    // PROFESSIONAL PROBABILITY CALCULATION
    const cutoffsWithProbability = cutoffs.map(cutoff => {
      const cutoffObj = cutoff;
      
      // SKIP DETAILED PROBABILITY FOR HIGH JEE RANKS
      if (shouldSkipLowProbabilityCalc) {
        // Professional optimistic probability for high JEE ranks
        cutoffObj.probabilityPercentage = 45; // Always show moderate chance
        cutoffObj.probability = "Consider Exploring";
        cutoffObj.probabilityColor = "blue";
        cutoffObj.searchMode = 'PROFESSIONAL_OPTIMISTIC';
        cutoffObj.examType = typeOfExam;
        cutoffObj.contextNote = 'JEE-based admission - explore all options';
        return cutoffObj;
      }
      
      // Normal probability calculation for realistic ranks
      let probabilityPercentage = 0;

      if (isCUET) {
        const closingRank = cutoff.closingRank;
        const openingRank = cutoff.openingRank || closingRank;
        
        if (!closingRank) {
          probabilityPercentage = 30;
        } else {
          if (userRank <= openingRank) {
            probabilityPercentage = 80;
          } else if (userRank <= closingRank) {
            const position = (userRank - openingRank) / (closingRank - openingRank);
            probabilityPercentage = 70 - (position * 30);
          } else {
            const distance = userRank - closingRank;
            const relativeDistance = distance / Math.max(closingRank, 1);
            probabilityPercentage = Math.max(30, 60 - (relativeDistance * 50));
          }
        }
      } else {
        // JEE probability with professional optimism
        const openingRank = cutoff.openingRank;
        const closingRank = cutoff.closingRank;
        
        if (!openingRank || !closingRank) {
          probabilityPercentage = 35;
        } else {
          const range = closingRank - openingRank;
          
          if (userRank <= openingRank) {
            probabilityPercentage = 75;
          } else if (userRank <= closingRank) {
            const position = (userRank - openingRank) / range;
            probabilityPercentage = 65 - (position * 25);
          } else {
            const distance = userRank - closingRank;
            const tolerance = Math.max(range * 1.2, userRank * 0.12);
            if (distance <= tolerance) {
              probabilityPercentage = 45 + (1 - distance / tolerance) * 25;
            } else {
              probabilityPercentage = 35;
            }
          }
        }
      }

      // Apply mode factor (slightly optimistic for fallbacks)
      const modeFactor = { 
        STRICT: 1.0, 
        FALLBACK_EXPAND_RANK: 1.05,
        FALLBACK_REMOVE_GENDER: 1.08,
        FALLBACK_REMOVE_CATEGORY: 1.1
      };
      
      probabilityPercentage *= modeFactor[searchMode] || 1.0;
      probabilityPercentage = Math.round(Math.max(35, Math.min(probabilityPercentage, 85)));

      // Professional probability labels
      let probability, probabilityColor;
      if (probabilityPercentage >= 70) {
        probability = "Good Chance";
        probabilityColor = "green";
      } else if (probabilityPercentage >= 50) {
        probability = "Possible";
        probabilityColor = "yellow";
      } else {
        probability = "Consider";
        probabilityColor = "blue"; // Not red - never discourage
      }

      cutoffObj.probabilityPercentage = probabilityPercentage;
      cutoffObj.probability = probability;
      cutoffObj.probabilityColor = probabilityColor;
      cutoffObj.searchMode = searchMode;
      cutoffObj.examType = typeOfExam;
      return cutoffObj;
    });

    // Prepare professional summary
    const summary = {
      examType: typeOfExam || 'JEE',
      opportunitiesFound: total,
      opportunitiesShown: cutoffs.length,
      averageProbability: cutoffsWithProbability.length > 0 ? 
        Math.round(cutoffsWithProbability.reduce((sum, c) => sum + c.probabilityPercentage, 0) / cutoffsWithProbability.length) : 0,
      userRank: userRank,
      category: normalizedCategory || category || 'Not Specified',
      searchStrategy: searchMode
    };

    // Professional guidance based on results
    const guidance = {};
    
    if (isJEE && userRank > JEE_HYBRID_THRESHOLD) {
      if (total > 0) {
        guidance.primaryMessage = `Found ${total} JEE-based opportunities`;
        guidance.secondaryMessage = "Consider these as potential options and explore additional pathways below";
      }
      
      if (cuetSuggestions && cuetSuggestions.length > 0) {
        guidance.alternativePathways = {
          message: "You might also consider CUET-based universities",
          count: cuetSuggestions.length,
          note: "CUET opens doors to 250+ universities including many top central universities"
        };
      }
    }

    // Prepare final response
    const response = {
      success: true,
      data: cutoffsWithProbability,
      summary,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    };

    // Add guidance if available
    if (Object.keys(guidance).length > 0) {
      response.guidance = guidance;
    }

    // Add CUET suggestions if available
    if (cuetSuggestions && cuetSuggestions.length > 0) {
      response.alternativeOpportunities = {
        examType: 'CUET',
        colleges: cuetSuggestions.map(college => ({
          institute: college.institute,
          program: college.academicProgramName,
          category: college.category,
          closingRank: college.closingRank,
          note: 'CUET admission pathway'
        })),
        guidance: "Many students discover excellent universities through CUET. Consider exploring this option."
      };
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('Get cutoffs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching cutoff data',
      error: process.env.NODE_ENV === "development" ? error.message : undefined
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
