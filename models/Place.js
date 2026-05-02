import mongoose from "mongoose";

const TiersSchema = new mongoose.Schema(
  {
    "50-59": { type: Number, default: null },
    "60-69": { type: Number, default: null },
    "70-79": { type: Number, default: null },
    "80-89": { type: Number, default: null },
    "90-99": { type: Number, default: null },
  },
  { _id: false }
);

const FaresSchema = new mongoose.Schema(
  {
    route: { type: String, default: null },
    route_label: { type: String, default: null },
    fare_basis: { type: String, default: null },
    distance_km: { type: Number, default: null },
    emergency_provisional_php: { type: Number, default: null },
    tiers: { type: TiersSchema, default: () => ({}) },
  },
  { _id: false }
);

const placeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    coords: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    category: {
      type: String,
      default: "barangay",
    },
    distance: {
      type: String,
      default: null,
    },
    fares: {
      type: FaresSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

const Place =
  mongoose.models.Place || mongoose.model("Place", placeSchema);

export default Place;