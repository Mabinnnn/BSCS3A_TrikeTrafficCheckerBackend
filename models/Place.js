const mongoose = require("mongoose");

// ── fares is stored as a free-form Mixed object so that:
//   1. Hyphenated tier keys like "50-59", "60-69" are never stripped by Mongoose
//   2. Any future shape changes don't require a schema migration
// The frontend / admin always sends the full fares object; Mongoose stores it as-is.
const placeSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: true,
      trim:     true,
    },
    // Mixed accepts both [lng,lat] array AND GeoJSON {type, coordinates}
    coords: {
      type:    mongoose.Schema.Types.Mixed,
      default: null,
    },
    category: {
      type:    String,
      default: "barangay",
    },
    distance: {
      type:    String,
      default: null,
    },
    // Mixed so that fares.tiers keys ("50-59", "60-69", …) are stored verbatim
    fares: {
      type:    mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.Place || mongoose.model("Place", placeSchema);