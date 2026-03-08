const express = require("express");
const router = express.Router();
const Route = require("../models/Route");

// GET fare by route_no
router.get("/", async (req, res) => {
  try {
    const { route_no } = req.query;

    if (!route_no) {
      return res.status(400).json({ status: "error", message: "Route number is required" });
    }

    const data = await Route.findOne(); // finds the first document

    if (!data || !data.routes || data.routes.length === 0) {
      return res.status(404).json({ status: "error", message: "No routes found in database" });
    }

    const route = data.routes.find(r => r.route_no === Number(route_no));

    if (!route) {
      return res.status(404).json({ status: "error", message: "Route not found" });
    }

    res.json({ status: "success", route });

  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "error", message: "Server error" });
  }
});

module.exports = router;