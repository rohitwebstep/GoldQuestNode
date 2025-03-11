const crypto = require("crypto");
const { pool, startConnection, connectionRelease } = require("../../config/db");

// Generates a new random token
const generateToken = () => crypto.randomBytes(32).toString("hex");

const getCurrentTime = () => new Date();

// Utility function to get token expiry time (15 minutes from the current time)
const getTokenExpiry = () => {
  const expiryDurationInMinutes = 3; // Duration for token expiry in minutes
  return new Date(getCurrentTime().getTime() + expiryDurationInMinutes * 60000);
};

const common = {
  /**
   * Validates the admin's token and refreshes it if expired.
   * @param {string} _token - Provided token
   * @param {number} admin_id - Admin ID
   * @param {function} callback - Callback function
   */
  isAdminTokenValid: (_token, admin_id, callback) => {
    const sql = `
      SELECT \`login_token\`, \`token_expiry\`
      FROM \`admins\`
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        console.error("Connection error:", err);
        return callback({ status: false, message: "Connection error" }, null);
      }

      connection.query(sql, [admin_id], (queryErr, results) => {
        if (queryErr) {
          connectionRelease(connection);
          console.error("Database query error: 28", queryErr);
          return callback({ status: false, message: "Database error" }, null);
        }

        if (results.length === 0) {
          return callback({ status: false, message: "Admin not found" }, null);
        }

        const currentToken = results[0].login_token;
        const tokenExpiry = new Date(results[0].token_expiry);
        const currentTime = new Date();

        if (_token !== currentToken) {
          connectionRelease(connection);
          return callback(
            { status: false, message: "Invalid token provided" },
            null
          );
        }

        if (tokenExpiry > currentTime) {
          connectionRelease(connection);
          return callback(null, { status: true, message: "Token is valid" });
        } else {
          const newToken = generateToken();
          const newTokenExpiry = getTokenExpiry();

          const updateSql = `
            UPDATE \`admins\`
            SET \`login_token\` = ?, \`token_expiry\` = ?
            WHERE \`id\` = ?
          `;

          connection.query(
            updateSql,
            [newToken, newTokenExpiry, admin_id],
            (updateErr) => {
              connectionRelease(connection); // Release the connection again

              if (updateErr) {
                console.error("Error updating token:", updateErr);
                return callback(
                  { status: false, message: "Error updating token" },
                  null
                );
              }

              callback(null, {
                status: true,
                message: "Token was expired and has been refreshed",
                newToken,
              });
            }
          );
        }
      });
    });
  },

  /**
   * Logs admin login activities.
   * @param {number} admin_id - Admin ID
   * @param {string} action - Action performed
   * @param {string} result - Result of the action
   * @param {string} error - Error message if any
   * @param {function} callback - Callback function
   */
  adminLoginLog: (admin_id, action, result, error, callback) => {
    const insertSql = `
      INSERT INTO \`admin_login_logs\` (\`admin_id\`, \`action\`, \`result\`, \`error\`, \`created_at\`)
      VALUES (?, ?, ?, ?, NOW())
    `;

    startConnection((err, connection) => {
      if (err) {
        console.error("Connection error:", err);
        return callback({ status: false, message: "Connection error" }, null);
      }

      connection.query(insertSql, [admin_id, action, result, error], (err) => {
        connectionRelease(connection); // Release the connection

        if (err) {
          console.error("Database insertion error:", err);
          return callback({ status: false, message: "Database error" }, null);
        }

        callback(null, {
          status: true,
          message: "Admin login log entry added successfully",
        });
      });
    });
  },

  /**
   * Logs other admin activities.
   * @param {number} admin_id - Admin ID
   * @param {string} module - Module name
   * @param {string} action - Action performed
   * @param {string} result - Result of the action
   * @param {string} update - Update description
   * @param {string} error - Error message if any
   * @param {function} callback - Callback function
   */
  adminActivityLog: (
    admin_id,
    module,
    action,
    result,
    update,
    error,
    callback
  ) => {
    const insertSql = `
      INSERT INTO \`admin_activity_logs\` (\`admin_id\`, \`module\`, \`action\`, \`result\`, \`update\`, \`error\`, \`created_at\`)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;

    startConnection((err, connection) => {
      if (err) {
        console.error("Connection error:", err);
        return callback({ status: false, message: "Connection error" }, null);
      }

      connection.query(
        insertSql,
        [
          admin_id || null,
          module || null,
          action || null,
          result || null,
          update || null,
          error || null,
        ],
        (err) => {
          connectionRelease(connection); // Release the connection

          if (err) {
            console.error("Database insertion error:", err);
            return callback({ status: false, message: "Database error" }, null);
          }

          callback(null, {
            status: true,
            message: "Admin activity log entry added successfully",
          });
        }
      );
    });
  },

  /**
   * Checks if the admin is authorized for a specific action.
   * @param {number} admin_id - Admin ID
   * @param {string} action - Action performed
   * @param {function} callback - Callback function
   */
  isAdminAuthorizedForAction: (admin_id, action, callback) => {
    // console.log("Step 1: Function called with admin_id:", admin_id, "and action:", action);

    const adminSQL = `SELECT \`role\` FROM \`admins\` WHERE \`id\` = ?`;
    const permissionsJsonByRoleSQL = `SELECT \`json\` FROM \`permissions\` WHERE \`role\` = ?`;

    startConnection((err, connection) => {
      if (err) {
        console.error("Step 2: Connection error:", err);
        return callback({ message: "Connection error", error: err }, null);
      }

      if (!connection) {
        console.error("Step 3: Connection is not available");
        return callback({ message: "Connection is not available" }, null);
      }

      // console.log("Step 4: Database connection established successfully");

      // First query: Get the admin's role
      connection.query(adminSQL, [admin_id], (err, results) => {
        if (err) {
          console.error("Step 5: Database query error (5-8)", err);
          connectionRelease(connection);
          return callback(
            { message: "Database query error (5-8)", error: err },
            null
          );
        }

        // console.log("Step 6: Query 1 executed successfully. Results:", results);

        if (results.length === 0) {
          // console.log("Step 7: No admin found with the provided ID");
          connectionRelease(connection);
          return callback(
            { message: "No admin found with the provided ID" },
            null
          );
        }

        const role = results[0].role;
        // console.log("Step 8: Admin role found:", role);

        // Second query: Get permissions for the admin's role
        connection.query(permissionsJsonByRoleSQL, [role], (err, results) => {
          if (err) {
            console.error("Step 9: Database query error (5-9)", err);
            connectionRelease(connection);
            return callback(
              { message: "Database query error (5-9)", error: err },
              null
            );
          }

          // console.log("Step 10: Query 2 executed successfully. Results:", results);

          if (results.length === 0) {
            // console.log("Step 11: No permissions found for the admin role");
            connectionRelease(connection);
            return callback({ message: "Access Denied" }, null);
          }

          const permissionsRaw = results[0].json;
          // console.log("Step 12: Raw permissions JSON:", permissionsRaw);

          if (!permissionsRaw) {
            // console.log("Step 13: Permissions field is empty");
            connectionRelease(connection);
            return callback({ status: false, message: "Access Denied" });
          }

          try {
            const permissionsJson = JSON.parse(permissionsRaw);
            // console.log("Step 14: Parsed permissions JSON:", permissionsJson);

            const permissions =
              typeof permissionsJson === "string"
                ? JSON.parse(permissionsJson)
                : permissionsJson;

            // console.log("Step 15: Checking if action exists in permissions");

            if (!permissions[action]) {
              // console.log("Step 16: Action type not found in permissions");
              connectionRelease(connection);
              return callback({ status: false, message: "Access Denied" });
            }

            // console.log("Step 17: Authorization successful");

            connectionRelease(connection);
            return callback({
              status: true,
              message: "Authorization Successful",
            });
          } catch (parseErr) {
            console.error("Step 18: Error parsing permissions JSON:", parseErr);
            connectionRelease(connection);
            return callback({ status: false, message: "Access Denied" });
          }
        });
      });
    });
  },

};

module.exports = common;
