const {
  pool,
  startConnection,
  connectionRelease,
} = require("../../../config/db");

const subUser = {
  create: (data, callback) => {
    const { branch_id, customer_id, email, password } = data;

    // Start DB connection
    startConnection((err, connection) => {
      if (err) {
        console.error("Failed to connect to the database:", err);
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      // Check if the email already exists for the given branch_id
      const checkEmailSql = `
            SELECT * FROM \`branch_sub_users\`
            WHERE \`email\` = ? AND \`branch_id\` = ?
        `;

      connection.query(checkEmailSql, [email, branch_id], (err, results) => {
        if (err) {
          console.error("Error checking email existence:", err);
          connectionRelease(connection);
          return callback(err, null);
        }

        // If email already exists, return error
        if (results.length > 0) {
          connectionRelease(connection);
          return callback(
            { message: "Email is already associated with this branch." },
            null
          );
        }

        // SQL query for inserting a new record into branch_sub_users
        const insertSql = `
                INSERT INTO \`branch_sub_users\` (
                  \`branch_id\`,
                  \`customer_id\`,
                  \`email\`,
                  \`password\`
                ) VALUES (?, ?, ?, ?)
            `;

        const values = [branch_id, customer_id, email, password];

        connection.query(insertSql, values, (err, results) => {
          if (err) {
            console.error("Error inserting branch sub-user:", err);
            connectionRelease(connection);
            return callback(err, null);
          }

          // Assuming you want to send the `new_application_id` back, you should extract it from `results.insertId`
          const new_application_id = results.insertId;

          // SQL query for fetching branch and customer names
          const branchCustomerSql = `
                    SELECT 
                        B.name AS branch_name, 
                        C.name AS customer_name 
                    FROM \`branches\` AS B 
                    INNER JOIN \`customers\` AS C 
                    ON B.customer_id = C.id 
                    WHERE B.id = ? AND C.id = ?
                `;

          const branchCustomerValues = [branch_id, customer_id];

          connection.query(
            branchCustomerSql,
            branchCustomerValues,
            (branchCustomerErr, branchCustomerResults) => {
              // Release connection after query execution
              connectionRelease(connection);

              if (branchCustomerErr) {
                console.error(
                  "Error fetching branch and customer names:",
                  branchCustomerErr
                );
                return callback(branchCustomerErr, null);
              }

              if (branchCustomerResults.length === 0) {
                return callback(
                  { message: "Branch or customer not found." },
                  null
                );
              }

              const { branch_name, customer_name } = branchCustomerResults[0];

              return callback(null, {
                new_application_id,
                branch_name,
                customer_name,
              });
            }
          );
        });
      });
    });
  },

  getSubUserById: (id, callback) => {
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      const sql = `SELECT * FROM \`branch_sub_users\` WHERE \`id\` = ?`;
      connection.query(sql, [id], (err, results) => {
        connectionRelease(connection); // Ensure connection is released

        if (err) {
          console.error("Database query error: 89", err);
          return callback(err, null);
        }

        if (results.length === 0) {
          return callback(null, null);
        }

        callback(null, results[0]);
      });
    });
  },
  list: (branch_id, callback) => {
    // Start DB connection
    startConnection((err, connection) => {
      if (err) {
        console.error("Failed to connect to the database:", err);
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      // SQL query to fetch sub-user details for a specific branch
      const sqlClient = `
          SELECT id, email
          FROM branch_sub_users
          WHERE branch_id = ?
        `;

      connection.query(sqlClient, [branch_id], (err, subUserResults) => {
        // Release connection after query execution
        connectionRelease(connection);

        if (err) {
          console.error("Database query error: 110", err);
          return callback(
            { message: "Error retrieving sub-users", error: err },
            null
          );
        }

        // If no results are found, return an empty array
        if (subUserResults.length === 0) {
          return callback(null, {
            message: "No sub-users found for this branch.",
            data: [],
          });
        }

        // Return the list of sub-users
        return callback(null, subUserResults);
      });
    });
  },

  updateEmail: (data, callback) => {
    const { id, branch_id, customer_id, email } = data;

    // Start DB connection
    startConnection((err, connection) => {
      if (err) {
        console.error("Failed to connect to the database:", err);
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      // Check if the email already exists for the given branch_id, excluding the current record (id)
      const checkEmailSql = `
          SELECT * FROM \`branch_sub_users\` WHERE \`email\` = ? AND \`branch_id\` = ? AND \`id\` != ?
        `;

      connection.query(
        checkEmailSql,
        [email, branch_id, id],
        (err, results) => {
          if (err) {
            console.error("Error checking email existence:", err);
            connectionRelease(connection);
            return callback(err, null);
          }

          // If email already exists, return error
          if (results.length > 0) {
            connectionRelease(connection);
            return callback(
              { message: "Email is already associated with this branch." },
              null
            );
          }

          // SQL query for updating the record in branch_sub_users
          const updateSql = `
            UPDATE \`branch_sub_users\` 
            SET 
              \`branch_id\` = ?, 
              \`customer_id\` = ?, 
              \`email\` = ?
            WHERE \`id\` = ?
          `;

          const values = [branch_id, customer_id, email, id];

          connection.query(updateSql, values, (err, results) => {
            // Release connection after query execution
            connectionRelease(connection);

            if (err) {
              console.error("Database query error: 109", err);
              return callback(err, null);
            }

            return callback(null, {
              results,
              message: "Record updated successfully.",
            });
          });
        }
      );
    });
  },

  updatePassword: (data, callback) => {
    const { id, branch_id, customer_id, password } = data;

    // Start DB connection
    startConnection((err, connection) => {
      if (err) {
        console.error("Failed to connect to the database:", err);
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      try {
        // SQL query for updating the record in branch_sub_users
        const updateSql = `
                  UPDATE \`branch_sub_users\` 
                  SET 
                      \`branch_id\` = ?, 
                      \`customer_id\` = ?, 
                      \`password\` = md5(?)
                  WHERE \`id\` = ?
              `;

        const values = [branch_id, customer_id, password, id];

        // Execute the query
        connection.query(updateSql, values, (err, results) => {
          // Release connection after query execution
          connectionRelease(connection);

          if (err) {
            console.error("Database query error:", err);
            return callback(
              { message: "Error updating the record", error: err },
              null
            );
          }

          // Handle no rows affected
          if (results.affectedRows === 0) {
            return callback(
              { message: "No record found with the given ID." },
              null
            );
          }

          // Success
          return callback(null, {
            results,
            message: "Record updated successfully.",
          });
        });
      } catch (error) {
        // Release connection and handle unexpected errors
        connectionRelease(connection);
        console.error("Unexpected error:", error);
        return callback({ message: "Unexpected error occurred", error }, null);
      }
    });
  },

  updateStatus: (status, client_application_id, callback) => {
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      const sql = `
        UPDATE \`client_applications\`
        SET
          \`status\` = ?
        WHERE
          \`id\` = ?
      `;

      connection.query(sql, [status, client_application_id], (err, results) => {
        connectionRelease(connection); // Ensure the connection is released

        if (err) {
          console.error("Database query error: 115", err);
          return callback(err, null);
        }
        callback(null, results);
      });
    });
  },

  delete: (id, callback) => {
    // Start database connection
    startConnection((err, connection) => {
      if (err) {
        console.error("Failed to connect to the database:", err);
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }

      // SQL query to delete the record
      const deleteSql = `DELETE FROM branch_sub_users WHERE id = ?`;

      connection.query(deleteSql, [id], (err, results) => {
        // Release the connection after query execution
        connectionRelease(connection);

        if (err) {
          console.error("Database query error:", err);
          return callback(
            {
              message: "An error occurred while deleting the record.",
              error: err,
            },
            null
          );
        }

        // Check if any rows were affected (i.e., if the record was deleted)
        if (results.affectedRows === 0) {
          return callback(
            { message: "No record found with the provided ID." },
            null
          );
        }

        // Successfully deleted
        callback(null, {
          message: "Record deleted successfully.",
          affectedRows: results.affectedRows,
        });
      });
    });
  },
};

module.exports = subUser;
