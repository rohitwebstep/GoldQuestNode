const { pool, startConnection, connectionRelease } = require("../../config/db");
const moment = require("moment"); // Ensure you have moment.js installed

const tatDelay = {
  index: (callback) => {
    // SQL query to retrieve applications, customers, branches, and tat_days
    const SQL = `SELECT * FROM \`admin_login_logs\` ORDER BY \`created_at\` DESC`;

    startConnection((connectionError, connection) => {
      if (connectionError) {
        return callback(connectionError, null);
      }

      // Execute the query to fetch data
      connection.query(SQL, (appQueryError, applicationResults) => {
        if (appQueryError) {
          return handleQueryError(appQueryError, connection, callback);
        }

        connectionRelease(connection);

        // Check if there are any results
        if (applicationResults.length === 0) {
          return callback(null, { message: "No records found" });
        }
        // Return the processed data
        return callback(null, applicationResults);
      });
    });
  },

  activityList: (logId, adminId, callback) => {

    // SQL query to retrieve the first login log
    const initialLoginQuery = `SELECT * FROM \`admin_login_logs\` WHERE \`id\` = ? AND \`action\` = ? AND \`result\` = ? AND \`admin_id\` = ? LIMIT 1`;

    startConnection((connectionError, connection) => {
      if (connectionError) {
        console.error("Database connection error:", connectionError);
        return callback(connectionError, null);
      }

      // Execute the query to fetch the current login log
      connection.query(
        initialLoginQuery,
        [logId, "login", "1", adminId],
        (queryError, currentLoginResults) => {
          if (queryError) {
            console.error(
              "Query error fetching current login log:",
              queryError
            );
            return handleQueryError(queryError, connection, callback);
          }

          // Check if no login records found
          if (currentLoginResults.length === 0) {
            return callback(null, { message: "No records found" });
          }

          const currentLogData = currentLoginResults[0];

          // SQL query to retrieve the next login log
          const nextLoginQuery = `SELECT * FROM \`admin_login_logs\` WHERE \`id\` > ? AND \`action\` = ? AND \`result\` = ? AND \`admin_id\` = ? LIMIT 1`;

          // Execute the query to fetch the next login log
          connection.query(
            nextLoginQuery,
            [logId, "login", "1", adminId],
            (nextQueryError, nextLoginResults) => {
              if (nextQueryError) {
                console.error(
                  "Query error fetching next login log:",
                  nextQueryError
                );
                return handleQueryError(
                  nextQueryError,
                  connection,
                  callback
                );
              }

              let nextLogDatacreated_at = "9999-12-31";
              // Check if no next login records found
              if (nextLoginResults.length === 0) {
                nextLogDatacreated_at = "9999-12-31";
              } else {
                const nextLogData = nextLoginResults[0];
                nextLogDatacreated_at = nextLogData.created_at;
              }

              // SQL query to retrieve admin activity logs within the time range
              const activityQuery = `SELECT * FROM \`admin_activity_logs\` WHERE \`admin_id\` = ? AND \`created_at\` <= ? AND \`created_at\` >=  ? ORDER BY \`created_at\` DESC`;

              // Execute the query to fetch activity logs
              connection.query(
                activityQuery,
                [
                  adminId,
                  nextLogDatacreated_at || "9999-12-31",
                  currentLogData.created_at,
                ],
                (activityQueryError, activityResults) => {
                  if (activityQueryError) {
                    console.error(
                      "Query error fetching activity logs:",
                      activityQueryError
                    );
                    return handleQueryError(
                      activityQueryError,
                      connection,
                      callback
                    );
                  }

                  connectionRelease(connection);

                  // Check if no activity records found
                  if (activityResults.length === 0) {
                    return callback(null, []);
                  }

                  // Return the processed activity data
                  return callback(null, activityResults);
                }
              );
            }
          );
        }
      );
    });
  },
};

// Helper function to handle query errors and release connection
function handleQueryError(err, connection, callback) {
  console.error("Query error:", err);
  connectionRelease(connection);
  callback(err, null);
}

module.exports = tatDelay;
