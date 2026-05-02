require("dotenv").config();

const express   = require("express");
const cors      = require("cors");
const connectDB = require("./config/db");

const placesRoutes      = require("./routes/places");
const adminPlacesRoutes = require("./routes/adminPlaces");
const fareRoutes        = require("./routes/fare");       // ← NEW

const app = express();

connectDB();

app.use(cors());
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
