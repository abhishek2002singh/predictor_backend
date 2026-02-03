


const mongoose = require('mongoose')

const checkHistorySchema = mongoose.Schema({
    examType: {
      type: String,
      enum: ["JEE_MAINS", "JEE_ADVANCED", "CUET", "NEET", "MHT_CET", "KCET", "WBJEE", "BITSAT"],
      uppercase: true,
    },
    rank: {
      type: Number,
      min: 1,
    },
    // category: {
    //   type: String,
    //   enum: ["GENERAL", "OBC", "SC", "ST", "EWS", "GENERAL-PWD", "OBC-NCL", "OBC-NCL-PWD", "SC-PWD", "ST-PWD"],
    // },
    // gender: {
    //   type: String,
    //   enum: [
    //     'Gender-Neutral',
    //     'Female-only',
    //     'Male-only',
    //     'Male',
    //     'Female',
    //     'Gender-neutral',
    //     'Female-only (including Supernumerary)',
    //     'Male (including Supernumerary)',
    //     "Other"
    //   ],
    // },

    
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
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    lastName: {
      type: String,
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
        homeState: {
      type: String,
      trim: true,
    },

    emailId: {
      type: String,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email address"],
    },
    city:{
      type: String,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    checkHistory: [checkHistorySchema],

    totalChecks: {
      type: Number,
      default: 0,
    },

    examsChecked: [{
      type: String,
      enum: ["JEE_MAINS", "JEE_ADVANCED", "CUET", "NEET", "MHT_CET", "KCET", "WBJEE", "BITSAT"],
    }],

    isNegativeResponse: {
      type: Boolean,
      default: false,
    },
    isPositiveResponse: {
      type: Boolean,
      default: false,
    },
    isCheckData: {
      type: Boolean,
      default: false,
    },
    isDataExport: {
      type: Boolean,
      default: false
    },

}, {
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