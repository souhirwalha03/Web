const express = require("express");
const router = express.Router();
const { sql, poolPromise } = require("../config/connect");

router.get("/charging-sessions", async (req, res) => {
  try {
    const pool = await poolPromise;
    let result2 = await pool.request()
      .query`SELECT user_id, role FROM Users WHERE user_id = ${req.session.userId}`;
    role = result2.recordset[0].role;

    if (role === "client") {
      const result = await pool
        .request()
        .query(
          `SELECT * FROM Charging_sessions WHERE client_id = ${req.session.userId}`
        );

      return res.json(result.recordset);
    } else {
      const result1 = await pool
        .request()
        .query(`SELECT * FROM Charging_sessions`);

      return res.json(result1.recordset);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
module.exports = router;
