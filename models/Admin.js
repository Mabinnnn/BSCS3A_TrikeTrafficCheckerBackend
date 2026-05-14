const mongoose = require("mongoose");

// ── admins collection in fareDB ───────────────────────────────────────────────
// Each document represents one authorized admin Gmail account.
// Add / remove documents in MongoDB Atlas to grant or revoke admin access.
// ─────────────────────────────────────────────────────────────────────────────
const AdminSchema = new mongoose.Schema({
  email: {
    type:     String,
    required: true,
    unique:   true,
    lowercase: true,
    trim:     true,
  },
  addedBy: {
    type:    String,
    default: "system",
  },
  createdAt: {
    type:    Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Admin", AdminSchema, "admins");
