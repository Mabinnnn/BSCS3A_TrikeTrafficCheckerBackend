const express = require("express");
const router = express.Router();
const Route = require("../models/Route");

const defaultRoutes = require("../data/defaultRoutes");
const { getAllPlaces, data: fareData } = require("../data/places");


// GET all places
router.get("/places", (req, res) => {
  const places = getAllPlaces();
  res.json({ status: "success", places });
});


// GET fare
router.get("/fare", (req, res) => {
  try {
    const { origin, destination, category = "regular", gas_price } = req.query;

    if (!origin || !destination) {
      return res.status(400).json({ status: "error", message: "Origin and destination are required" });
    }

    if (origin === destination) {
      return res.status(400).json({ status: "error", message: "Origin and destination cannot be the same" });
    }

    const places = getAllPlaces();
    const originObj = places.find(p => p.name === origin);
    const destObj = places.find(p => p.name === destination);

    if (!originObj || !destObj) {
      return res.status(404).json({ status: "error", message: "Invalid origin or destination" });
    }

    let fareObj = null;

    if (originObj.type === "zone" && destObj.type === "barangay") {
      fareObj = destObj;
    } else if (originObj.type === "barangay" && destObj.type === "zone") {
      fareObj = originObj;
    } else {
      return res.status(400).json({ status: "error", message: "Only trips between base and barangay supported" });
    }

    let gasKey = null;

    if (gas_price) {
      const price = parseFloat(gas_price);
      const range = fareData.gasoline_price_ranges.find(r => price >= r.min && price <= r.max);

      if (range) {
        gasKey = range.range.replace(/\./g, '_');
      }
    }

    if (!gasKey) {
      gasKey = Object.keys(fareObj.fares_by_gas_price)[0];
    }

    const fare = fareObj.fares_by_gas_price[gasKey]?.[category.toLowerCase()];

    if (fare === undefined) {
      return res.status(404).json({ status: "error", message: "No fare found" });
    }

    res.json({
      status: "success",
      origin: originObj.name,
      destination: destObj.name,
      fare
    });

  } catch (error) {
    res.status(500).json({ status: "error", message: "Server error" });
  }
});


// ✅ RESTORE DEFAULT FARE DATA
router.post("/fare/restore", async (req, res) => {
  try {
    await Route.deleteMany();
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


// ✅ EXPORT AT VERY BOTTOM
module.exports = router;
