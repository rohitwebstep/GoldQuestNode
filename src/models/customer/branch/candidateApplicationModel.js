const {
  pool,
  startConnection,
  connectionRelease,
} = require("../../../config/db");

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
          \`customer_id\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

    const values = [
      branch_id,
      name,
      employee_id,
      mobile_number,
      email,
      services || "",
      package || "",
      customer_id,
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
        connectionRelease(connection); // Ensure connection is released

        if (err) {
          console.error("Database query error: 100", err);
          return callback(err, null);
        }
        callback(null, results);
      });
    });
  },

  checkUniqueEmpId: (candidateUniqueEmpId, callback) => {
    const sql = `
      SELECT COUNT(*) AS count
      FROM \`candidate_applications\`
      WHERE \`employee_id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      connection.query(sql, [candidateUniqueEmpId], (err, results) => {
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
    application_id,
    candidateUniqueEmpId,
    callback
  ) => {
    const sql = `
      SELECT COUNT(*) AS count
      FROM \`candidate_applications\`
      WHERE \`employee_id\` = ? AND id = ?
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
        [candidateUniqueEmpId, application_id],
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
    const { name, employee_id, mobile_number, email, services, package } = data;

    const sql = `
      UPDATE \`candidate_applications\`
      SET
        \`name\` = ?,
        \`employee_id\` = ?,
        \`mobile_number\` = ?,
        \`email\` = ?,
        \`services\` = ?,
        \`package\` = ?
      WHERE
        \`id\` = ?
    `;

    const values = [
      name,
      employee_id,
      mobile_number,
      email,
      services,
      package,
      candidate_application_id,
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
    const sql =
      "SELECT * FROM `candidate_applications` WHERE `id` = ? AND `branch_id` = ? AND `customer_id` = ?";

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
          connectionRelease(connection); // Ensure connection is released

          if (err) {
            console.error("Database query error: 106", err);
            return callback(err, null);
          }

          // Return the entry if it exists, or false otherwise
          const entry = results.length > 0 ? results[0] : false;
          callback(null, entry);
        }
      );
    });
  },
};

module.exports = candidateApplication;
