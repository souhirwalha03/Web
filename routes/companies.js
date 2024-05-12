const express = require("express");
const router = express.Router();
const { sql, poolPromise } = require("../config/connect");
const bcrypt = require("bcrypt");
const saltRounds = 10;

router.post("/add-rfid", async (req, res) => {
  console.log("req.body", req.body);
  try {
    const { admin_id, ...RFIDs } = req.body;

    const pool = await poolPromise;
    const request = pool.request().input("admin_id", sql.Int, admin_id);

    const notAddedRFIDs = [];

    for (const key in RFIDs) {
      if (Object.hasOwnProperty.call(RFIDs, key)) {
        const RFID_tag_IDs = Array.isArray(RFIDs[key])
          ? RFIDs[key]
          : [RFIDs[key]];
        for (const RFID_tag_ID of RFID_tag_IDs) {
          let result = await pool
            .request()
            .input(`RFID_tag_ID_${key}`, sql.BigInt, RFID_tag_ID)
            .query(
              `SELECT RFID_tag_ID FROM Company_RFIDs WHERE RFID_tag_ID = @RFID_tag_ID_${key}`
            );

          if (result.recordset.length === 0) {
            await request.input(`RFID_tag_ID_${key}`, sql.BigInt, RFID_tag_ID)
              .query(`INSERT INTO Company_RFIDs (RFID_tag_ID, admin_id)
                                    VALUES (@RFID_tag_ID_${key}, @admin_id);`);

            console.log("RFID tag inserted successfully");
          } else {
            notAddedRFIDs.push(RFID_tag_ID);
          }
        }
      }
    }

    console.log("notAddedRFIDs", notAddedRFIDs);
    if (notAddedRFIDs.length > 0) {
      console.log("RFID tags not added:", notAddedRFIDs);
      return res.redirect(
        `/admin/company.html?notAddedRFIDs=${JSON.stringify(notAddedRFIDs)}`
      );
    }

    console.log("rfid added successfully");
    return res.redirect("/admin/company.html");
  } catch (error) {
    console.error("Error inserting RFID tags:", error);
    res.redirect("/admin/company.html?The+RFID+tag+already+exists");
  }
});

router.post("/add-admin-company", async (req, res) => {
  const { Name, Email, password, Address, Phone, role, Company, ...RFIDs } =
    req.body;

  try {
    const pool = await poolPromise;
    const request = pool.request();

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    request.input("Name", sql.VarChar, Name);
    request.input("Email", sql.VarChar, Email);
    request.input("password", sql.VarChar, hashedPassword);
    request.input("Address", sql.VarChar, Address);
    request.input("Phone", sql.Int, Phone);
    request.input("role", sql.VarChar, role);
    request.input("Company", sql.VarChar, Company);

    // Check if station with the same name already exists
    const existingStation = await request.query(
      `
        SELECT 1 FROM Users WHERE username = @Name
        `,
      { Name }
    );

    if (existingStation.recordset.length > 0) {
      return res.redirect("/admin/company.html?msg=company+already+exists");
    }
    // Check if the user with the same email already exists
    const existingUser = await request.query(
      `
        SELECT 1 FROM Users WHERE email = @Email
        `,
      { Email }
    );

    if (existingUser.recordset.length > 0) {
      const result = await request.query(`
        UPDATE Users SET username = @Name, password = @password, address = @Address, phone_number = @Phone, role = @role
        WHERE email = @Email
        `);

      return res.status(200).json({ message: "admin updated successfully" });
    }
    const result = await request.query(`
            INSERT INTO Users (username, email, password, address, phone_number, role)
            VALUES (@Name, @Email, @password, @Address, @Phone, @role);
            SELECT SCOPE_IDENTITY() AS user_id;
        `);
    const userId = result.recordset[0].user_id;

    request.input("user_id", sql.Int, userId);

    await request.query(`
                INSERT INTO Admin (admin_id)
                SELECT @user_id
                WHERE EXISTS (
                    SELECT 1
                    FROM users
                    WHERE user_id = @user_id
                    AND role = 'admin'
                );`);

    await request.query(`
                    UPDATE Admin
                    SET Company_name = @Company
                    WHERE admin_id = @user_id;
            `);

    // Insert the RFID tags into the Company_RFIDs table
    for (const key in RFIDs) {
      if (Object.hasOwnProperty.call(RFIDs, key)) {
        const RFID_tag_ID = RFIDs[key];
        await request
          .input(`RFID_tag_ID_${key}`, sql.BigInt, RFID_tag_ID)
          .query(
            `INSERT INTO Company_RFIDs (RFID_tag_ID, admin_id) VALUES (@RFID_tag_ID_${key}, @user_id);`
          );
      }
    }

    console.log("ADMIN added successfully");
    return res.redirect("/admin/company.html");
  } catch (error) {
    if (error.number === 2627) {
      return res.redirect("/admin/company.html?The+RFID+tag+already+exists");
    }
    console.error("Error inserting station:", error);
    res.redirect("/admin/company.html?error");
    res.sendStatus(500); 
  }
});

router.delete("/rfid/:rfidTagID", async (req, res) => {
  const { admin_id, rfidTagID } = req.params;
  const pool = await poolPromise;
  pool
    .query(`DELETE FROM Company_RFIDs WHERE RFID_tag_ID =  ${rfidTagID}`)

    .then(() => {
      res.status(200).send("RFID tag deleted successfully");
    })
    .catch((err) => {
      console.error("Error deleting RFID tag:", err);
      res.status(500).send("Error deleting RFID tag");
    });
});

router.get("/getRFIDTags", async (req, res) => {
  try {
    const pool = await poolPromise;
    console.log("User ID:", req.session.userId);

    const result = await pool
      .request()
      .input("userId", sql.Int, req.session.userId)
      .query(
        "SELECT cr.RFID_tag_ID FROM Company_RFIDs cr LEFT JOIN Clients c ON cr.RFID_tag_ID = c.RFID_tag_ID WHERE c.RFID_tag_ID IS NULL AND cr.admin_id = @userId; "
      );

    res.json(result.recordset);
  } catch (err) {
    console.error("Error fetching RFID tags:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/company_clients", async (req, res) => {
  try {
    const pool = await poolPromise;
    console.log("User ID:", req.session.userId);

    const result = await pool
      .request()
      .input("userId", sql.Int, req.session.userId).query(`
        SELECT c.client_id, u.username, u.email, u.phone_number, u.address, c.RFID_tag_ID, c.account_balance
        FROM Users u
        JOIN Clients c ON u.user_id = c.client_id
        WHERE c.client_id IN (
            SELECT client_id
            FROM Clients c
            WHERE c.RFID_tag_ID IN (
                SELECT cr.RFID_tag_ID
                FROM Company_RFIDs cr
                WHERE cr.admin_id = @userId
            )
        );
        
        `);
    res.json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
