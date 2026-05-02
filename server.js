import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import connectDB from "./config/db.js";

// ✅ CORRECT ROUTES
import placesRoutes from "./routes/places.js";
import adminPlacesRoutes from "./routes/adminPlaces.js"; // FIXED
import faresRoutes from "./routes/fares.js";
import adminRoutes from "./routes/adminPlaces.js";

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// ✅ ROUTES
app.use("/api/places", placesRoutes);
app.use("/api/admin/places", adminPlacesRoutes);
app.use("/api/fares", faresRoutes);
app.use("/api/fare",  faresRoutes);
app.use("/api/admin/routes", adminRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});