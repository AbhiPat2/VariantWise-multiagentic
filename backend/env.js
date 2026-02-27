const fs = require("fs");
const path = require("path");

console.log("[env] Starting environment loading...");

const candidatePaths = [
  path.join(__dirname, ".env"),
  path.join(__dirname, "_env"),
];

const envPath = candidatePaths.find((p) => fs.existsSync(p));

console.log("[env] Found env file:", envPath);

// Manual env loading as fallback if dotenv hangs
if (envPath) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          // Remove quotes if present
          const cleanValue = value.replace(/^["']|["']$/g, '');
          process.env[key.trim()] = cleanValue;
        }
      }
    });
    console.log(`[env] Loaded environment from ${path.basename(envPath)} (manual parsing)`);
  } catch (error) {
    console.error("[env] Error loading env file:", error.message);
  }
} else {
  console.warn(
    "[env] No .env or _env file found in backend/. Falling back to process env."
  );
}

module.exports = envPath;
