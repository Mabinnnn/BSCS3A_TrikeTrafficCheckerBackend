import express from "express";
import Route from "../models/Route.js";
import Place from "../models/Place.js";
import Setting from "../models/Setting.js";

const router = express.Router();

// GET /api/fares?route_no=1  (existing)
router.get("/", async (req, res) => {
  try {
    const { route_no } = req.query;
    const route = await Route.findOne({ route_no });
    if (!route) return res.status(404).json({ status: "error", message: "Route not found" });
    res.json({ status: "success", route });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/fare/passenger-types
router.get("/passenger-types", (req, res) => {
  res.json({
    passengerTypes: [
      { key: "regular",  label: "Regular" },
      { key: "student",  label: "Student" },
      { key: "pwd",      label: "PWD" },
      { key: "senior",   label: "Senior Citizen" },
    ],
  });
});

// GET /api/fare/route-geometry?fromLng=&fromLat=&toLng=&toLat=
router.get("/route-geometry", async (req, res) => {
  try {
    const { fromLng, fromLat, toLng, toLat } = req.query;
    if (!fromLng || !fromLat || !toLng || !toLat)
      return res.status(400).json({ status: "error", message: "Missing coordinates" });

    const osrmURL =
      `http://router.project-osrm.org/route/v1/driving/` +
      `${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;

    const response = await fetch(osrmURL);
    const data = await response.json();

    if (!data.routes || data.routes.length === 0)
      return res.json({ status: "error", message: "No route found" });

    const leg = data.routes[0];
    res.json({
      status: "success",
      geometry: leg.geometry,
      distance_km: +(leg.distance / 1000).toFixed(2),
      duration_min: +(leg.duration / 60).toFixed(1),
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// POST /api/fare/calculate
router.post("/calculate", async (req, res) => {
  try {
    const { origin, destination, passengerType = "regular" } = req.body;

    if (!origin || !destination)
      return res.status(400).json({ status: "error", message: "Origin and destination are required" });

    if (origin === destination)
      return res.status(400).json({ status: "error", message: "Origin and destination cannot be the same", tooClose: true });

    const [originPlace, destPlace] = await Promise.all([
      Place.findOne({ name: origin }),
      Place.findOne({ name: destination }),
    ]);

    if (!originPlace) return res.status(404).json({ status: "error", message: `Place not found: ${origin}` });
    if (!destPlace)   return res.status(404).json({ status: "error", message: `Place not found: ${destination}` });

    // Get active gasoline tier from settings
    const setting = await Setting.findOne({ key: "activeTier" });
    const activeTier = setting?.value ?? "50-59";

    // Pull fare from destination's fares.tiers map
    const tierFares = destPlace.fares?.tiers?.get(activeTier) ?? destPlace.fares?.tiers?.[activeTier];

    if (!tierFares)
      return res.status(404).json({ status: "error", message: `No fare data for tier: ${activeTier}` });

    const discountMap = { regular: 1, student: 0.8, pwd: 0.8, senior: 0.8 };
    const discount = discountMap[passengerType] ?? 1;
    const baseFare = tierFares.base ?? 0;
    const finalFare = +(baseFare * discount).toFixed(2);

    res.json({
      status: "success",
      origin,
      destination,
      fareInfo: {
        baseFare,
        finalFare,
        passengerType,
        activeTier,
        discount: discount < 1 ? "20% discount applied" : null,
      },
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

export default router;