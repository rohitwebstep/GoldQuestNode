const crypto = require("crypto");
const { pool, startConnection, connectionRelease } = require("../../config/db");

// Function to hash the password using MD5
const hashPassword = (password) =>
  crypto.createHash("md5").update(password).digest("hex");

const Customer = {
  list: (filter_status, callback) => {
    let customers_id = [];

    startConnection((err, connection) => {
      if (err) {
        console.error("Connection error:", err);
        return callback(err, null);
      }

      if (
        filter_status &&
        filter_status.trim().toLowerCase() &&
        (filter_status.trim().toLowerCase() === "submitted" ||
          filter_status.trim().toLowerCase() === "unsubmitted")
      ) {
        // Query when `filter_status` exists
        const sql = `
          SELECT b.customer_id, 
                 b.id AS branch_id, 
                 b.name AS branch_name, 
                 COUNT(ca.id) AS application_count,
                 MAX(ca.created_at) AS latest_application_date
          FROM candiate_applications ca
          INNER JOIN branches b ON ca.branch_id = b.id
          WHERE ca.status = ?
          GROUP BY b.customer_id, b.id, b.name
          ORDER BY latest_application_date DESC;
        `;

        connection.query(sql, [filter_status], (err, results) => {
          if (err) {
            console.error("Database query error: 14", err);
            connectionRelease(connection);
            return callback(err, null);
          }

          // Loop through results and push customer_id to the array
          results.forEach((row) => {
            customers_id.push(row.customer_id);
          });

          let customersIDConditionString = "";
          if (customers_id.length > 0) {
            customersIDConditionString = ` AND customers.id IN (${customers_id.join(
              ","
            )})`;
          }

          const finalSql = `
            WITH BranchesCTE AS (
                    SELECT 
                        b.id AS branch_id,
                        b.customer_id
                    FROM 
                        branches b
                    WHERE 
                        EXISTS (
                            SELECT 1 
                            FROM candidate_applications ca 
                            WHERE ca.branch_id = b.id
                        )
                ),
                ApplicationCounts AS (
                    SELECT 
                        b.customer_id, 
                        COUNT(ca.id) AS application_count,
                        MAX(ca.created_at) AS latest_application_date
                    FROM 
                        BranchesCTE b
                    INNER JOIN 
                        candidate_applications ca ON b.branch_id = ca.branch_id
                    GROUP BY 
                        b.customer_id
                )
                SELECT 
                    customers.client_unique_id,
                    customers.name,
                    customer_metas.tat_days,
                    customer_metas.single_point_of_contact,
                    customers.id AS main_id,
                    COALESCE(branch_counts.branch_count, 0) AS branch_count,
                    COALESCE(application_counts.application_count, 0) AS application_count
                FROM 
                    customers
                LEFT JOIN 
                    customer_metas ON customers.id = customer_metas.customer_id
                LEFT JOIN (
                    SELECT 
                        b.customer_id, 
                        COUNT(*) AS branch_count
                    FROM 
                        branches b
                    WHERE 
                        EXISTS (
                            SELECT 1 
                            FROM candidate_applications ca 
                            WHERE ca.branch_id = b.id
                        )
                    GROUP BY 
                        b.customer_id
                ) AS branch_counts ON customers.id = branch_counts.customer_id
                LEFT JOIN 
                    ApplicationCounts application_counts ON customers.id = application_counts.customer_id
                WHERE 
                    COALESCE(application_counts.application_count, 0) > 0
                ${customersIDConditionString}
            ORDER BY 
                    application_counts.latest_application_date DESC;
          `;

          connection.query(finalSql, (err, results) => {
            connectionRelease(connection); // Always release the connection
            if (err) {
              console.error("Database query error: 15", err);
              return callback(err, null);
            }
            callback(null, results);
          });
        });
      } else {
        // If no filter_status is provided, proceed with the final SQL query without filters
        const finalSql = `
                          WITH BranchesCTE AS (
                    SELECT 
                        b.id AS branch_id,
                        b.customer_id
                    FROM 
                        branches b
                    WHERE 
                        EXISTS (
                            SELECT 1 
                            FROM candidate_applications ca 
                            WHERE ca.branch_id = b.id
                        )
                ),
                ApplicationCounts AS (
                    SELECT 
                        b.customer_id, 
                        COUNT(ca.id) AS application_count,
                        MAX(ca.created_at) AS latest_application_date
                    FROM 
                        BranchesCTE b
                    INNER JOIN 
                        candidate_applications ca ON b.branch_id = ca.branch_id
                    GROUP BY 
                        b.customer_id
                )
                SELECT 
                    customers.client_unique_id,
                    customers.name,
                    customer_metas.tat_days,
                    customer_metas.single_point_of_contact,
                    customers.id AS main_id,
                    COALESCE(branch_counts.branch_count, 0) AS branch_count,
                    COALESCE(application_counts.application_count, 0) AS application_count
                FROM 
                    customers
                LEFT JOIN 
                    customer_metas ON customers.id = customer_metas.customer_id
                LEFT JOIN (
                    SELECT 
                        b.customer_id, 
                        COUNT(*) AS branch_count
                    FROM 
                        branches b
                    WHERE 
                        EXISTS (
                            SELECT 1 
                            FROM candidate_applications ca 
                            WHERE ca.branch_id = b.id
                        )
                    GROUP BY 
                        b.customer_id
                ) AS branch_counts ON customers.id = branch_counts.customer_id
                LEFT JOIN 
                    ApplicationCounts application_counts ON customers.id = application_counts.customer_id
                WHERE 
                    COALESCE(application_counts.application_count, 0) > 0
                ORDER BY 
                    application_counts.latest_application_date DESC;
        `;

        connection.query(finalSql, (err, results) => {
          connectionRelease(connection); // Always release the connection
          if (err) {
            console.error("Database query error:16", err);
            return callback(err, null);
          }
          callback(null, results);
        });
      }
    });
  },

  listByCustomerID: (customer_id, filter_status, callback) => {
    startConnection((err, connection) => {
      if (err) {
        console.error("Connection error:", err);
        return callback(err, null);
      }

      // Base SQL query with mandatory condition for status
      let sql = `
        SELECT b.id AS branch_id, 
               b.name AS branch_name, 
               COUNT(ca.id) AS application_count,
               MAX(ca.created_at) AS latest_application_date
        FROM candidate_applications ca
        INNER JOIN branches b ON ca.branch_id = b.id
        WHERE b.customer_id = ?`;

      // Array to hold query parameters
      const queryParams = [customer_id];

      // Check if filter_status is provided
      if (filter_status && filter_status !== null && filter_status !== "") {
        sql += ` AND ca.status = ?`;
        queryParams.push(filter_status);
      }

      sql += ` GROUP BY b.id, b.name 
                ORDER BY latest_application_date DESC;`;

      // Execute the query
      connection.query(sql, queryParams, (err, results) => {
        connectionRelease(connection); // Always release the connection
        if (err) {
          console.error("Database query error: 17", err);
          return callback(err, null);
        }
        callback(null, results);
      });
    });
  },

  applicationListByBranch: (filter_status, branch_id, status, callback) => {
    startConnection((err, connection) => {
      if (err) {
        console.error("Error starting database connection:", err);
        return callback(err, null);
      }

      let sql = `
            SELECT 
                ca.*, 
                ca.id AS main_id, 
                cef.created_at AS cef_filled_date,
                cef.id AS cef_id,
                dav.created_at AS dav_filled_date,
                dav.id AS dav_id,
                CASE WHEN cef.id IS NOT NULL THEN 1 ELSE 0 END AS cef_submitted,
                CASE WHEN dav.id IS NOT NULL THEN 1 ELSE 0 END AS dav_submitted
            FROM 
                \`candidate_applications\` ca
            LEFT JOIN 
                \`cef_applications\` cef 
            ON 
                ca.id = cef.candidate_application_id
            LEFT JOIN 
                \`dav_applications\` dav 
            ON 
                ca.id = dav.candidate_application_id
            WHERE 
                ca.\`branch_id\` = ?`;

      const params = [branch_id];
      if (filter_status && filter_status.trim() !== "") {
        sql += ` AND ca.\`status\` = ?`;
        params.push(filter_status);
      }

      if (typeof status === "string" && status.trim() !== "") {
        sql += ` AND ca.\`status\` = ?`;
        params.push(status);
      }

      sql += ` ORDER BY ca.\`created_at\` DESC;`;

      connection.query(sql, params, (err, results) => {
        if (err) {
          console.error("Database query error:", err);
          connectionRelease(connection);
          return callback(err, null);
        }

        const davSql = `
        SELECT * FROM \`services\`
        WHERE LOWER(\`title\`) LIKE '%digital%'
        AND (LOWER(\`title\`) LIKE '%verification%' OR LOWER(\`title\`) LIKE '%address%')
        LIMIT 1
      `;
        connection.query(davSql, (queryErr, davResults) => {
          if (queryErr) {
            console.error("Database query error: 48", queryErr);
            return callback(queryErr, null);
          }
          let digitalAddressID = null;
          const singleEntry = davResults.length > 0 ? davResults[0] : null;

          if (singleEntry) {
            digitalAddressID = parseInt(singleEntry.id, 10);
          }

          const cmtPromises = results.map(async (candidateApp) => {
            const servicesResult = { cef: {}, dav: {} };

            // Handle DAV submitted cases
            if (candidateApp.dav_submitted === 1) {
              const checkDavSql = `
                SELECT identity_proof, home_photo, locality
                FROM \`dav_applications\`
                WHERE \`candidate_application_id\` = ?
              `;

              try {
                const davResults = await new Promise((resolve, reject) => {
                  startConnection((err, connection) => {
                    if (err) {
                      console.error("Connection error:", err);
                      return reject(err); // Reject if connection fails
                    }

                    connection.query(
                      checkDavSql,
                      [candidateApp.main_id],
                      (queryErr, results) => {
                        connectionRelease(connection); // Always release connection after query
                        if (queryErr) {
                          console.error(
                            "Database query error: Check DAV",
                            queryErr
                          );
                          return reject(queryErr); // Reject on query error
                        }
                        resolve(results); // Resolve with query results
                      }
                    );
                  });
                });

                // Process DAV results
                if (davResults.length === 0) {
                  throw new Error("Candidate DAV form is not submitted yet");
                }

                davResults.forEach((cefResult) => {
                  // Check if the values are not empty or null before pushing to servicesResult.dav
                  if (
                    cefResult.identity_proof &&
                    cefResult.identity_proof !== ""
                  ) {
                    servicesResult.dav["Identity Proof"] =
                      cefResult.identity_proof;
                  }

                  if (cefResult.home_photo && cefResult.home_photo !== "") {
                    servicesResult.dav["Home Photo"] = cefResult.home_photo;
                  }

                  if (cefResult.locality && cefResult.locality !== "") {
                    servicesResult.dav["Locality"] = cefResult.locality;
                  }
                });

                candidateApp.service_data = servicesResult;
              } catch (error) {
                return Promise.reject(error); // Reject the promise if DAV check fails
              }
            }

            // Handle CEF submitted cases
            if (candidateApp.cef_submitted === 1) {
              const services = candidateApp.services.split(",");
              candidateApp.dav_exist = services.includes(digitalAddressID)
                ? 1
                : 0;

              const dbTableFileInputs = {};
              const dbTableColumnLabel = {};
              let completedQueries = 0;
              const dbTableWithHeadings = {};

              try {
                await Promise.all(
                  services.map(async (service) => {
                    const query =
                      "SELECT `json` FROM `cef_service_forms` WHERE `service_id` = ?";
                    const result = await new Promise((resolve, reject) => {
                      connection.query(query, [service], (err, result) => {
                        if (err) {
                          return reject(err); // Reject if there is an error in the query
                        }
                        resolve(result); // Resolve with query result
                      });
                    });

                    if (result.length > 0) {
                      try {
                        const rawJson = result[0].json;
                        const sanitizedJson = rawJson
                          .replace(/\\"/g, '"')
                          .replace(/\\'/g, "'");
                        const jsonData = JSON.parse(sanitizedJson);
                        const dbTable = jsonData.db_table;
                        const heading = jsonData.heading;

                        if (dbTable && heading) {
                          dbTableWithHeadings[dbTable] = heading;
                        }

                        if (!dbTableFileInputs[dbTable]) {
                          dbTableFileInputs[dbTable] = [];
                        }

                        jsonData.rows.forEach((row) => {
                          row.inputs.forEach((input) => {
                            if (input.type === "file") {
                              dbTableFileInputs[dbTable].push(input.name);
                              dbTableColumnLabel[input.name] = input.label;
                            }
                          });
                        });
                      } catch (parseErr) {
                        console.error("Error parsing JSON:", parseErr);
                      }
                    }
                  })
                );

                // After all CEF queries are completed, perform the host SQL query
                const hostSql = `SELECT \`cloud_host\` FROM \`app_info\` WHERE \`status\` = 1 AND \`interface_type\` = ? ORDER BY \`updated_at\` DESC LIMIT 1`;
                const hostResults = await new Promise((resolve, reject) => {
                  connection.query(hostSql, ["backend"], (err, hostResults) => {
                    if (err) {
                      return reject(err);
                    }
                    resolve(hostResults);
                  });
                });

                const host =
                  hostResults.length > 0
                    ? hostResults[0].cloud_host
                    : "www.example.com";
                let tableQueries = 0;
                const totalTables = Object.keys(dbTableFileInputs).length;

                if (totalTables === 0) {
                  return; // If no tables to query, resolve immediately
                }

                await Promise.all(
                  Object.entries(dbTableFileInputs).map(
                    async ([dbTable, fileInputNames]) => {
                      if (fileInputNames.length > 0) {
                        const selectQuery = `SELECT ${fileInputNames.join(
                          ", "
                        )} FROM cef_${dbTable} WHERE candidate_application_id = ?`;
                        const rows = await new Promise((resolve, reject) => {
                          connection.query(
                            selectQuery,
                            [candidateApp.main_id],
                            (err, rows) => {
                              if (err) {
                                console.error(
                                  "Error querying database for table:",
                                  dbTable,
                                  err
                                );
                                return reject(err);
                              }
                              resolve(rows);
                            }
                          );
                        });

                        // Process and map the rows to replace column names with labels
                        const updatedRows = rows.map((row) => {
                          const updatedRow = {};
                          for (const [key, value] of Object.entries(row)) {
                            const label = dbTableColumnLabel[key];
                            updatedRow[label || key] = value; // Use label if available, else keep original key
                          }
                          return updatedRow;
                        });

                        if (updatedRows.length > 0) {
                          servicesResult.cef[dbTableWithHeadings[dbTable]] =
                            updatedRows;
                        }

                        tableQueries++;
                        if (tableQueries === totalTables) {
                          candidateApp.service_data = servicesResult;
                        }
                      } else {
                        console.log(
                          `Skipping table ${dbTable} as fileInputNames is empty.`
                        );
                      }
                    }
                  )
                );
              } catch (error) {
                return Promise.reject(error); // Reject if any errors occur during CEF processing
              }
            }
          });

          Promise.all(cmtPromises)
            .then(() => {
              connectionRelease(connection);
              callback(null, results);
            })
            .catch((err) => {
              console.error("Error processing candidate applications:", err);
              connectionRelease(connection);
              callback(err, null);
            });
        });
      });
    });
  },

  applicationDataByClientApplicationID: (
    client_application_id,
    branch_id,
    callback
  ) => {
    // Start a connection
    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      // Base SQL query with JOINs to fetch client_spoc_name and cmt_applications data if it exists
      let sql = `
        SELECT 
          ca.*, 
          ca.id AS main_id, 
          cmt.first_insufficiency_marks,
          cmt.first_insuff_date,
          cmt.first_insuff_reopened_date,
          cmt.second_insufficiency_marks,
          cmt.second_insuff_date,
          cmt.second_insuff_reopened_date,
          cmt.third_insufficiency_marks,
          cmt.third_insuff_date,
          cmt.third_insuff_reopened_date,
          cmt.overall_status,
          cmt.report_date,
          cmt.report_status,
          cmt.report_type,
          cmt.qc_done_by,
          qc_admin.name AS qc_done_by_name,
          cmt.delay_reason,
          cmt.report_generate_by,
          report_admin.name AS report_generated_by_name,
          cmt.case_upload
        FROM 
          \`client_applications\` ca
        LEFT JOIN 
          \`cmt_applications\` cmt 
        ON 
          ca.id = cmt.client_application_id
        LEFT JOIN 
          \`admins\` AS qc_admin 
        ON 
          qc_admin.id = cmt.qc_done_by
        LEFT JOIN 
          \`admins\` AS report_admin 
        ON 
          report_admin.id = cmt.report_generate_by
        WHERE 
          ca.\`id\` = ? AND
          ca.\`branch_id\` = ?`;

      const params = [client_application_id, branch_id]; // Start with branch_id

      sql += ` ORDER BY ca.\`created_at\` DESC;`;

      // Execute the query using the connection
      connection.query(sql, params, (err, results) => {
        connectionRelease(connection); // Release the connection
        if (err) {
          console.error("Database query error: 18", err);
          return callback(err, null);
        }
        callback(null, results[0]);
      });
    });
  },

  cefApplicationByID: (application_id, branch_id, callback) => {
    // Start a connection
    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      // First, check if an entry exists in cef_applications
      const checkCefSql = `
        SELECT * 
        FROM \`cef_applications\` 
        WHERE 
          \`candidate_application_id\` = ? 
          AND \`branch_id\` = ?
      `;

      connection.query(
        checkCefSql,
        [application_id, branch_id],
        (err, cefResults) => {
          if (err) {
            connectionRelease(connection); // Release the connection
            console.error("Database query error: Check CEF", err);
            return callback(err, null);
          }

          // If no entry in cef_applications, return error
          if (cefResults.length === 0) {
            connectionRelease(connection); // Release the connection
            return callback(
              { message: "Candidate BGV form is not submitted yet" },
              null
            );
          }

          callback(null, cefResults[0]);
        }
      );
    });
  },

  davApplicationByID: (application_id, branch_id, callback) => {
    // Start a connection
    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      // First, check if an entry exists in cef_applications
      const checkCefSql = `
        SELECT * 
        FROM \`dav_applications\` 
        WHERE 
          \`candidate_application_id\` = ? 
          AND \`branch_id\` = ?
      `;

      connection.query(
        checkCefSql,
        [application_id, branch_id],
        (err, cefResults) => {
          if (err) {
            connectionRelease(connection); // Release the connection
            console.error("Database query error: Check CEF", err);
            return callback(err, null);
          }

          // If no entry in cef_applications, return error
          if (cefResults.length === 0) {
            connectionRelease(connection); // Release the connection
            return callback(
              { message: "Candidate DAV form is not submitted yet" },
              null
            );
          }

          callback(null, cefResults[0]);
        }
      );
    });
  },

  applicationByID: (application_id, branch_id, callback) => {
    // Start a connection
    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      // Use a parameterized query to prevent SQL injection
      const sql =
        "SELECT CA.*, C.name AS customer_name FROM `candidate_applications` AS CA INNER JOIN `customers` AS C ON C.id = CA.customer_id WHERE CA.`id` = ? AND CA.`branch_id` = ? ORDER BY `created_at` DESC";

      connection.query(sql, [application_id, branch_id], (err, results) => {
        connectionRelease(connection); // Release the connection
        if (err) {
          console.error("Database query error: 19", err);
          return callback(err, null);
        }
        // Assuming `results` is an array, and we want the first result
        callback(null, results[0] || null); // Return single application or null if not found
      });
    });
  },

  annexureData: (client_application_id, db_table, callback) => {
    // Start a connection
    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      // Check if the table exists in the information schema
      const checkTableSql = `
        SELECT COUNT(*) AS count 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() 
        AND table_name = ?`;

      connection.query(checkTableSql, [db_table], (err, results) => {
        if (err) {
          console.error("Database error while checking table existence:", err);
          connectionRelease(connection); // Release connection
          return callback(err, null);
        }
        // If the table does not exist, return an error
        if (results[0].count === 0) {
          const createTableSql = `
            CREATE TABLE \`${db_table}\` (
              \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
              \`cmt_id\` bigint(20) NOT NULL,
              \`client_application_id\` bigint(20) NOT NULL,
              \`branch_id\` int(11) NOT NULL,
              \`customer_id\` int(11) NOT NULL,
              \`status\` VARCHAR(100) NOT NULL,
              \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
              \`updated_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (\`id\`),
              KEY \`client_application_id\` (\`client_application_id\`),
              KEY \`cmt_application_customer_id\` (\`customer_id\`),
              KEY \`cmt_application_cmt_id\` (\`cmt_id\`),
              CONSTRAINT \`fk_${db_table}_client_application_id\` FOREIGN KEY (\`client_application_id\`) REFERENCES \`client_applications\` (\`id\`) ON DELETE CASCADE,
              CONSTRAINT \`fk_${db_table}_customer_id\` FOREIGN KEY (\`customer_id\`) REFERENCES \`customers\` (\`id\`) ON DELETE CASCADE,
              CONSTRAINT \`fk_${db_table}_cmt_id\` FOREIGN KEY (\`cmt_id\`) REFERENCES \`cmt_applications\` (\`id\`) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

          connection.query(createTableSql, (createErr) => {
            if (createErr) {
              console.error(`Error creating table "${db_table}":`, createErr);
              connectionRelease(connection); // Release connection
              return callback(createErr);
            }
            fetchData();
          });
        } else {
          fetchData();
        }

        function fetchData() {
          // Now that we know the table exists, run the original query
          const sql = `SELECT * FROM \`${db_table}\` WHERE \`client_application_id\` = ?`;
          connection.query(sql, [client_application_id], (err, results) => {
            connectionRelease(connection); // Release connection
            if (err) {
              console.error("Database query error: 20", err);
              return callback(err, null);
            }
            // Return the first result or null if not found
            callback(null, results[0] || null);
          });
        }
      });
    });
  },

  filterOptions: (callback) => {
    // Start a connection
    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      const sql = `
        SELECT \`status\`, COUNT(*) AS \`count\` 
        FROM \`client_applications\` 
        GROUP BY \`status\`
      `;
      connection.query(sql, (err, results) => {
        connectionRelease(connection); // Release connection
        if (err) {
          console.error("Database query error: 21", err);
          return callback(err, null);
        }
        callback(null, results);
      });
    });
  },

  filterOptionsForBranch: (branch_id, callback) => {
    // Start a connection
    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      const sql = `
        SELECT \`status\`, COUNT(*) AS \`count\` 
        FROM \`client_applications\` 
        WHERE \`branch_id\` = ?
        GROUP BY \`status\`, \`branch_id\`
      `;
      connection.query(sql, [branch_id], (err, results) => {
        connectionRelease(connection); // Release connection
        if (err) {
          console.error("Database query error: 22", err);
          return callback(err, null);
        }
        callback(null, results);
      });
    });
  },
};

module.exports = Customer;
