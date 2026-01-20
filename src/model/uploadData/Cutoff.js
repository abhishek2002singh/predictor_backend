// models/Cutoff.js
const mongoose = require('mongoose');

const jeeCutoffSchema = new mongoose.Schema({
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
  typeOfExam :{
    type: String,
    required: true,
    trim: true
  },
  seatType: {
    type: String,
    required: true,
    enum: [
      'OPEN', 'EWS', 'OBC-NCL', 'SC', 'ST',
      'OPEN (PwD)', 'EWS-PwD', 'OBC-NCL-PwD', 'SC-PwD', 'ST-PwD',
      'OPEN-PwD', 'EWS (PwD)', 'OBC-NCL (PwD)', 'SC (PwD)', 'ST (PwD)'
    ]
  },
  gender: {
    type: String,
    required: true,
    enum: ['Gender-Neutral', 'Female-only (including Supernumerary)', 'Male-only']
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
  round: {
    type: Number,
    required: true,
    default: 1,
    min: 1,
    max: 7
  },
  year: {
    type: Number,
    required: true,
    min: 2015,
    max: new Date().getFullYear()
  },
  category: {
    type: String,
    required: false,
    enum: [
      'GENERAL', 'EWS', 'OBC-NCL', 'SC', 'ST',
      'GENERAL-PwD', 'EWS-PwD', 'OBC-NCL-PwD', 'SC-PwD', 'ST-PwD'
    ]
  },
  isPwd: {
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
    { closingRank: 1, year: 1, seatType: 1 }
  ]
});

// Seat type to category mapping
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

// Pre-save middleware - FIXED VERSION
jeeCutoffSchema.pre('save', function(next) {
  // Set category from seatType if not already set
  if (!this.category && this.seatType) {
    this.category = seatTypeToCategory[this.seatType] || 'GENERAL';
  }
  
  // Set isPwd flag
  if (this.seatType) {
    this.isPwd = this.seatType.includes('PwD');
  }
  
  // Check if next is a function before calling it
  if (typeof next === 'function') {
    next();
  }
  // If next is not a function (like in bulk operations), just return
  return Promise.resolve();
});

// ALTERNATIVE: Pre-validate middleware that works with bulk operations
jeeCutoffSchema.pre('validate', function(next) {
  // Set category from seatType if not already set
  if (!this.category && this.seatType) {
    this.category = seatTypeToCategory[this.seatType] || 'GENERAL';
  }
  
  // Set isPwd flag
  if (this.seatType) {
    this.isPwd = this.seatType.includes('PwD');
  }
  
  if (typeof next === 'function') {
    next();
  }
});

// Static method to calculate category from seat type
jeeCutoffSchema.statics.getCategoryFromSeatType = function(seatType) {
  return seatTypeToCategory[seatType] || 'GENERAL';
};

// Instance method to set derived fields
jeeCutoffSchema.methods.setDerivedFields = function() {
  if (this.seatType) {
    if (!this.category) {
      this.category = seatTypeToCategory[this.seatType] || 'GENERAL';
    }
    this.isPwd = this.seatType.includes('PwD');
  }
  return this;
};

module.exports = mongoose.model('Cutoff', jeeCutoffSchema);