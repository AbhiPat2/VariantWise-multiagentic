const db = require('../db/config');
const bcrypt = require('../utils/password');

module.exports = {
  createUser: (first_name, last_name, email, password) => {
    return new Promise((resolve, reject) => {
      const insertUser = (hashedPassword) => {
        const sql = 'INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)';
        db.query(sql, [first_name, last_name, email, hashedPassword], (error, result) => {
          if (error) return reject(error);
          resolve(result);
        });
      };

      if (password) {
        bcrypt.hash(password, 10, (err, hashed) => {
          if (err) return reject(err);
          insertUser(hashed);
        });
      } else {
        // For Google OAuth users with no password
        insertUser(null);
      }
    });
  },

  getUserByEmail: (email) => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM users WHERE email = ?';
      db.query(sql, [email], (error, results) => {
        if (error) return reject(error);
        resolve(results[0]);
      });
    });
  },

  // deserializeUser
  getUserById: (id) => {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM users WHERE id = ?';
      db.query(sql, [id], (error, results) => {
        if (error) return reject(error);
        resolve(results[0]);
      });
    });
  },

  updatePasswordByEmail: (email, newPassword) => {
    return new Promise((resolve, reject) => {
      bcrypt.hash(newPassword, 10, (err, hashed) => {
        if (err) return reject(err);
        const sql = 'UPDATE users SET password = ? WHERE email = ?';
        db.query(sql, [hashed, email], (error, result) => {
          if (error) return reject(error);
          resolve(result);
        });
      });
    });
  },
};
