const express = require("express");
const router = express.Router();
const { sql, poolPromise } = require("../config/connect");
const nodemailer = require("nodemailer");

const path = require("path");
router.use(express.static(path.join(__dirname, "..", "front-end")));
const bcrypt = require("bcrypt");
const saltRounds = 10;

router.post("/register", async (req, res) => {
  try {
    console.log(req.body);
    const pool = await poolPromise;
    const { username, email, address, password, phone_number, RFID } = req.body;
    let role = "client";
    // Check if the client already exists
    const checkClientResult = await pool
      .request()
      .input("email", sql.VarChar, email)
      .query("SELECT * FROM Users WHERE email = @email");
    if (checkClientResult.recordset.length > 0) {
      if (req.body.RFID) {
        return res.redirect(
          "/company_admin/add_user.html?error=Client+already+exists"
        );
      } else {
        return res.redirect("/signup.html?error=Client+already+exists");
      }
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const userInsertResult = await pool
      .request()
      .input("username", sql.VarChar, username)
      .input("email", sql.VarChar, email)
      .input("address", sql.VarChar, address)
      .input("password", sql.VarChar, hashedPassword)
      .input("phone_number", sql.Int, phone_number)
      .input("role", sql.VarChar, role)
      .query(`INSERT INTO Users (username, email, address, password, phone_number, role) 
                    VALUES (@username, @email, @address, @password, @phone_number, @role);
                    SELECT SCOPE_IDENTITY() AS user_id;`);
    const userId = userInsertResult.recordset[0].user_id;

    const clientInsertResult = await pool
      .request()
      .input("user_id", sql.Int, userId).query(`INSERT INTO clients (client_id)
                SELECT @user_id
                WHERE EXISTS (
                    SELECT 1
                    FROM users
                    WHERE user_id = @user_id
                    AND role = 'client'
                );`);

    if (req.body.RFID) {
      const updateRFIDResult = await pool
        .request()
        .input("RFID", sql.VarChar, req.body.RFID)
        .input("user_id", sql.Int, userId).query(`UPDATE clients 
                            SET RFID_tag_ID = @RFID
                            WHERE client_id = @user_id`);
            // Send email to client
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: "stocklanamethyst@gmail.com", // Your Gmail address
              pass: "clglpsufkljysaff", // Your Gmail password
            },
          });

          const mailOptions = {
            from: "stocklanamethyst@gmail.com",
            to: email,
            subject: "Welcome to Horizop Energy!",
            html: `<p>Dear ${username},</p>
                  <p>Your account has been successfully created.</p>
                  <p>Your temporary password is: <strong>${password}</strong></p>
                  <p>Please login to your account and change your password immediately.</p>`,
          };

          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error(error);
            } else {
              console.log("Email sent: " + info.response);
            }
    });
      return res.redirect(
        "/company_admin/add_user.html?message=user+added+successfully"
      );
    } else {
      res.redirect("/success.html");
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
