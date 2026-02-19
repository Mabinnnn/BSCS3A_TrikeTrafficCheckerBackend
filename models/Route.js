const mongoose = require("mongoose");

const FareSchema = new mongoose.Schema({
  origin: { type: String, required: true },
  destination: { type: String, required: true },
  fare: { type: Number, required: true }
});

module.exports = mongoose.model("Fare", FareSchema);
