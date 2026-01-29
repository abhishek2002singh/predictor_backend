const mongoose = require('mongoose')


const checkHistorySchema = mongoose.Schema({
    examType: {
      type: String,
      // required: true,
      enum: ["JEE_MAINS", "JEE_ADVANCED", "CUET", "NEET", "MHT_CET", "KCET", "WBJEE", "BITSAT"],
      uppercase: true,
    },
    rank: {
      type: Number,
      min: 1,
    },
    category: {
      type: String,
      enum: ["GENERAL", "OBC", "SC", "ST", "EWS"],
    },
    gender: {
      type: String,
      enum: ['Gender-Neutral',
        'Female-only (including Supernumerary)',
        'Male-only',
        'Male',
        'Female'],
      // required: true,
    },
    homeState: {
      type: String,
      trim: true,
    },
     gainLeedFrom: {
  type: [String],
  enum: ["FROM_STUDENT_RANK", "FROM_COLLEGE_SEARCH"],
  default: [],
},
    checkedAt: {
      type: Date,
      default: Date.now,
    },
}, { _id: true });

const userDataSchema = mongoose.Schema({
    firstName: {
      type: String,
      // required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    lastName: {
      type: String,
      // required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    mobileNumber: {
      type: String,
      required: true,
      unique: true,
      match: [/^[6-9]\d{9}$/, "Invalid mobile number"],
      index: true,
    },

    emailId: {
      type: String,
      // required: true,
      // unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email address"],
    },

    
    checkHistory: [checkHistorySchema],

    // Total number of checks by this user
    totalChecks: {
      type: Number,
      default: 0,
    },

    // Track which exams this user has checked (for quick filtering)
    examsChecked: [{
      type: String,
      enum: ["JEE_MAINS", "JEE_ADVANCED", "CUET", "NEET", "MHT_CET", "KCET", "WBJEE", "BITSAT"],
    }],

    isNegativeResponse: {
      type: Boolean,
      default: false,
    },
    isPositiveResponse:{
      type: Boolean,
      default: false,
    },
    isCheckData:{
      type: Boolean,
      default: false,
    },
     isDataExport: {
    type: Boolean,
    default: false
  },

},{
     timestamps: true,
})

userDataSchema.index(
  { emailId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      emailId: { $exists: true, $ne: null },
    },
  }
);





module.exports = mongoose.model("UserData", userDataSchema);