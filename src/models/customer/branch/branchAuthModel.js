const {
  pool,
  startConnection,
  connectionRelease,
} = require("../../../config/db");

const Branch = {
  findByEmailOrMobile: (username, callback) => {
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      const sql = `
        SELECT \`id\`, \`customer_id\`, \`name\`, \`email\`, \`status\`, \`login_token\`, \`token_expiry\`, \`otp\`, \`two_factor_enabled\`, \`otp_expiry\`
        FROM \`branches\`
        WHERE \`email\` = ?
      `;

      connection.query(sql, [username], (err, results) => {
        connectionRelease(connection); // Ensure connection is released

        if (err) {
          console.error("Database query error: 74", err);
          return callback(
            { message: "Database query error", error: err },
            null
          );
        }

        if (results.length === 0) {
          return callback(
            { message: "No branch found with the provided email" },
            null
          );
        }

        callback(null, results);
      });
    });
  },

  findByEmailOrMobileAllInfo: (username, callback) => {
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      const sql = `
        SELECT *
        FROM \`branches\`
        WHERE \`email\` = ?
      `;

      connection.query(sql, [username], (err, results) => {
        connectionRelease(connection); // Ensure connection is released

        if (err) {
          console.error("Database query error: 75", err);
          return callback(
            { message: "Database query error", error: err },
            null
          );
        }

        if (results.length === 0) {
          return callback(
            { message: "No branch found with the provided email" },
            null
          );
        }

        callback(null, results);
      });
    });
  },

  setResetPasswordToken: (id, token, tokenExpiry, callback) => {
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      const sql = `
        UPDATE \`branches\`
        SET \`reset_password_token\` = ?, \`password_token_expiry\` = ?
        WHERE \`id\` = ?
      `;

      connection.query(sql, [token, tokenExpiry, id], (err, results) => {
        connectionRelease(connection); // Ensure connection is released

        if (err) {
          console.error("Database query error: 76", err);
          return callback(
            { message: "Database update error", error: err },
            null
          );
        }

        if (results.affectedRows === 0) {
          return callback(
            {
              message:
                "Token update failed. Branch not found or no changes made.",
            },
            null
          );
        }

        callback(null, results);
      });
    });
  },

  validatePassword: (email, password, callback) => {
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      const sql = `
        SELECT \`id\`
        FROM \`branches\`
        WHERE \`email\` = ?
        AND (\`password\` = MD5(?) OR \`password\` = ?)
      `;

      connection.query(sql, [email, password, password], (err, results) => {
        connectionRelease(connection); // Ensure connection is released

        if (err) {
          console.error("Database query failed:", err);
          return callback(
            { message: "Internal server error", error: err },
            null
          );
        }

        // Return true if a match is found, otherwise return false
        if (results.length > 0) {
          return callback(null, true);
        } else {
          return callback(null, false);
        }
      });
    });
  },

  updatePassword: (new_password, branch_id, callback) => {
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      const sql = `UPDATE \`branches\` SET \`password\` = MD5(?), \`reset_password_token\` = null, \`login_token\` = null, \`token_expiry\` = null, \`password_token_expiry\` = null WHERE \`id\` = ?`;

      connection.query(sql, [new_password, branch_id], (err, results) => {
        connectionRelease(connection); // Ensure connection is released

        if (err) {
          console.error("Database query error: 77", err);
          return callback(
            {
              message: "An error occurred while updating the password.",
              error: err,
            },
            null
          );
        }

        // Check if the branch_id was found and the update affected any rows
        if (results.affectedRows === 0) {
          return callback(
            {
              message:
                "Branch not found or password not updated. Please check the provided details.",
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

  updateOTP: (branch_id, otp, otp_expiry, callback) => {
    const sql = `UPDATE \`branches\` SET \`otp\` = ?, \`otp_expiry\` = ?,  \`reset_password_token\` = null, \`login_token\` = null, \`token_expiry\` = null, \`password_token_expiry\` = null WHERE \`id\` = ?`;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(
        sql,
        [otp, otp_expiry, branch_id],
        (queryErr, results) => {
          connectionRelease(connection); // Release the connection

          if (queryErr) {
            console.error("Database query error: 8", queryErr);
            return callback(
              {
                message: "An error occurred while updating the password.",
                error: queryErr,
              },
              null
            );
          }

          // Check if the branch_id was found and the update affected any rows
          if (results.affectedRows === 0) {
            return callback(
              {
                message:
                  "Branch not found or password not updated. Please check the provided details.",
              },
              null
            );
          }

          callback(null, {
            message: "Password updated successfully.",
            affectedRows: results.affectedRows,
          });
        }
      );
    });
  },

  updateToken: (id, token, tokenExpiry, callback) => {
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      const sql = `
        UPDATE \`branches\`
        SET \`login_token\` = ?, \`token_expiry\` = ?
        WHERE \`id\` = ?
      `;

      connection.query(sql, [token, tokenExpiry, id], (err, results) => {
        connectionRelease(connection); // Ensure connection is released

        if (err) {
          console.error("Database query error: 78", err);
          return callback(
            { message: "Database update error", error: err },
            null
          );
        }

        if (results.affectedRows === 0) {
          return callback(
            {
              message:
                "Token update failed. Branch not found or no changes made.",
            },
            null
          );
        }

        callback(null, results);
      });
    });
  },

  validateLogin: (id, callback) => {
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      const sql = `
        SELECT \`login_token\`, \`token_expiry\`
        FROM \`branches\`
        WHERE \`id\` = ?
      `;

      connection.query(sql, [id], (err, results) => {
        connectionRelease(connection); // Ensure connection is released

        if (err) {
          console.error("Database query error: 79", err);
          return callback(
            { message: "Database query error", error: err },
            null
          );
        }

        if (results.length === 0) {
          return callback({ message: "Branch not found" }, null);
        }

        callback(null, results);
      });
    });
  },

  // Clear login token and token expiry
  logout: (id, callback) => {
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      const sql = `
          UPDATE \`branches\`
          SET \`login_token\` = NULL, \`token_expiry\` = NULL
          WHERE \`id\` = ?
        `;

      connection.query(sql, [id], (err, results) => {
        connectionRelease(connection); // Ensure connection is released

        if (err) {
          console.error("Database query error: 80", err);
          return callback(
            { message: "Database update error", error: err },
            null
          );
        }

        if (results.affectedRows === 0) {
          return callback(
            {
              message:
                "Token clear failed. Branch not found or no changes made.",
            },
            null
          );
        }

        callback(null, results);
      });
    });
  },

  findById: (id, callback) => {
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      const sql = `
        SELECT \`id\`, \`customer_id\`, \`name\`, \`email\`, \`status\`, \`login_token\`, \`token_expiry\`
        FROM \`branches\`
        WHERE \`id\` = ?
      `;

      connection.query(sql, [id], (err, results) => {
        connectionRelease(connection); // Ensure connection is released

        if (err) {
          console.error("Database query error: 81", err);
          return callback(
            { message: "Database query error", error: err },
            null
          );
        }
        if (results.length === 0) {
          return callback({ message: "Branch not found" }, null);
        }
        callback(null, results[0]); // Return the first result (should be one result if ID is unique)
      });
    });
  },

  isBranchActive: (id, callback) => {
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      const sql = `
        SELECT \`status\`
        FROM \`branches\`
        WHERE \`id\` = ?
      `;

      connection.query(sql, [id], (err, results) => {
        connectionRelease(connection); // Ensure connection is released

        if (err) {
          console.error("Database query error: 82", err);
          return callback(
            { message: "Database query error", error: err },
            null
          );
        }
        if (results.length === 0) {
          return callback({ message: "Branch not found" }, null);
        }

        const isActive = results[0].status == 1;
        callback(null, { isActive });
      });
    });
  },

  isCustomerActive: (customerID, callback) => {
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      const sql = `
      SELECT \`status\`
      FROM \`customers\`
      WHERE \`id\` = ?
    `;

      connection.query(sql, [customerID], (err, results) => {
        connectionRelease(connection); // Ensure connection is released

        if (err) {
          console.error("Database query error: 83", err);
          return callback(
            { message: "Database query error", error: err },
            null
          );
        }
        if (results.length === 0) {
          return callback({ message: "Customer not found" }, null);
        }

        const isActive = results[0].status == 1;
        callback(null, { isActive });
      });
    });
  },
};

module.exports = Branch;
