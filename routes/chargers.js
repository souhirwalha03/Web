const express = require("express");
const router = express.Router();
const { sql, poolPromise } = require("../config/connect");

router.get("/charging-stations", async (req, res) => {
  try {
    console.log(req.body);

    const pool = await poolPromise;
    const result = await pool
      .request()
      .query("SELECT * FROM Charging_stations");
    res.json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/add-station", async (req, res) => {
  const { stationName, location, Address, type, power, price } = req.body;
  console.log("type", type);
  try {
    const pool = await poolPromise;
    const request = pool.request();

    request.input("stationName", sql.VarChar, stationName);
    request.input("location", sql.VarChar, location);
    request.input("Address", sql.VarChar, Address);
    request.input("type", sql.VarChar, type);
    request.input("power", sql.Float, power);

    request.input("price", sql.Int, price);

    // Check if station with the same name already exists
    const existingStation = await request.query(
      `
        SELECT 1 FROM Charging_stations WHERE Station_name = @stationName
        `,
      { stationName }
    );

    if (existingStation.recordset.length > 0) {
      return res.redirect("admin/Chargers.html?message=Station+already+exists");
    }
    const result = await request.query(`
        INSERT INTO Charging_stations (Station_name, Location, availability, Address, charging_type, power_rating, Pricing)
        VALUES (@stationName, @location, 'Available', @Address, @type, @power, @price)
      `);

    return res.redirect(
      "admin/Chargers.html?message=Station+added+successfully"
    );
  } catch (error) {
    console.error("Error inserting station:", error);
    res.sendStatus(500); 
  }
});

router.delete("/charging-stations/:stationId", async (req, res) => {
  const stationId = req.params.stationId;
  try {
    const pool = await poolPromise;
    await pool
      .request()
      .query(
        "ALTER TABLE Charging_sessions NOCHECK CONSTRAINT FK__Charging___stati__6FE99F9F"
      );

    await pool
      .request()
      .query(`DELETE FROM Charging_stations WHERE station_id = ${stationId}`);
    await pool
      .request()
      .query(
        "ALTER TABLE Charging_sessions CHECK CONSTRAINT FK__Charging___stati__6FE99F9F        "
      );

    res.status(200).json({ message: "Station deleted successfully" });
  } catch (error) {
    console.error("Error deleting station:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/charging-stations/:stationId", async (req, res) => {
  const stationId = req.params.stationId;
  const {
    Station_name,
    Location,
    charging_Address,
    charging_type,
    power_rating,
    Pricing,
  } = req.body;

  try {
    const pool = await poolPromise;
    const request = pool.request();

    request.input("stationId", sql.Int, stationId);
    request.input("Station_name", sql.VarChar, Station_name);
    request.input("Location", sql.VarChar, Location);
    request.input("charging_Address", sql.VarChar, charging_Address);
    request.input("charging_type", sql.VarChar, charging_type);
    request.input("power_rating", sql.Float, power_rating);
    request.input("Pricing", sql.Int, Pricing);

    const result = await request.query(`
          UPDATE Charging_stations 
          SET Station_name = @Station_name, Location = @Location, 
              Address = @charging_Address, charging_type = @charging_type, 
              power_rating = @power_rating, Pricing = @Pricing
          WHERE station_id = @stationId
      `);

    res.status(200).json({ message: "Station updated successfully" });
  } catch (error) {
    console.error("Error updating station:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
