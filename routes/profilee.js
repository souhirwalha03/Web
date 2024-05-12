const express = require("express");
const router = express.Router();
const { sql, poolPromise } = require("../config/connect");
const bcrypt = require("bcrypt");
const saltRounds = 10;
router.get("/profilee", async (req, res) => {
  try {
    console.log("Route reached:", req.url);
    const pool = await poolPromise;
    const userId = req.session.userId;
    console.log("User ID:", userId);
    const result1 = await pool.request().input("userId", sql.Int, userId)
      .query(`SELECT role
            FROM Users
            WHERE user_id = @userId`);
    const role = result1.recordset[0].role;

    if (role == "client") {
      const result = await pool.request().input("userId", sql.Int, userId)
        .query(`SELECT Users.role,Users.password,  Users.username, Users.email, Users.phone_number, Clients.RFID_tag_ID, Clients.account_balance, Users.address
            FROM Clients
            JOIN Users ON Clients.client_id = Users.user_id
            WHERE Clients.client_id = @userId`);

      console.log("SQL Query Result:", result);

      if (result.recordset.length === 0) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.json(result.recordset[0]);
    } else if (role === "admin" || role === "super_admin") {
      const result = await pool.request().input("userId", sql.Int, userId)
        .query(`SELECT Users.role ,Users.password, Users.username, Users.email, Users.phone_number, Users.address
                FROM Users
                WHERE user_id = @userId`);

      console.log("SQL Query Result:", result);

      if (result.recordset.length === 0) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.json(result.recordset[0]);
    }
  } catch (error) {
    console.error("Failed to fetch user profile:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

router.post("/edit_profile", async (req, res) => {
  console.log("req.body", req.body);
  const { Name, Email, Address, Phone, password } = req.body;

  try {
    const pool = await poolPromise;
    const request = pool.request();
    const userId = req.session.userId;

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    request.input("Name", sql.VarChar, Name);
    request.input("Email", sql.VarChar, Email);

    request.input("Address", sql.VarChar, Address);

    request.input("Phone", sql.Int, Phone);

    request.input("password", sql.VarChar, hashedPassword);

    const result = await request.input("userId", sql.Int, userId).query(`
            UPDATE Users
            SET username = @Name,
                email = @Email,
                address = @Address,
                phone_number = @Phone,
                password = @password
            WHERE user_id= @userId;
            
      `);

    return res.redirect("/profilee.html?message=Profile+updated+successfully");
  } catch (error) {
    console.error("Error inserting station:", error);
    res.sendStatus(500);
  }
});

router.post("/recharge", async (req, res) => {
  console.log("req.body", req.body);
  console.log("req.body", req.body.balance);

  const balance = req.body.balance;

  try {
    const pool = await poolPromise;
    const request = pool.request();
    const userId = req.session.userId;

    request.input("balance", sql.Float, balance);

    const result1 = await request.input("userId", sql.Int, userId).query(`
        UPDATE Clients
            SET account_balance = @balance
            WHERE client_id= @userId;
      `);

    return res.redirect(
      "client/recharge.html?message=Profile+updated+successfully"
    );
  } catch (error) {
    console.error("Error inserting station:", error);
    res.sendStatus(500);
  }
});

router.post("/recharge/:clientId", async (req, res) => {
  console.log("req.body", req.body);
  console.log("req.body", req.body.balance);
  const clientId = req.params.clientId;
  console.log("clientId", req.params.clientId);

  const balance = req.body.balance;

  try {
    const pool = await poolPromise;
    const request = pool.request();

    request.input("balance", sql.Float, balance);

    const result1 = await request.input("clientId", sql.Int, clientId).query(`
        UPDATE Clients
            SET account_balance = @balance
            WHERE client_id= @clientId;
      `);

    return res.sendStatus(200);
  } catch (error) {
    console.error("Error inserting station:", error);
    res.sendStatus(500);
  }
});

router.put("/profilee/:user_id", async (req, res) => {
  const user_id = req.params.user_id;
  const { Name, Email, Address, Phone } = req.body;

  try {
    const pool = await poolPromise;
    const request = pool.request();

    request.input("user_id", sql.Int, user_id);
    request.input("Name", sql.VarChar, Name);
    request.input("Email", sql.VarChar, Email);
    request.input("Address", sql.VarChar, Address);
    request.input("Phone", sql.VarChar, Phone);

    const result = await request.query(`
            UPDATE Users
            SET username = @Name, email = @Email, 
                address = @Address, phone_number = @Phone
            WHERE user_id = @user_id
        `);

    res.status(200).json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Error updating Profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/assign_rfid", async (req, res) => {
  console.log("req.body", req.body);

  const { RFID_tag_ID, clientId } = req.body;
  try {
    const pool = await poolPromise;
    const request = pool.request();
    const userId = req.session.userId;

    request.input("RFID_tag_ID", sql.BigInt, RFID_tag_ID);
    request.input("clientId", sql.Int, clientId);
    const result = await request.query(`
        UPDATE Clients
        SET RFID_tag_ID = @RFID_tag_ID
        WHERE client_id = @clientId;
    `);

    console.log(`RFID tag ${RFID_tag_ID} assigned to client ${clientId}`);
    res.redirect("admin/clients.html?message=RFID+added+successfully");
  } catch (error) {
    console.error("Error updating RFID tag:", error);
    return res.status(500).send("Error updating RFID tag");
  }
});

module.exports = router;
