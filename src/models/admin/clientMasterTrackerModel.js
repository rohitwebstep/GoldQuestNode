const crypto = require("crypto");
const { pool, startConnection, connectionRelease } = require("../../config/db");
const moment = require("moment"); // Ensure you have moment.js installed
// Function to hash the password using MD5
const hashPassword = (password) =>
  crypto.createHash("md5").update(password).digest("hex");

function calculateDueDate(startDate, tatDays = 0, holidayDates, weekendsSet) {
  // console.log("Starting calculation...");
  // console.log("Start Date:", startDate.format("YYYY-MM-DD"));
  // console.log("TAT Days:", tatDays);
  // console.log("Holiday Dates:", holidayDates.map(date => date.format("YYYY-MM-DD")));
  // console.log("Weekends Set:", weekendsSet);

  // Track remaining TAT days to process
  let remainingDays = tatDays;

  // Generate potential dates to check
  const potentialDates = Array.from({ length: tatDays * 2 }, (_, i) =>
    startDate.clone().add(i + 1, "days")
  );

  // console.log("Generated Potential Dates:", potentialDates.map(date => date.format("YYYY-MM-DD")));

  // Calculate the final due date
  let finalDueDate = potentialDates.find((date) => {
    const dayName = date.format("dddd").toLowerCase();
    // console.log(`Checking date: ${date.format("YYYY-MM-DD")} (Day: ${dayName})`);

    // Skip weekends
    if (weekendsSet.has(dayName)) {
      // console.log(`Skipping ${date.format("YYYY-MM-DD")} - It's a weekend.`);
      return false;
    }

    // Skip holidays
    if (holidayDates.some((holiday) => holiday.isSame(date, "day"))) {
      // console.log(`Skipping ${date.format("YYYY-MM-DD")} - It's a holiday.`);
      return false;
    }

    remainingDays--;
    // console.log(`Remaining Days: ${remainingDays}`);

    return remainingDays <= 0;
  });

  // console.log("Final Due Date:", finalDueDate ? finalDueDate.format("YYYY-MM-DD") : "Not Found");
  return finalDueDate;
}

const Customer = {
  list: (filter_status, callback) => {
    let client_application_ids = [];
    let customer_ids = [];

    startConnection((err, connection) => {
      if (err) {
        console.error("Connection error:", err);
        return callback(err, null);
      }

      // Get the current date
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthYear = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

      if (filter_status && filter_status !== null && filter_status !== "") {

        let sql = `SELECT customer_id FROM customers WHERE status = 1`;

        switch (filter_status) {
          case 'overallCount':
            sql = `
                    SELECT DISTINCT
                      a.id,
                      a.customer_id
                    FROM 
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    WHERE
                      (
                        b.overall_status = 'wip'
                        OR b.overall_status = 'insuff'
                        OR (b.overall_status = 'completed' 
                          AND LOWER(b.final_verification_status) IN ('green', 'red', 'yellow', 'pink', 'orange')
                          AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                        )
                      )
                      AND (a.created_at LIKE '${yearMonth}-%' OR a.created_at LIKE '%-${monthYear}')
                      AND (c.status = 1)
              `;
            break;
          case 'qcStatusPendingCount':
            sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                  FROM 
                    client_applications a 
                    JOIN customers c ON a.customer_id = c.id
                    JOIN cmt_applications b ON a.id = b.client_application_id
                  WHERE
                    a.is_report_downloaded = '1'
                    AND LOWER(b.is_verify) = 'no'
                    AND (a.created_at LIKE '${yearMonth}-%' OR a.created_at LIKE '%-${monthYear}')
                    AND a.status = 'completed';
              `;
            break;
          case 'wipCount':
            sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    FROM 
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    WHERE 
                      c.status = 1
                      AND (a.created_at LIKE '${yearMonth}-%' OR a.created_at LIKE '%-${monthYear}')
                      AND b.overall_status = 'wip'
              `;
            break;
          case 'insuffCount':
            sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    FROM 
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    WHERE 
                      c.status = 1
                      AND (a.created_at LIKE '${yearMonth}-%' OR a.created_at LIKE '%-${monthYear}')
                      AND b.overall_status = 'insuff'
              `;
            break;
          case 'previousCompletedCount':
            sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    FROM 
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    WHERE
                      b.overall_status = 'completed'
                      AND (a.created_at LIKE '${yearMonth}-%' OR a.created_at LIKE '%-${monthYear}')
                      AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                      AND c.status = 1
              `;
            break;
          case 'stopcheckCount':
            sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    FROM 
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    WHERE
                      b.overall_status = 'stopcheck'
                      AND (a.created_at LIKE '${yearMonth}-%' OR a.created_at LIKE '%-${monthYear}')
                      AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                      AND c.status = 1
              `;
            break;
          case 'activeEmploymentCount':
            sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    FROM 
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    WHERE
                      b.overall_status = 'active employment'
                      AND (a.created_at LIKE '${yearMonth}-%' OR a.created_at LIKE '%-${monthYear}')
                      AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                      AND c.status = 1
              `;
            break;
          case 'nilCount':
            sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    FROM 
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    WHERE
                      b.overall_status = 'nil'
                      AND (a.created_at LIKE '${yearMonth}-%' OR a.created_at LIKE '%-${monthYear}')
                      AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                      AND c.status = 1
              `;
            break;
          case 'notDoableCount':
            sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    FROM 
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    WHERE
                      b.overall_status = 'not doable'
                      AND (a.created_at LIKE '${yearMonth}-%' OR a.created_at LIKE '%-${monthYear}')
                      AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                      AND c.status = 1
              `;
            break;
          case 'candidateDeniedCount':
            sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    FROM 
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    WHERE
                      b.overall_status = 'candidate denied'
                      AND (a.created_at LIKE '${yearMonth}-%' OR a.created_at LIKE '%-${monthYear}')
                      AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                      AND c.status = 1
              `;
            break;
          case 'completedGreenCount':
            sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    from
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    where
                      b.overall_status ='completed'
                      AND (a.created_at LIKE '${yearMonth}-%' OR a.created_at LIKE '%-${monthYear}')
                      AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                      AND LOWER(b.final_verification_status) = 'green'
                      AND c.status=1
              `;
            break;
          case 'completedRedCount':
            sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    from
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    where
                      b.overall_status ='completed'
                      AND (a.created_at LIKE '${yearMonth}-%' OR a.created_at LIKE '%-${monthYear}')
                      AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                      AND LOWER(b.final_verification_status) = 'red'
                      AND c.status=1
              `;
            break;
          case 'completedYellowCount':
            sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    from
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    where
                      b.overall_status ='completed'
                      AND (a.created_at LIKE '${yearMonth}-%' OR a.created_at LIKE '%-${monthYear}')
                      AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                      AND LOWER(b.final_verification_status)  = 'yellow'
                      AND c.status=1
              `;
            break;
          case 'completedPinkCount':
            sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    from
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    where
                      b.overall_status ='completed'
                      AND (a.created_at LIKE '${yearMonth}-%' OR a.created_at LIKE '%-${monthYear}')
                      AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                      AND LOWER(b.final_verification_status) = 'pink'
                      AND c.status=1
              `;
            break;
          case 'completedOrangeCount':
            sql = `
                  SELECT DISTINCT
                    a.id,
                    a.customer_id
                    from
                      client_applications a 
                      JOIN customers c ON a.customer_id = c.id
                      JOIN cmt_applications b ON a.id = b.client_application_id 
                    where
                      b.overall_status ='completed'
                      AND (a.created_at LIKE '${yearMonth}-%' OR a.created_at LIKE '%-${monthYear}')
                      AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                      AND LOWER(b.final_verification_status) = 'orange'
                      AND c.status=1
              `;
            break;
        }

        connection.query(sql, (err, results) => {
          if (err) {
            console.error("Database query error: 37", err);
            connectionRelease(connection);
            return callback(err, null);
          }

          // Loop through results and push customer_id to the array
          results.forEach((row) => {
            client_application_ids.push(row.id);
            customer_ids.push(row.customer_id);
          });

          const finalSql = `WITH BranchesCTE AS (
                                SELECT
                                    b.id AS branch_id,
                                    b.customer_id
                                FROM
                                    branches b
                            )
                            SELECT
                                customers.client_unique_id,
                                customers.name,
                                customer_metas.tat_days,
                                customer_metas.single_point_of_contact,
                                customers.id AS main_id,
                                COALESCE(branch_counts.branch_count, 0) AS branch_count,
                                COALESCE(application_counts.application_count, 0) AS application_count,
                                COALESCE(completed_counts.completed_count, 0) AS completedApplicationsCount,
                                COALESCE(pending_counts.pending_count, 0) AS pendingApplicationsCount
                            FROM
                                customers
                            LEFT JOIN
                                customer_metas ON customers.id = customer_metas.customer_id
                            LEFT JOIN (
                                SELECT
                                    customer_id,
                                    COUNT(*) AS branch_count
                                FROM
                                    branches
                                GROUP BY
                                    customer_id
                            ) AS branch_counts ON customers.id = branch_counts.customer_id
                            LEFT JOIN (
                                SELECT
                                    b.customer_id,
                                    COUNT(ca.id) AS application_count,
                                    MAX(ca.created_at) AS latest_application_date
                                FROM
                                    BranchesCTE b
                                INNER JOIN
                                    client_applications ca ON b.branch_id = ca.branch_id
                                WHERE
                                    ca.id IN (${client_application_ids.join(",")}) 
                                    AND (ca.created_at LIKE '${yearMonth}-%' OR ca.created_at LIKE '%-${monthYear}')
                                GROUP BY
                                    b.customer_id
                            ) AS application_counts ON customers.id = application_counts.customer_id
                            LEFT JOIN (
                                SELECT
                                    b.customer_id,
                                    COUNT(ca.id) AS completed_count
                                FROM
                                    BranchesCTE b
                                INNER JOIN
                                    client_applications ca ON b.branch_id = ca.branch_id
                                WHERE
                                    ca.status = 'completed'
                                    AND (ca.created_at LIKE '${yearMonth}-%' OR ca.created_at LIKE '%-${monthYear}')
                                GROUP BY
                                    b.customer_id
                            ) AS completed_counts ON customers.id = completed_counts.customer_id
                            LEFT JOIN (
                                SELECT
                                    b.customer_id,
                                    COUNT(ca.id) AS pending_count
                                FROM
                                    BranchesCTE b
                                INNER JOIN
                                    client_applications ca ON b.branch_id = ca.branch_id
                                WHERE
                                    ca.status <> 'completed'
                                    AND (ca.created_at LIKE '${yearMonth}-%' OR ca.created_at LIKE '%-${monthYear}')
                                GROUP BY
                                    b.customer_id
                            ) AS pending_counts ON customers.id = pending_counts.customer_id
                            WHERE
                                customers.id IN (${customer_ids.join(",")})
                                AND customers.status = 1
                                AND COALESCE(application_counts.application_count, 0) > 0
                            ORDER BY
                                application_counts.latest_application_date DESC;
                            `;

          connection.query(finalSql, async (err, results) => {
            connectionRelease(connection); // Always release the connection
            if (err) {
              console.error("Database query error: 38", err);
              return callback(err, null);
            }
            // Process each result to fetch client_spoc names
            for (const result of results) {

              const headBranchApplicationsCountQuery = `SELECT COUNT(*) FROM \`client_applications\` ca INNER JOIN \`branches\` b ON ca.branch_id = b.id WHERE ca.customer_id = ? AND b.customer_id = ? AND b.is_head = ?`;
              const headBranchApplicationsCount = await new Promise(
                (resolve, reject) => {
                  connection.query(
                    headBranchApplicationsCountQuery,
                    [result.main_id, result.main_id, 1], // Parameters passed correctly
                    (headBranchErr, headBranchResults) => {
                      if (headBranchErr) {
                        return reject(headBranchErr);
                      }
                      resolve(headBranchResults[0]["COUNT(*)"]); // Get the count result
                    }
                  );
                }
              );
              result.head_branch_applications_count =
                headBranchApplicationsCount;
              // if (result.branch_count === 1) {
              // Query client_spoc table to fetch names for these IDs
              const headBranchQuery = `SELECT id, is_head FROM \`branches\` WHERE \`customer_id\` = ? AND \`is_head\` = ?`;

              try {
                const headBranchID = await new Promise((resolve, reject) => {
                  connection.query(
                    headBranchQuery,
                    [result.main_id, 1], // Properly pass query parameters as an array
                    (headBranchErr, headBranchResults) => {
                      if (headBranchErr) {
                        return reject(headBranchErr);
                      }
                      resolve(
                        headBranchResults.length > 0
                          ? headBranchResults[0].id
                          : null
                      );
                    }
                  );
                });

                // Attach head branch id and application count to the current result
                result.head_branch_id = headBranchID;
              } catch (headBranchErr) {
                console.error(
                  "Error fetching head branch id or applications count:",
                  headBranchErr
                );
                result.head_branch_id = null;
                result.head_branch_applications_count = 0;
              }
              // }
            }
            callback(null, results);
          });
        });
      } else {
        // If no filter_status is provided, proceed with the final SQL query without filters
        const finalSql = `WITH BranchesCTE AS (
                              SELECT
                                  b.id AS branch_id,
                                  b.customer_id
                              FROM
                                  branches b
                          )
                          SELECT
                              customers.client_unique_id,
                              customers.name,
                              customer_metas.tat_days,
                              customer_metas.single_point_of_contact,
                              customers.id AS main_id,
                              COALESCE(branch_counts.branch_count, 0) AS branch_count,
                              COALESCE(application_counts.application_count, 0) AS application_count,
                              COALESCE(completed_counts.completed_count, 0) AS completedApplicationsCount,
                              COALESCE(pending_counts.pending_count, 0) AS pendingApplicationsCount
                          FROM
                              customers
                          LEFT JOIN
                              customer_metas ON customers.id = customer_metas.customer_id
                          LEFT JOIN (
                              SELECT
                                  customer_id,
                                  COUNT(*) AS branch_count
                              FROM
                                  branches
                              GROUP BY
                                  customer_id
                          ) AS branch_counts ON customers.id = branch_counts.customer_id
                          LEFT JOIN (
                              SELECT
                                  b.customer_id,
                                  COUNT(ca.id) AS application_count,
                                  MAX(ca.created_at) AS latest_application_date
                              FROM
                                  BranchesCTE b
                              INNER JOIN
                                  client_applications ca ON b.branch_id = ca.branch_id
                              WHERE
                                  (ca.created_at LIKE '${yearMonth}-%' OR ca.created_at LIKE '%-${monthYear}')
                              GROUP BY
                                  b.customer_id
                          ) AS application_counts ON customers.id = application_counts.customer_id
                          LEFT JOIN (
                              SELECT
                                  b.customer_id,
                                  COUNT(ca.id) AS completed_count
                              FROM
                                  BranchesCTE b
                              INNER JOIN
                                  client_applications ca ON b.branch_id = ca.branch_id
                              WHERE
                                  ca.status = 'completed'
                                  AND (ca.created_at LIKE '${yearMonth}-%' OR ca.created_at LIKE '%-${monthYear}')
                              GROUP BY
                                  b.customer_id
                          ) AS completed_counts ON customers.id = completed_counts.customer_id
                          LEFT JOIN (
                              SELECT
                                  b.customer_id,
                                  COUNT(ca.id) AS pending_count
                              FROM
                                  BranchesCTE b
                              INNER JOIN
                                  client_applications ca ON b.branch_id = ca.branch_id
                              WHERE
                                  ca.status <> 'completed'
                                  AND (ca.created_at LIKE '${yearMonth}-%' OR ca.created_at LIKE '%-${monthYear}')
                              GROUP BY
                                  b.customer_id
                          ) AS pending_counts ON customers.id = pending_counts.customer_id
                          WHERE
                              customers.status = 1
                              AND COALESCE(application_counts.application_count, 0) > 0
                          ORDER BY
                              application_counts.latest_application_date DESC;
                          `;

        connection.query(finalSql, async (err, results) => {
          connectionRelease(connection); // Always release the connection
          if (err) {
            console.error("Database query error: 39", err);
            return callback(err, null);
          }
          // Process each result to fetch client_spoc names
          for (const result of results) {
            const headBranchApplicationsCountQuery = `SELECT COUNT(*) FROM \`client_applications\` ca INNER JOIN \`branches\` b ON ca.branch_id = b.id WHERE ca.customer_id = ? AND b.customer_id = ? AND b.is_head = ?`;
            const headBranchApplicationsCount = await new Promise(
              (resolve, reject) => {
                connection.query(
                  headBranchApplicationsCountQuery,
                  [result.main_id, result.main_id, 1, 1], // Parameters passed correctly
                  (headBranchErr, headBranchResults) => {
                    if (headBranchErr) {
                      return reject(headBranchErr);
                    }
                    resolve(headBranchResults[0]["COUNT(*)"]); // Get the count result
                  }
                );
              }
            );
            result.head_branch_applications_count = headBranchApplicationsCount;
            // if (result.branch_count === 1) {
            // Query client_spoc table to fetch names for these IDs
            const headBranchQuery = `SELECT id, is_head FROM \`branches\` WHERE \`customer_id\` = ? AND \`is_head\` = ?`;

            try {
              const headBranchID = await new Promise((resolve, reject) => {
                connection.query(
                  headBranchQuery,
                  [result.main_id, 1], // Properly pass query parameters as an array
                  (headBranchErr, headBranchResults) => {
                    if (headBranchErr) {
                      return reject(headBranchErr);
                    }
                    resolve(
                      headBranchResults.length > 0
                        ? headBranchResults[0].id
                        : null
                    );
                  }
                );
              });

              // Attach head branch id and application count to the current result
              result.head_branch_id = headBranchID;
            } catch (headBranchErr) {
              console.error(
                "Error fetching head branch id or applications count:",
                headBranchErr
              );
              result.head_branch_id = null;
              result.head_branch_applications_count = 0;
            }
            // }
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
        FROM client_applications ca
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
    // Start a connection
    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }
      const holidaysQuery = `SELECT id AS holiday_id, title AS holiday_title, date AS holiday_date FROM holidays;`;

      // Execute the holidays query
      connection.query(holidaysQuery, (holQueryError, holidayResults) => {
        if (holQueryError) {
          connectionRelease(connection); // Ensure the connection is released
          console.error("Database query error:", holQueryError);
          callback(holQueryError, null);
        }

        // Prepare holiday dates for calculations
        const holidayDates = holidayResults.map((holiday) =>
          moment(holiday.holiday_date).startOf("day")
        );

        const weekendsQuery = `SELECT weekends FROM company_info WHERE status = 1;`;

        // Execute the weekends query
        connection.query(
          weekendsQuery,
          (weekendQueryError, weekendResults) => {
            connectionRelease(connection); // Always release the connection

            if (weekendQueryError) {
              console.error(
                "Database query error: Weekends",
                weekendQueryError
              );
              return callback(weekendQueryError, null);
            }

            const weekends = weekendResults[0]?.weekends
              ? JSON.parse(weekendResults[0].weekends)
              : [];
            const weekendsSet = new Set(
              weekends.map((day) => day.toLowerCase())
            );

            // Get the current date and month
            const now = new Date();
            const month = `${String(now.getMonth() + 1).padStart(2, '0')}`;
            const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const monthYear = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

            // Define SQL conditions for each filter status
            const conditions = {
              overallCount: `AND (cmt.overall_status='wip' OR cmt.overall_status='insuff' OR cmt.overall_status='initiated' OR cmt.overall_status='hold' OR cmt.overall_status='closure advice' OR cmt.overall_status='stopcheck' OR cmt.overall_status='active employment' OR cmt.overall_status='nil' OR cmt.overall_status='' OR cmt.overall_status='not doable' OR cmt.overall_status='candidate denied' OR (cmt.overall_status='completed' AND cmt.report_date LIKE '${yearMonth}-%') OR (cmt.overall_status='completed' AND cmt.report_date NOT LIKE '${yearMonth}-%'))`,
              qcStatusPendingCount: `AND ca.is_report_downloaded = '1' AND LOWER(cmt.is_verify) = 'no' AND ca.status = 'completed'`,
              wipCount: `AND cmt.overall_status = 'wip'`,
              insuffCount: `AND cmt.overall_status = 'insuff'`,
              completedGreenCount: `AND cmt.overall_status = 'completed' AND cmt.report_date LIKE '${yearMonth}-%' AND LOWER(cmt.final_verification_status) = 'green'`,
              completedRedCount: `AND cmt.overall_status = 'completed' AND cmt.report_date LIKE '${yearMonth}-%' AND LOWER(cmt.final_verification_status) = 'red'`,
              completedYellowCount: `AND cmt.overall_status = 'completed' AND cmt.report_date LIKE '${yearMonth}-%' AND LOWER(cmt.final_verification_status) = 'yellow'`,
              completedPinkCount: `AND cmt.overall_status = 'completed' AND cmt.report_date LIKE '${yearMonth}-%' AND LOWER(cmt.final_verification_status) = 'pink'`,
              completedOrangeCount: `AND cmt.overall_status = 'completed' AND cmt.report_date LIKE '${yearMonth}-%' AND LOWER(cmt.final_verification_status) = 'orange'`,
              previousCompletedCount: `AND (cmt.overall_status = 'completed' AND cmt.report_date NOT LIKE '${yearMonth}-%') AND c.status=1`,
              stopcheckCount: `AND cmt.overall_status = 'stopcheck'`,
              activeEmploymentCount: `AND cmt.overall_status = 'active employment'`,
              nilCount: `AND cmt.overall_status IN ('nil', '')`,
              candidateDeniedCount: `AND cmt.overall_status = 'candidate denied'`,
              notDoableCount: `AND cmt.overall_status = 'not doable'`,
              initiatedCount: `AND cmt.overall_status = 'initiated'`,
              holdCount: `AND cmt.overall_status = 'hold'`,
              closureAdviceCount: `AND cmt.overall_status = 'closure advice'`,
              notReadyCount: `AND cmt.overall_status !='completed'`,
              downloadReportCount: `AND (cmt.overall_status = 'completed' AND (ca.is_report_downloaded = '1' OR ca.is_report_downloaded IS NULL))`
            };

            // Construct SQL condition based on filter_status
            let sqlCondition = '';
            if (filter_status && filter_status.trim() !== "") {
              sqlCondition = conditions[filter_status] || '';
            }

            let sql = `
        SELECT 
          ca.*, 
          ca.id AS main_id, 
          cmt.is_verify,
          cmt.dob,
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
          cmt.final_verification_status,
          cmt.report_date,
          cmt.report_status,
          cmt.report_type,
          cmt.qc_done_by,
          qc_admin.name AS qc_done_by_name,
          cmt.delay_reason,
          cmt.report_generate_by,
          report_admin.name AS report_generated_by_name,
          cmt.case_upload,
          customer_metas.tat_days
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
          \`customers\` AS c 
        ON 
          c.id = ca.customer_id
        LEFT JOIN 
          \`customer_metas\` AS customer_metas 
        ON 
          customer_metas.customer_id = ca.customer_id
        LEFT JOIN 
          \`admins\` AS report_admin 
        ON 
          report_admin.id = cmt.report_generate_by
        WHERE 
            c.status = 1
          AND ca.\`branch_id\` = ?
          ${sqlCondition}`;

            const params = [branch_id]; // Start with branch_id

            // Check if status is provided and add the corresponding condition
            if (typeof status === "string" && status.trim() !== "") {
              sql += ` AND ca.\`status\` = ?`; // Add filter for status
              params.push(status);
            }

            sql += ` ORDER BY ca.\`created_at\` DESC;`;

            // Execute the query using the connection
            connection.query(sql, params, (err, results) => {
              connectionRelease(connection); // Release the connection
              if (err) {
                console.error("Database query error: 18", err);
                return callback(err, null);
              }
              const formattedResults = results.map((result, index) => {
                return {
                  ...result,
                  created_at: new Date(result.created_at).toISOString(), // Format created_at
                  deadline_date: calculateDueDate(
                    moment(result.created_at),
                    result.tat_days,
                    holidayDates,
                    weekendsSet
                  )
                };
              });
              callback(null, formattedResults);
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

  applicationByID: (application_id, branch_id, callback) => {
    // Start a connection
    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      // Use a parameterized query to prevent SQL injection
      const sql =
        "SELECT CA.*, C.name AS customer_name FROM `client_applications` AS CA INNER JOIN `customers` AS C ON C.id = CA.customer_id WHERE CA.`id` = ? AND CA.`branch_id` = ? ORDER BY `created_at` DESC";

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
    console.log("Starting annexureData function with:", { client_application_id, db_table });

    // Start a connection
    startConnection((err, connection) => {
      if (err) {
        console.error("Error establishing database connection:", err);
        return callback(err, null);
      }
      console.log("Database connection established.");

      // Check if the table exists in the information schema
      const checkTableSql = `
            SELECT COUNT(*) AS count 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
            AND table_name = ?`;

      console.log(`Checking if table "${db_table}" exists.`);

      connection.query(checkTableSql, [db_table], (err, results) => {
        if (err) {
          console.error("Database error while checking table existence:", err);
          connectionRelease(connection); // Release connection
          return callback(err, null);
        }

        console.log(`Table existence check result:`, results);

        // If the table does not exist, create it
        if (results[0].count === 0) {
          console.log(`Table "${db_table}" does not exist. Creating now.`);

          const createTableSql = `
                    CREATE TABLE \`${db_table}\` (
                        \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
                        \`cmt_id\` bigint(20) NOT NULL,
                        \`client_application_id\` bigint(20) NOT NULL,
                        \`branch_id\` int(11) NOT NULL,
                        \`customer_id\` int(11) NOT NULL,
                        \`status\` ENUM(
                            'nil', 'initiated', 'hold', 'closure_advice', 'wip', 'insuff', 'completed', 
                            'stopcheck', 'active_employment', 'not_doable', 'candidate_denied', 
                            'completed_green', 'completed_orange', 'completed_red', 'completed_yellow', 'completed_pink'
                        ) DEFAULT NULL,
                        \`is_submitted\` TINYINT(1) DEFAULT 0,
                        \`is_billed\` TINYINT(1) DEFAULT 0,
                        \`billed_date\` TIMESTAMP NULL DEFAULT NULL,
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
            console.log(`Table "${db_table}" created successfully.`);
            fetchData();
          });
        } else {
          console.log(`Table "${db_table}" exists. Proceeding to fetch data.`);
          fetchData();
        }

        function fetchData() {
          console.log(`Fetching data from table "${db_table}" for client_application_id: ${client_application_id}`);
          const sql = `SELECT * FROM \`${db_table}\` WHERE \`client_application_id\` = ?`;
          console.log(`sql - `, sql);

          connection.query(sql, [client_application_id], (err, results) => {
            connectionRelease(connection); // Release connection
            if (err) {
              console.error("Database query error:", err);
              return callback(err, null);
            }

            console.log("Query executed successfully. Results:", results);
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

  filterOptionsForCustomers: (callback) => {

    // Start a connection
    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      // Get the current date
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthYear = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

      let filterOptions = {
        overallCount: 0,
        qcStatusPendingCount: 0,
        wipCount: 0,
        insuffCount: 0,
        previousCompletedCount: 0,
        stopcheckCount: 0,
        activeEmploymentCount: 0,
        nilCount: 0,
        notDoableCount: 0,
        candidateDeniedCount: 0,
        completedGreenCount: 0,
        completedRedCount: 0,
        completedYellowCount: 0,
        completedPinkCount: 0,
        completedOrangeCount: 0,
      };

      const overallCountSQL = `
        SELECT
          COUNT(*) as overall_count
        FROM 
          client_applications a 
          JOIN customers c ON a.customer_id = c.id
          JOIN cmt_applications b ON a.id = b.client_application_id 
        WHERE
          (
            b.overall_status = 'wip'
            OR b.overall_status = 'insuff'
            OR (b.overall_status = 'completed' 
              AND LOWER(b.final_verification_status) IN ('green', 'red', 'yellow', 'pink', 'orange')
              AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
            )
          )
          AND (a.created_at LIKE '${yearMonth}-%' OR a.created_at LIKE '%-${monthYear}')
          AND (c.status = 1)
      `;

      connection.query(overallCountSQL, (err, overallCountResult) => {

        if (err) {
          console.error("Database query error:", err);
          // return callback(err, null);
          return callback(null, filterOptions);
        }

        if (overallCountResult.length > 0) {
          filterOptions.overallCount = overallCountResult[0].overall_count || 0;
        }

        const qcStatusPendingSQL = `
          select
            count(*) as overall_count
          from 
            client_applications a 
            JOIN customers c ON a.customer_id = c.id
            JOIN cmt_applications b ON a.id = b.client_application_id 
          where
            a.is_report_downloaded='1'
            AND (a.created_at LIKE '${yearMonth}-%' OR a.created_at LIKE '%-${monthYear}')
            AND LOWER(b.is_verify)='no'
            AND a.status='completed'
          order by 
            b.id DESC
        `;

        connection.query(qcStatusPendingSQL, (err, qcStatusPendingResult) => {
          connectionRelease(connection); // Release connection

          if (err) {
            console.error("Database query error:", err);
            // return callback(err, null);
            return callback(null, filterOptions);
          }

          if (qcStatusPendingResult.length > 0) {
            filterOptions.qcStatusPendingCount = qcStatusPendingResult[0].overall_count || 0;
          }

          const wipInsuffSQL = `
          SELECT 
            b.overall_status, 
            COUNT(*) AS overall_count
          FROM 
            client_applications a 
            JOIN customers c ON a.customer_id = c.id
            JOIN cmt_applications b ON a.id = b.client_application_id 
          WHERE 
            c.status = 1
            AND (a.created_at LIKE '${yearMonth}-%' OR a.created_at LIKE '%-${monthYear}')
            AND b.overall_status IN ('wip', 'insuff')
          GROUP BY 
            b.overall_status
        `;

          connection.query(wipInsuffSQL, (err, wipInsuffResult) => {
            connectionRelease(connection); // Release connection

            if (err) {
              console.error("Database query error:", err);
              return callback(null, filterOptions);
            }

            wipInsuffResult.forEach(row => {
              if (row.overall_status === 'wip') {
                filterOptions.wipCount = row.overall_count;
              } else if (row.overall_status === 'insuff') {
                filterOptions.insuffCount = row.overall_count;
              }
            });

            const completedStocheckactiveEmployementNilNotDoubleCandidateDeniedSQL = `
            SELECT
              COUNT(*) as overall_count,
              b.overall_status
            from 
              client_applications a 
              JOIN customers c ON a.customer_id = c.id
              JOIN cmt_applications b ON a.id = b.client_application_id 
            where
              b.overall_status IN ('completed','stopcheck','active employment','nil','not doable','candidate denied')
              AND (a.created_at LIKE '${yearMonth}-%' OR a.created_at LIKE '%-${monthYear}')
              AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
              AND c.status=1
            GROUP BY
              b.overall_status
          `;

            connection.query(completedStocheckactiveEmployementNilNotDoubleCandidateDeniedSQL, (err, completedStocheckactiveEmployementNilNotDoubleCandidateDeniedResult) => {
              connectionRelease(connection); // Release connection

              if (err) {
                console.error("Database query error:", err);
                return callback(null, filterOptions);
              }

              completedStocheckactiveEmployementNilNotDoubleCandidateDeniedResult.forEach(row => {
                if (row.overall_status === 'completed') {
                  filterOptions.previousCompletedCount = row.overall_count;
                } else if (row.overall_status === 'stopcheck') {
                  filterOptions.stopcheckCount = row.overall_count;
                } else if (row.overall_status === 'active employment') {
                  filterOptions.activeEmploymentCount = row.overall_count;
                } else if (row.overall_status === 'nil' || row.overall_status === '' || row.overall_status === null) {
                  filterOptions.nilCount = row.overall_count;
                } else if (row.overall_status === 'not doable') {
                  filterOptions.notDoableCount = row.overall_count;
                } else if (row.overall_status === 'candidate denied') {
                  filterOptions.candidateDeniedCount = row.overall_count;
                }
              });

              const completedGreenRedYellowPinkOrangeSQL = `
              SELECT
                COUNT(*) as overall_count,
                b.final_verification_status
              from
                client_applications a 
                JOIN customers c ON a.customer_id = c.id
                JOIN cmt_applications b ON a.id = b.client_application_id 
              where
                b.overall_status ='completed'
                AND (a.created_at LIKE '${yearMonth}-%' OR a.created_at LIKE '%-${monthYear}')
                AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')
                AND LOWER(b.final_verification_status) IN ('green', 'red', 'yellow', 'pink', 'orange')
                AND c.status=1
              GROUP BY
                b.final_verification_status
            `;

              connection.query(completedGreenRedYellowPinkOrangeSQL, (err, completedGreenRedYellowPinkOrangeResult) => {
                connectionRelease(connection); // Release connection

                if (err) {
                  console.error("Database query error:", err);
                  return callback(null, filterOptions);
                }

                completedGreenRedYellowPinkOrangeResult.forEach(row => {
                  const status = row.final_verification_status.toLowerCase();
                  if (status === 'green') {
                    filterOptions.completedGreenCount = row.overall_count;
                  } else if (status === 'red') {
                    filterOptions.completedRedCount = row.overall_count;
                  } else if (status === 'yellow') {
                    filterOptions.completedYellowCount = row.overall_count;
                  } else if (status === 'pink') {
                    filterOptions.completedPinkCount = row.overall_count;
                  } else if (status === 'orange') {
                    filterOptions.completedOrangeCount = row.overall_count;
                  }
                });
                const transformedFilterOptions = Object.entries(filterOptions).map(([status, count]) => ({
                  status,
                  count
                }));

                return callback(null, transformedFilterOptions);
              });
            });
          });

        });
      });
    });
  },

  filterOptionsForApplicationListing: (customer_id, branch_id, callback) => {

    // Start a connection
    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      // Get the current date
      const now = new Date();
      const month = `${String(now.getMonth() + 1).padStart(2, '0')}`;
      const year = `${now.getFullYear()}`;
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthYear = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

      let filterOptions = {
        overallCount: 0,
        wipCount: 0,
        insuffCount: 0,
        completedGreenCount: 0,
        completedRedCount: 0,
        completedYellowCount: 0,
        completedPinkCount: 0,
        completedOrangeCount: 0,
        previousCompletedCount: 0,
        stopcheckCount: 0,
        activeEmploymentCount: 0,
        nilCount: 0,
        candidateDeniedCount: 0,
        notDoableCount: 0,
        initiatedCount: 0,
        holdCount: 0,
        closureAdviceCount: 0,
        qcStatusPendingCount: 0,
        notReadyCount: 0,
        downloadReportCount: 0,
      };

      let conditions = {
        overallCount: `AND (b.overall_status='wip' OR b.overall_status='insuff' OR b.overall_status='initiated' OR b.overall_status='hold' OR b.overall_status='closure advice' OR b.overall_status='stopcheck' OR b.overall_status='active employment' OR b.overall_status='nil' OR b.overall_status='' OR b.overall_status='not doable' OR b.overall_status='candidate denied' OR (b.overall_status='completed' AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')) OR (b.overall_status='completed' AND b.report_date NOT LIKE '%-${month}-%'))`,
        wipCount: `AND (b.overall_status = 'wip')`,
        insuffCount: `AND (b.overall_status = 'insuff')`,
        completedGreenCount: `AND (b.overall_status = 'completed' AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')) AND LOWER(b.final_verification_status)='green'`,
        completedRedCount: `AND (b.overall_status = 'completed' AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')) AND LOWER(b.final_verification_status)='red'`,
        completedYellowCount: `AND (b.overall_status = 'completed' AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')) AND LOWER(b.final_verification_status)='yellow'`,
        completedPinkCount: `AND (b.overall_status = 'completed' AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')) AND LOWER(b.final_verification_status)='pink'`,
        completedOrangeCount: `AND (b.overall_status = 'completed' AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')) AND LOWER(b.final_verification_status)='orange'`,
        previousCompletedCount: `AND (b.overall_status = 'completed' AND b.report_date NOT LIKE '%-${month}-%')`,
        stopcheckCount: `AND (b.overall_status = 'stopcheck')`,
        activeEmploymentCount: `AND (b.overall_status = 'active employment')`,
        nilCount: `AND (b.overall_status = 'nil' OR b.overall_status = '')`,
        candidateDeniedCount: `AND (b.overall_status = 'candidate denied')`,
        notDoableCount: `AND (b.overall_status = 'not doable')`,
        initiatedCount: `AND (b.overall_status = 'initiated')`,
        holdCount: `AND (b.overall_status = 'hold')`,
        closureAdviceCount: `AND (b.overall_status = 'closure advice')`,
        qcStatusPendingCount: `AND a.is_report_downloaded='1' AND LOWER(b.is_verify)='no' AND a.status='completed'`,
        notReadyCount: `AND b.overall_status !='completed'`,
        downloadReportCount: `AND (b.overall_status = 'completed' AND (a.is_report_downloaded = '1' OR a.is_report_downloaded IS NULL))`
      };

      let sqlQueries = [];

      // Build SQL queries for each filter option
      for (let key in filterOptions) {
        if (filterOptions.hasOwnProperty(key)) {
          let condition = conditions[key];
          if (condition) {
            const SQL = `
              SELECT count(*) AS count
              FROM client_applications a
              JOIN customers c ON a.customer_id = c.id
              JOIN cmt_applications b ON a.id = b.client_application_id
              WHERE a.customer_id = ? 
              AND CAST(a.branch_id AS CHAR) = ? 
              AND (a.created_at LIKE '${yearMonth}-%' OR a.created_at LIKE '%-${monthYear}') 
              ${condition}
              AND c.status = 1
            `;

            sqlQueries.push(new Promise((resolve, reject) => {
              connection.query(SQL, [customer_id, branch_id], (err, result) => {
                if (err) {
                  console.error("Database query error:", err);
                  return reject(err);
                }
                filterOptions[key] = result[0] ? result[0].count : 0;
                resolve();
              });
            }));
          }
        }
      }

      // After all queries finish, execute the callback
      Promise.all(sqlQueries)
        .then(() => {
          const transformedFilterOptions = Object.entries(filterOptions).map(([status, count]) => ({
            status,
            count
          }));

          callback(null, transformedFilterOptions);
          connectionRelease(connection); // Release connection here
        })
        .catch((err) => {
          callback(err, null);
          connectionRelease(connection); // Ensure connection is released even on error
        });
    });
  },

  filterOptionsForBranch: (branch_id, callback) => {

    // Start a connection
    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      // Get the current date
      const now = new Date();
      const month = `${String(now.getMonth() + 1).padStart(2, '0')}`;
      const year = `${now.getFullYear()}`;
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthYear = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

      let filterOptions = {
        overallCount: 0,
        wipCount: 0,
        insuffCount: 0,
        completedGreenCount: 0,
        completedRedCount: 0,
        completedYellowCount: 0,
        completedPinkCount: 0,
        completedOrangeCount: 0,
        previousCompletedCount: 0,
        stopcheckCount: 0,
        activeEmploymentCount: 0,
        nilCount: 0,
        candidateDeniedCount: 0,
        notDoableCount: 0,
        initiatedCount: 0,
        holdCount: 0,
        closureAdviceCount: 0,
        qcStatusPendingCount: 0,
        notReadyCount: 0,
        downloadReportCount: 0,
      };

      let conditions = {
        overallCount: `AND (b.overall_status='wip' OR b.overall_status='insuff' OR b.overall_status='initiated' OR b.overall_status='hold' OR b.overall_status='closure advice' OR b.overall_status='stopcheck' OR b.overall_status='active employment' OR b.overall_status='nil' OR b.overall_status='' OR b.overall_status='not doable' OR b.overall_status='candidate denied' OR (b.overall_status='completed' AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')) OR (b.overall_status='completed' AND b.report_date NOT LIKE '%-${month}-%'))`,
        wipCount: `AND (b.overall_status = 'wip')`,
        insuffCount: `AND (b.overall_status = 'insuff')`,
        completedGreenCount: `AND (b.overall_status = 'completed' AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')) AND LOWER(b.final_verification_status)='green'`,
        completedRedCount: `AND (b.overall_status = 'completed' AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')) AND LOWER(b.final_verification_status)='red'`,
        completedYellowCount: `AND (b.overall_status = 'completed' AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')) AND LOWER(b.final_verification_status)='yellow'`,
        completedPinkCount: `AND (b.overall_status = 'completed' AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')) AND LOWER(b.final_verification_status)='pink'`,
        completedOrangeCount: `AND (b.overall_status = 'completed' AND (b.report_date LIKE '${yearMonth}-%' OR b.report_date LIKE '%-${monthYear}')) AND LOWER(b.final_verification_status)='orange'`,
        previousCompletedCount: `AND (b.overall_status = 'completed' AND b.report_date NOT LIKE '%-${month}-%')`,
        stopcheckCount: `AND (b.overall_status = 'stopcheck')`,
        activeEmploymentCount: `AND (b.overall_status = 'active employment')`,
        nilCount: `AND (b.overall_status = 'nil' OR b.overall_status = '')`,
        candidateDeniedCount: `AND (b.overall_status = 'candidate denied')`,
        notDoableCount: `AND (b.overall_status = 'not doable')`,
        initiatedCount: `AND (b.overall_status = 'initiated')`,
        holdCount: `AND (b.overall_status = 'hold')`,
        closureAdviceCount: `AND (b.overall_status = 'closure advice')`,
        qcStatusPendingCount: `AND a.is_report_downloaded='1' AND LOWER(b.is_verify)='no' AND a.status='completed'`,
        notReadyCount: `AND b.overall_status !='completed'`,
        downloadReportCount: `AND (b.overall_status = 'completed' AND (a.is_report_downloaded = '1' OR a.is_report_downloaded IS NULL))`
      };

      let sqlQueries = [];

      // Build SQL queries for each filter option
      for (let key in filterOptions) {
        if (filterOptions.hasOwnProperty(key)) {
          let condition = conditions[key];
          if (condition) {
            const SQL = `
              SELECT count(*) AS count
              FROM client_applications a
              JOIN customers c ON a.customer_id = c.id
              JOIN cmt_applications b ON a.id = b.client_application_id
              WHERE a.branch_id = ? 
              AND (a.created_at LIKE '${yearMonth}-%' OR a.created_at LIKE '%-${monthYear}') 
              ${condition}
              AND c.status = 1
            `;
            sqlQueries.push(new Promise((resolve, reject) => {
              connection.query(SQL, [branch_id], (err, result) => {
                if (err) {
                  console.error("Database query error:", err);
                  return reject(err);
                }
                filterOptions[key] = result[0] ? result[0].count : 0;
                resolve();
              });
            }));
          }
        }
      }

      // After all queries finish, execute the callback
      Promise.all(sqlQueries)
        .then(() => {
          const transformedFilterOptions = Object.entries(filterOptions).map(([status, count]) => ({
            status,
            count
          }));

          callback(null, transformedFilterOptions);
          connectionRelease(connection); // Release connection here
        })
        .catch((err) => {
          callback(err, null);
          connectionRelease(connection); // Ensure connection is released even on error
        });
    });
  },

  applicationByRefID: (ref_id, callback) => {
    // Start a connection
    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      // Use a parameterized query to prevent SQL injection
      const sql =
        "SELECT CA.*, C.name AS customer_name FROM `client_applications` AS CA INNER JOIN `customers` AS C ON C.id = CA.customer_id WHERE CA.`application_id` = ? ORDER BY `created_at` DESC";

      connection.query(sql, [ref_id], (err, results) => {
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

  getCMTApplicationById: (client_application_id, callback) => {
    // Start a connection
    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      const sql =
        "SELECT * FROM `cmt_applications` WHERE `client_application_id` = ?";
      connection.query(sql, [`${client_application_id}`], (err, results) => {
        connectionRelease(connection); // Release connection
        if (err) {
          console.error("Database query error: 23", err);
          return callback(err, null);
        }
        callback(null, results[0] || null); // Return the first result or null if not found
      });
    });
  },

  getCMTApplicationIDByClientApplicationId: (
    client_application_id,
    callback
  ) => {
    if (!client_application_id) {
      return callback(null, false);
    }

    // Start a connection
    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      const sql =
        "SELECT `id` FROM `cmt_applications` WHERE `client_application_id` = ?";

      connection.query(sql, [client_application_id], (err, results) => {
        connectionRelease(connection); // Release connection
        if (err) {
          console.error("Database query error: 24", err);
          return callback(err, null);
        }

        if (results.length > 0) {
          return callback(null, results[0].id);
        }
        callback(null, false);
      });
    });
  },

  getCMTAnnexureByApplicationId: (
    client_application_id,
    db_table,
    callback
  ) => {
    // Start a connection
    startConnection((err, connection) => {
      if (err) {
        return callback(err);
      }

      // 1. Check if the table exists
      const checkTableSql = `
        SELECT COUNT(*) AS count 
        FROM information_schema.tables 
        WHERE table_schema = ? AND table_name = ?`;

      connection.query(
        checkTableSql,
        [process.env.DB_NAME || "goldquest", db_table],
        (tableErr, tableResults) => {
          if (tableErr) {
            console.error("Error checking table existence:", tableErr);
            connectionRelease(connection); // Release connection
            return callback(tableErr);
          }
          if (tableResults[0].count === 0) {
            const createTableSql = `
              CREATE TABLE \`${db_table}\` (
                \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
                \`cmt_id\` bigint(20) NOT NULL,
                \`client_application_id\` bigint(20) NOT NULL,
                \`branch_id\` int(11) NOT NULL,
                \`customer_id\` int(11) NOT NULL,
                \`status\` ENUM(
                          'nil', 'initiated', 'hold', 'closure_advice', 'wip', 'insuff', 'completed', 
                          'stopcheck', 'active_employment', 'not_doable', 'candidate_denied', 
                          'completed_green', 'completed_orange', 'completed_red', 'completed_yellow', 'completed_pink'
                        ) DEFAULT NULL,
                \`is_submitted\` TINYINT(1) DEFAULT 0,
                \`is_billed\` TINYINT(1) DEFAULT 0,
                \`billed_date\` TIMESTAMP NULL DEFAULT NULL,
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
            const sql = `SELECT * FROM \`${db_table}\` WHERE \`client_application_id\` = ?`;
            connection.query(
              sql,
              [client_application_id],
              (queryErr, results) => {
                connectionRelease(connection); // Release connection
                if (queryErr) {
                  console.error("Error executing query:", queryErr);
                  return callback(queryErr);
                }
                const response = results.length > 0 ? results[0] : null;
                callback(null, response);
              }
            );
          }
        }
      );
    });
  },

  reportFormJsonByServiceID: (service_id, callback) => {
    // Start a connection
    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      // Use a parameterized query to prevent SQL injection
      const sql = `
                SELECT rf.json, s.excel_sorting 
                FROM report_forms rf 
                INNER JOIN services s ON s.id = rf.service_id 
                WHERE rf.service_id = ?
              `;
      connection.query(sql, [service_id], (err, results) => {
        connectionRelease(connection); // Release connection
        if (err) {
          console.error("Database query error: 25", err);
          return callback(err, null);
        }
        // Return single application or null if not found
        callback(null, results[0] || null);
      });
    });
  },

  generateReport: (
    mainJson,
    client_application_id,
    branch_id,
    customer_id,
    callback
  ) => {
    const fields = Object.keys(mainJson);

    // Start a connection
    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      // 1. Check for existing columns in cmt_applications
      const checkColumnsSql = `SHOW COLUMNS FROM \`cmt_applications\``;

      connection.query(checkColumnsSql, (err, results) => {
        if (err) {
          console.error("Error checking columns:", err);
          connectionRelease(connection); // Release connection
          return callback(err, null);
        }

        const existingColumns = results.map((row) => row.Field);
        const missingColumns = fields.filter(
          (field) => !existingColumns.includes(field)
        );

        // 2. Add missing columns if any
        const addMissingColumns = () => {
          if (missingColumns.length > 0) {
            const alterQueries = missingColumns.map((column) => {
              return `ALTER TABLE cmt_applications ADD COLUMN ${column} LONGTEXT`; // Adjust data type as needed
            });

            // Run all ALTER statements sequentially
            const alterPromises = alterQueries.map(
              (query) =>
                new Promise((resolve, reject) => {
                  connection.query(query, (alterErr) => {
                    if (alterErr) {
                      console.error("Error adding column:", alterErr);
                      return reject(alterErr);
                    }
                    resolve();
                  });
                })
            );

            return Promise.all(alterPromises);
          }
          return Promise.resolve(); // No missing columns, resolve immediately
        };

        // 3. Check if entry exists by client_application_id and insert/update accordingly
        const checkAndUpsertEntry = () => {
          const checkEntrySql =
            "SELECT * FROM cmt_applications WHERE client_application_id = ?";

          connection.query(
            checkEntrySql,
            [client_application_id],
            (entryErr, entryResults) => {
              if (entryErr) {
                console.error("Error checking entry existence:", entryErr);
                connectionRelease(connection); // Release connection
                return callback(entryErr, null);
              }

              // Add branch_id and customer_id to mainJson
              mainJson.branch_id = branch_id;
              mainJson.customer_id = customer_id;

              if (entryResults.length > 0) {
                // Update existing entry
                const updateSql =
                  "UPDATE cmt_applications SET ? WHERE client_application_id = ?";
                connection.query(
                  updateSql,
                  [mainJson, client_application_id],
                  (updateErr, updateResult) => {
                    connectionRelease(connection); // Release connection
                    if (updateErr) {
                      console.error("Error updating application:", updateErr);
                      return callback(updateErr, null);
                    }
                    callback(null, updateResult);
                  }
                );
              } else {
                // Insert new entry
                const insertSql = "INSERT INTO cmt_applications SET ?";
                connection.query(
                  insertSql,
                  {
                    ...mainJson,
                    client_application_id,
                    branch_id,
                    customer_id,
                  },
                  (insertErr, insertResult) => {
                    connectionRelease(connection); // Release connection
                    if (insertErr) {
                      console.error("Error inserting application:", insertErr);
                      return callback(insertErr, null);
                    }
                    callback(null, insertResult);
                  }
                );
              }
            }
          );
        };

        // Execute the operations in sequence
        addMissingColumns()
          .then(() => checkAndUpsertEntry())
          .catch((err) => {
            console.error("Error during ALTER or entry check:", err);
            connectionRelease(connection); // Release connection
            callback(err, null);
          });
      });
    });
  },

  createOrUpdateAnnexure: (
    cmt_id,
    client_application_id,
    branch_id,
    customer_id,
    db_table,
    mainJson,
    callback
  ) => {
    const fields = Object.keys(mainJson);
    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      const checkTableSql = `
        SELECT COUNT(*) AS count 
        FROM information_schema.tables 
        WHERE table_schema = ? AND table_name = ?`;

      connection.query(
        checkTableSql,
        [process.env.DB_NAME || "goldquest", db_table],
        (tableErr, tableResults) => {
          if (tableErr) {
            connectionRelease(connection);
            console.error("Error checking table existence:", tableErr);
            return callback(tableErr, null);
          }

          if (tableResults[0].count === 0) {
            const createTableSql = `
              CREATE TABLE \`${db_table}\` (
                \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
                \`cmt_id\` bigint(20) NOT NULL,
                \`client_application_id\` bigint(20) NOT NULL,
                \`branch_id\` int(11) NOT NULL,
                \`customer_id\` int(11) NOT NULL,
                \`status\` ENUM(
                          'nil', 'initiated', 'hold', 'closure_advice', 'wip', 'insuff', 'completed', 
                          'stopcheck', 'active_employment', 'not_doable', 'candidate_denied', 
                          'completed_green', 'completed_orange', 'completed_red', 'completed_yellow', 'completed_pink'
                        ) DEFAULT NULL,
                \`is_submitted\` TINYINT(1) DEFAULT 0,
                \`is_billed\` TINYINT(1) DEFAULT 0,
                \`billed_date\` TIMESTAMP NULL DEFAULT NULL,
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
                connectionRelease(connection);
                console.error("Error creating table:", createErr);
                return callback(createErr, null);
              }
              proceedToCheckColumns();
            });
          } else {
            proceedToCheckColumns();
          }

          function proceedToCheckColumns() {
            const checkColumnsSql = `SHOW COLUMNS FROM \`${db_table}\``;

            connection.query(checkColumnsSql, (err, results) => {
              if (err) {
                connectionRelease(connection);
                console.error("Error checking columns:", err);
                return callback(err, null);
              }

              // Extract column names from the results (use 'Field' instead of 'COLUMN_NAME')
              const existingColumns = results.map((row) => row.Field);

              // Filter out missing columns
              const missingColumns = fields.filter(
                (field) => !existingColumns.includes(field)
              );

              if (missingColumns.length > 0) {
                const alterQueries = missingColumns.map((column) => {
                  return `ALTER TABLE \`${db_table}\` ADD COLUMN \`${column}\` LONGTEXT`; // Adjust data type as necessary
                });

                const alterPromises = alterQueries.map(
                  (query) =>
                    new Promise((resolve, reject) => {
                      connection.query(query, (alterErr) => {
                        if (alterErr) {
                          console.error("Error adding column:", alterErr);
                          return reject(alterErr);
                        }
                        resolve();
                      });
                    })
                );

                Promise.all(alterPromises)
                  .then(() => checkAndUpdateEntry())
                  .catch((err) => {
                    connectionRelease(connection);
                    console.error("Error executing ALTER statements:", err);
                    callback(err, null);
                  });
              } else {
                checkAndUpdateEntry();
              }
            });
          }

          function checkAndUpdateEntry() {
            const checkEntrySql = `SELECT * FROM \`${db_table}\` WHERE client_application_id = ?`;
            connection.query(
              checkEntrySql,
              [client_application_id],
              (entryErr, entryResults) => {
                if (entryErr) {
                  connectionRelease(connection);
                  console.error("Error checking entry existence:", entryErr);
                  return callback(entryErr, null);
                }

                if (entryResults.length > 0) {
                  const updateSql = `UPDATE \`${db_table}\` SET ? WHERE client_application_id = ?`;
                  connection.query(
                    updateSql,
                    [mainJson, client_application_id],
                    (updateErr, updateResult) => {
                      connectionRelease(connection);
                      if (updateErr) {
                        console.error("Error updating application:", updateErr);
                        return callback(updateErr, null);
                      }
                      callback(null, updateResult);
                    }
                  );
                } else {
                  const insertSql = `INSERT INTO \`${db_table}\` SET ?`;
                  connection.query(
                    insertSql,
                    {
                      ...mainJson,
                      client_application_id,
                      branch_id,
                      customer_id,
                      cmt_id,
                    },
                    (insertErr, insertResult) => {
                      connectionRelease(connection);
                      if (insertErr) {
                        console.error(
                          "Error inserting application:",
                          insertErr
                        );
                        return callback(insertErr, null);
                      }
                      callback(null, insertResult);
                    }
                  );
                }
              }
            );
          }
        }
      );
    });
  },

  upload: (
    client_application_id,
    db_table,
    db_column,
    savedImagePaths,
    callback
  ) => {
    startConnection((err, connection) => {
      if (err) {
        console.error("Error starting connection:", err);
        return callback(false, {
          error: "Error starting database connection.",
          details: err,
        });
      }

      const checkTableSql = `
        SELECT COUNT(*) AS count 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() 
        AND table_name = ?`;

      connection.query(checkTableSql, [db_table], (tableErr, tableResults) => {
        if (tableErr) {
          connectionRelease(connection);
          console.error("Error checking table existence:", tableErr);
          return callback(false, {
            error: "Error checking table existence.",
            details: tableErr,
          });
        }

        if (tableResults[0].count === 0) {
          const createTableSql = `
            CREATE TABLE \`${db_table}\` (
              \`id\` bigint(20) NOT NULL AUTO_INCREMENT,
              \`cmt_id\` bigint(20) NOT NULL,
              \`client_application_id\` bigint(20) NOT NULL,
              \`branch_id\` int(11) NOT NULL,
              \`customer_id\` int(11) NOT NULL,
              \`status\` ENUM(
                          'nil', 'initiated', 'hold', 'closure_advice', 'wip', 'insuff', 'completed', 
                          'stopcheck', 'active_employment', 'not_doable', 'candidate_denied', 
                          'completed_green', 'completed_orange', 'completed_red', 'completed_yellow', 'completed_pink'
                        ) DEFAULT NULL,
              \`is_submitted\` TINYINT(1) DEFAULT 0,
              \`is_billed\` TINYINT(1) DEFAULT 0,
              \`billed_date\` TIMESTAMP NULL DEFAULT NULL,
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
              connectionRelease(connection);
              console.error("Error creating table:", createErr);
              return callback(false, {
                error: "Error creating table.",
                details: createErr,
              });
            }
            proceedToCheckColumns();
          });
        } else {
          proceedToCheckColumns();
        }

        function proceedToCheckColumns() {
          const currentColumnsSql = `SHOW COLUMNS FROM \`${db_table}\``;

          connection.query(currentColumnsSql, (err, results) => {
            if (err) {
              connectionRelease(connection);
              return callback(false, {
                error: "Error fetching current columns.",
                details: err,
              });
            }

            // Extract column names from the results (use 'Field' instead of 'COLUMN_NAME')
            const existingColumns = results.map((row) => row.Field);
            const expectedColumns = [db_column];

            // Filter out missing columns
            const missingColumns = expectedColumns.filter(
              (field) => !existingColumns.includes(field)
            );

            const addColumnPromises = missingColumns.map((column) => {
              return new Promise((resolve, reject) => {
                const alterTableSql = `ALTER TABLE \`${db_table}\` ADD COLUMN \`${column}\` LONGTEXT`;
                connection.query(alterTableSql, (alterErr) => {
                  if (alterErr) {
                    reject(alterErr);
                  } else {
                    resolve();
                  }
                });
              });
            });

            Promise.all(addColumnPromises)
              .then(() => {
                const insertSql = `UPDATE \`${db_table}\` SET \`${db_column}\` = ? WHERE \`client_application_id\` = ?`;
                const joinedPaths = savedImagePaths.join(", ");
                connection.query(
                  insertSql,
                  [joinedPaths, client_application_id],
                  (queryErr, results) => {
                    connectionRelease(connection);

                    if (queryErr) {
                      console.error("Error updating records:", queryErr);
                      return callback(false, {
                        error: "Error updating records.",
                        details: queryErr,
                      });
                    }
                    callback(true, results);
                  }
                );
              })
              .catch((columnErr) => {
                connectionRelease(connection);
                console.error("Error adding columns:", columnErr);
                callback(false, {
                  error: "Error adding columns.",
                  details: columnErr,
                });
              });
          });
        }
      });
    });
  },

  getAttachmentsByClientAppID: (client_application_id, callback) => {
    startConnection((err, connection) => {
      if (err) {
        console.error("Error starting connection:", err);
        return callback(err, null);
      }

      const sql = "SELECT `services` FROM `client_applications` WHERE `id` = ?";
      connection.query(sql, [client_application_id], (err, results) => {
        if (err) {
          console.error("Database query error: 26", err);
          connectionRelease(connection);
          return callback(err, null);
        }

        if (results.length > 0) {
          const services = results[0].services.split(","); // Split services by comma
          const dbTableFileInputs = {}; // Object to store db_table and its file inputs
          let completedQueries = 0; // To track completed queries

          // Step 1: Loop through each service and perform actions
          services.forEach((service) => {
            const query = "SELECT `json` FROM `report_forms` WHERE `id` = ?";
            connection.query(query, [service], (err, result) => {
              completedQueries++;

              if (err) {
                console.error("Error fetching JSON for service:", service, err);
              } else if (result.length > 0) {
                try {
                  // Parse the JSON data
                  const jsonData = JSON.parse(result[0].json);
                  const dbTable = jsonData.db_table;

                  // Initialize an array for the dbTable if not already present
                  if (!dbTableFileInputs[dbTable]) {
                    dbTableFileInputs[dbTable] = [];
                  }

                  // Extract inputs with type 'file' and add to the db_table array
                  jsonData.rows.forEach((row) => {
                    row.inputs.forEach((input) => {
                      if (input.type === "file") {
                        dbTableFileInputs[dbTable].push(input.name);
                      }
                    });
                  });
                } catch (parseErr) {
                  console.error(
                    "Error parsing JSON for service:",
                    service,
                    parseErr
                  );
                }
              }

              // When all services have been processed
              if (completedQueries === services.length) {
                // Fetch the host from the database
                const hostSql = `SELECT \`cloud_host\` FROM \`app_info\` WHERE \`status\` = 1 AND \`interface_type\` = ? ORDER BY \`updated_at\` DESC LIMIT 1`;
                connection.query(hostSql, ["backend"], (err, hostResults) => {
                  if (err) {
                    console.error("Database query error: 27", err);
                    connectionRelease(connection);
                    return callback(err, null);
                  }

                  // Check if an entry was found for the host
                  const host =
                    hostResults.length > 0
                      ? hostResults[0].cloud_host
                      : "www.example.com"; // Fallback host

                  let finalAttachments = [];
                  let tableQueries = 0;
                  const totalTables = Object.keys(dbTableFileInputs).length;

                  // Loop through each db_table and perform a query
                  for (const [dbTable, fileInputNames] of Object.entries(
                    dbTableFileInputs
                  )) {
                    const selectQuery = `SELECT ${fileInputNames && fileInputNames.length > 0
                      ? fileInputNames.join(", ")
                      : "*"
                      } FROM ${dbTable} WHERE client_application_id = ?`;

                    connection.query(
                      selectQuery,
                      [client_application_id],
                      (err, rows) => {
                        tableQueries++;

                        if (err) {
                          console.error(
                            `Error querying table ${dbTable}:`,
                            err
                          );
                        } else {
                          // Combine values from each row into a single string
                          rows.forEach((row) => {
                            const attachments = Object.values(row)
                              .filter((value) => value) // Remove any falsy values
                              .join(","); // Join values by comma

                            // Split and concatenate the URL with each attachment
                            attachments.split(",").forEach((attachment) => {
                              finalAttachments.push(`${attachment}`);
                            });
                          });
                        }

                        // Step 3: When all db_table queries are completed, return finalAttachments
                        if (tableQueries === totalTables) {
                          connectionRelease(connection); // Release connection before callback
                          callback(null, finalAttachments.join(", "));
                        }
                      }
                    );
                  }
                });
              }
            });
          });
        } else {
          connectionRelease(connection); // Release connection if no results found
          callback(null, []); // Return an empty array if no results found
        }
      });
    });
  },

  updateReportDownloadStatus: (id, callback) => {
    const sql = `
      UPDATE client_applications
      SET is_report_downloaded = 1
      WHERE id = ?
    `;

    /*
    const sql = `
      UPDATE client_applications ca
      JOIN cmt ON ca.id = cmt.client_application_id
      SET ca.is_report_downloaded = 1
      WHERE 
        ca.id = ? 
        AND cmt.report_date IS NOT NULL
        AND TRIM(cmt.report_date) != '0000-00-00'
        AND TRIM(cmt.report_date) != ''
        AND cmt.overall_status IN ('complete', 'completed')
        AND (cmt.is_verify = 'yes' OR cmt.is_verify = 1 OR cmt.is_verify = '1');
    `;
    */

    startConnection((err, connection) => {
      if (err) {
        return callback(err, null);
      }

      connection.query(sql, [id], (queryErr, results) => {
        connectionRelease(connection);

        if (queryErr) {
          console.error("Error in query execution:", queryErr);
          return callback(queryErr, null);
        }
        callback(null, results);
      });
    });
  },
};

module.exports = Customer;
