import mongoose from "mongoose";

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

const Route =
  mongoose.models.Route || mongoose.model("Route", routeSchema);

export default Route;