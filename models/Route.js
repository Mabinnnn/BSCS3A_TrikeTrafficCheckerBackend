const mongoose = require("mongoose");

const routeSchema = new mongoose.Schema({
  routes: [
    {
      route_no: { type: Number, required: true },
      toda_name: { type: String, required: true },
      location: { type: String, required: true },
      student_fare_min: { type: Number, required: true },
      student_fare_max: { type: Number, required: true }
    }
  ]
});

module.exports = mongoose.model("Route", routeSchema);