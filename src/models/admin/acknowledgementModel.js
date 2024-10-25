const crypto = require("crypto");
const pool = require("../../config/db");

// Function to hash the password using MD5
const hashPassword = (password) =>
  crypto.createHash("md5").update(password).digest("hex");

const Acknowledgement = {
  list: (callback) => {
    const sql = `
      SELECT \`id\`, \`ack_sent\`, \`branch_id\`, \`customer_id\`, COUNT(*) AS application_count
      FROM \`client_applications\`
      WHERE ack_sent = 0
      GROUP BY \`branch_id\`, \`customer_id\`
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, (queryErr, results) => {
        // Release the connection after the query
        connectionRelease(connection);

        if (queryErr) {
          console.error("Database query error:", queryErr);
          return callback(queryErr, null);
        }

        const customerMap = new Map();
        let totalResults = 0;
        let remainingQueries = results.length;

        // Early return if no results
        if (remainingQueries === 0) {
          return callback(null, { data: [], totalResults: 0 });
        }

        const processResults = (result) => {
          const { branch_id, customer_id, application_count } = result;
          const customerSql = `SELECT \`id\`, \`admin_id\`, \`client_unique_id\`, \`name\` FROM \`customers\` WHERE \`id\` = ? AND \`status\` = ?`;
          const branchSql = `SELECT \`id\`, \`customer_id\`, \`name\`, \`is_head\`, \`head_id\` FROM \`branches\` WHERE \`id\` = ? AND \`status\` = ?`;

          // Fetch customer details
          startConnection((err, connection) => {
            if (err) {
              console.error("Connection error:", err);
              remainingQueries--;
              if (remainingQueries === 0) {
                return callback(null, {
                  data: Array.from(customerMap.values()),
                  totalResults,
                });
              }
              return;
            }

            connection.query(
              customerSql,
              [customer_id, "1"],
              (customerErr, customerResult) => {
                connectionRelease(connection); // Release the connection

                if (customerErr || !customerResult.length) {
                  console.error(
                    "Error fetching customer:",
                    customerErr || "Customer not found"
                  );
                  remainingQueries--;
                  if (remainingQueries === 0) {
                    return callback(null, {
                      data: Array.from(customerMap.values()),
                      totalResults,
                    });
                  }
                  return;
                }

                // Fetch branch details
                startConnection((err, connection) => {
                  if (err) {
                    console.error("Connection error:", err);
                    remainingQueries--;
                    if (remainingQueries === 0) {
                      return callback(null, {
                        data: Array.from(customerMap.values()),
                        totalResults,
                      });
                    }
                    return;
                  }

                  connection.query(
                    branchSql,
                    [branch_id, "1"],
                    (branchErr, branchResult) => {
                      connectionRelease(connection); // Release the connection

                      if (branchErr || !branchResult.length) {
                        console.error(
                          "Error fetching branch:",
                          branchErr || "Branch not found"
                        );
                        remainingQueries--;
                        if (remainingQueries === 0) {
                          return callback(null, {
                            data: Array.from(customerMap.values()),
                            totalResults,
                          });
                        }
                        return;
                      }

                      const branchData = {
                        id: branchResult[0].id,
                        customer_id: branchResult[0].customer_id,
                        name: branchResult[0].name,
                        is_head: branchResult[0].is_head,
                        head_id: branchResult[0].head_id,
                        applicationCount: application_count,
                      };

                      if (!customerMap.has(customer_id)) {
                        const customerData = customerResult[0];
                        customerData.applicationCount = 0; // Initialize total application count
                        customerData.branches = []; // Initialize branches array
                        customerMap.set(customer_id, customerData);
                      }

                      const customerData = customerMap.get(customer_id);
                      customerData.branches.push(branchData);
                      customerData.applicationCount += application_count; // Update total for customer
                      totalResults += application_count; // Update overall total

                      remainingQueries--;
                      if (remainingQueries === 0) {
                        callback(null, {
                          data: Array.from(customerMap.values()),
                          totalResults,
                        });
                      }
                    }
                  );
                });
              }
            );
          });
        };

        // Process each result
        results.forEach(processResults);
      });
    });
  },

  listByCustomerID: (customer_id, callback) => {
    const sql = `
      SELECT id, application_id, name, services, ack_sent, branch_id, customer_id
      FROM client_applications
      WHERE ack_sent = 0 AND customer_id = ?
      ORDER BY created_at DESC
      LIMIT 250
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [customer_id], (err, results) => {
        connectionRelease(connection); // Release the connection

        if (err) {
          console.error("Database query error:", err);
          return callback(err, null);
        }

        const customerMap = new Map();
        let totalResults = 0;

        // Early return if no results
        if (results.length === 0) {
          return callback(null, { data: [], totalResults: 0 });
        }

        let remainingQueries = results.length; // Track number of remaining results to process

        const processResults = (result) => {
          const { id, branch_id, application_id, name, services } = result;

          const customerSql = `SELECT id, admin_id, client_unique_id, name FROM customers WHERE id = ? AND status = ?`;
          const branchSql = `SELECT id, customer_id, name, email, is_head, head_id FROM branches WHERE id = ? AND status = ?`;

          // Fetch customer details
          startConnection((err, connection) => {
            if (err) {
              console.error("Connection error:", err);
              remainingQueries--;
              checkRemainingQueries();
              return;
            }

            connection.query(
              customerSql,
              [customer_id, "1"],
              (customerErr, customerResult) => {
                connectionRelease(connection); // Release the connection

                if (customerErr || !customerResult.length) {
                  console.error(
                    "Error fetching customer:",
                    customerErr || "Customer not found"
                  );
                  remainingQueries--;
                  checkRemainingQueries();
                  return;
                }

                // Fetch branch details
                startConnection((err, connection) => {
                  if (err) {
                    console.error("Connection error:", err);
                    remainingQueries--;
                    checkRemainingQueries();
                    return;
                  }

                  connection.query(
                    branchSql,
                    [branch_id, "1"],
                    (branchErr, branchResult) => {
                      connectionRelease(connection); // Release the connection

                      if (branchErr || !branchResult.length) {
                        console.error(
                          "Error fetching branch:",
                          branchErr || "Branch not found"
                        );
                        remainingQueries--;
                        checkRemainingQueries();
                        return;
                      }

                      const branchData = {
                        id: branchResult[0].id,
                        customer_id: branchResult[0].customer_id,
                        name: branchResult[0].name,
                        is_head: branchResult[0].is_head,
                        email: branchResult[0].email,
                        head_id: branchResult[0].head_id,
                        applications: [],
                        applicationCount: 0,
                      };

                      // Add application details to the branch
                      const applicationDetails = {
                        id: id,
                        application_id: application_id,
                        name: name,
                        services: services,
                      };
                      branchData.applications.push(applicationDetails);
                      branchData.applicationCount += 1; // Increment count for this application

                      // Group data under the customer ID
                      if (!customerMap.has(customer_id)) {
                        const customerData = customerResult[0];
                        customerData.applicationCount = 0;
                        customerData.branches = [];
                        customerMap.set(customer_id, customerData);
                      }

                      // Add branch data and update counts
                      const customerData = customerMap.get(customer_id);
                      const existingBranch = customerData.branches.find(
                        (branch) => branch.id === branchData.id
                      );
                      if (existingBranch) {
                        existingBranch.applications.push(applicationDetails);
                        existingBranch.applicationCount += 1; // Update count for this branch
                      } else {
                        customerData.branches.push(branchData);
                      }
                      customerData.applicationCount += 1; // Update total for customer
                      totalResults += 1; // Update overall total

                      // Resolve when all queries are done
                      remainingQueries--;
                      checkRemainingQueries();
                    }
                  );
                });
              }
            );
          });
        };

        const checkRemainingQueries = () => {
          if (remainingQueries === 0) {
            const finalResult = Array.from(customerMap.values());
            callback(null, { data: finalResult, totalResults });
          }
        };

        // Process each result
        results.forEach(processResults);
      });
    });
  },

  updateAckByCustomerID: (applicationIdsString, customer_id, callback) => {
    // Convert the comma-separated string into an array of integers
    const applicationIdsArray = applicationIdsString.split(",").map(Number);

    const sqlUpdate = `
      UPDATE client_applications
      SET ack_sent = 1
      WHERE customer_id = ? AND ack_sent = 0 AND id IN (?)
    `;

    startConnection((err, connection) => {
      if (err) {
        console.error("Connection error:", err);
        return callback(err, null);
      }

      connection.query(
        sqlUpdate,
        [customer_id, applicationIdsArray],
        (err, results) => {
          connectionRelease(connection); // Release the connection

          if (err) {
            console.error("Database update error:", err);
            return callback(err, null);
          }

          // Return the number of affected rows (if needed)
          callback(null, results.affectedRows);
        }
      );
    });
  },
};

module.exports = Acknowledgement;
