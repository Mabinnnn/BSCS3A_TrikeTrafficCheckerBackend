import express from "express";
import Place from "../models/Place.js";

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
// /api/places/123const mongoose = require("mongoose");

// ── fares is stored as a free-form Mixed object so that:
//   1. Hyphenated tier keys like "50-59", "60-69" are never stripped by Mongoose
//   2. Any future shape changes don't require a schema migration
// The frontend / admin always sends the full fares object; Mongoose stores it as-is.
const placeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Mixed accepts both [lng,lat] array AND GeoJSON {type, coordinates}
    coords: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    category: {
      type: String,
      default: "barangay",
    },
    distance: {
      type: String,
      default: null,
    },
    // Mixed so that fares.tiers keys ("50-59", "60-69", …) are stored verbatim
    fares: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.Place || mongoose.model("Place", placeSchema);

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

export default router;