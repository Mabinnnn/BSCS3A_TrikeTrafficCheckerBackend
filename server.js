require("dotenv").config();

// ── Startup env-var check ─────────────────────────────────────────────────────
const REQUIRED_ENV = ["MONGO_URI", "JWT_SECRET"];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(
    `\n[FATAL] Missing required environment variables: ${missing.join(", ")}\n` +
    "  • Local: add them to fare-api-backend/.env\n" +
    "  • Deployed: add them in your hosting platform's environment settings.\n"
  );
  process.exit(1);
}

const express   = require("express");
const cors      = require("cors");
const connectDB = require("./config/db");

const placesRoutes      = require("./routes/places");
const adminPlacesRoutes = require("./routes/adminPlaces");
const fareRoutes        = require("./routes/fares");

const app = express();

connectDB();

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allow requests from the frontend origin. VITE_FRONTEND_URL can be set in
// .env for production (e.g. https://your-app.vercel.app). Falls back to
// localhost:5173 for local development.
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json());

// Public route — used by Checkerpage to load all places
app.use("/api/places", placesRoutes);

// Admin routes — ALL admin endpoints are now under /api/admin
// This covers:
//   POST   /api/admin/login
//   GET    /api/admin/places
//   POST   /api/admin/places
//   PUT    /api/admin/places/:id
//   DELETE /api/admin/places/:id
//   GET    /api/admin/settings/active-tier
//   PUT    /api/admin/settings/active-tier
app.use("/api/admin", adminPlacesRoutes);

// Fare calculation — moved from frontend to backend
//   POST /api/fare/calculate          { origin, destination, passengerType }
//   GET  /api/fare/passenger-types    returns the passenger-type lookup table
app.use("/api/fare", fareRoutes);        // ← NEW

app.get("/", (req, res) => res.send("✅ Server is running!"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));