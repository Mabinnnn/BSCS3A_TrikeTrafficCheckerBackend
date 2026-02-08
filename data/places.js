const fs = require('fs');
const path = require('path');

// Load the JSON data
const data = require('../../../../Downloads/FARE-IN-BULAN.json');

// Helper to get all places (base_zones + barangays)
const getAllPlaces = () => {
  const places = [];
  if (data.base_zones) {
    data.base_zones.forEach((z) => {
      places.push({
        id: z.zone_id,
        name: z.zone_name,
        type: 'zone',
        fares_by_gas_price: z.fares_by_gas_price,
        distance_km: z.distance_km
      });
    });
  }
  if (data.barangays) {
    data.barangays.forEach((b) => {
      places.push({
        id: b.barangay_id,
        name: b.barangay_name,
        type: 'barangay',
        fares_by_gas_price: b.fares_by_gas_price,
        distance_km: b.distance_km
      });
    });
  }
  return places;
};

module.exports = {
  getAllPlaces,
  data
};
