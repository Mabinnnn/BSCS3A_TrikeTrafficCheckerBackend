const express = require("express");
const router  = express.Router();
const jwt     = require("jsonwebtoken");
const Place   = require("../models/Place");
const Setting = require("../models/Setting");
const Admin   = require("../models/Admin");

// ── fetch polyfill: works on Node 14/16 (no built-in fetch) and Node 18+ ─────
const nodeFetch = (() => {
  if (typeof fetch !== "undefined") return fetch;          // Node 18+
  try { return require("node-fetch"); } catch (_) {}       // node-fetch installed
  throw new Error(
    "No fetch implementation found. Run `npm install node-fetch` or upgrade to Node 18+."
  );
})();

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const VALID_TIERS = ["50-59", "60-69", "70-79", "80-89", "90-99"];
const JWT_SECRET  = process.env.JWT_SECRET;
const JWT_EXPIRY  = "4h"; // token expires in 4 hours

// ── Guard: fail loudly at startup if JWT_SECRET is missing ───────────────────
if (!JWT_SECRET) {
  console.error(
    "\n[FATAL] JWT_SECRET environment variable is not set.\n" +
    "  • Local: add  JWT_SECRET=<your-secret>  to fare-api-backend/.env\n" +
    "  • Deployed: add it to your hosting platform's environment variables.\n"
  );
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT MIDDLEWARE — protects all admin routes below
// Every request to /api/admin/* (except /auth/google) must carry:
//   Authorization: Bearer <token>
// The token is issued by POST /api/admin/auth/google after verifying
// the Google OAuth access_token against Google's API and checking the
// admin's email against the `admins` collection in MongoDB.
// ─────────────────────────────────────────────────────────────────────────────
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ status: "error", message: "No admin token provided." });
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.adminEmail = decoded.email;  // attach email for downstream handlers
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ status: "error", message: "Admin session expired. Please sign in again." });
    }
    return res.status(401).json({ status: "error", message: "Invalid admin token." });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTE — Google OAuth verification + JWT issuance
// POST /api/admin/auth/google
// Body: { accessToken: "<google_oauth_access_token>" }
//
// Flow:
//  1. Receive Google access_token from the frontend
//  2. Verify it against Google's API on the BACKEND (cannot be spoofed)
//  3. Extract email from Google's verified response
//  4. Check the email against the `admins` collection in MongoDB
//  5. If authorized → issue a signed JWT
//  6. If not → return 403
// ─────────────────────────────────────────────────────────────────────────────
router.post("/auth/google", async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken || typeof accessToken !== "string") {
      return res.status(400).json({ status: "error", message: "Missing Google access token." });
    }

    // ── Step 1: Verify with Google ────────────────────────────────────────────
    // This hits Google's real API. A forged or expired token returns an error.
    const googleRes = await nodeFetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!googleRes.ok) {
      return res.status(401).json({
        status:  "error",
        message: "Could not verify Google account. Token may be invalid or expired.",
      });
    }

    const googleData = await googleRes.json();
    const email = (googleData.email || "").toLowerCase().trim();

    if (!email) {
      return res.status(401).json({ status: "error", message: "No email returned from Google." });
    }

    // ── Step 2: Check MongoDB admins collection ────────────────────────────────
    const adminDoc = await Admin.findOne({ email });

    if (!adminDoc) {
      // Log unauthorized attempt (server-side only — not exposed to client)
      console.warn(`[ADMIN AUTH] Unauthorized access attempt by: ${email}`);
      return res.status(403).json({
        status:  "error",
        message: `Access denied. "${googleData.email}" is not an authorized admin.`,
      });
    }

    // ── Step 3: Issue JWT ──────────────────────────────────────────────────────
    const token = jwt.sign(
      { email, name: googleData.name || "" },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    console.log(`[ADMIN AUTH] Admin login: ${email}`);

    return res.json({
      status: "success",
      token,
      email:  googleData.email,
      name:   googleData.name || "",
    });

  } catch (err) {
    console.error("[ADMIN AUTH] Unexpected error:", err.message);
    res.status(500).json({
      status:  "error",
      message: "Authentication error. Please try again.",
      ...(process.env.NODE_ENV !== "production" && { detail: err.message }),
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ALL ROUTES BELOW REQUIRE A VALID ADMIN JWT
// ─────────────────────────────────────────────────────────────────────────────
router.use(requireAdminAuth);

// ─────────────────────────────────────────────────────────────────────────────
// PLACES
// ─────────────────────────────────────────────────────────────────────────────

// GET all places
router.get("/places", async (req, res) => {
  try {
    const places = await Place.find().sort({ category: 1, name: 1 });
    res.json({ status: "success", places });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// POST add a new place
router.post("/places", async (req, res) => {
  try {
    const { name, coords, category, distance, fares } = req.body;

    let normalizedCoords = null;
    if (coords !== undefined && coords !== null) {
      if (Array.isArray(coords) && coords.length >= 2) {
        const lng = parseFloat(coords[0]);
        const lat = parseFloat(coords[1]);
        if (!isNaN(lng) && !isNaN(lat)) normalizedCoords = [lng, lat];
      } else if (coords?.coordinates?.length >= 2) {
        const lng = parseFloat(coords.coordinates[0]);
        const lat = parseFloat(coords.coordinates[1]);
        if (!isNaN(lng) && !isNaN(lat)) normalizedCoords = [lng, lat];
      }
    }

    const doc = new Place({ name, coords: normalizedCoords, category, distance, fares: fares ?? null });
    doc.markModified("fares");
    doc.markModified("coords");
    const place = await doc.save();
    res.status(201).json({ status: "success", place });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// PUT update a place by ID
router.put("/places/:id", async (req, res) => {
  try {
    const { fares, distance, coords } = req.body;
    const doc = await Place.findById(req.params.id);
    if (!doc) return res.status(404).json({ status: "error", message: "Place not found" });

    if (fares !== undefined) { doc.fares = fares; doc.markModified("fares"); }
    if (distance !== undefined) doc.distance = distance;

    if (coords !== undefined) {
      if (coords === null) {
        doc.coords = null;
      } else {
        let arr = null;
        if (Array.isArray(coords) && coords.length >= 2) {
          arr = [parseFloat(coords[0]), parseFloat(coords[1])];
        } else if (coords?.coordinates?.length >= 2) {
          arr = [parseFloat(coords.coordinates[0]), parseFloat(coords.coordinates[1])];
        }
        doc.coords = (arr && !isNaN(arr[0]) && !isNaN(arr[1])) ? arr : null;
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
router.delete("/places/:id", async (req, res) => {
  try {
    const deleted = await Place.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ status: "error", message: "Place not found" });
    res.json({ status: "success", message: "Place deleted" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS — ACTIVE GASOLINE TIER
// ─────────────────────────────────────────────────────────────────────────────

router.get("/settings/active-tier", async (req, res) => {
  try {
    const doc = await Setting.findOne({ key: "activeTier" });
    res.json({ status: "success", activeTier: doc ? doc.value : "50-59" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

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
    res.json({ status: "success", activeTier: doc.value });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN MANAGEMENT — list, add, remove authorized admins
// Only an already-authenticated admin can manage the list.
// ─────────────────────────────────────────────────────────────────────────────

// GET list of all admin emails
router.get("/admins", async (req, res) => {
  try {
    const admins = await Admin.find({}, { email: 1, addedBy: 1, createdAt: 1 }).lean();
    res.json({ status: "success", admins });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// POST add a new admin email
router.post("/admins", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ status: "error", message: "Valid email is required." });
    }
    const normalized = email.toLowerCase().trim();
    const existing = await Admin.findOne({ email: normalized });
    if (existing) {
      return res.status(409).json({ status: "error", message: "Email is already an admin." });
    }
    const admin = await Admin.create({ email: normalized, addedBy: req.adminEmail });
    res.status(201).json({ status: "success", admin });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// DELETE remove an admin email
router.delete("/admins/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase().trim();

    // Prevent removing yourself
    if (email === req.adminEmail) {
      return res.status(400).json({ status: "error", message: "You cannot remove your own admin access." });
    }

    const deleted = await Admin.findOneAndDelete({ email });
    if (!deleted) return res.status(404).json({ status: "error", message: "Admin email not found." });

    res.json({ status: "success", message: `${email} removed from admins.` });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

module.exports = router;
