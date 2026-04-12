const express = require("express");
const router  = express.Router();
const Place   = require("../models/Place");
const Setting = require("../models/Setting");

// ─────────────────────────────────────────────────────────────────────────────
// VALID TIER KEYS — updated to match fares.tiers keys in MongoDB
// ─────────────────────────────────────────────────────────────────────────────
const VALID_TIERS = [
  "50-59",
  "60-69",
  "70-79",
  "80-89",
  "90-99",
];

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// POST /api/admin/login
// ─────────────────────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const ADMIN_USER = process.env.ADMIN_USERNAME || "admin";
    const ADMIN_PASS = process.env.ADMIN_PASSWORD || "12345";

    if (username === ADMIN_USER && password === ADMIN_PASS) {
      return res.json({ status: "success", message: "Login successful" });
    }
    return res.status(401).json({ status: "error", message: "Invalid credentials" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PLACES
// ─────────────────────────────────────────────────────────────────────────────

// GET all places
// GET /api/admin/places
router.get("/places", async (req, res) => {
  try {
    const places = await Place.find().sort({ category: 1, name: 1 });
    res.json({ status: "success", places });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// POST add a new place
// POST /api/admin/places
router.post("/places", async (req, res) => {
  try {
    const { name, coords, category, distance, fares } = req.body;
    const place = await Place.create({ name, coords, category, distance, fares });
    res.status(201).json({ status: "success", place });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// PUT update fares of a place by ID
// PUT /api/admin/places/:id
// Body: { fares: { route, route_label, distance_km, emergency_provisional_php, tiers: {...} }, distance, coords }
router.put("/places/:id", async (req, res) => {
  try {
    const { fares, distance, coords } = req.body;

    const update = {};
    if (fares    !== undefined) update.fares    = fares;
    if (distance !== undefined) update.distance = distance;
    if (coords   !== undefined) update.coords   = coords;

    const updated = await Place.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ status: "error", message: "Place not found" });
    }
    res.json({ status: "success", place: updated });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// DELETE a place by ID
// DELETE /api/admin/places/:id
router.delete("/places/:id", async (req, res) => {
  try {
    const deleted = await Place.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ status: "error", message: "Place not found" });
    }
    res.json({ status: "success", message: "Place deleted" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS — ACTIVE GASOLINE TIER
// Stored in MongoDB Atlas → fareDB → settings collection
// ─────────────────────────────────────────────────────────────────────────────

// GET active tier
// GET /api/admin/settings/active-tier
router.get("/settings/active-tier", async (req, res) => {
  try {
    const doc = await Setting.findOne({ key: "activeTier" });
    return res.json({
      status:     "success",
      activeTier: doc ? doc.value : "50-59", // updated default
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// PUT save active tier
// PUT /api/admin/settings/active-tier
router.put("/settings/active-tier", async (req, res) => {
  try {
    const { activeTier } = req.body;

    if (!VALID_TIERS.includes(activeTier)) {
      return res.status(400).json({ status: "error", message: "Invalid tier key." });
    }

    const doc = await Setting.findOneAndUpdate(
      { key: "activeTier" },
      { key: "activeTier", value: activeTier },
      { upsert: true, new: true }
    );

    return res.json({ status: "success", activeTier: doc.value });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS — ADMIN GMAIL
// First Gmail to sign in becomes the permanent admin
// ─────────────────────────────────────────────────────────────────────────────

// GET registered admin Gmail
// GET /api/admin/settings/admin-gmail
router.get("/settings/admin-gmail", async (req, res) => {
  try {
    const doc = await Setting.findOne({ key: "adminGmail" });
    return res.json({
      status:     "success",
      adminGmail: doc ? doc.value : null,
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// POST save the first Gmail as the permanent admin
// POST /api/admin/settings/admin-gmail
router.post("/settings/admin-gmail", async (req, res) => {
  try {
    const { adminGmail } = req.body;

    if (!adminGmail || typeof adminGmail !== "string") {
      return res.status(400).json({ status: "error", message: "Invalid Gmail address." });
    }

    // Only save if no admin Gmail has been set yet (first-time only)
    const existing = await Setting.findOne({ key: "adminGmail" });
    if (existing) {
      return res.status(403).json({ status: "error", message: "Admin Gmail already registered." });
    }

    await Setting.create({ key: "adminGmail", value: adminGmail.toLowerCase().trim() });
    return res.json({ status: "success", adminGmail });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

module.exports = router;