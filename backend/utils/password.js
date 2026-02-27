const crypto = require("crypto");

// Lightweight, dependency-free password hashing for local dev.
// NOTE: Stored hashes are NOT bcrypt-compatible.
// Format: pbkdf2$<iterations>$<salt_hex>$<hash_hex>
const ITERATIONS = 120_000;
const KEYLEN = 64;
const DIGEST = "sha512";
const SALT_BYTES = 16;
const PREFIX = "pbkdf2";

function encodeHash(iterations, saltHex, hashHex) {
  return `${PREFIX}$${iterations}$${saltHex}$${hashHex}`;
}

function pbkdf2Async(password, salt, iterations) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, KEYLEN, DIGEST, (err, key) => {
      if (err) return reject(err);
      resolve(key);
    });
  });
}

function hash(password, _saltRounds, cb) {
  const run = async () => {
    const saltHex = crypto.randomBytes(SALT_BYTES).toString("hex");
    const key = await pbkdf2Async(password, saltHex, ITERATIONS);
    return encodeHash(ITERATIONS, saltHex, key.toString("hex"));
  };

  if (typeof cb === "function") {
    run()
      .then((val) => cb(null, val))
      .catch((err) => cb(err));
    return;
  }

  return run();
}

function compare(password, storedHash, cb) {
  const run = async () => {
    if (!storedHash || typeof storedHash !== "string") return false;

    const parts = storedHash.split("$");
    if (parts.length !== 4 || parts[0] !== PREFIX) {
      // If existing hashes are bcrypt, they won't validate in this dev fallback.
      console.warn(
        "[auth] Non-pbkdf2 hash detected; bcrypt unavailable in this dev setup."
      );
      return false;
    }

    const iterations = Number(parts[1]);
    const saltHex = parts[2];
    const hashHex = parts[3];
    if (!iterations || !saltHex || !hashHex) return false;

    const key = await pbkdf2Async(password, saltHex, iterations);
    const keyHex = key.toString("hex");
    if (keyHex.length !== hashHex.length) return false;

    return crypto.timingSafeEqual(
      Buffer.from(keyHex, "hex"),
      Buffer.from(hashHex, "hex")
    );
  };

  if (typeof cb === "function") {
    run()
      .then((val) => cb(null, val))
      .catch((err) => cb(err));
    return;
  }

  return run();
}

module.exports = {
  hash,
  compare,
};
