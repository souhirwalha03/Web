const express = require("express");
const session = require("express-session");
const router = express.Router();

const path = require("path");
router.use(express.static(path.join(__dirname, "..", "front-end")));
const { v4: uuidv4 } = require("uuid");
const { sql, poolPromise } = require("../config/connect");

const secretKey = uuidv4();

router.use(
  session({
    secret: secretKey,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false },
  })
);

const bcrypt = require("bcrypt");
const saltRounds = 10;

router.post("/login", async (req, res) => {
  try {
    console.log("Login request received:", req.body);

    const pool = await poolPromise;
    const { email, password } = req.body;

    const result = await pool
      .request()
      .input("email", sql.VarChar, email)
      .query("SELECT user_id, password, role FROM Users WHERE email = @email");

    if (result.recordset.length === 0) {
      return res.redirect("/login.html?error=Incorrect+email");
    }

    const user_id = result.recordset[0].user_id;
    const storedPassword = result.recordset[0].password;
    const role = result.recordset[0].role;
    console.log("storedPassword", storedPassword);
    console.log("password", password);

    const passwordMatch = await bcrypt.compare(password, storedPassword);

    if (!passwordMatch) {
      return res.redirect("/login.html?error=Incorrect+password");
    }

    req.session.userId = user_id;
    console.log("req.session.userId", req.session.userId);
    if (role === "client") {
      return res.redirect("/map.html");
    } else if (role === "super_admin") {
      return res.redirect("admin/chart.html");
    } else if (role === "admin") {
      return res.redirect("company_admin/add_user.html");
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/profile", (req, res) => {
  if (req.session.userId) {
    res.json({ userId: req.session.userId });
  } else {
    res.redirect("/login.html");
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ message: "Failed to destroy session" });
    } else {
      res.redirect(`/loggedout.html`);
    }
  });
});

module.exports = router;
