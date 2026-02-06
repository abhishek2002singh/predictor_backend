

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
    enum: ['Home State', 'All India', 'Other State'],
    default: 'Home State'
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
    enum: [
      'GENERAL', 'EWS', 'OBC-NCL', 'SC', 'ST',
      'GENERAL-PwD', 'EWS-PwD', 'OBC-NCL-PwD', 'SC-PwD', 'ST-PwD',
      'BC', 'BC-PwD', 'OPEN', 'OPEN(AF)', 'OPEN(FF)'
    ]
  },
  subCategory: {
    type: String,
    enum: ['', 'Girl', 'AF', 'FF', 'PH', 'GL', 'PwD'],
    default: ''
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
    { typeOfExam: 1, year: 1 }
  ]
});

// Enhanced mapping for CSV seatType to standardized category and subCategory
const seatTypeMapping = {
  // GENERAL category
  'GENERAL': { category: 'GENERAL', subCategory: '' },
  'OPEN': { category: 'OPEN', subCategory: '' },
  'OPEN(AF)': { category: 'OPEN(AF)', subCategory: 'AF' },
  'OPEN(FF)': { category: 'OPEN(FF)', subCategory: 'FF' },
  'OPEN(PH)': { category: 'GENERAL-PwD', subCategory: 'PH', isPwd: true },
  
  // EWS category
  'EWS': { category: 'EWS', subCategory: '' },
  'EWS(OPEN)': { category: 'EWS', subCategory: '' },
  'EWS(GL)': { category: 'EWS', subCategory: 'GL' },
  'EWS(AF)': { category: 'EWS', subCategory: 'AF' },
  
  // OBC/BC category
  'BC': { category: 'BC', subCategory: '' },
  'BC(Girl)': { category: 'BC', subCategory: 'Girl' },
  'BC(AF)': { category: 'BC', subCategory: 'AF' },
  'BC(FF)': { category: 'BC', subCategory: 'FF' },
  'BC(PH)': { category: 'BC-PwD', subCategory: 'PH', isPwd: true },
  
  // SC category
  'SC': { category: 'SC', subCategory: '' },
  'SC(Girl)': { category: 'SC', subCategory: 'Girl' },
  'SC(AF)': { category: 'SC', subCategory: 'AF' },
  
  // ST category
  'ST': { category: 'ST', subCategory: '' },
  'ST(Girl)': { category: 'ST', subCategory: 'Girl' },
  
  // Default fallback
  'DEFAULT': { category: 'GENERAL', subCategory: '' }
};

// Helper function to parse seatType - FIXED VERSION
function parseSeatType(seatType) {
  if (!seatType || typeof seatType !== 'string') {
    return seatTypeMapping['DEFAULT'];
  }
  
  const trimmedSeatType = seatType.trim();
  
  // Check exact match first
  if (seatTypeMapping[trimmedSeatType]) {
    return seatTypeMapping[trimmedSeatType];
  }
  
  // Handle patterns like X(Y)
  const match = trimmedSeatType.match(/^(\w+)(?:\((\w+)\))?$/);
  if (match) {
    const main = match[1];
    const sub = match[2] || '';
    
    // Handle PwD cases
    if (sub.includes('PH') || sub.includes('PwD') || main.includes('PH')) {
      let baseCategory = 'GENERAL';
      if (main === 'BC' || main === 'OBC') baseCategory = 'BC';
      else if (main === 'SC') baseCategory = 'SC';
      else if (main === 'ST') baseCategory = 'ST';
      else if (main === 'EWS') baseCategory = 'EWS';
      else if (main === 'OPEN' || main === 'GENERAL') baseCategory = 'GENERAL';
      
      return { 
        category: `${baseCategory}-PwD`, 
        subCategory: sub.replace('PH', '').replace('PwD', '').trim() || 'PH',
        isPwd: true 
      };
    }
    
    // Handle Girl cases
    if (sub.includes('Girl')) {
      let baseCategory = 'GENERAL';
      if (main === 'BC' || main === 'OBC') baseCategory = 'BC';
      else if (main === 'SC') baseCategory = 'SC';
      else if (main === 'ST') baseCategory = 'ST';
      else if (main === 'EWS') baseCategory = 'EWS';
      
      return { 
        category: baseCategory, 
        subCategory: 'Girl'
      };
    }
    
    // Handle other subcategories
    if (sub) {
      return {
        category: seatTypeMapping[main]?.category || 'GENERAL',
        subCategory: sub,
        isPwd: sub.includes('PH') || sub.includes('PwD')
      };
    }
    
    // Return base category if no subcategory
    return seatTypeMapping[main] || seatTypeMapping['DEFAULT'];
  }
  
  return seatTypeMapping['DEFAULT'];
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
  // Parse seatType to get category and subCategory
  const parsed = parseSeatType(this.seatType);
  this.category = parsed.category || 'GENERAL';
  this.subCategory = parsed.subCategory || '';
  
  // Set isPwd flag
  this.isPwd = parsed.isPwd || 
              (this.seatType && (
                this.seatType.toUpperCase().includes('PH') || 
                this.seatType.toUpperCase().includes('PWD') || 
                this.category.includes('-PwD')
              ));
  
  // Set isFemaleOnly flag
  this.isFemaleOnly = (this.gender && this.gender.includes('Female-only')) ||
                     (this.seatType && this.seatType.includes('(Girl)')) ||
                     (this.subCategory === 'Girl');
  
  // Set year from scrapedAt if available
  if (this.scrapedAt && !this.year) {
    this.year = new Date(this.scrapedAt).getFullYear();
  }
  
  // Set round from round string if it's in format "Round X"
  if (typeof this.round === 'string' && this.round.includes('Round')) {
    const roundMatch = this.round.match(/Round (\d+)/);
    if (roundMatch) {
      this.round = parseInt(roundMatch[1]);
    }
  }
};

// Static method to process CSV data - FIXED VERSION
cuetCutoffSchema.statics.processCSVData = function(csvData) {
  return csvData.map(row => {
    // Parse seatType first
    const seatType = row['Seat Type'] || row.seatType || '';
    const parsed = parseSeatType(seatType);
    
    // Parse year
    let year = new Date().getFullYear();
    if (row.Year) {
      year = parseInt(row.Year);
    } else if (row['Scraped At']) {
      year = new Date(row['Scraped At']).getFullYear();
    }
    
    // Parse round
    let round = 1;
    const roundStr = row.Round || '';
    if (roundStr.includes('Round')) {
      const roundMatch = roundStr.match(/Round (\d+)/);
      round = roundMatch ? parseInt(roundMatch[1]) : 1;
    }
    
    // Create document object
    const docData = {
      year: year,
      round: round,
      institute: row.Institute || row.institute || '',
      academicProgramName: row['Academic Program Name'] || row.academicProgramName || '',
      quota: row.Quota || row.quota || 'Home State',
      seatType: seatType,
      gender: row.Gender || row.gender || 'Gender-Neutral',
      openingRank: parseFloat(row['Opening Rank'] || row.openingRank || 0),
      closingRank: parseFloat(row['Closing Rank'] || row.closingRank || 0),
      remark: row.Remark || row.remark || '',
      typeOfExam: row['Type of Exam'] || row.typeOfExam || 'CUET',
      scrapedAt: row['Scraped At'] ? new Date(row['Scraped At']) : new Date(),
      category: parsed.category || 'GENERAL',
      subCategory: parsed.subCategory || '',
      isPwd: parsed.isPwd || false,
      isFemaleOnly: parsed.isFemaleOnly || false
    };
    
    // Create a temporary document to trigger field processing
    const tempDoc = new this(docData);
    tempDoc.processFields();
    
    return tempDoc.toObject();
  });
};

// **ADDED: Safe save method that handles bulk operations**
cuetCutoffSchema.statics.saveBulk = async function(dataArray) {
  // Process all data first
  const processedData = this.processCSVData(dataArray);
  
  // Use insertMany with { validateBeforeSave: false } to bypass middleware
  // Then update each document with processed fields
  const savedDocs = [];
  
  for (const data of processedData) {
    try {
      // Create document without triggering save middleware
      const doc = new this(data);
      
      // Manually process fields
      doc.processFields();
      
      // Save the document
      const savedDoc = await doc.save();
      savedDocs.push(savedDoc);
    } catch (error) {
      console.error('Failed to save record:', {
        institute: data.institute,
        program: data.academicProgramName,
        examType: data.typeOfExam,
        error: error.message
      });
      // Continue with next record
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

// Create indexes
cuetCutoffSchema.index({ institute: 1, academicProgramName: 1, year: 1, round: 1 });
cuetCutoffSchema.index({ category: 1, closingRank: 1 });
cuetCutoffSchema.index({ seatType: 1, gender: 1 });

module.exports = mongoose.model('CuetCutoff', cuetCutoffSchema);