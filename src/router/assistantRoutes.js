const express = require("express");
const router = express.Router();

const {
  createAssistant,
  getAllAssistants,
  getAssistant,
  updatePermissions,
  updateAssistantStatus,
  deleteAssistant,
  getMyPermissions,
} = require("../controllers/assistantController");

const { protect, adminOnly, adminOrAssistant } = require("../middleware/auth.middleware");

// All routes require authentication
router.use(protect);

// Assistant can check their own permissions
router.get("/my-permissions", adminOrAssistant, getMyPermissions);

// Admin only routes for managing assistants
router.post("/", adminOnly, createAssistant);
router.get("/", adminOnly, getAllAssistants);
router.get("/:id", adminOnly, getAssistant);
router.put("/:id/permissions", adminOnly, updatePermissions);
router.put("/:id/status", adminOnly, updateAssistantStatus);
router.delete("/:id", adminOnly, deleteAssistant);

module.exports = router;
