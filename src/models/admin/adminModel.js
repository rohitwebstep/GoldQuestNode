const { pool, startConnection, connectionRelease } = require("../../config/db");

const Admin = {
  list: (callback) => {
    const sql = `SELECT \`id\`, \`emp_id\`, \`name\`, \`profile_picture\`, \`email\`, \`mobile\` FROM \`admins\``;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, (queryErr, results) => {
        connectionRelease(connection); // Release the connection

        if (queryErr) {
          console.error("Database query error: 47", queryErr);
          return callback(queryErr, null);
        }
        callback(null, results);
      });
    });
  },

  findByEmailOrMobile: (username, callback) => {
    const sql = `
      SELECT \`id\`, \`emp_id\`, \`name\`, \`profile_picture\`, \`email\`, \`mobile\`, \`status\`, \`login_token\`, \`token_expiry\`
      FROM \`admins\`
      WHERE \`email\` = ? OR \`mobile\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [username, username], (queryErr, results) => {
        connectionRelease(connection); // Release the connection

        if (queryErr) {
          console.error("Database query error: 5", queryErr);
          return callback(
            { message: "Database query error", error: queryErr },
            null
          );
        }

        if (results.length === 0) {
          return callback(
            { message: "No admin found with the provided email or mobile" },
            null
          );
        }

        callback(null, results);
      });
    });
  },

  findByEmailOrMobileAllInfo: (username, callback) => {
    const sql = `
      SELECT *
      FROM \`admins\`
      WHERE \`email\` = ? OR \`mobile\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [username, username], (queryErr, results) => {
        connectionRelease(connection); // Release the connection

        if (queryErr) {
          console.error("Database query error: 6", queryErr);
          return callback(
            { message: "Database query error", error: queryErr },
            null
          );
        }

        if (results.length === 0) {
          return callback(
            { message: "No admin found with the provided email or mobile" },
            null
          );
        }

        callback(null, results);
      });
    });
  },

  validatePassword: (username, password, callback) => {
    const sql = `
      SELECT \`id\`, \`emp_id\`, \`name\`, \`profile_picture\`, \`email\`, \`mobile\`, \`status\`
      FROM \`admins\`
      WHERE (\`email\` = ? OR \`mobile\` = ?)
      AND \`password\` = MD5(?)
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(
        sql,
        [username, username, password],
        (queryErr, results) => {
          connectionRelease(connection); // Release the connection

          if (queryErr) {
            console.error("Database query error: 7", queryErr);
            return callback(
              { message: "Database query error", error: queryErr },
              null
            );
          }

          if (results.length === 0) {
            return callback(
              { message: "Incorrect password or username" },
              null
            );
          }

          callback(null, results);
        }
      );
    });
  },

  updatePassword: (new_password, admin_id, callback) => {
    const sql = `UPDATE \`admins\` SET \`password\` = MD5(?), \`reset_password_token\` = null, \`login_token\` = null, \`token_expiry\` = null, \`password_token_expiry\` = null WHERE \`id\` = ?`;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [new_password, admin_id], (queryErr, results) => {
        connectionRelease(connection); // Release the connection

        if (queryErr) {
          console.error("Database query error: 8", queryerr);
          return callback(
            {
              message: "An error occurred while updating the password.",
              error: queryErr,
            },
            null
          );
        }

        // Check if the admin_id was found and the update affected any rows
        if (results.affectedRows === 0) {
          return callback(
            {
              message:
                "Admin not found or password not updated. Please check the provided details.",
            },
            null
          );
        }

        callback(null, {
          message: "Password updated successfully.",
          affectedRows: results.affectedRows,
        });
      });
    });
  },

  updateToken: (id, token, tokenExpiry, callback) => {
    const sql = `
      UPDATE \`admins\`
      SET \`login_token\` = ?, \`token_expiry\` = ?
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [token, tokenExpiry, id], (queryErr, results) => {
        connectionRelease(connection); // Release the connection

        if (queryErr) {
          console.error("Database query error: 9", queryErr);
          return callback(
            { message: "Database update error", error: queryErr },
            null
          );
        }

        if (results.affectedRows === 0) {
          return callback(
            {
              message:
                "Token update failed. Admin not found or no changes made.",
            },
            null
          );
        }
        callback(null, results);
      });
    });
  },

  setResetPasswordToken: (id, token, tokenExpiry, callback) => {
    const sql = `
      UPDATE \`admins\`
      SET \`reset_password_token\` = ?, \`password_token_expiry\` = ?
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [token, tokenExpiry, id], (queryErr, results) => {
        connectionRelease(connection); // Release the connection

        if (queryErr) {
          console.error("Database query error: 10", queryErr);
          return callback(
            { message: "Database update error", error: queryErr },
            null
          );
        }

        if (results.affectedRows === 0) {
          return callback(
            {
              message:
                "Token update failed. Admin not found or no changes made.",
            },
            null
          );
        }

        callback(null, results);
      });
    });
  },

  validateLogin: (id, callback) => {
    const sql = `
      SELECT \`login_token\`, \`token_expiry\`
      FROM \`admins\`
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
        connectionRelease(connection); // Release the connection

        if (queryErr) {
          console.error("Database query error: 11", queryErr);
          return callback(
            { message: "Database query error", error: queryErr },
            null
          );
        }

        if (results.length === 0) {
          return callback({ message: "Admin not found" }, null);
        }

        callback(null, results);
      });
    });
  },

  // Clear login token and token expiry
  logout: (id, callback) => {
    const sql = `
        UPDATE \`admins\`
        SET \`login_token\` = NULL, \`token_expiry\` = NULL
        WHERE \`id\` = ?
      `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
        connectionRelease(connection); // Release the connection

        if (queryErr) {
          console.error("Database query error: 12", queryErr);
          return callback(
            { message: "Database update error", error: queryErr },
            null
          );
        }

        if (results.affectedRows === 0) {
          return callback(
            {
              message:
                "Token clear failed. Admin not found or no changes made.",
            },
            null
          );
        }

        callback(null, results);
      });
    });
  },

  findById: (id, callback) => {
    const sql = `
      SELECT \`id\`, \`emp_id\`, \`name\`, \`profile_picture\`, \`email\`, \`mobile\`, \`status\`, \`login_token\`, \`token_expiry\`
      FROM \`admins\`
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
        connectionRelease(connection); // Release the connection

        if (queryErr) {
          console.error("Database query error: 13", queryErr);
          return callback(
            { message: "Database query error", error: queryErr },
            null
          );
        }

        if (results.length === 0) {
          return callback({ message: "Admin not found" }, null);
        }

        callback(null, results[0]); // Return the first result (should be one result if ID is unique)
      });
    });
  },
};

module.exports = Admin;
