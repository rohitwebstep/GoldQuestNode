const { pool, startConnection, connectionRelease } = require("../../config/db");

const Admin = {
  list: (callback) => {
    const sql = `SELECT \`id\`, \`emp_id\`, \`name\`, \`role\`, \`profile_picture\`, \`email\`, \`service_groups\`, \`status\`, \`mobile\` FROM \`admins\``;

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

  create: (data, callback) => {
    const { name, mobile, email, employee_id, role, password, service_groups } = data;

    // SQL query to check if any field already exists in the admins table
    const checkExistingQuery = `
      SELECT * FROM \`admins\` WHERE \`email\` = ? OR \`mobile\` = ? OR \`emp_id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      // Check if any field already exists in the admins table
      connection.query(
        checkExistingQuery,
        [email, mobile, employee_id],
        (checkErr, results) => {
          if (checkErr) {
            connectionRelease(connection); // Release connection on error
            return callback(checkErr, null);
          }

          // If results are found, check which fields are already in use
          if (results.length > 0) {
            const usedFields = [];

            // Iterate over all results
            for (let i = 0; i < results.length; i++) {
              const existingAdmin = results[i];

              // Check if any field is a duplicate
              if (existingAdmin.email === email) {
                usedFields.push("email");
              }

              if (existingAdmin.mobile === mobile) {
                usedFields.push("mobile");
              }

              if (existingAdmin.emp_id === employee_id) {
                usedFields.push("Employee ID");
              }
            }

            // If there are any duplicate fields, release connection and return the error message
            if (usedFields.length > 0) {
              connectionRelease(connection); // Release connection if duplicates found

              // Log the message being returned to the callback
              return callback(
                {
                  message: `Another admin is registered with the following ${usedFields.join(
                    " and "
                  )}.`,
                },
                null
              );
            }
          }

          // If role is 'admin', we don't include the service_groups field
          let sql;
          let queryParams;

          if (role.toLowerCase() === 'admin') {
            sql = `
              INSERT INTO \`admins\` (\`name\`, \`emp_id\`, \`mobile\`, \`email\`, \`role\`, \`status\`, \`password\`) 
              VALUES (?, ?, ?, ?, ?, ?, md5(?))
            `;
            queryParams = [name, employee_id, mobile, email, role, "1", password];
          } else {
            sql = `
              INSERT INTO \`admins\` (\`name\`, \`emp_id\`, \`mobile\`, \`email\`, \`role\`, \`service_groups\`, \`status\`, \`password\`) 
              VALUES (?, ?, ?, ?, ?, ?, ?, md5(?))
            `;
            queryParams = [name, employee_id, mobile, email, role, JSON.stringify(service_groups), "1", password];
          }

          // Insert the new admin
          connection.query(sql, queryParams, (queryErr, results) => {
            connectionRelease(connection); // Release the connection

            if (queryErr) {
              console.error("Database query error: 612", queryErr);
              return callback(queryErr, null);
            }
            callback(null, results); // Successfully inserted the admin
          });
        }
      );
    });
  },


  update: (data, callback) => {
    const { id, name, mobile, email, employee_id, role, status, service_groups } = data;

    // SQL query to check if any field already exists in the admins table
    const checkExistingQuery = `
      SELECT * FROM \`admins\` 
      WHERE (\`email\` = ? OR \`mobile\` = ? OR \`emp_id\` = ?) AND \`id\` != ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      // Check if any field already exists in the admins table
      connection.query(
        checkExistingQuery,
        [email, mobile, employee_id, id],
        (checkErr, results) => {
          if (checkErr) {
            connectionRelease(connection); // Release connection on error
            return callback(checkErr, null);
          }

          // If results are found, check which fields are already in use
          if (results.length > 0) {
            const existingAdmin = results[0];
            const usedFields = [];

            if (existingAdmin.email === email) usedFields.push("email");
            if (existingAdmin.mobile === mobile) usedFields.push("mobile");
            if (existingAdmin.emp_id === employee_id)
              usedFields.push("Employee ID");

            if (usedFields.length > 0) {
              connectionRelease(connection); // Release connection if duplicates found
              return callback(
                `Another admin is registered with the following ${usedFields.join(
                  " and "
                )}.`,
                null
              );
            }
          }

          // If role is 'admin', we don't include the service_groups field in the update
          let sql;
          let queryParams;

          if (role.toLowerCase() === 'admin') {
            sql = `
              UPDATE \`admins\` 
              SET 
                \`name\` = ?, 
                \`emp_id\` = ?, 
                \`mobile\` = ?, 
                \`email\` = ?, 
                \`role\` = ?, 
                \`status\` = ? 
              WHERE \`id\` = ?
            `;
            queryParams = [name, employee_id, mobile, email, role, status, id];
          } else {
            sql = `
              UPDATE \`admins\` 
              SET 
                \`name\` = ?, 
                \`emp_id\` = ?, 
                \`mobile\` = ?, 
                \`email\` = ?, 
                \`role\` = ?, 
                \`service_groups\` = ?, 
                \`status\` = ? 
              WHERE \`id\` = ?
            `;
            queryParams = [name, employee_id, mobile, email, role, JSON.stringify(service_groups), status, id];
          }

          // Update the admin record
          connection.query(sql, queryParams, (queryErr, results) => {
            connectionRelease(connection); // Release the connection

            if (queryErr) {
              console.error("Database query error: 7", queryErr);
              return callback(queryErr, null);
            }
            callback(null, results); // Successfully updated the admin
          });
        }
      );
    });
  },

  delete: (id, callback) => {
    const sql = `
      DELETE FROM \`admins\`
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
        connectionRelease(connection); // Release the connection

        if (queryErr) {
          console.error("Database query error: 8", queryErr);
          return callback(queryErr, null);
        }
        callback(null, results);
      });
    });
  },

  upload: (id, savedImagePaths, callback) => {
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      const sqlUpdateCustomer = `
      UPDATE admins 
      SET profile_picture = ?
      WHERE id = ?
    `;
      const joinedPaths = savedImagePaths.join(", ");
      // Prepare the parameters for the query
      const queryParams = [joinedPaths, id];

      connection.query(sqlUpdateCustomer, queryParams, (err, results) => {
        connectionRelease(connection); // Ensure the connection is released

        if (err) {
          // Return error details and the final query with parameters
          return callback(false, {
            error: "Database error occurred.",
            details: err, // Include error details for debugging
            query: sqlUpdateCustomer,
            params: queryParams, // Return the parameters used in the query
          });
        }

        // Check if any rows were affected by the update
        if (results.affectedRows > 0) {
          return callback(true, results); // Success with results
        } else {
          // No rows updated, return a specific message along with the query details
          return callback(false, {
            error: "No rows updated. Please check the Admin ID.",
            details: results,
            query: sqlUpdateCustomer,
            params: queryParams, // Return the parameters used in the query
          });
        }
      });
    });
  },

  findByEmailOrMobile: (username, callback) => {
    const sql = `
      SELECT \`id\`, \`emp_id\`, \`name\`, \`profile_picture\`, \`email\`, \`mobile\`, \`status\`, \`login_token\`, \`token_expiry\`, \`otp\`, \`two_factor_enabled\`, \`otp_expiry\`
      FROM \`admins\`
      WHERE \`email\` = ? OR \`mobile\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [username, username], (queryErr, results) => {
        if (queryErr) {
          console.error("Database query error: 5", queryErr);
          return callback(
            { message: "Database query error", error: queryErr },
            null
          );
        }

        if (results.length === 0) {
          return callback(
            { message: "No admin found with the provided email or mobile" },
            null
          );
        }
        connectionRelease(connection);
        callback(null, results);
      });
    });
  },

  findByEmailOrMobileAllInfo: (username, callback) => {
    const sql = `
      SELECT *
      FROM \`admins\`
      WHERE \`email\` = ? OR \`mobile\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [username, username], (queryErr, results) => {
        connectionRelease(connection); // Release the connection

        if (queryErr) {
          console.error("Database query error: 6", queryErr);
          return callback(
            { message: "Database query error", error: queryErr },
            null
          );
        }

        if (results.length === 0) {
          return callback(
            { message: "No admin found with the provided email or mobile" },
            null
          );
        }

        callback(null, results);
      });
    });
  },

  validatePassword: (username, password, callback) => {
    const sql = `
      SELECT \`id\`, \`emp_id\`, \`name\`, \`profile_picture\`, \`email\`, \`mobile\`, \`status\`
      FROM \`admins\`
      WHERE (\`email\` = ? OR \`mobile\` = ?)
      AND \`password\` = MD5(?)
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(
        sql,
        [username, username, password],
        (queryErr, results) => {
          connectionRelease(connection); // Release the connection

          if (queryErr) {
            console.error("Database query error: 7", queryErr);
            return callback(
              { message: "Database query error", error: queryErr },
              null
            );
          }

          if (results.length === 0) {
            return callback(
              { message: "Incorrect password or username" },
              null
            );
          }

          callback(null, results);
        }
      );
    });
  },

  updatePassword: (new_password, admin_id, callback) => {
    const sql = `UPDATE \`admins\` SET \`password\` = MD5(?), \`reset_password_token\` = null, \`login_token\` = null, \`token_expiry\` = null, \`password_token_expiry\` = null WHERE \`id\` = ?`;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [new_password, admin_id], (queryErr, results) => {
        connectionRelease(connection); // Release the connection

        if (queryErr) {
          console.error("Database query error: 8", queryerr);
          return callback(
            {
              message: "An error occurred while updating the password.",
              error: queryErr,
            },
            null
          );
        }

        // Check if the admin_id was found and the update affected any rows
        if (results.affectedRows === 0) {
          return callback(
            {
              message:
                "Admin not found or password not updated. Please check the provided details.",
            },
            null
          );
        }

        callback(null, {
          message: "Password updated successfully.",
          affectedRows: results.affectedRows,
        });
      });
    });
  },

  updateOTP: (admin_id, otp, otp_expiry, callback) => {
    const sql = `UPDATE \`admins\` SET \`otp\` = ?, \`otp_expiry\` = ?,  \`reset_password_token\` = null, \`login_token\` = null, \`token_expiry\` = null, \`password_token_expiry\` = null WHERE \`id\` = ?`;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(
        sql,
        [otp, otp_expiry, admin_id],
        (queryErr, results) => {
          connectionRelease(connection); // Release the connection

          if (queryErr) {
            console.error("Database query error: 8", queryErr);
            return callback(
              {
                message: "An error occurred while updating the password.",
                error: queryErr,
              },
              null
            );
          }

          // Check if the admin_id was found and the update affected any rows
          if (results.affectedRows === 0) {
            return callback(
              {
                message:
                  "Admin not found or password not updated. Please check the provided details.",
              },
              null
            );
          }

          callback(null, {
            message: "Password updated successfully.",
            affectedRows: results.affectedRows,
          });
        }
      );
    });
  },

  updateToken: (id, token, tokenExpiry, callback) => {
    const sql = `
      UPDATE \`admins\`
      SET \`login_token\` = ?, \`token_expiry\` = ?
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [token, tokenExpiry, id], (queryErr, results) => {
        connectionRelease(connection); // Release the connection

        if (queryErr) {
          console.error("Database query error: 9", queryErr);
          return callback(
            { message: "Database update error", error: queryErr },
            null
          );
        }

        if (results.affectedRows === 0) {
          return callback(
            {
              message:
                "Token update failed. Admin not found or no changes made.",
            },
            null
          );
        }
        callback(null, results);
      });
    });
  },

  setResetPasswordToken: (id, token, tokenExpiry, callback) => {
    const sql = `
      UPDATE \`admins\`
      SET \`reset_password_token\` = ?, \`password_token_expiry\` = ?
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [token, tokenExpiry, id], (queryErr, results) => {
        connectionRelease(connection); // Release the connection

        if (queryErr) {
          console.error("Database query error: 10", queryErr);
          return callback(
            { message: "Database update error", error: queryErr },
            null
          );
        }

        if (results.affectedRows === 0) {
          return callback(
            {
              message:
                "Token update failed. Admin not found or no changes made.",
            },
            null
          );
        }

        callback(null, results);
      });
    });
  },

  validateLogin: (id, callback) => {
    const sql = `
      SELECT \`login_token\`, \`token_expiry\`
      FROM \`admins\`
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
        connectionRelease(connection); // Release the connection

        if (queryErr) {
          console.error("Database query error: 11", queryErr);
          return callback(
            { message: "Database query error", error: queryErr },
            null
          );
        }

        if (results.length === 0) {
          return callback({ message: "Admin not found" }, null);
        }

        callback(null, results);
      });
    });
  },

  // Clear login token and token expiry
  logout: (id, callback) => {
    const sql = `
        UPDATE \`admins\`
        SET \`login_token\` = NULL, \`token_expiry\` = NULL
        WHERE \`id\` = ?
      `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
        connectionRelease(connection); // Release the connection

        if (queryErr) {
          console.error("Database query error: 12", queryErr);
          return callback(
            { message: "Database update error", error: queryErr },
            null
          );
        }

        if (results.affectedRows === 0) {
          return callback(
            {
              message:
                "Token clear failed. Admin not found or no changes made.",
            },
            null
          );
        }

        callback(null, results);
      });
    });
  },

  findById: (id, callback) => {
    const sql = `
      SELECT \`id\`, \`emp_id\`, \`name\`, \`profile_picture\`, \`email\`, \`mobile\`, \`status\`, \`login_token\`, \`token_expiry\`
      FROM \`admins\`
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
        if (queryErr) {
          console.error("Database query error: 13", queryErr);
          return callback(
            { message: "Database query error", error: queryErr },
            null
          );
        }

        if (results.length === 0) {
          return callback({ message: "Admin not found" }, null);
        }
        connectionRelease(connection);
        callback(null, results[0]); // Return the first result (should be one result if ID is unique)
      });
    });
  },

  fetchAllowedServiceIds: (id, callback) => {
    const sql = `
      SELECT \`service_groups\`, \`role\` FROM \`admins\`
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        console.error("Connection error:", err);
        return callback(err, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
        if (queryErr) {
          console.error("Database query error: 13", queryErr);
          return callback(
            { message: "Database query error", error: queryErr },
            null
          );
        }

        if (results.length === 0) {
          return callback({ message: "Admin not found" }, null);
        }

        const role = results[0].role;
        const serviceGroups = results[0].service_groups;
        let finalServiceIds = []; // Initialize as an empty array
        let servicePromises = [];
        let isaddressServiceAllowed = false;

        // Check if the role is not "admin"
        if (role !== 'admin') {
          try {
            // Parse the service_groups JSON string to an array
            const serviceGroupsArray = JSON.parse(serviceGroups);

            // Create promises for each service group query
            serviceGroupsArray.forEach((serviceGroup, index) => {
              // Check if the service group contains 'address' (case-insensitive)
              if (serviceGroup.toLowerCase().includes('address')) {
                isaddressServiceAllowed = true;
              }
              const serviceSql = `
                SELECT id FROM services WHERE \`group\` = ?
              `;

              // Create a promise for the query
              const queryPromise = new Promise((resolve, reject) => {
                connection.query(serviceSql, [serviceGroup], (serviceQueryErr, serviceResults) => {
                  if (serviceQueryErr) {
                    console.error("Error fetching service IDs for group:", serviceQueryErr);
                    reject(serviceQueryErr); // Reject on error
                  } else {
                    if (serviceResults.length > 0) {
                      serviceResults.forEach(service => {
                        finalServiceIds.push(service.id); // Add service ID to finalServiceIds
                      });
                    }
                    resolve(); // Resolve once the results are processed
                  }
                });
              });

              servicePromises.push(queryPromise); // Push promise into array
            });

            // Wait for all promises to resolve before calling callback
            Promise.all(servicePromises)
              .then(() => {
                // Once all service IDs are fetched, release the connection and return the result
                connectionRelease(connection);
                callback(null, { finalServiceIds, addressServicesPermission: isaddressServiceAllowed }); // Return the final service IDs and permission
              })
              .catch((err) => {
                console.error("Error while fetching service IDs:", err);
                connectionRelease(connection);
                callback({ message: "Error fetching service IDs", error: err }, null);
              });

          } catch (parseErr) {
            console.error("Error parsing service_groups JSON:", parseErr);
            connectionRelease(connection);
            return callback(
              { message: "Error parsing service_groups data", error: parseErr },
              null
            );
          }
        } else {
          connectionRelease(connection);
          return callback(null, { finalServiceIds: [], addressServicesPermission: true }); // Return empty array and true for admin role
        }
      });
    });
  }





};

module.exports = Admin;
