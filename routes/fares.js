/**
 * POST /api/fare/calculate
 *
 * Accepts { origin, destination, passengerType } in the request body.
 * Fetches the active gasoline tier from MongoDB, looks up both places,
 * calls OSRM for the real road distance, applies the fare table and the
 * passenger-type multiplier, then returns a structured fareInfo object
 * that the frontend's /result page can consume directly.
 *
 * This is the server-side equivalent of the handleCalculate() + getFareForRoute()
 * logic that previously lived in Checkerpage.jsx.
 */

const express = require("express");
const router  = express.Router();
const Place   = require("../models/Place");
const Setting = require("../models/Setting");

// ─── Constants (must match the frontend's PASSENGER_TYPES / fare rules) ───────

const PASSENGER_TYPES = [
  { value: "regular", label: "Regular",              multiplier: 1.00, discountPercent:  0 },
  { value: "student", label: "Student (Estudyante)", multiplier: 0.80, discountPercent: 20 },
  { value: "pwd",     label: "PWD",                  multiplier: 0.80, discountPercent: 20 },
  { value: "senior",  label: "Senior Citizen",        multiplier: 0.80, discountPercent: 20 },
];

const SHORT_TRIP_FLAT_FARE = 25;   // ₱25 for trips ≤ 2.0 km
const SHORT_TRIP_MAX_KM    = 2.0;
const OSRM_BASE            = "https://router.project-osrm.org/route/v1/driving";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract [lng, lat] from a Place document's coords field (Mixed). */
const getCoords = (place) => {
  if (!place?.coords) return null;
  if (Array.isArray(place.coords)) return place.coords;
  if (place.coords.coordinates && Array.isArray(place.coords.coordinates)) {
    return place.coords.coordinates;
  }
  return null;
};

/** Haversine straight-line distance in km — used as fallback only. */
const haversineKm = (from, to) => {
  if (!from || !to || from.length < 2 || to.length < 2) return null;
  const [lng1, lat1] = from;
  const [lng2, lat2] = to;
  const toRad = (d) => (d * Math.PI) / 180;
  const R   = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** Get numeric stored distance_km from a Place document. */
const getPlaceKm = (place) => {
  if (!place) return 0;
  if (place.fares?.distance_km != null) return parseFloat(place.fares.distance_km) || 0;
  if (place.distance != null)          return parseFloat(place.distance)           || 0;
  return 0;
};

/**
 * Call OSRM routing API for the actual road distance between two [lng,lat] pairs.
 * Returns km as a number, or null on failure.
 */
const getOSRMRoadDistance = async (fromCoords, toCoords) => {
  if (!fromCoords || !toCoords) return null;
  try {
    const url =
      `${OSRM_BASE}/${fromCoords[0]},${fromCoords[1]};${toCoords[0]},${toCoords[1]}` +
      `?overview=false`;

    // Use native fetch (Node 18+) or fall back to the global if polyfilled
    const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.routes?.length > 0) {
      return data.routes[0].legs[0].distance / 1000; // metres → km
    }
  } catch {
    // OSRM unreachable — caller will fall back to stored / Haversine distance
  }
  return null;
};

/**
 * Core fare logic — mirrors Checkerpage.getFareForRoute().
 *
 * @param {object} origPlace   - Place document from MongoDB
 * @param {object} destPlace   - Place document from MongoDB
 * @param {string} tierKey     - Active gasoline tier, e.g. "50-59"
 * @param {number|null} roadKm - Actual road distance in km (from OSRM or fallback)
 * @returns {object|null}      - Raw fare data (before passenger multiplier)
 */
const getFareForRoute = (origPlace, destPlace, tierKey, roadKm) => {
  // ── Short-trip flat rate ───────────────────────────────────────────────────
  if (roadKm != null && roadKm > 0.05 && roadKm <= SHORT_TRIP_MAX_KM) {
    return {
      activeTier:          tierKey,
      baseFare:            SHORT_TRIP_FLAT_FARE,
      isShortTripFlat:     true,
      emergency_provisional_php: null,
      "50-59": SHORT_TRIP_FLAT_FARE,
      "60-69": SHORT_TRIP_FLAT_FARE,
      "70-79": SHORT_TRIP_FLAT_FARE,
      "80-89": SHORT_TRIP_FLAT_FARE,
      "90-99": SHORT_TRIP_FLAT_FARE,
      route:       "Short Trip",
      route_label: `Short Trip ≤ ${SHORT_TRIP_MAX_KM} km (Flat Rate ₱${SHORT_TRIP_FLAT_FARE})`,
      distance_km: parseFloat(roadKm.toFixed(2)),
      distance:    `${roadKm.toFixed(1)} km`,
    };
  }

  // ── Pick the place that carries the fare table ────────────────────────────
  const origHasFares = !!(origPlace?.fares?.tiers);
  const destHasFares = !!(destPlace?.fares?.tiers);

  let farePlace = null;
  if (origHasFares && destHasFares) {
    farePlace = getPlaceKm(origPlace) >= getPlaceKm(destPlace) ? origPlace : destPlace;
  } else if (origHasFares) {
    farePlace = origPlace;
  } else if (destHasFares) {
    farePlace = destPlace;
  }

  if (!farePlace) return null;

  const tiers    = farePlace.fares?.tiers ?? {};
  const baseFare = tiers[tierKey] ?? null;

  return {
    activeTier: tierKey,
    baseFare,
    emergency_provisional_php: farePlace.fares?.emergency_provisional_php ?? null,
    "50-59": tiers["50-59"] ?? null,
    "60-69": tiers["60-69"] ?? null,
    "70-79": tiers["70-79"] ?? null,
    "80-89": tiers["80-89"] ?? null,
    "90-99": tiers["90-99"] ?? null,
    route:       farePlace.fares?.route       ?? null,
    route_label: farePlace.fares?.route_label ?? farePlace.fares?.fare_basis ?? null,
    distance_km: roadKm != null
      ? parseFloat(roadKm.toFixed(2))
      : (farePlace.fares?.distance_km ?? null),
    distance: roadKm != null
      ? `${roadKm.toFixed(1)} km`
      : (farePlace.distance ?? null),
  };
};

// ─── POST /api/fare/calculate ─────────────────────────────────────────────────

router.post("/calculate", async (req, res) => {
  try {
    const { origin, destination, passengerType = "regular" } = req.body;

    // ── Validate inputs ───────────────────────────────────────────────────────
    if (!origin || !destination) {
      return res.status(400).json({
        status:  "error",
        message: "Both 'origin' and 'destination' are required.",
      });
    }
    if (origin === destination) {
      return res.status(400).json({
        status:  "error",
        message: "Origin and destination must be different places.",
      });
    }

    const passenger = PASSENGER_TYPES.find((p) => p.value === passengerType);
    if (!passenger) {
      return res.status(400).json({
        status:  "error",
        message: `Invalid passengerType. Must be one of: ${PASSENGER_TYPES.map((p) => p.value).join(", ")}.`,
      });
    }

    // ── Fetch both places from MongoDB ────────────────────────────────────────
    const [origPlace, destPlace] = await Promise.all([
      Place.findOne({ name: origin }),
      Place.findOne({ name: destination }),
    ]);

    if (!origPlace) {
      return res.status(404).json({ status: "error", message: `Place not found: "${origin}"` });
    }
    if (!destPlace) {
      return res.status(404).json({ status: "error", message: `Place not found: "${destination}"` });
    }

    const coordsA = getCoords(origPlace);
    const coordsB = getCoords(destPlace);

    // ── Too-close check (straight-line ≤ 100 m) ──────────────────────────────
    const geoDist = haversineKm(coordsA, coordsB);
    if (geoDist !== null && geoDist >= 0.001 && geoDist <= 0.1) {
      return res.status(400).json({
        status:  "error",
        message: "These places are just across from each other.",
        tooClose: true,
      });
    }

    // ── Fetch active gasoline tier from MongoDB Settings ──────────────────────
    let activeTier = "50-59"; // safe default
    try {
      const setting = await Setting.findOne({ key: "activeTier" });
      if (setting?.value) activeTier = setting.value;
    } catch {
      // DB read failed — keep default
    }

    // ── OSRM road distance ────────────────────────────────────────────────────
    let roadKm = await getOSRMRoadDistance(coordsA, coordsB);

    // Fallback: stored distance_km (max of origin/destination) or Haversine
    if (roadKm === null) {
      const origKm = getPlaceKm(origPlace);
      const destKm = getPlaceKm(destPlace);
      const maxStoredKm = Math.max(origKm, destKm);
      roadKm = maxStoredKm > 0 ? maxStoredKm : (geoDist ?? null);
    }

    // ── Fare lookup ───────────────────────────────────────────────────────────
    const routeData = getFareForRoute(origPlace, destPlace, activeTier, roadKm);

    if (!routeData) {
      return res.status(200).json({
        status: "success",
        origin,
        destination,
        fareInfo: null,
        message:  "No fare data found for this route.",
      });
    }

    // ── Apply passenger-type multiplier ───────────────────────────────────────
    const baseFare   = routeData.baseFare ?? null;
    const finalFare  = baseFare != null ? Math.round(baseFare * passenger.multiplier) : null;
    const fareDecrease = baseFare != null && finalFare != null ? baseFare - finalFare : null;

    const fareInfo = {
      ...routeData,
      rideType:        passenger.value,
      rideLabel:       passenger.label,
      multiplier:      passenger.multiplier,
      discountPercent: passenger.discountPercent,
      finalFare,
      fareIncrease: fareDecrease != null ? -fareDecrease : 0,
    };

    return res.json({
      status: "success",
      origin,
      destination,
      fareInfo,
    });
  } catch (err) {
    console.error("[fare/calculate] error:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
});

// ─── GET /api/fare/passenger-types  (convenience — returns the lookup table) ──
router.get("/passenger-types", (_req, res) => {
  res.json({ status: "success", passengerTypes: PASSENGER_TYPES });
});

// ─── GET /api/fare/route-geometry ─────────────────────────────────────────────
// Proxies an OSRM driving-route request so the browser never calls OSRM directly.
// Query params: fromLng, fromLat, toLng, toLat  (all required, all floats)
// Returns: { status, geometry (GeoJSON LineString), distance_km, duration_min }
router.get("/route-geometry", async (req, res) => {
  const { fromLng, fromLat, toLng, toLat } = req.query;

  if (!fromLng || !fromLat || !toLng || !toLat) {
    return res.status(400).json({
      status: "error",
      message: "Query params fromLng, fromLat, toLng, toLat are all required.",
    });
  }

  const fLng = parseFloat(fromLng);
  const fLat = parseFloat(fromLat);
  const tLng = parseFloat(toLng);
  const tLat = parseFloat(toLat);

  if ([fLng, fLat, tLng, tLat].some(isNaN)) {
    return res.status(400).json({ status: "error", message: "All coords must be valid numbers." });
  }

  try {
    const url =
      `${OSRM_BASE}/${fLng},${fLat};${tLng},${tLat}` +
      `?overview=full&geometries=geojson`;

    const osrmRes = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!osrmRes.ok) {
      return res.status(502).json({ status: "error", message: "OSRM returned an error." });
    }

    const osrmData = await osrmRes.json();
    if (!osrmData.routes?.length) {
      return res.status(404).json({ status: "error", message: "No route found between these points." });
    }

    const route = osrmData.routes[0];
    return res.json({
      status:       "success",
      geometry:     route.geometry,                                   // GeoJSON LineString
      distance_km:  parseFloat((route.legs[0].distance / 1000).toFixed(2)),
      duration_min: Math.ceil(route.legs[0].duration / 60),
    });
  } catch (err) {
    return res.status(502).json({ status: "error", message: `OSRM unreachable: ${err.message}` });
  }
});

module.exports = router;
