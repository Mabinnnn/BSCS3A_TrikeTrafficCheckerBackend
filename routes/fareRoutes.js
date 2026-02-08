const express = require("express");
const router = express.Router();
const Route = require("../models/Route");

const defaultRoutes = require("../data/defaultRoutes");
const { getAllPlaces, data: fareData } = require("../data/places");

// GET all places for dropdowns
router.get("/places", (req, res) => {
  const places = getAllPlaces();
  res.json({ status: "success", places });
});



// GET fare based on route, category, and gas price
router.get("/fare", (req, res) => {
  try {
    const { origin, destination, category = "regular", gas_price } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({ status: "error", message: "Origin and destination are required" });
    }
    if (origin === destination) {
      return res.status(400).json({ status: "error", message: "Origin and destination cannot be the same" });
    }

    // Find place objects
    const places = getAllPlaces();
    const originObj = places.find((p) => p.name === origin);
    const destObj = places.find((p) => p.name === destination);
    if (!originObj || !destObj) {
      return res.status(404).json({ status: "error", message: "Invalid origin or destination" });
    }

    // For this model, assume fare is from origin to destination (one is Poblacion/base, one is barangay)
    // Find which is base and which is barangay
    let fareObj = null;
    if (originObj.type === "zone" && destObj.type === "barangay") {
      fareObj = destObj;
    } else if (originObj.type === "barangay" && destObj.type === "zone") {
      fareObj = originObj;
    } else if (originObj.type === "zone" && destObj.type === "zone") {
      fareObj = originObj; // fallback
    } else {
      // barangay to barangay not supported
      return res.status(400).json({ status: "error", message: "Only trips between base and barangay supported" });
    }

    // Determine gas price range key
    let gasKey = null;
    if (gas_price) {
      const price = parseFloat(gas_price);
      const range = fareData.gasoline_price_ranges.find(r => price >= r.min && price <= r.max);
      if (range) {
        gasKey = range.range.replace(/\./g, '_'); // e.g. 50.00-59.00 -> 50_59
      }
    }
    if (!gasKey) {
      // Default to first range
      gasKey = Object.keys(fareObj.fares_by_gas_price)[0];
    }

    // Get fare for category
    const fare = fareObj.fares_by_gas_price[gasKey]?.[category.toLowerCase()];
    if (fare === undefined) {
      return res.status(404).json({ status: "error", message: "No fare found for this selection" });
    }

    res.json({
      status: "success",
      origin: originObj.name,
      destination: destObj.name,
      fare,
      currency: fareData.metadata.currency,
      category,
      gas_price: gas_price || null
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Server error" });
  }
});

module.exports = router;
// RESTORE DEFAULT FARE DATA (ADMIN)
router.post("/fare/restore", async (req, res) => {
  try {
    // 1. Remove all existing fare data
    await Route.deleteMany();

    // 2. Insert default fare data
    await Route.insertMany(defaultRoutes);

    res.json({
      status: "success",
      message: "Fare data restored to default"
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to restore fare data"
    });
  }
});
