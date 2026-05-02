import express from "express";
import Route from "../models/Route.js";

const router = express.Router();

// GET /api/admin/routes
router.get("/", async (req, res) => {
  try {
    const routes = await Route.find();

    res.json({
      status: "success",
      routes,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;