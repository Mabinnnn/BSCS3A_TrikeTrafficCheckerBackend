import express from "express";
import Place from "../models/Place.js";
import Route from "../models/Route.js";

const router = express.Router();

// GET /api/admin/places — all places
router.get("/", async (req, res) => {
  try {
    const places = await Place.find();
    res.json({ status: "success", places });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/admin/places — create a place
router.post("/", async (req, res) => {
  try {
    const place = await Place.create(req.body);
    res.status(201).json({ status: "success", place });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/admin/places/:id — update a place
router.put("/:id", async (req, res) => {
  try {
    const place = await Place.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!place) return res.status(404).json({ status: "error", message: "Place not found" });
    res.json({ status: "success", place });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/admin/places/:id — delete a place
router.delete("/:id", async (req, res) => {
  try {
    const place = await Place.findByIdAndDelete(req.params.id);
    if (!place) return res.status(404).json({ status: "error", message: "Place not found" });
    res.json({ status: "success", message: "Place deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/routes — all routes (kept here)
router.get("/routes", async (req, res) => {
  try {
    const routes = await Route.find();
    res.json({ status: "success", routes });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;