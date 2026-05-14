const express = require("express");
const Place   = require("../models/Place");

const router = express.Router();

// ✅ GET all places or filter by category
// /api/places?category=zone
router.get("/", async (req, res) => {
  try {
    const { category } = req.query;

    let query = {};
    if (category) {
      query.category = category;
    }

    const places = await Place.find(query);
    res.json(places);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ GET all places with fares
// /api/places/fares
router.get("/fares", async (req, res) => {
  try {
    const places = await Place.find().select("name fares route_no");
    res.json(places);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ GET place by name
// /api/places/name/Town Proper
router.get("/name/:name", async (req, res) => {
  try {
    const place = await Place.findOne({
      name: { $regex: new RegExp(`^${req.params.name}$`, "i") },
    });

    if (!place) {
      return res.status(404).json({ message: "Place not found" });
    }

    res.json(place);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ❗ IMPORTANT: ALWAYS LAST
// ✅ GET place by ID
// /api/places/:id
router.get("/:id", async (req, res) => {
  try {
    const place = await Place.findById(req.params.id);

    if (!place) {
      return res.status(404).json({ message: "Place not found" });
    }

    res.json(place);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;