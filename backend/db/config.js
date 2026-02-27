require("../env");
const mysql = require("mysql2");

// Use a pool so dropped connections (common with remote MySQL) recover automatically.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 4000),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// Smoke test connectivity on boot (non-fatal).
pool.getConnection((err, conn) => {
  if (err) {
    console.error("DB Pool Connection Error:", err);
    return;
  }
  console.log("Connected to MySQL (pool)");
  conn.release();
});

module.exports = pool;
