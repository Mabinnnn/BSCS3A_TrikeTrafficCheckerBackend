const express = require("express");
const router = express.Router();
const Route = require("../models/Route");

// Admin credentials (embedded)
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "12345";

// GET /api/admin/routes - Get all routes
router.get("/routes", async (req, res) => {
  try {
    const data = await Route.findOne();
    if (!data || !data.routes || data.routes.length === 0) {
      return res.status(404).json({ status: "error", message: "No routes found" });
    }
    res.json({ status: "success", routes: data.routes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
});

// POST /api/admin/login
router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ status: "error", message: "Username and password required" });
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) return res.json({ status: "success", message: "Login successful" });
  return res.status(401).json({ status: "error", message: "Invalid credentials" });
});

// POST /api/admin/add - Add new TODA/route
router.post("/add", async (req, res) => {
  try {
    const { route_no, toda_name, location, student_fare_min, student_fare_max } = req.body;
    if (!route_no || !toda_name || !location || !student_fare_min || !student_fare_max)
      return res.status(400).json({ status: "error", message: "All fields required" });

    const data = await Route.findOne();
    if (!data) {
      // If no document exists, create one
      await Route.create({ routes: [{ route_no, toda_name, location, student_fare_min, student_fare_max }] });
    } else {
      // Check if route_no exists
      const exists = data.routes.find(r => r.route_no === Number(route_no));
      if (exists) return res.status(400).json({ status: "error", message: "Route number already exists" });

      await Route.updateOne({}, { $push: { routes: { route_no, toda_name, location, student_fare_min, student_fare_max } } });
    }

    res.json({ status: "success", message: "Route added successfully" });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Server error" });
  }
});

// PUT /api/admin/update - Update existing TODA/route
router.put("/update", async (req, res) => {
  try {
    const { route_no, toda_name, location, student_fare_min, student_fare_max } = req.body;
    if (!route_no) return res.status(400).json({ status: "error", message: "route_no is required" });

    const data = await Route.findOne();
    if (!data) return res.status(404).json({ status: "error", message: "No routes found" });

    const updated = await Route.updateOne(
      { "routes.route_no": route_no },
      { $set: {
          "routes.$.toda_name": toda_name,
          "routes.$.location": location,
          "routes.$.student_fare_min": student_fare_min,
          "routes.$.student_fare_max": student_fare_max
        }
      }
    );

    if (updated.matchedCount === 0) return res.status(404).json({ status: "error", message: "Route not found" });

    res.json({ status: "success", message: "Route updated successfully" });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Server error" });
  }
});

// DELETE /api/admin/delete - Delete TODA/route
router.delete("/delete", async (req, res) => {
  try {
    const { route_no } = req.body;
    if (!route_no) return res.status(400).json({ status: "error", message: "route_no is required" });

    const data = await Route.findOne();
    if (!data) return res.status(404).json({ status: "error", message: "No routes found" });

    await Route.updateOne({}, { $pull: { routes: { route_no: route_no } } });

    res.json({ status: "success", message: "Route deleted successfully" });
  } catch (error) {
    res.status(500).json({ status: "error", message: "Server error" });
  }
});

module.exports = router;