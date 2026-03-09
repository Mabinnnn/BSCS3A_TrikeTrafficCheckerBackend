require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const fareRoutes = require("./routes/fareRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/fares", fareRoutes);
app.use("/api/admin", adminRoutes);

// Test route
app.get("/", (req, res) => res.send("Server is running!"));

// MongoDB connection
const mongoUri = process.env.MONGO_URI; // Must match your environment variable
if (!mongoUri) {
  console.error("❌ Error: MONGO_URI is not defined");
  process.exit(1); // Exit if URI is missing
}

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ MongoDB connection error:", err));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));