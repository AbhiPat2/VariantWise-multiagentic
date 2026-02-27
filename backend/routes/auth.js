const express = require("express");
const router = express.Router();
const bcrypt = require("../utils/password");
const crypto = require("crypto");
const passport = require("passport");
require("../env");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/user");
const autho = require("../middlewares/autho");

// In-memory password reset tokens (dev-friendly).
// NOTE: This will reset on server restart. For production, store in DB + send email.
const resetTokens = new Map(); // token -> { email, expiresAt }
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

// --- Passport Google Strategy Configuration ---
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

console.log("Google Auth Config:", {
  clientIdExists: !!googleClientId,
  clientSecretExists: !!googleClientSecret,
  callbackUrl: process.env.GOOGLE_CALLBACK_URL
});

if (googleClientId && googleClientSecret && googleClientId.trim() !== "") {
  try {
    passport.use(
      new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          let user = await User.getUserByEmail(profile.emails[0].value);

          if (user) {
            return done(null, user);
          } else {
            // Create new user - passing null for password
            const newUserInfo = await User.createUser(
              profile.name.givenName || "GoogleUser",
              profile.name.familyName || "",
              profile.emails[0].value,
              null // Pass null for password for Google sign-up
            );
            // Fetch the newly created user to get their full details including ID
            user = await User.getUserByEmail(profile.emails[0].value);
            if (!user) {
              // Handle case where user creation seemed successful but fetch failed
              return done(
                new Error("Failed to retrieve newly created user."),
                null
              );
            }
            return done(null, user);
          }
        } catch (error) {
          console.error("Error in Google Strategy:", error); // Log the error
          return done(error, null);
        }
      }
    )
  );
  } catch (err) {
    console.error("Failed to initialize Google Strategy:", err.message);
  }
} else {
  console.log("Google Client ID/Secret not found or invalid. Google Auth disabled.");
}

// --- Passport Session Serialization/Deserialization ---
passport.serializeUser((user, done) => {
  // Ensure user object has an 'id' property after creation/retrieval
  if (!user || typeof user.id === "undefined") {
    return done(
      new Error("User object or user ID is missing for serialization."),
      null
    );
  }
  done(null, user.id); // Store user ID in session
});

passport.deserializeUser(async (id, done) => {
  try {
    // Fetch user from DB using ID stored in session
    const user = await User.getUserById(id);
    if (!user) {
      return done(new Error("User not found during deserialization."), null);
    }
    done(null, user); // Pass the full user object
  } catch (error) {
    console.error("Error in deserializeUser:", error);
    done(error, null);
  }
});

router.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

// --- Google OAuth Routes ---
router.get(
  "/auth/google/callback",
  (req, res, next) => {
    // Custom callback so DB/strategy errors don't render an Express stack trace page.
    passport.authenticate("google", async (err, user) => {
      const frontend = process.env.FRONTEND_URL || "http://localhost:3000";

      if (err) {
        console.error("Google auth error:", err);
        return res.redirect(`${frontend}/signin?error=google_auth_failed`);
      }

      if (!user) {
        return res.redirect(`${frontend}/signin?error=google_auth_failed`);
      }

      try {
        // Ensure the user exists in DB.
        let dbUser = await User.getUserByEmail(user.email);
        if (!dbUser) {
          await User.createUser(
            user.first_name || "GoogleUser",
            user.last_name || "",
            user.email,
            null
          );
          dbUser = await User.getUserByEmail(user.email);
        }

        // Set session for the frontend to read via /api/me
        req.session.user = {
          id: dbUser.id,
          email: dbUser.email,
          first_name: dbUser.first_name,
        };

        req.session.save(() => res.redirect(`${frontend}/`));
      } catch (e) {
        console.error("Google callback post-auth error:", e);
        return res.redirect(`${frontend}/signin?error=server_error`);
      }
    })(req, res, next);
  }
);

router.post("/register", async (req, res) => {
  try {
    const { first_name, last_name, email, password } = req.body;
    await User.createUser(first_name, last_name, email, password);
    res.json({ success: true, message: "User registered" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ success: false, message: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.getUserByEmail(email);
    if (!user)
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });

    req.session.user = {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
    };

    req.session.save(() => {
      // Tell browser to save cookie now
      res.cookie("connect.sid", req.sessionID, {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        secure: process.env.NODE_ENV === "production",
      });

      res.json({
        success: true,
        message: "Logged in",
        user: { first_name: user.first_name },
      });
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Login failed" });
  }
});

router.post("/logout", autho, (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: "Logged out" });
  });
});

router.post("/request-password-reset", async (req, res) => {
  try {
    const { email } = req.body || {};
    const normalizedEmail = String(email || "").trim().toLowerCase();

    // Always return success-ish responses to avoid user enumeration.
    const responseBase = {
      success: true,
      message: "If that email exists, a reset link has been generated.",
    };

    if (!normalizedEmail) return res.json(responseBase);

    const user = await User.getUserByEmail(normalizedEmail);
    if (!user) return res.json(responseBase);

    const token = crypto.randomBytes(32).toString("hex");
    resetTokens.set(token, {
      email: normalizedEmail,
      expiresAt: Date.now() + RESET_TOKEN_TTL_MS,
    });

    // Dev-friendly: return a usable link. In production, you’d email this.
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    const isProd = process.env.NODE_ENV === "production";

    return res.json({
      ...responseBase,
      ...(isProd ? {} : { reset_token: token, reset_url: resetUrl }),
    });
  } catch (error) {
    console.error("Request password reset error:", error);
    res.status(500).json({ success: false, message: "Could not generate reset link." });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, new_password } = req.body || {};
    const t = String(token || "").trim();
    const newPassword = String(new_password || "");

    if (!t) return res.status(400).json({ success: false, message: "Missing reset token." });
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
    }

    const record = resetTokens.get(t);
    if (!record) return res.status(400).json({ success: false, message: "Invalid or expired reset link." });
    if (Date.now() > record.expiresAt) {
      resetTokens.delete(t);
      return res.status(400).json({ success: false, message: "Reset link expired. Please request a new one." });
    }

    await User.updatePasswordByEmail(record.email, newPassword);
    resetTokens.delete(t);

    return res.json({ success: true, message: "Password updated.", email: record.email });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ success: false, message: "Could not reset password." });
  }
});

router.get("/dashboard", autho, (req, res) => {
  res.json({ success: true, message: "Welcome to your dashboard" });
});

router.get("/me", autho, (req, res) => {
  res.json({ user: req.session.user });
});

module.exports = router;
