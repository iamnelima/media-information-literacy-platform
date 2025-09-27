const express = require("express");
const session = require("express-session");
require("dotenv").config();
const router = express.Router();
const connectionPromise = require("./connection.js");
const bcrypt = require("bcrypt");
const saltRounds = parseInt(process.env.S_ROUNDS);

// Rendering page
router.get("/signin", (req, res) => {
  res.render("signin");
});

//User signing up
router.post("/signin", (req, res) => {
  async function main() {
    var email = req.body.email;
    var password = req.body.password;
    var confirmPassword = req.body.confirmPassword;
    var username = email.split("@")[0];

    if (password != confirmPassword) {
      //check if passwords match
      return res.status(400).json({
        message: "Passwords do not match.\n Please Try again",
        color: "red",
      });
    }

    //hash password
    var hashedPassword = await bcrypt.hash(password.trim(), saltRounds);

    //Add data to database
    try {
      const connection = await connectionPromise;
      await connection.query(
        "insert into users(email, user_password, username)values(?, ?, ?)",
        [email, hashedPassword, username]
      );

      res.status(200).json({
        message:
          "Account created successfully. Please signin with your current details.",
        color: "green",
      });
    } catch (err) {
      if (err.code == "ER_DUP_ENTRY") {
        return res.status(400).json({
          message: "Account Exists, please proceed to login",
          color: "blue",
        });
      } else {
        console.error(
          "Error while accessing database for user registration: " +
            err.code +
            "\n" +
            err
        );
      }
    }
  }
  main();
});

//user logging in
router.post("/login", (req, res) => {
  async function main() {
    var email = req.body.email;
    var clientPassword;

    try {
      clientPassword = req.body.password;
      const connection = await connectionPromise;

      //Check if email exists in database
      var [dbUser] = await connection.query(
        "select email from users where email = ?",
        [email]
      );
      //if empty array is returned user doesnt exist
      if (dbUser.length == 0) {
        return res.json({
          message:
            "Sorry, account does not exist. Please sign up for an account",
          color: "red",
        });
      }

      // fetch from db and compare passwords
      var [dbPassword] = await connection.query(
        "select user_password from users where email = ?",
        [email]
      );

      var safePassword = dbPassword[0].user_password;
      var isMatch = await bcrypt.compare(clientPassword, safePassword);
      if (isMatch) {
        // Create a new session for the user
        req.session.user = {
          email,
        };

        return res.json({
          message: "Access granted. Redirecting...",
          color: "green",
          user: req.session.user.email,
        });
      } else {
        return res.status(400).json({
          message: "Access Denied.\n Incorrect password",
          color: "red",
        });
      }
    } catch (err) {
      console.error("Error occured while logging in: " + err.code + "\n" + err);
    }
  }
  main();
});

module.exports = router;
