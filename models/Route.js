const mongoose = require("mongoose");

const routeSchema = new mongoose.Schema({
  origin: {
    type: String,
    required: true,
    trim: true
  },
  destination: {
    type: String,
    required: true,
    trim: true
  },
  fare: {
    type: Number,
    required: true
  }
});

module.exports = mongoose.model("Route", routeSchema);
