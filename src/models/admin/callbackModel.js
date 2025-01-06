const { pool, startConnection, connectionRelease } = require("../../config/db");

const Callback = {
  list: (callback) => {
    const sql = `
      SELECT 
        *
      FROM \`callback_requests\`
      ORDER BY \`requested_at\` DESC
    `;

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
};

module.exports = Callback;
