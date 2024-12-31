const { pool, startConnection, connectionRelease } = require("../../config/db");

const Service = {
  create: (title, description, short_code, group, sac_code, admin_id, callback) => {
    // Step 1: Check if a service with the same title already exists
    const checkServiceSql = `
    SELECT * FROM \`services\` WHERE \`title\` = ? OR \`short_code\` = ?
  `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(
        checkServiceSql,
        [title, short_code],
        (checkErr, serviceResults) => {
          if (checkErr) {
            console.error("Error checking service:", checkErr);
            connectionRelease(connection); // Release connection on error
            return callback(checkErr, null);
          }

          // Step 2: If a service with the same title, short code, or sac code exists, return specific error
          if (serviceResults.length > 0) {
            let errorMessage =
              "Service with the following values already exists: ";

            const titleExists = serviceResults.some(
              (result) => result.title.toLowerCase() === title.toLowerCase()
            );
            if (titleExists) {
              errorMessage += "`title` ";
            }

            const shortCodeExists = serviceResults.some(
              (result) =>
                result.short_code.toLowerCase() === short_code.toLowerCase()
            );

            if (shortCodeExists) {
              errorMessage += "`short_code` ";
            }

            connectionRelease(connection); // Release connection before returning error
            return callback({ message: errorMessage }, null);
          }

          // Step 3: Insert the new service
          const insertServiceSql = `
          INSERT INTO \`services\` (\`title\`, \`description\`, \`short_code\`, \`group\`, \`sac_code\`, \`admin_id\`)
          VALUES (?, ?, ?, ?, ?, ?)
        `;

          connection.query(
            insertServiceSql,
            [title, description, short_code, group, sac_code, admin_id],
            (insertErr, results) => {
              connectionRelease(connection); // Release the connection

              if (insertErr) {
                console.error("Database query error: 46", insertErr);
                return callback(insertErr, null);
              }
              callback(null, results);
            }
          );
        }
      );
    });
  },

  list: (callback) => {
    const sql = `SELECT * FROM \`services\``;

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

  digitlAddressService: (callback) => {
    const sql = `
      SELECT * FROM \`services\`
      WHERE LOWER(\`title\`) LIKE '%digital%'
      AND (LOWER(\`title\`) LIKE '%verification%' OR LOWER(\`title\`) LIKE '%address%')
      LIMIT 1
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, (queryErr, results) => {
        connectionRelease(connection); // Release the connection

        if (queryErr) {
          console.error("Database query error: 48", queryErr);
          return callback(queryErr, null);
        }

        // Check if results are found and return the first entry or null if not found
        const singleEntry = results.length > 0 ? results[0] : null;
        callback(null, singleEntry); // Return single entry or null if not found
      });
    });
  },

  getServiceById: (id, callback) => {
    const sql = `SELECT * FROM \`services\` WHERE \`id\` = ?`;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
        connectionRelease(connection); // Release the connection

        if (queryErr) {
          console.error("Database query error: 49", queryErr);
          return callback(queryErr, null);
        }
        callback(null, results[0]);
      });
    });
  },

  getServiceRequiredDocumentsByServiceId: (service_id, callback) => {
    const sql = `SELECT * FROM \`service_required_documents\` WHERE \`service_id\` = ?`;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [service_id], (queryErr, results) => {
        connectionRelease(connection); // Release the connection

        if (queryErr) {
          console.error("Database query error: 50", queryErr);
          return callback(queryErr, null);
        }
        callback(null, results[0]);
      });
    });
  },

  update: (id, title, description, short_code, sac_code, callback) => {
    // Step 1: Check if a service with the same title already exists
    const checkServiceSql = `
        SELECT * FROM \`services\` WHERE \`title\` = ? OR \`short_code\` = ? AND \`id\` != ?
      `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(
        checkServiceSql,
        [title, short_code, id],
        (checkErr, serviceResults) => {
          if (checkErr) {
            console.error("Error checking service:", checkErr);
            connectionRelease(connection); // Release connection on error
            return callback(checkErr, null);
          }

          // Step 2: If a service with the same title, short code, or sac code exists, return specific error
          if (serviceResults.length > 0) {
            let errorMessage =
              "Service with the following values already exists: ";

            const titleExists = serviceResults.some(
              (result) => result.title.toLowerCase() === title.toLowerCase()
            );
            if (titleExists) {
              errorMessage += "`title` ";
            }

            const shortCodeExists = serviceResults.some(
              (result) =>
                result.short_code.toLowerCase() === short_code.toLowerCase()
            );

            if (shortCodeExists) {
              errorMessage += "`short_code` ";
            }

            connectionRelease(connection); // Release connection before returning error
            return callback({ message: errorMessage }, null);
          }
          const sql = `
                      UPDATE \`services\`
                      SET \`title\` = ?, \`description\` = ? , \`short_code\` = ?, \`sac_code\` = ?
                      WHERE \`id\` = ?
                    `;

          startConnection((err, connection) => {
            if (err) {
              return callback(err, null);
            }

            connection.query(
              sql,
              [title, description, short_code, sac_code, id],
              (queryErr, results) => {
                connectionRelease(connection); // Release the connection

                if (queryErr) {
                  console.error(" 51", queryErr);
                  return callback(queryErr, null);
                }
                callback(null, results);
              }
            );
          });
        }
      );
    });
  },

  delete: (id, callback) => {
    const sql = `
      DELETE FROM \`services\`
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
        connectionRelease(connection); // Release the connection

        if (queryErr) {
          console.error("Database query error: 51", queryErr);
          return callback(queryErr, null);
        }
        callback(null, results);
      });
    });
  },
};

module.exports = Service;
