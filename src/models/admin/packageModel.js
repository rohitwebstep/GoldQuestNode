const { pool, startConnection, connectionRelease } = require("../../config/db");

const Package = {
  create: (title, description, admin_id, callback) => {
    // Step 1: Check if a package with the same title already exists
    const checkPackageSql = `
        SELECT * FROM \`packages\` WHERE \`title\` = ?
      `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(checkPackageSql, [title], (checkErr, packageResults) => {
        if (checkErr) {
          console.error("Error checking service:", checkErr);
          connectionRelease(connection); // Release connection on error
          return callback(checkErr, null);
        }

        // Step 2: If a service with the same title, short code, or sac code exists, return specific error
        if (packageResults.length > 0) {
          let errorMessage =
            "Service with the following values already exists: ";

          const titleExists = packageResults.some(
            (result) => result.title.toLowerCase() === title.toLowerCase()
          );
          if (titleExists) {
            errorMessage += "`title` ";
          }

          connectionRelease(connection); // Release connection before returning error
          return callback({ message: errorMessage }, null);
        }
        const sql = `
      INSERT INTO \`packages\` (\`title\`, \`description\`, \`admin_id\`)
      VALUES (?, ?, ?)
    `;
        connection.query(
          sql,
          [title, description, admin_id],
          (queryErr, results) => {
            connectionRelease(connection); // Release the connection

            if (queryErr) {
              console.error("Database query error: 41", queryErr);
              return callback(queryErr, null);
            }

            callback(null, results);
          }
        );
      });
    });
  },

  list: (callback) => {
    const sql = `SELECT * FROM \`packages\``;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, (queryErr, results) => {
        connectionRelease(connection); // Release the connection

        if (queryErr) {
          console.error("Database query error: 42", queryErr);
          return callback(queryErr, null);
        }

        callback(null, results);
      });
    });
  },

  getPackageById: (id, callback) => {
    const sql = `SELECT * FROM \`packages\` WHERE \`id\` = ?`;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
        connectionRelease(connection); // Release the connection

        if (queryErr) {
          console.error("Database query error: 43", queryErr);
          return callback(queryErr, null);
        }

        callback(null, results[0]);
      });
    });
  },

  update: (id, title, description, callback) => {
    // Step 1: Check if a service with the same title already exists
    const checkPackageSql = `
        SELECT * FROM \`packages\` WHERE \`title\` = ? AND \`id\` != ?
      `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(
        checkPackageSql,
        [title, id],
        (checkErr, packageResults) => {
          if (checkErr) {
            console.error("Error checking service:", checkErr);
            connectionRelease(connection); // Release connection on error
            return callback(checkErr, null);
          }

          // Step 2: If a service with the same title, short code, or sac code exists, return specific error
          if (packageResults.length > 0) {
            let errorMessage =
              "Service with the following values already exists: ";

            const titleExists = packageResults.some(
              (result) => result.title.toLowerCase() === title.toLowerCase()
            );
            if (titleExists) {
              errorMessage += "`title` ";
            }

            connectionRelease(connection); // Release connection before returning error
            return callback({ message: errorMessage }, null);
          }
          const sql = `
      UPDATE \`packages\`
      SET \`title\` = ?, \`description\` = ?
      WHERE \`id\` = ?
    `;

          connection.query(
            sql,
            [title, description, id],
            (queryErr, results) => {
              connectionRelease(connection); // Release the connection

              if (queryErr) {
                console.error("Database query error: 44", queryErr);
                return callback(queryErr, null);
              }

              callback(null, results);
            }
          );
        }
      );
    });
  },

  delete: (id, callback) => {
    const sql = `
      DELETE FROM \`packages\`
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
        connectionRelease(connection); // Release the connection

        if (queryErr) {
          console.error("Database query error: 45", queryErr);
          return callback(queryErr, null);
        }

        callback(null, results);
      });
    });
  },
};

module.exports = Package;
