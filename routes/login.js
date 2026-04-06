const express = require("express");
require("dotenv").config();
const router = express.Router();
const connectionPromise = require("./connection.js");
const bcrypt = require("bcrypt");

// ─── Constants ────────────────────────────────────────────────────────────────

const SALT_ROUNDS = Math.max(parseInt(process.env.S_ROUNDS) || 12, 12); // enforce minimum of 12

// Disposable / throwaway email domains to block
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "tempmail.com", "guerrillamail.com", "10minutemail.com",
  "throwam.com", "yopmail.com", "trashmail.com", "fakeinbox.com",
  "maildrop.cc", "dispostable.com", "spamgourmet.com", "sharklasers.com",
  "guerrillamailblock.com", "grr.la", "guerrillamail.info", "spam4.me",
  "trashmail.at", "trashmail.io", "trashmail.me", "discard.email",
  "mailnull.com", "spamhereplease.com", "spamthisplease.com", "tempr.email",
  "tempinbox.com", "throwam.com", "mailnesia.com", "noblepioneer.com",
  "getnada.com", "bouncr.com", "filzmail.com", "spamgourmet.net",
]);

// Password rules
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_RULES = [
  { regex: /.{12,}/,          message: "At least 12 characters" },
  { regex: /[A-Z]/,           message: "At least one uppercase letter (A-Z)" },
  { regex: /[a-z]/,           message: "At least one lowercase letter (a-z)" },
  { regex: /[0-9]/,           message: "At least one number (0-9)" },
  { regex: /[^A-Za-z0-9]/,   message: "At least one special character (!@#$%^&*…)" },
];

// Common / weak passwords to outright reject
const COMMON_PASSWORDS = new Set([
  "password123!", "Password123!", "P@ssword123", "Welcome@123",
  "Admin@12345", "Qwerty@123", "Letmein@1!", "Monkey@123",
  "Dragon@1234", "Master@123", "Hello@World1", "Iloveyou@1",
]);

// ─── Validators ───────────────────────────────────────────────────────────────

/**
 * Validate email format and reject disposable domains.
 * Returns { valid: boolean, message?: string }
 */
function validateEmail(email) {
  if (!email || typeof email !== "string") {
    return { valid: false, message: "Email is required." };
  }

  const trimmed = email.trim().toLowerCase();

  // RFC-5322–ish format check (covers 99.9 % of real addresses)
  const EMAIL_REGEX =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, message: "Please enter a valid email address." };
  }

  // Block disposable / throwaway domains
  const domain = trimmed.split("@")[1];
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      valid: false,
      message: "Disposable or temporary email addresses are not allowed. Please use a real email.",
    };
  }

  return { valid: true };
}

/**
 * Validate password strength.
 * Returns { valid: boolean, failures: string[] }
 */
function validatePassword(password) {
  if (!password || typeof password !== "string") {
    return { valid: false, failures: ["Password is required."] };
  }

  // Block known common passwords early
  if (COMMON_PASSWORDS.has(password)) {
    return {
      valid: false,
      failures: ["This password is too common. Please choose a more unique password."],
    };
  }

  const failures = PASSWORD_RULES.filter((r) => !r.regex.test(password)).map(
    (r) => r.message
  );

  return { valid: failures.length === 0, failures };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Render sign-in / sign-up page
router.get("/signin", (req, res) => {
  res.render("signin");
});

// ── Sign Up ──────────────────────────────────────────────────────────────────
router.post("/signin", async (req, res) => {
  try {
    const { email, password, confirmPassword, username: clientUsername } = req.body;

    // 0. Validate username
    if (!clientUsername || typeof clientUsername !== "string" || clientUsername.trim().length < 3) {
      return res.status(400).json({ message: "Username must be at least 3 characters.", color: "red" });
    }
    const username = clientUsername.trim();

    // 1. Validate email
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      return res.status(400).json({ message: emailCheck.message, color: "red" });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 2. Check passwords match (do this before hashing)
    if (!password || !confirmPassword) {
      return res.status(400).json({ message: "Password fields cannot be empty.", color: "red" });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match. Please try again.", color: "red" });
    }

    // 3. Enforce password strength
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({
        message: "Password does not meet requirements:\n• " + passwordCheck.failures.join("\n• "),
        color: "red",
        failures: passwordCheck.failures, // useful for frontend to highlight specific rules
      });
    }

    // 4. Hash and store
    const hashedPassword = await bcrypt.hash(password.trim(), SALT_ROUNDS);
    const connection = await connectionPromise;

    await connection.query(
      "INSERT INTO users (email, user_password, username) VALUES (?, ?, ?)",
      [cleanEmail, hashedPassword, username]
    );

    return res.status(201).json({
      message: "Account created successfully! Please sign in with your details.",
      color: "green",
    });

  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        message: "An account with this email already exists. Please log in instead.",
        color: "blue",
      });
    }
    console.error("Registration error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again later.", color: "red" });
  }
});

// ── Log In ───────────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Basic presence checks
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required.", color: "red" });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Validate email format (catches typos at login too)
    const emailCheck = validateEmail(cleanEmail);
    if (!emailCheck.valid) {
      return res.status(400).json({ message: emailCheck.message, color: "red" });
    }

    const connection = await connectionPromise;

    // Single query — fetch email, password, and username together
    const [rows] = await connection.query(
      "SELECT email, user_password, username FROM users WHERE email = ?",
      [cleanEmail]
    );

    // Use a generic message to avoid user enumeration attacks
    if (rows.length === 0) {
      return res.status(401).json({
        message: "Invalid email or password. Please try again.",
        color: "red",
      });
    }

    const { user_password: hashedPassword } = rows[0];
    const isMatch = await bcrypt.compare(password, hashedPassword);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password. Please try again.",
        color: "red",
      });
    }

    // Create session
    req.session.user = { email: cleanEmail, username: rows[0].username };

    return res.status(200).json({
      message: "Access granted. Redirecting…",
      color: "green",
      user: req.session.user.email,
      username: req.session.user.username,
    });

  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again later.", color: "red" });
  }
});

module.exports = router;
