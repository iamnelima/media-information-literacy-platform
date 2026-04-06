
const RULES = [
    { id: "rule-length",  regex: /.{12,}/,        label: "At least 12 characters" },
    { id: "rule-upper",   regex: /[A-Z]/,          label: "One uppercase letter"   },
    { id: "rule-lower",   regex: /[a-z]/,          label: "One lowercase letter"   },
    { id: "rule-number",  regex: /[0-9]/,          label: "One number"             },
    { id: "rule-special", regex: /[^A-Za-z0-9]/,  label: "One special character"  },
  ];
  
  // ─── Email Validation (client-side) ──────────────────────────────────────────
  
  const DISPOSABLE_DOMAINS = new Set([
    "mailinator.com", "tempmail.com", "guerrillamail.com", "10minutemail.com",
    "yopmail.com", "trashmail.com", "fakeinbox.com", "maildrop.cc",
    "dispostable.com", "spamgourmet.com", "sharklasers.com", "spam4.me",
    "trashmail.at", "trashmail.io", "trashmail.me", "discard.email",
    "mailnull.com", "tempr.email", "getnada.com", "bouncr.com",
    "filzmail.com", "mailnesia.com", "noblepioneer.com",
  ]);
  
  const EMAIL_REGEX =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  
  function validateEmailClient(email) {
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmed)) return "Please enter a valid email address.";
    const domain = trimmed.split("@")[1];
    if (DISPOSABLE_DOMAINS.has(domain))
      return "Disposable email addresses are not allowed.";
    return null; // null = valid
  }
  
  // ─── Strength Meter ───────────────────────────────────────────────────────────
  
  function getStrength(password) {
    const passed = RULES.filter((r) => r.regex.test(password)).length;
    if (passed <= 1) return { score: 1, label: "Very Weak",  color: "#ef4444" };
    if (passed === 2) return { score: 2, label: "Weak",       color: "#f97316" };
    if (passed === 3) return { score: 3, label: "Fair",       color: "#eab308" };
    if (passed === 4) return { score: 4, label: "Strong",     color: "#22c55e" };
    return              { score: 5, label: "Very Strong", color: "#16a34a" };
  }
  
  function updateStrengthUI(password) {
    const bar   = document.getElementById("strength-bar");
    const label = document.getElementById("strength-label");
    if (!bar || !label) return;
  
    if (!password) {
      bar.style.width = "0%";
      bar.style.background = "transparent";
      label.textContent = "";
      return;
    }
  
    const { score, label: text, color } = getStrength(password);
    bar.style.width      = `${(score / 5) * 100}%`;
    bar.style.background = color;
    bar.style.transition = "width 0.3s ease, background 0.3s ease";
    label.textContent    = text;
    label.style.color    = color;
  
    // Update individual rule indicators
    RULES.forEach(({ id, regex }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const passed = regex.test(password);
      el.classList.toggle("rule-pass", passed);
      el.classList.toggle("rule-fail", !passed);
      // Update icon prefix
      const icon = el.querySelector(".rule-icon");
      if (icon) icon.textContent = passed ? "✅" : "❌";
    });
  }
  
  // ─── Wire Up Signup Form ──────────────────────────────────────────────────────
  
  document.addEventListener("DOMContentLoaded", () => {
  
    // Live strength meter
    const passwordInput = document.getElementById("password");
    if (passwordInput) {
      passwordInput.addEventListener("input", () => {
        updateStrengthUI(passwordInput.value);
      });
    }
  
    // Email blur validation
    const emailInput = document.getElementById("email");
    const emailError = document.getElementById("email-error");
    if (emailInput && emailError) {
      emailInput.addEventListener("blur", () => {
        const err = validateEmailClient(emailInput.value);
        emailError.textContent = err || "";
        emailInput.classList.toggle("input-error", !!err);
      });
    }
  
    // Confirm password match indicator
    const confirmInput = document.getElementById("confirmPassword");
    const matchMsg     = document.getElementById("password-match");
    if (confirmInput && matchMsg && passwordInput) {
      confirmInput.addEventListener("input", () => {
        const match = confirmInput.value === passwordInput.value;
        matchMsg.textContent = confirmInput.value
          ? match ? "✅ Passwords match" : "❌ Passwords do not match"
          : "";
        matchMsg.style.color = match ? "#22c55e" : "#ef4444";
      });
    }
  
    // ── Signup form submit ──────────────────────────────────────────────────────
    const signupForm = document.getElementById("signup-form");
    if (signupForm) {
      signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
  
        const email           = emailInput?.value || "";
        const password        = passwordInput?.value || "";
        const confirmPassword = confirmInput?.value || "";
        const msgEl           = document.getElementById("form-message");
  
        // Client-side email check
        const emailErr = validateEmailClient(email);
        if (emailErr) {
          showMessage(msgEl, emailErr, "red");
          return;
        }
  
        // Client-side password check
        const failedRules = RULES.filter((r) => !r.regex.test(password));
        if (failedRules.length > 0) {
          showMessage(
            msgEl,
            "Password requirements not met:\n• " + failedRules.map((r) => r.label).join("\n• "),
            "red"
          );
          return;
        }
  
        if (password !== confirmPassword) {
          showMessage(msgEl, "Passwords do not match.", "red");
          return;
        }
  
        // Submit to server
        try {
          const res  = await fetch("/signin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, confirmPassword }),
          });
          const data = await res.json();
          showMessage(msgEl, data.message, data.color);
          if (res.ok) signupForm.reset();
        } catch {
          showMessage(msgEl, "Network error. Please try again.", "red");
        }
      });
    }
  
    // ── Login form submit ───────────────────────────────────────────────────────
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
  
        const email    = loginForm.querySelector("#login-email")?.value || "";
        const password = loginForm.querySelector("#login-password")?.value || "";
        const msgEl    = document.getElementById("login-message");
  
        const emailErr = validateEmailClient(email);
        if (emailErr) {
          showMessage(msgEl, emailErr, "red");
          return;
        }
  
        try {
          const res  = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const data = await res.json();
          showMessage(msgEl, data.message, data.color);
          if (res.ok && data.user) {
            setTimeout(() => (window.location.href = "/home"), 1000);
          }
        } catch {
          showMessage(msgEl, "Network error. Please try again.", "red");
        }
      });
    }
  });
  
  // ─── Helper ───────────────────────────────────────────────────────────────────
  
  function showMessage(el, message, color) {
    if (!el) return;
    const colorMap = {
      red:   "#ef4444",
      green: "#22c55e",
      blue:  "#3b82f6",
      orange:"#f97316",
    };
    el.style.color       = colorMap[color] || color;
    el.style.whiteSpace  = "pre-line"; // so \n renders as newline
    el.textContent       = message;
  }
  