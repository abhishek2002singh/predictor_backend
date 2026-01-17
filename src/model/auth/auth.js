

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },

    lastName: {
      type: String,
      required: true,
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
      required: true,
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email address"],
      index: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },


    gender: {
      type: String,
      enum: ["MALE", "FEMALE", "OTHER"],
    },

    homeState: {
      type: String,
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    role: {
      type: String,
      enum: ["USER", "ADMIN" , "ASSISTANCE"],
      default: "USER",
    },

    lastLoginAt: {
      type: Date,
    },

    profileCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Hash password before saving - Modern Mongoose version
userSchema.pre("save", async function () {
  
  if (!this.isModified("password")) {
    return;
  }

  // Generate salt and hash password
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error("Password comparison failed");
  }
};

// Generate JWT Token method
userSchema.methods.generateToken = function () {
  try {
    return jwt.sign(
      {
        id: this._id,
        emailId: this.emailId,
        role: this.role,
        firstName: this.firstName,
        lastName: this.lastName,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );
  } catch (error) {
    throw new Error("Token generation failed");
  }
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  try {
    const user = this.toObject();
    delete user.password;
    return user;
  } catch (error) {
    return this.toObject();
  }
};

module.exports = mongoose.model("User", userSchema);