const express = require("express");
const router = express.Router();
const { sql, poolPromise } = require("../config/connect");

router.get("/cost", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query("SELECT Cost, Start_time FROM Charging_sessions");
    const data = result.recordset;
    res.send(data);
    console.log(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/energy", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query("SELECT energy_consumed, Start_time FROM Charging_sessions");
    const data = result.recordset;
    res.send(data);
    console.log(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/availability", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .query("SELECT availability FROM Charging_stations");
    const data = result.recordset;
    res.send(data);
    console.log(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/cost_client", async (req, res) => {
  const userId = req.session.userId;
  console.log("userId", userId);
  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(
        "SELECT Cost, Start_time FROM Charging_sessions WHERE client_id = @userId"
      );
    const data = result.recordset;
    console.log("data", data);

    res.send(data);
    console.log(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
