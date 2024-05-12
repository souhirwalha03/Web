const express = require("express");
const router = express.Router();
const { sql, poolPromise } = require("../config/connect");
router.get("/pins", async (req, res) => {
  try {
    const pool = await poolPromise;
    const request = pool.request();
    const results = await request.query(
      "SELECT Location,availability,charging_type  FROM Charging_stations"
    );

    if (!Array.isArray(results.recordset) || results.recordset.length === 0) {
      console.log("No pins found");
      res.status(404).json({ message: "No pins found" });
      return;
    }

    const pins = results.recordset.map((result) => {
      console.log("result.availability", result.availability);
      console.log("result.availability", result.charging_type);

      const [lat, lng] = result.Location.split(",");
      return {
        lat: parseFloat(lat.trim()),
        lng: parseFloat(lng.trim()),
        availability: result.availability,
        charging_type: result.charging_type,
      };
    });

    res.json(pins);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
router.get("/pin-details", async (req, res) => {
  const { lat, lng } = req.query;

  const pool = await poolPromise;
  const request = pool.request();
  const results = await request.query(
    `SELECT * FROM Charging_stations WHERE Location = '${lat}, ${lng}'`
  );
  if (!results || results.recordset.length === 0) {
    res.status(404).json({ message: "Pin not found" });
    return;
  }

  const pinDetails = results.recordset[0];
  console.log(pinDetails);

  res.json(pinDetails);
});

router.get("/user-role", async (req, res) => {
  const pool = await poolPromise;
  let role;
  const result1 = await pool.request()
    .query`SELECT role FROM Users WHERE user_id = ${req.session.userId}`;
  console.log("result1", result1);

  if (result1.recordset.length > 0) {
    role = result1.recordset[0].role;
    console.log("role", role);
  } else {
    console.log("No record found for role");
  }

  res.send(role);
});
module.exports = router;
