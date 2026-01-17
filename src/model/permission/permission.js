const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema(
  {
    assistantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // User Data Management Permissions
    canViewUsers: {
      type: Boolean,
      default: false,
    },
    canEditUsers: {
      type: Boolean,
      default: false,
    },
    canDeleteUsers: {
      type: Boolean,
      default: false,
    },

    // Prediction/Check Data Permissions
    canViewPredictions: {
      type: Boolean,
      default: false,
    },
    canExportData: {
      type: Boolean,
      default: false,
    },

    // Dashboard Access
    canViewDashboard: {
      type: Boolean,
      default: true,
    },
    canViewStats: {
      type: Boolean,
      default: false,
    },

    // Granted by which admin
    grantedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Last updated by
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Index for faster lookups
permissionSchema.index({ assistantId: 1 });

module.exports = mongoose.model("Permission", permissionSchema);
