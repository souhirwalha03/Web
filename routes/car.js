const express = require("express");
const router = express.Router();
const { sql, poolPromise } = require("../config/connect");

router.get("/cars", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM Car");
    res.json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/client_cars", async (req, res) => {
  try {
    const userId = req.session.userId;
    console.log("userId", userId);

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query("SELECT * FROM Car WHERE client_id = @userId");
    res.json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/add_car", async (req, res) => {
  console.log("req.body", req.body);
  const pool = await poolPromise;

  const request = pool.request();

  // Extract data from the request body
  const { Brand, Model, Battery } = req.body;
  const userId = req.session.userId;
  console.log("userId", userId);

  request.input("Brand", sql.VarChar, Brand);
  request.input("Model", sql.VarChar, Model);
  request.input("Battery", sql.VarChar, Battery);
  request.input("userId", sql.Int, userId);

  const result = await request.query(
    "INSERT INTO Car (Brand, Model, Battery, client_id) VALUES (@Brand, @Model, @Battery, @userId)"
  );

  console.log("Car added successfully");
  res.redirect("/profilee.html"); // Redirect to the profile page
});

router.delete("/car/:Model", async (req, res) => {
  const Model = req.params.Model;
  try {
    console.log("model", Model);

    const pool = await poolPromise;

    const request = pool.request();
    const userId = req.session.userId;
    console.log("userId", userId);

    request.input("Model", sql.VarChar, Model);
    request.input("userId", sql.Int, userId);

    const result = await request.query(
      `DELETE FROM Car WHERE Model = @Model AND client_id = @userId`
    );

    res.status(200).json({ message: "Car deleted successfully" });
  } catch (error) {
    console.error("Error deleting car:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
