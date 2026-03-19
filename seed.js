require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("./config/db");
const Place = require("./models/Place");
const bulanPlaces = require("./data/bulan-places-with-fares");

const seed = async () => {
  try {
    await connectDB();

    // Clear existing data
    await Place.deleteMany();
    console.log("🗑️  Cleared existing places");

    // Insert all places
    await Place.insertMany(bulanPlaces);
    console.log(`✅ Successfully inserted ${bulanPlaces.length} places into MongoDB!`);

    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
    process.exit(0);

  } catch (error) {
    console.error("❌ Seed error:", error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seed();
