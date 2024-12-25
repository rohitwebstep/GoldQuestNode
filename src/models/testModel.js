const { pool, startConnection, connectionRelease } = require("../config/db");

const Test = {
  connectionCheck: (callback) => {
    startConnection((err, connection) => {
      console.log(`step - 1`);
      connectionRelease(connection);
      console.log(`step - 2`);
      if (err) {
        console.error("Failed to connect to the database:", err);
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      console.log(`step - 3`);
      connectionRelease(connection);
      console.log(`step - 4`);

      const sql = `
        SELECT * FROM \`app_info\`
        WHERE \`status\` = 1 AND \`interface_type\` = ?
        ORDER BY \`updated_at\` DESC
        LIMIT 1
      `;

      connection.query(sql, ["backend"], (queryErr, results) => {
        connectionRelease(connection);

        if (queryErr) {
          console.error("Database query error:", queryErr);
          return callback(queryErr, null);
        }

        if (results.length === 0) {
          return callback(null, null); // Return null if no entry found
        }

        callback(null, results[0]); // Return the first result
      });
    });
  },
};

module.exports = Test;
