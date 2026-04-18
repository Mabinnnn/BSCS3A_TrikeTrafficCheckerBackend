const express = require("express");
const router  = express.Router();
const Place   = require("../models/Place");
const Setting = require("../models/Setting");

// ─────────────────────────────────────────────────────────────────────────────
// VALID TIER KEYS
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

    // ── Normalize coords to [lng, lat] array ─────────────────────────────────
    let normalizedCoords = null;
    if (coords !== undefined && coords !== null) {
      if (Array.isArray(coords) && coords.length >= 2) {
        const lng = parseFloat(coords[0]);
        const lat = parseFloat(coords[1]);
        if (!isNaN(lng) && !isNaN(lat)) {
          normalizedCoords = [lng, lat];
        }
      } else if (coords && coords.coordinates && Array.isArray(coords.coordinates) && coords.coordinates.length >= 2) {
        const lng = parseFloat(coords.coordinates[0]);
        const lat = parseFloat(coords.coordinates[1]);
        if (!isNaN(lng) && !isNaN(lat)) {
          normalizedCoords = [lng, lat];
        }
      }
    }

    // Build the new document — fares is Mixed so it stores exactly what the
    // frontend sends (including hyphenated tier keys like "50-59")
    const doc = new Place({
      name,
      coords:   normalizedCoords,
      category,
      distance,
      fares:    fares ?? null,
    });

    // markModified ensures Mongoose persists Mixed fields even if they look
    // identical to the default value
    doc.markModified("fares");
    doc.markModified("coords");

    const place = await doc.save();
    res.status(201).json({ status: "success", place });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// PUT update a place by ID
// PUT /api/admin/places/:id
// Body: { fares: {...}, distance, coords }
router.put("/places/:id", async (req, res) => {
  try {
    const { fares, distance, coords } = req.body;

    // ── Find the document first ───────────────────────────────────────────────
    const doc = await Place.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ status: "error", message: "Place not found" });
    }

    // ── Update fares (Mixed field) ────────────────────────────────────────────
    // Assign directly and markModified so Mongoose knows the Mixed field changed.
    if (fares !== undefined) {
      doc.fares = fares;
      doc.markModified("fares");
    }

    // ── Update distance ───────────────────────────────────────────────────────
    if (distance !== undefined) {
      doc.distance = distance;
    }

    // ── Update coords — normalise to [lng, lat] array ─────────────────────────
    if (coords !== undefined) {
      if (coords === null) {
        doc.coords = null;
      } else {
        let coordsArray = null;
        if (Array.isArray(coords) && coords.length >= 2) {
          coordsArray = [parseFloat(coords[0]), parseFloat(coords[1])];
        } else if (coords?.coordinates?.length >= 2) {
          coordsArray = [parseFloat(coords.coordinates[0]), parseFloat(coords.coordinates[1])];
        }
        doc.coords = (coordsArray && !isNaN(coordsArray[0]) && !isNaN(coordsArray[1]))
          ? coordsArray
          : null;
      }
      doc.markModified("coords");
    }

    const updated = await doc.save();
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
// ─────────────────────────────────────────────────────────────────────────────

// GET active tier
// GET /api/admin/settings/active-tier
router.get("/settings/active-tier", async (req, res) => {
  try {
    const doc = await Setting.findOne({ key: "activeTier" });
    return res.json({
      status:     "success",
      activeTier: doc ? doc.value : "50-59",
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
