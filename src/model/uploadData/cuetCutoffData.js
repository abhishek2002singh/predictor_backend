

// models/CuetCutoff.js
const mongoose = require('mongoose');

const cuetCutoffSchema = new mongoose.Schema({
  year: {
    type: Number,
    required: true,
    min: 2015,
    max: new Date().getFullYear(),
    default: new Date().getFullYear()
  },
  round: {
    type: Number,
    required: true,
    min: 1,
    max: 7
  },
  institute: {
    type: String,
    required: true,
    trim: true
  },
  academicProgramName: {
    type: String,
    required: true,
    trim: true
  },
  quota: {
    type: String,
    trim: true,
    // enum: ['Home State', 'All India', 'Other State'],
    // default: 'Home State'
  },
  seatType: {
    type: String,
    required: true,
    trim: true
  },
  gender: {
    type: String,
    required: true,
    trim: true,
    // enum: ['Gender-Neutral', 'Female-only (including Supernumerary)', 'Female-only', 'Male-only' , "Both Male and Female Seats" , "	Female Seats","Female" , "Male"]
  },
  openingRank: {
    type: Number,
    required: true,
    min: 0
  },
  closingRank: {
    type: Number,
    required: true,
    min: 0
  },
  remark: {
    type: String,
    trim: true,
    default: ''
  },
  typeOfExam: {
    type: String,
    required: true,
    trim: true,
    default: 'CUET'
  },
  category: {
    type: String,
    required: true,
    default: 'GENERAL'
  },
  isPwd: {
    type: Boolean,
    default: false
  },
  isFemaleOnly: {
    type: Boolean,
    default: false
  },
  scrapedAt: {
    type: Date,
    default: Date.now
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  }
}, {
  timestamps: true,
  indexes: [
    { institute: 1, academicProgramName: 1 },
    { seatType: 1, gender: 1, year: 1 },
    { category: 1, year: 1, round: 1 },
    { closingRank: 1, year: 1, seatType: 1 },
    { quota: 1, year: 1 },
    { typeOfExam: 1, year: 1 },
    // Unique index to prevent true duplicates (same seat allocation)
    { institute: 1, academicProgramName: 1, seatType: 1, gender: 1, year: 1, round: 1, openingRank: 1, closingRank: 1, typeOfExam: 1, sparse: true }
  ]
});

// Simplified mapping for CSV seatType to standardized category
const seatTypeMapping = {
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
  'BC(Girl)': 'OBC-NCL',
  'BC(AF)': 'OBC-NCL',
  'BC(FF)': 'OBC-NCL',
  'BC(PH)': 'OBC-NCL',
  'OBC': 'OBC-NCL',
  'OBC-NCL': 'OBC-NCL',
  'SC': 'SC',
  'SC(Girl)': 'SC',
  'SC(AF)': 'SC',
  'SC(PH)': 'SC',
  'ST': 'ST',
  'ST(Girl)': 'ST',
  'ST(AF)': 'ST',
  'ST(PH)': 'ST'
};

// Helper function to parse seatType and return category
function parseSeatType(seatType) {
  if (!seatType || typeof seatType !== 'string') {
    return 'GENERAL';
  }
  
  const trimmedSeatType = seatType.trim().toUpperCase();
  
  // Direct lookup
  if (seatTypeMapping[trimmedSeatType]) {
    return seatTypeMapping[trimmedSeatType];
  }
  
  // Extract base category from patterns like "BC(Girl)" or "OPEN(AF)"
  const match = trimmedSeatType.match(/^([A-Z]+)(?:\([A-Z]+\))?$/);
  if (match) {
    const baseCategory = match[1];
    
    // Map base to standard category
    if (baseCategory === 'BC' || baseCategory === 'OBC') return 'OBC-NCL';
    if (baseCategory === 'SC') return 'SC';
    if (baseCategory === 'ST') return 'ST';
    if (baseCategory === 'EWS') return 'EWS';
    if (baseCategory === 'OPEN' || baseCategory === 'GENERAL') return 'GENERAL';
  }
  
  // Default fallback
  return 'GENERAL';
}

// **FIXED: Pre-save middleware - SIMPLIFIED VERSION**
cuetCutoffSchema.pre('save', function(next) {
  try {
    // Always check if next is a function
    if (typeof next !== 'function') {
      // If no next function, process synchronously
      this.processFields();
      return;
    }
    
    this.processFields();
    next();
  } catch (error) {
    if (typeof next === 'function') {
      next(error);
    } else {
      throw error;
    }
  }
});

// **ADDED: Method to process fields (can be called manually)**
cuetCutoffSchema.methods.processFields = function() {
  // Parse seatType to get category
  this.category = parseSeatType(this.seatType);
  
  // Set isPwd flag based on seatType
  this.isPwd = (this.seatType && (
    this.seatType.toUpperCase().includes('PH') || 
    this.seatType.toUpperCase().includes('PWD')
  )) || false;
  
  // Set isFemaleOnly flag based on gender or seatType
  this.isFemaleOnly = (this.gender && this.gender.includes('Female-only')) ||
                     (this.seatType && (this.seatType.includes('(Girl)') || this.seatType.includes('Girl'))) ||
                     false;
  
  // Ensure typeOfExam is set
  if (!this.typeOfExam) {
    this.typeOfExam = 'CUET';
  }
};

// Static method to process CSV data
cuetCutoffSchema.statics.processCSVData = function(csvData) {
  return csvData.map(row => {
    // Parse seatType (fall back to CSV Category if Seat Type missing)
    const seatType = (row['Seat Type'] || row.seatType || row['seatType'] || row['Category'] || row['category'] || '').toString().trim();
    const category = (row['Category'] || row['category'])
      ? parseSeatType((row['Category'] || row['category']).toString().trim())
      : parseSeatType(seatType);
    
    // Parse year
    let year = new Date().getFullYear();
    if (row.Year) year = parseInt(row.Year);
    else if (row['Scraped At']) year = new Date(row['Scraped At']).getFullYear();
    
    // Parse round
    let round = 1;
    const roundStr = row.Round || row.round || '';
    if (roundStr.includes('Round')) {
      const roundMatch = roundStr.match(/(\d+)/);
      round = roundMatch ? parseInt(roundMatch[1]) : 1;
    } else if (!isNaN(parseInt(roundStr))) {
      round = parseInt(roundStr);
    }
    
    // Create document object
    const docData = {
      year: year,
      round: round,
      institute: (row.Institute || row.institute || '').trim(),
      academicProgramName: (row['Academic Program Name'] || row.academicProgramName || row.Program || '').trim(),
      quota: (row.Quota || row.quota || 'Home State').trim(),
      seatType: seatType || 'OPEN',
      gender: (row['Seat Gender'] || row['SeatGender'] || row.Gender || row.gender || 'Gender-Neutral').toString().trim(),
      openingRank: parseInt(row['Opening Rank'] || row.openingRank || 0) || 0,
      closingRank: parseInt(row['Closing Rank'] || row.closingRank || 0) || 0,
      remark: (row.Remark || row.remark || '').trim(),
      typeOfExam: 'CUET',
      scrapedAt: row['Scraped At'] ? new Date(row['Scraped At']) : new Date(),
      category: category,
      isPwd: (seatType || '').toUpperCase().includes('PH') || (seatType || '').toUpperCase().includes('PWD'),
      isFemaleOnly: ((row['Seat Gender'] || row['SeatGender'] || row.Gender || row.gender || '').toString().includes('Female-only')) || (seatType || '').includes('Girl')
    };
    
    return docData;
  });
};

// **ADDED: Safe save method that handles bulk operations**
cuetCutoffSchema.statics.saveBulk = async function(dataArray) {
  // Process all data first
  const processedData = this.processCSVData(dataArray);
  
  const savedDocs = [];
  
  for (const data of processedData) {
    try {
      // Create and save document
      const doc = new this(data);
      doc.processFields();
      const savedDoc = await doc.save();
      savedDocs.push(savedDoc);
    } catch (error) {
      console.error('Failed to save record:', {
        institute: data.institute,
        program: data.academicProgramName,
        category: data.category,
        error: error.message
      });
      continue;
    }
  }
  
  return savedDocs;
};

// Alternative: Use insertMany with pre-processed data
cuetCutoffSchema.statics.bulkInsert = async function(csvData) {
  const processedData = this.processCSVData(csvData);
  return this.insertMany(processedData, { ordered: false });
};

// Create additional indexes
cuetCutoffSchema.index({ category: 1, year: 1 });
cuetCutoffSchema.index({ typeOfExam: 1, year: 1, round: 1 });

// Ensure compound unique index is created to prevent exact duplicates
cuetCutoffSchema.index(
  { 
    institute: 1, 
    academicProgramName: 1, 
    seatType: 1, 
    gender: 1, 
    year: 1, 
    round: 1, 
    openingRank: 1, 
    closingRank: 1, 
    typeOfExam: 1 
  }, 
  { unique: true, sparse: true, name: 'unique_cuet_cutoff' }
);

module.exports = mongoose.model('CuetCutoff', cuetCutoffSchema);