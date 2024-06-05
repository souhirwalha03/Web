const express = require("express");
const router = express.Router();
const { sql, poolPromise } = require("../config/connect");
const bcrypt = require("bcrypt");
const saltRounds = 10;

router.get("/clients", async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
        SELECT c.client_id, u.username, u.email, u.phone_number, u.address, c.RFID_tag_ID, c.account_balance
        FROM Users u
        JOIN Clients c ON u.user_id = c.client_id
        WHERE u.role = 'client';
    `);

    for (let i = 0; i < result.recordset.length; i++) {
      const client = result.recordset[i];

      const result2 = await pool
        .request()
        .input("rfid", sql.BigInt, client.RFID_tag_ID).query(`
            SELECT a.Company_name
            FROM RFIDs c
            JOIN Admin a ON c.admin_id = a.admin_id
            WHERE c.RFID_tag_ID = @rfid;
        `);

      if (result2.recordset.length > 0) {
        client.Company_name = result2.recordset[0].Company_name;
      } else {
        client.Company_name = "N/A";
      }
    }
    console.log("result.recordset", result.recordset);
    res.json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/clients/:clientid", async (req, res) => {
  const clientid = req.params.clientid;
  try {
    const pool = await poolPromise;

    await pool
      .request()
      .query(`DELETE FROM Clients WHERE client_id = ${clientid}`);

    await pool.request().query(`DELETE FROM Users WHERE user_id = ${clientid}`);
    res.status(200).json({ message: "Station deleted successfully" });
  } catch (error) {
    console.error("Error deleting station:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/admins", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
            SELECT user_id, username, email, phone_number, address
            FROM Users 
            WHERE role = 'super_admin'
        `);
    res.json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/company_admins", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
            SELECT u.user_id, u.username, u.email, u.phone_number, u.address, a.Company_name
            FROM Users u
            JOIN Admin a ON u.user_id = a.admin_id
            WHERE u.role = 'admin'
        `);

    res.json(result.recordset);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
router.delete("/admin/:adminId", async (req, res) => {
  const adminId = req.params.adminId;
  try {
    const pool = await poolPromise;

    const request = pool.request().input("user_id", sql.Int, adminId);

    const result = await request.query(
      "SELECT role FROM Users WHERE user_id = @user_id"
    );

    const role = result.recordset[0]?.role;

    if (!role) {
      return res.status(404).json({ message: "Admin not found" });
    }

    if (role === "super_admin" || role === "admin") {
      try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT c.client_id
            FROM Users u
            JOIN Clients c ON u.user_id = c.client_id
            JOIN RFIDs cr ON cr.RFID_tag_ID = c.RFID_tag_ID
            JOIN Admin a ON cr.admin_id = a.admin_id
            WHERE u.role = 'client';
          `);
        console.log("result: ", result);

        const clientIds = result.recordset.map((record) => record.client_id);
        console.log("clientIds: ", clientIds);
        // Delete the clients based on the client IDs
        await Promise.all(
          clientIds.map(async (clientId) => {
            await pool
              .request()
              .input("clientId", sql.Int, clientId)
              .query("DELETE FROM Clients WHERE client_id = @clientId");
            await pool
              .request()
              .input("clientId", sql.Int, clientId)
              .query(`DELETE FROM Users WHERE user_id =  @clientId`);
          })
        );

        // Delete the admin
        await pool
          .request()
          .input("user_id", sql.Int, adminId)
          .query("DELETE FROM Admin WHERE admin_id = @user_id");

        // Delete the user
        await pool
          .request()
          .input("user_id", sql.Int, adminId)
          .query("DELETE FROM Users WHERE user_id = @user_id");

        return res.status(200).json({
          message: "Admin and associated clients deleted successfully",
        });
      } catch (error) {
        console.error("Error deleting admin and associated clients:", error);
        return res.status(500).json({
          message:
            "An error occurred while deleting admin and associated clients",
        });
      }
    } else {
      return res.status(403).json({ message: "Unauthorized" });
    }
  } catch (error) {
    console.error("Error deleting admin:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/rfid/:admin_id", async (req, res) => {
  const admin_id = req.params.admin_id;

  try {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("user_id", sql.Int, admin_id)
      .query("SELECT RFID_tag_ID FROM RFIDs WHERE admin_id=@user_id");

    const RFID_tag_IDs = result.recordset.map((record) => record.RFID_tag_ID);
    console.log("RFID_tag_IDs", RFID_tag_IDs);
    res.json({ RFID_tag_IDs });
  } catch (err) {
    console.error("Error fetching RFID_tag_IDs:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/add-admin", async (req, res) => {
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

    const existingStation = await request.query(
      `
        SELECT 1 FROM Users WHERE username = @Name
        `,
      { Name }
    );
    console.log("role", role);
    if (existingStation.recordset.length > 0) {
      if (role === "super_admin") {
        return res.redirect("/admin/admin.html?msg=admin+already+exists");
      } else {
        return res.redirect("/admin/company.html?msg=company+already+exists");
      }
    }
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

    if (req.body.Company) {
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

      for (const key in RFIDs) {
        if (Object.hasOwnProperty.call(RFIDs, key)) {
          const RFID_tag_ID = RFIDs[key];
          await request
            .input(`RFID_tag_ID_${key}`, sql.BigInt, RFID_tag_ID)
            .query(
              `INSERT INTO RFIDs (RFID_tag_ID, admin_id) VALUES (@RFID_tag_ID_${key}, @user_id);`
            );
        }
      }
    }

    console.log("ADMIN added successfully");
    if (role === "super_admin") {
      return res.redirect("/admin/admin.html");
    } else {
      return res.redirect("/admin/company.html");
    }
  } catch (error) {
    if (error.number === 2627) {
      return res.redirect("/admin/company.html?The+RFID+tag+already+exists");
    }
    console.error("Error inserting station:", error);
    res.redirect("/admin/company.html?error");
    res.sendStatus(500);
  }
});

module.exports = router;
