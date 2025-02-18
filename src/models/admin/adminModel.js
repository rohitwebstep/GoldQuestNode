const { pool, startConnection, connectionRelease } = require("../../config/db");

const Admin = {
  list: (callback) => {
    const sql = `SELECT \`id\`, \`emp_id\`, \`name\`, \`role\`, \`profile_picture\`, \`email\`, \`service_ids\`, \`status\`, \`mobile\` FROM \`admins\``;

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

  filterAdmins: ({ status, role }, callback) => {
    // console.log("filterAdmins called with:", { status, role });

    let sql = `
        SELECT 
            id, emp_id, name, role, profile_picture, email, 
            service_ids, status, mobile 
        FROM admins
    `;
    const conditions = [];
    const values = [];

    // Normalize status filter (expecting "1" or "0" as string)
    if (status !== undefined) {
      const statusValue = (status === "active" || status === "1") ? "1" : "0";
      conditions.push("status = ?");
      values.push(statusValue);
      // console.log("Applied status filter:", statusValue);
    }

    // Apply role filter if provided
    if (role) {
      conditions.push("role = ?");
      values.push(role);
      // console.log("Applied role filter:", role);
    }

    // Append conditions only if there are any filters
    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    // console.log("Final SQL Query:", sql);
    // console.log("Query Values:", values);

    startConnection((err, connection) => {
      if (err) {
        console.error("Database connection error:", err);
        return callback(err, null);
      }
      // console.log("Database connection established.");

      connection.query(sql, values, (queryErr, results) => {
        // console.log("Query executed.");

        connectionRelease(connection);
        // console.log("Database connection released.");

        if (queryErr) {
          console.error("Database query error:", queryErr);
          return callback(queryErr, null);
        }

        // console.log("Query Results:", results);
        callback(null, results);
      });
    });
  },

  create: (data, callback) => {
    const { name, mobile, email, employee_id, role, password, service_ids } = data;

    // SQL query to check if any field already exists in the admins table
    const checkExistingQuery = `
      SELECT * FROM \`admins\` WHERE \`email\` = ? OR \`mobile\` = ? OR \`emp_id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      // Check if any field already exists in the admins table
      connection.query(
        checkExistingQuery,
        [email, mobile, employee_id],
        (checkErr, results) => {
          if (checkErr) {
            connectionRelease(connection); // Release connection on error
            return callback(checkErr, null);
          }

          // If results are found, check which fields are already in use
          if (results.length > 0) {
            const usedFields = [];

            // Iterate over all results
            for (let i = 0; i < results.length; i++) {
              const existingAdmin = results[i];

              // Check if any field is a duplicate
              if (existingAdmin.email === email) {
                usedFields.push("email");
              }

              if (existingAdmin.mobile === mobile) {
                usedFields.push("mobile");
              }

              if (existingAdmin.emp_id === employee_id) {
                usedFields.push("Employee ID");
              }
            }

            // If there are any duplicate fields, release connection and return the error message
            if (usedFields.length > 0) {
              connectionRelease(connection); // Release connection if duplicates found

              // Log the message being returned to the callback
              return callback(
                {
                  message: `Another admin is registered with the following ${usedFields.join(
                    " and "
                  )}.`,
                },
                null
              );
            }
          }

          // If role is 'admin', we don't include the service_ids field
          let sql;
          let queryParams;

          if (role.toLowerCase() === 'admin') {
            sql = `
              INSERT INTO \`admins\` (\`name\`, \`emp_id\`, \`mobile\`, \`email\`, \`role\`, \`status\`, \`password\`) 
              VALUES (?, ?, ?, ?, ?, ?, md5(?))
            `;
            queryParams = [name, employee_id, mobile, email, role, "1", password];
          } else {
            sql = `
              INSERT INTO \`admins\` (\`name\`, \`emp_id\`, \`mobile\`, \`email\`, \`role\`, \`service_ids\`, \`status\`, \`password\`) 
              VALUES (?, ?, ?, ?, ?, ?, ?, md5(?))
            `;
            queryParams = [name, employee_id, mobile, email, role, service_ids, "1", password];
          }

          // Insert the new admin
          connection.query(sql, queryParams, (queryErr, results) => {
            connectionRelease(connection); // Release the connection

            if (queryErr) {
              console.error("Database query error: 612", queryErr);
              return callback(queryErr, null);
            }
            callback(null, results); // Successfully inserted the admin
          });
        }
      );
    });
  },


  update: (data, callback) => {
    const { id, name, mobile, email, employee_id, role, status, service_ids } = data;

    // SQL query to check if any field already exists in the admins table
    const checkExistingQuery = `
      SELECT * FROM \`admins\` 
      WHERE (\`email\` = ? OR \`mobile\` = ? OR \`emp_id\` = ?) AND \`id\` != ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      // Check if any field already exists in the admins table
      connection.query(
        checkExistingQuery,
        [email, mobile, employee_id, id],
        (checkErr, results) => {
          if (checkErr) {
            connectionRelease(connection); // Release connection on error
            return callback(checkErr, null);
          }

          // If results are found, check which fields are already in use
          if (results.length > 0) {
            const existingAdmin = results[0];
            const usedFields = [];

            if (existingAdmin.email === email) usedFields.push("email");
            if (existingAdmin.mobile === mobile) usedFields.push("mobile");
            if (existingAdmin.emp_id === employee_id)
              usedFields.push("Employee ID");

            if (usedFields.length > 0) {
              connectionRelease(connection); // Release connection if duplicates found
              return callback(
                `Another admin is registered with the following ${usedFields.join(
                  " and "
                )}.`,
                null
              );
            }
          }

          // If role is 'admin', we don't include the service_ids field in the update
          let sql;
          let queryParams;

          if (role.toLowerCase() === 'admin') {
            sql = `
              UPDATE \`admins\` 
              SET 
                \`name\` = ?, 
                \`emp_id\` = ?, 
                \`mobile\` = ?, 
                \`email\` = ?, 
                \`role\` = ?, 
                \`status\` = ? 
              WHERE \`id\` = ?
            `;
            queryParams = [name, employee_id, mobile, email, role, status, id];
          } else {
            sql = `
              UPDATE \`admins\` 
              SET 
                \`name\` = ?, 
                \`emp_id\` = ?, 
                \`mobile\` = ?, 
                \`email\` = ?, 
                \`role\` = ?, 
                \`service_ids\` = ?, 
                \`status\` = ? 
              WHERE \`id\` = ?
            `;
            queryParams = [name, employee_id, mobile, email, role, service_ids, status, id];
          }

          // Update the admin record
          connection.query(sql, queryParams, (queryErr, results) => {
            connectionRelease(connection); // Release the connection

            if (queryErr) {
              console.error("Database query error: 7", queryErr);
              return callback(queryErr, null);
            }
            callback(null, results); // Successfully updated the admin
          });
        }
      );
    });
  },

  delete: (id, callback) => {
    const sql = `
      DELETE FROM \`admins\`
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
        connectionRelease(connection); // Release the connection

        if (queryErr) {
          console.error("Database query error: 8", queryErr);
          return callback(queryErr, null);
        }
        callback(null, results);
      });
    });
  },

  upload: (id, savedImagePaths, callback) => {
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      const sqlUpdateCustomer = `
      UPDATE admins 
      SET profile_picture = ?
      WHERE id = ?
    `;
      const joinedPaths = savedImagePaths.join(", ");
      // Prepare the parameters for the query
      const queryParams = [joinedPaths, id];

      connection.query(sqlUpdateCustomer, queryParams, (err, results) => {
        connectionRelease(connection); // Ensure the connection is released

        if (err) {
          // Return error details and the final query with parameters
          return callback(false, {
            error: "Database error occurred.",
            details: err, // Include error details for debugging
            query: sqlUpdateCustomer,
            params: queryParams, // Return the parameters used in the query
          });
        }

        // Check if any rows were affected by the update
        if (results.affectedRows > 0) {
          return callback(true, results); // Success with results
        } else {
          // No rows updated, return a specific message along with the query details
          return callback(false, {
            error: "No rows updated. Please check the Admin ID.",
            details: results,
            query: sqlUpdateCustomer,
            params: queryParams, // Return the parameters used in the query
          });
        }
      });
    });
  },

  findByEmailOrMobile: (username, callback) => {
    const sql = `
      SELECT \`id\`, \`emp_id\`, \`name\`, \`profile_picture\`, \`email\`, \`mobile\`, \`status\`, \`login_token\`, \`token_expiry\`, \`otp\`, \`two_factor_enabled\`, \`otp_expiry\`, \`role\`
      FROM \`admins\`
      WHERE \`email\` = ? OR \`mobile\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [username, username], (queryErr, results) => {
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
        connectionRelease(connection);
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

  updateOTP: (admin_id, otp, otp_expiry, callback) => {
    const sql = `UPDATE \`admins\` SET \`otp\` = ?, \`otp_expiry\` = ?,  \`reset_password_token\` = null, \`login_token\` = null, \`token_expiry\` = null, \`password_token_expiry\` = null WHERE \`id\` = ?`;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(
        sql,
        [otp, otp_expiry, admin_id],
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
        }
      );
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
      SET 
        \`reset_password_token\` = ?, 
        \`password_token_expiry\` = ?,
        \`can_request_password_reset\` = ?,
        \`password_reset_request_count\` = 
          CASE 
            WHEN DATE(\`password_reset_requested_at\`) = CURDATE() 
            THEN \`password_reset_request_count\` + 1 
            ELSE 1 
          END,
        \`password_reset_requested_at\` = 
          CASE 
            WHEN DATE(\`password_reset_requested_at\`) = CURDATE() 
            THEN \`password_reset_requested_at\` 
            ELSE NOW() 
          END
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        console.error("Database connection error:", err);
        return callback({ success: false, message: "Database connection failed", error: err }, null);
      }

      connection.query(sql, [token, tokenExpiry, 1, id], (queryErr, results) => {
        connectionRelease(connection); // Ensure the connection is released

        if (queryErr) {
          console.error("Database query error:", queryErr);
          return callback({ success: false, message: "Failed to update reset password token", error: queryErr }, null);
        }

        if (results.affectedRows === 0) {
          return callback({ success: false, message: "No admin found with the provided ID or no update required" }, null);
        }

        return callback(null, {
          success: true,
          message: "Password reset token updated successfully",
          data: { affectedRows: results.affectedRows }
        });
      });
    });
  },

  updatePasswordResetPermission: (status, admin_id, callback) => {
    const sql = `
      UPDATE \`admins\`
      SET \`can_request_password_reset\` = ?
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        console.error("Database connection error:", err);
        return callback({
          success: false,
          message: "Database connection failed",
          error: err
        }, null);
      }

      connection.query(sql, [status, admin_id], (queryErr, results) => {
        connectionRelease(connection); // Ensure connection is released

        if (queryErr) {
          console.error("Database query error:", queryErr);
          return callback({
            success: false,
            message: "Failed to update password reset permission",
            error: queryErr
          }, null);
        }

        if (results.affectedRows === 0) {
          return callback({
            success: false,
            message: "No admin found with the provided ID or no update was necessary"
          }, null);
        }

        return callback(null, {
          success: true,
          message: `Password reset permission updated successfully to ${status ? 'Allowed' : 'Denied'}`,
          data: { affectedRows: results.affectedRows }
        });
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
        connectionRelease(connection);
        callback(null, results[0]); // Return the first result (should be one result if ID is unique)
      });
    });
  },

  fetchAllowedServiceIds: (id, callback) => {
    const sql = `
        SELECT \`service_ids\`, \`role\` FROM \`admins\`
        WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        console.error("Connection error:", err);
        return callback({ message: "Database connection error", error: err }, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
        if (queryErr) {
          console.error("Database query error:", queryErr);
          connectionRelease(connection);
          return callback(queryErr, null);
        }

        if (results.length === 0) {
          connectionRelease(connection);
          return callback({ message: "Admin not found" }, null);
        }

        const { role, service_ids } = results[0];

        // If the role is not "admin" or "admin_user"
        if (!["admin", "admin_user"].includes(role)) {
          try {
            // Convert service_ids string to an array and map to numbers
            const serviceIdsArr = service_ids ? service_ids.split(",").map(Number) : [];

            connectionRelease(connection);
            return callback(null, { finalServiceIds: serviceIdsArr });

          } catch (parseErr) {
            console.error("Error parsing service_ids:", parseErr);
            connectionRelease(connection);
            return callback({ message: "Error parsing service_ids data", error: parseErr }, null);
          }
        }

        // If the role is "admin" or "admin_user"
        connectionRelease(connection);
        return callback(null, { finalServiceIds: [] });
      });
    });
  }
};

module.exports = Admin;
