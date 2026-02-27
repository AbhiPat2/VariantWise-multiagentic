console.log("[1/8] Loading express...");
const express = require("express");
console.log("[2/8] Loading session...");
const session = require("express-session");
console.log("[3/8] Loading cors...");
const cors = require("cors");
console.log("[4/8] Loading passport...");
const passport = require("passport");
console.log("[5/8] Creating express app...");
const app = express();
console.log("[6/8] Loading environment...");
require("./env");
console.log("[7/8] Loading database config...");
require("./db/config");
console.log("[8/8] Loading auth routes...");
const authRoutes = require("./routes/auth");
console.log("[DONE] All modules loaded successfully");

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const SESSION_SECRET = process.env.Secret_Key || "fallback-secret";
const IS_PROD = process.env.NODE_ENV === "production";

// Trust proxy needed for secure cookies to work behind a proxy
if (IS_PROD) {
  app.set("trust proxy", 1);
}

// --- CORS Setup (allow frontend to send cookies) ---
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

// --- JSON Parser ---
app.use(express.json());

// --- Session Setup ---
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: IS_PROD ? "none" : "lax",
    },
  })
);

// --- Passport Initialization ---
app.use(passport.initialize());
app.use(passport.session());

// --- Route ---
app.use("/api", authRoutes);

// --- Server Start ---
const PORT = process.env.PORT || 3001;
app.listen(PORT, "127.0.0.1", () => {
  console.log(`Server running on http://127.0.0.1:${PORT}`);
});
