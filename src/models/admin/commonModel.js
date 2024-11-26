const crypto = require("crypto");
const { pool, startConnection, connectionRelease } = require("../../config/db");

// Generates a new random token
const generateToken = () => crypto.randomBytes(32).toString("hex");

// Returns the expiry time for the token (1 hour from now)
const getTokenExpiry = () => new Date(Date.now() + 3600000).toISOString();

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
          callback(null, { status: true, message: "Token is valid" });
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
    const adminSQL = `SELECT \`role\` FROM \`admins\` WHERE \`id\` = ?`;

    startConnection((err, connection) => {
      if (err) {
        console.error("Connection error:", err);
        return callback({ message: "Connection error", error: err }, null);
      }

      connection.query(adminSQL, [admin_id], (err, results) => {
        if (err) {
          connectionRelease(connection);
          console.error("Database query error: 29", err);
          return callback(
            { message: "Database query error", error: err },
            null
          );
        }

        if (results.length === 0) {
          connectionRelease(connection);
          return callback(
            { message: "No admin found with the provided ID" },
            null
          );
        }

        // Console log the role
        const role = results[0].role;

        const permissionsJsonByRoleSQL = `SELECT \`json\` FROM \`permissions\` WHERE \`role\` = ?`;
        pool.query(permissionsJsonByRoleSQL, [role], (err, results) => {
          connectionRelease(connection);
          if (err) {
            console.error("Database query error: 30", err);
            return callback(
              { message: "Database query error", error: err },
              null
            );
          }

          if (results.length === 0) {
            return callback(
              { message: "No permissions found for the admin role" },
              null
            );
          }

          // Console log the json
          const permissionsJson = JSON.parse(results[0].json);
          const permissions =
            typeof permissionsJson === "string"
              ? JSON.parse(permissionsJson)
              : permissionsJson;

          const actionObj =
            typeof action === "string" ? JSON.parse(action) : action;

          // Extract action type and action name from the action object
          const [actionType, actionName] = Object.entries(actionObj)[0] || [];

          // Check if action type and action name are valid
          if (!actionType || !actionName) {
            console.error("Invalid action format");
            return callback({ status: false, message: "Access Denied" });
          }

          // Check if the action type exists in the permissions object
          if (!permissions[actionType]) {
            console.error("Action type not found in permissions");
            return callback({
              status: false,
              message: "Access Denied",
            });
          }

          // Check if the action name is authorized
          const isAuthorized = permissions[actionType][actionName] === true;

          return callback({
            status: isAuthorized,
            message: isAuthorized
              ? "Authorization Successful"
              : "Access Denied",
          });
        });
      });
    });
  },
};

module.exports = common;
