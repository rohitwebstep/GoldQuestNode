const {
  pool,
  startConnection,
  connectionRelease,
} = require("../../../config/db");

const replaceEmptyWithNull = (value) => {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(",") : null; // Convert array to comma-separated string or return null if empty
  } else if (typeof value === "string") {
    return value.trim() !== "" ? value : null; // Trim and check if not empty
  } else {
    return value || null; // Return value if truthy, otherwise null
  }
};
const candidateApplication = {
  // Method to check if an email has been used before
  isEmailUsedBefore: (email, branch_id, callback) => {
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      const emailCheckSql = `
        SELECT COUNT(*) as count
        FROM \`candidate_applications\`
        WHERE \`email\` = ? AND \`branch_id\` = ?
      `;

      connection.query(
        emailCheckSql,
        [email, branch_id],
        (err, emailCheckResults) => {
          connectionRelease(connection); // Ensure connection is released

          if (err) {
            console.error(
              "Error checking email in candidate_applications:",
              err
            );
            return callback(err, null);
          }

          const emailExists = emailCheckResults[0].count > 0;
          return callback(null, emailExists);
        }
      );
    });
  },

  // Method to create a new candidate application
  create: (data, callback) => {
    const {
      branch_id,
      name,
      employee_id,
      mobile_number,
      email,
      services,
      package,
      purpose_of_application,
      nationality,
      customer_id,
    } = data;

    const sql = `
        INSERT INTO \`candidate_applications\` (
          \`branch_id\`,
          \`name\`,
          \`employee_id\`,
          \`mobile_number\`,
          \`email\`,
          \`services\`,
          \`package\`,
          \`purpose_of_application\`,
          \`nationality\`,
          \`customer_id\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

    const values = [
      replaceEmptyWithNull(branch_id),
      replaceEmptyWithNull(name),
      replaceEmptyWithNull(employee_id),
      replaceEmptyWithNull(mobile_number),
      replaceEmptyWithNull(email),
      replaceEmptyWithNull(services),
      replaceEmptyWithNull(package),
      replaceEmptyWithNull(purpose_of_application),
      replaceEmptyWithNull(nationality),
      replaceEmptyWithNull(customer_id),
    ];

    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      connection.query(sql, values, (err, results) => {
        connectionRelease(connection); // Ensure connection is released

        if (err) {
          console.error("Database query error: 99", err);
          return callback(err, null);
        }
        callback(null, results);
      });
    });
  },

  list: (branch_id, callback) => {
    const sql =
      "SELECT * FROM `candidate_applications` WHERE `branch_id` = ? ORDER BY created_at DESC";

    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      connection.query(sql, [branch_id], (err, results) => {
        if (err) {
          console.error("Database query error: 100", err);
          connectionRelease(connection); // Ensure connection is released
          return callback(err, null);
        }

        const finalResults = [];
        const servicePromises = results.map((application) => {
          return new Promise((resolve, reject) => {
            // Extract service IDs
            const servicesIds = application.services
              ? application.services.split(",")
              : [];

            if (servicesIds.length === 0) {
              finalResults.push({ ...application, serviceNames: "" });
              return resolve(); // No services to fetch
            }

            // Query for service titles
            const servicesQuery =
              "SELECT title FROM `services` WHERE id IN (?)";
            connection.query(
              servicesQuery,
              [servicesIds],
              (err, servicesResults) => {
                if (err) {
                  console.error("Database query error for services:", err);
                  return reject(err);
                }

                const servicesTitles = servicesResults.map(
                  (service) => service.title
                );

                finalResults.push({
                  ...application,
                  serviceNames: servicesTitles, // Add services titles to the result
                });
                resolve();
              }
            );
          });
        });

        Promise.all(servicePromises)
          .then(() => {
            connectionRelease(connection); // Ensure connection is released
            callback(null, finalResults);
          })
          .catch((err) => {
            connectionRelease(connection); // Ensure connection is released
            callback(err, null);
          });
      });
    });
  },

  checkUniqueEmpId: (branch_id, candidateUniqueEmpId, callback) => {
    const sql = `
      SELECT COUNT(*) AS count
      FROM \`candidate_applications\`
      WHERE \`employee_id\` = ? AND \`branch_id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      connection.query(sql, [candidateUniqueEmpId, branch_id], (err, results) => {
        connectionRelease(connection); // Ensure connection is released

        if (err) {
          console.error("Database query error: 101", err);
          return callback(
            { message: "Database query error", error: err },
            null
          );
        }

        const count = results[0].count;
        callback(null, count > 0);
      });
    });
  },

  checkUniqueEmpIdByCandidateApplicationID: (
    branch_id,
    application_id,
    candidateUniqueEmpId,
    callback
  ) => {
    const sql = `
      SELECT COUNT(*) AS count
      FROM \`candidate_applications\`
      WHERE \`employee_id\` = ? AND id = ? AND \`branch_id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      connection.query(
        sql,
        [candidateUniqueEmpId, application_id, branch_id],
        (err, results) => {
          connectionRelease(connection); // Ensure connection is released

          if (err) {
            console.error("Database query error: 102", err);
            return callback(
              { message: "Database query error", error: err },
              null
            );
          }

          const count = results[0].count;
          callback(null, count > 0);
        }
      );
    });
  },

  getCandidateApplicationById: (id, callback) => {
    const sql = "SELECT * FROM `candidate_applications` WHERE id = ?";

    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      connection.query(sql, [id], (err, results) => {
        connectionRelease(connection); // Ensure connection is released

        if (err) {
          console.error("Database query error: 103", err);
          return callback(err, null);
        }
        callback(null, results[0]);
      });
    });
  },

  update: (data, candidate_application_id, callback) => {
    const { name, employee_id, mobile_number, email, services, package, purpose_of_application, nationality } = data;

    const sql = `
      UPDATE \`candidate_applications\`
      SET
        \`name\` = ?,
        \`employee_id\` = ?,
        \`mobile_number\` = ?,
        \`email\` = ?,
        \`services\` = ?,
        \`package\` = ?,
        \`purpose_of_application\` = ?,
        \`nationality\` = ?
      WHERE
        \`id\` = ?
    `;

    const values = [
      replaceEmptyWithNull(name),
      replaceEmptyWithNull(employee_id),
      replaceEmptyWithNull(mobile_number),
      replaceEmptyWithNull(email),
      replaceEmptyWithNull(services),
      replaceEmptyWithNull(package),
      replaceEmptyWithNull(purpose_of_application),
      replaceEmptyWithNull(nationality),
      replaceEmptyWithNull(candidate_application_id),
    ];

    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      connection.query(sql, values, (err, results) => {
        connectionRelease(connection); // Ensure connection is released

        if (err) {
          console.error("Database query error: 104", err);
          return callback(err, null);
        }
        callback(null, results);
      });
    });
  },

  delete: (id, callback) => {
    const sql = "DELETE FROM `candidate_applications` WHERE `id` = ?";

    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      connection.query(sql, [id], (err, results) => {
        connectionRelease(connection); // Ensure connection is released

        if (err) {
          console.error("Database query error: 105", err);
          return callback(err, null);
        }
        callback(null, results);
      });
    });
  },

  isApplicationExist: (app_id, branch_id, customer_id, callback) => {
    const sql = `SELECT CA.*, C.is_custom_bgv AS is_custom_bgv, C.name AS customer_name, B.name AS branch_name
      FROM candidate_applications AS CA 
      INNER JOIN customers AS C ON C.id = CA.customer_id
      INNER JOIN branches AS B ON B.id = CA.branch_id
      WHERE CA.id = ? 
        AND CA.branch_id = ? 
        AND CA.customer_id = ?`;

    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      connection.query(
        sql,
        [app_id, branch_id, customer_id],
        (err, results) => {
          if (err) {
            console.error("Database query error: 106", err);
            return callback(err, null);
          }

          // Return the entry if it exists, or false otherwise
          const entry = results.length > 0 ? results[0] : false;
          connectionRelease(connection);
          callback(null, entry);
        }
      );
    });
  },
};

module.exports = candidateApplication;
