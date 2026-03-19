const express = require("express");
const router = express.Router();
const Place = require("../models/Place");

// GET /api/places
// GET /api/places?category=barangay
router.get("/", async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};
    const places = await Place.find(filter).sort({ name: 1 });
    res.json(places);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/places/fares — only places that have fare tier data
// Updated: checks fares.tiers exists instead of fares != null
router.get("/fares", async (req, res) => {
  try {
    const places = await Place.find({ "fares.tiers": { $exists: true } }).sort({ name: 1 });
    res.json(places);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/places/name/:name — find by name
router.get("/name/:name", async (req, res) => {
  try {
    const place = await Place.findOne({ name: req.params.name });
    if (!place) return res.status(404).json({ error: "Place not found" });
    res.json(place);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/places/:id — find by MongoDB ID
router.get("/:id", async (req, res) => {
  try {
    const place = await Place.findById(req.params.id);
    if (!place) return res.status(404).json({ error: "Place not found" });
    res.json(place);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;