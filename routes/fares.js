import express from "express";
import Route from "../models/Route.js";

const router = express.Router();

// GET /api/fares?route_no=1
router.get("/", async (req, res) => {
  try {
    const { route_no } = req.query;

    const route = await Route.findOne({ route_no });

    if (!route) {
      return res.status(404).json({
        status: "error",
        message: "Route not found",
      });
    }

    res.json({
      status: "success",
      route,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;