// models/Cutoff.js
const mongoose = require('mongoose');

const cuetCutoffData = new mongoose.Schema({
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
  Quota: {
    type: String,
    // required: true,
    trim: true,
    enum: ['Home State', 'All India', 'Other State'],
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
    enum: ['Gender-Neutral', 'Female-only (including Supernumerary)', 'Female-only', 'Male-only']
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
      'BC', 'BC-PwD'
    ]
  },
  isPwd: {
    type: Boolean,
    default: false
  },
  isFemaleOnly: {
    type: Boolean,
    default: false
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

// Mapping for CSV seatType to standardized category
const seatTypeToCategory = {
  'OPEN': 'GENERAL',
  'GENERAL': 'GENERAL',
  'EWS': 'EWS',
  'EWS(OPEN)': 'EWS',
  'EWS(GL)': 'EWS',
  'OBC-NCL': 'OBC-NCL',
  'OBC': 'OBC-NCL',
  'BC': 'OBC-NCL',
  'BC(Girl)': 'OBC-NCL',
  'BC(AF)': 'OBC-NCL',
  'SC': 'SC',
  'SC(Girl)': 'SC',
  'ST': 'ST',
  'ST(Girl)': 'ST',
  'OPEN(AF)': 'GENERAL',
  'EWS(AF)': 'EWS',
  'BC(PH)': 'OBC-NCL-PwD',
};

// FIXED: Middleware that works with both single and bulk operations
cuetCutoffData.pre('save', function(next) {
  try {
    // Set category from seatType
    if (this.seatType && !this.category) {
      const baseSeatType = this.seatType.split('(')[0].trim();
      this.category = seatTypeToCategory[this.seatType] || seatTypeToCategory[baseSeatType] || 'GENERAL';
    }
    
    // Set isPwd flag
    if (this.seatType) {
      this.isPwd = this.seatType.includes('PH') || this.seatType.includes('PwD') || 
                   this.seatType.includes('(PH)') || this.seatType.includes('(PwD)');
    }
    
    // Set isFemaleOnly flag
    if (this.gender) {
      this.isFemaleOnly = this.gender.includes('Female-only');
    }
    
    // Check if next exists and is a function
    if (next && typeof next === 'function') {
      return next();
    }
    return Promise.resolve();
  } catch (error) {
    if (next && typeof next === 'function') {
      return next(error);
    }
    return Promise.reject(error);
  }
});

// Alternative: Use setter functions instead of middleware
cuetCutoffData.path('seatType').set(function(seatType) {
  this._seatType = seatType;
  
  // Set derived fields when seatType is set
  if (seatType) {
    const baseSeatType = seatType.split('(')[0].trim();
    this.category = seatTypeToCategory[seatType] || seatTypeToCategory[baseSeatType] || 'GENERAL';
    this.isPwd = seatType.includes('PH') || seatType.includes('PwD') || 
                 seatType.includes('(PH)') || seatType.includes('(PwD)');
  }
  
  return seatType;
});

cuetCutoffData.path('gender').set(function(gender) {
  this._gender = gender;
  
  if (gender) {
    this.isFemaleOnly = gender.includes('Female-only');
  }
  
  return gender;
});

// Static method to process data before insertion (for bulk operations)
cuetCutoffData.statics.processData = function(data) {
  return data.map(item => {
    const baseSeatType = item.seatType ? item.seatType.split('(')[0].trim() : '';
    
    return {
      ...item,
      category: seatTypeToCategory[item.seatType] || seatTypeToCategory[baseSeatType] || 'GENERAL',
      isPwd: item.seatType ? (item.seatType.includes('PH') || item.seatType.includes('PwD') || 
             item.seatType.includes('(PH)') || item.seatType.includes('(PwD)')) : false,
      isFemaleOnly: item.gender ? item.gender.includes('Female-only') : false
    };
  });
};

module.exports = mongoose.model('CuetCutoff', cuetCutoffData);