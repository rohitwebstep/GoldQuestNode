const crypto = require("crypto");
const { pool, startConnection, connectionRelease } = require("../../config/db");

// Function to hash the password using MD5
const hashPassword = (password) =>
  crypto.createHash("md5").update(password).digest("hex");

const Customer = {
  checkUniqueId: (clientUniqueId, callback) => {
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      const sql = `
        SELECT COUNT(*) AS count
        FROM \`customers\`
        WHERE \`client_unique_id\` = ?
      `;
      connection.query(sql, [clientUniqueId], (err, results) => {
        connectionRelease(connection); // Ensure connection is released

        if (err) {
          console.error("Database query error: 53", err);
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

  checkUniqueIdForUpdate: (customer_id, clientUniqueId, callback) => {
    startConnection((err, connection) => {
      if (err) {
        console.error("Failed to connect to the database:", err);
        return callback(
          { status: false, message: "Database connection error" },
          null
        );
      }
      const sql = `
        SELECT COUNT(*) AS count
        FROM \`customers\`
        WHERE \`client_unique_id\` = ? AND \`id\` != ?
      `;
      connection.query(sql, [clientUniqueId, customer_id], (err, results) => {
        connectionRelease(connection); // Ensure connection is released

        if (err) {
          console.error("Database query error: 54", err);
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

  checkUsername: (username, callback) => {
    startConnection((err, connection) => {
      if (err) {
        console.error("Failed to connect to the database:", err);
        return callback(
          { status: false, message: "Database connection error" },
          null
        );
      }
      const sql = `
        SELECT COUNT(*) AS count
        FROM \`customers\`
        WHERE \`username\` = ?
      `;
      connection.query(sql, [username], (err, results) => {
        connectionRelease(connection); // Ensure connection is released

        if (err) {
          console.error("Database query error: 55", err);
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

  checkUsernameForUpdate: (customer_id, username, callback) => {
    startConnection((err, connection) => {
      if (err) {
        console.error("Failed to connect to the database:", err);
        return callback(
          { status: false, message: "Database connection error" },
          null
        );
      }
      const sql = `
        SELECT COUNT(*) AS count
        FROM \`customers\`
        WHERE \`username\` = ? AND \`id\` != ?
      `;
      connection.query(sql, [username, customer_id], (err, results) => {
        connectionRelease(connection); // Ensure connection is released

        if (err) {
          console.error("Database query error: 56", err);
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

  create: (customerData, callback) => {
    startConnection((err, connection) => {
      if (err) {
        console.error("Failed to connect to the database:", err);
        return callback(
          { status: false, message: "Database connection error" },
          null
        );
      }
      const sqlCustomers = `
        INSERT INTO \`customers\` (\`client_unique_id\`, \`name\`, \`additional_login\`, \`username\`, \`profile_picture\`, \`emails\`, \`mobile\`, \`services\`, \`admin_id\`, \`is_custom_bgv\`
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const valuesCustomers = [
        customerData.client_unique_id,
        customerData.name,
        customerData.additional_login,
        customerData.username,
        customerData.profile_picture,
        customerData.emails_json,
        customerData.mobile_number,
        customerData.services,
        customerData.admin_id,
        customerData.custom_bgv,
      ];

      connection.query(sqlCustomers, valuesCustomers, (err, results) => {
        connectionRelease(connection); // Ensure connection is released

        if (err) {
          console.error("Database insertion error for customers:", err);
          return callback({ message: err }, null);
        }

        const customerId = results.insertId;
        callback(null, { insertId: customerId });
      });
    });
  },

  documentUpload: (customer_id, db_column, savedImagePaths, callback) => {
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      const sqlUpdateCustomer = `
        UPDATE customer_metas 
        SET ${db_column} = ?
        WHERE id = ?
      `;

      connection.query(
        sqlUpdateCustomer,
        [savedImagePaths, customer_id],
        (err, results) => {
          connectionRelease(connection); // Ensure connection is released

          if (err) {
            console.error("Error updating customer meta:", err);
            return callback(
              { message: "Database update failed.", error: err },
              null
            );
          }

          return callback(null, results);
        }
      );
    });
  },

  update: (customerId, customerData, callback) => {
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      const sqlUpdateCustomer = `
        UPDATE \`customers\` 
        SET 
          \`name\` = ?, 
          \`additional_login\` = ?, 
          \`username\` = ?, 
          \`profile_picture\` = ?, 
          \`emails\` = ?, 
          \`mobile\` = ?, 
          \`services\` = ?, 
          \`admin_id\` = ?
        WHERE \`id\` = ?
      `;

      const valuesUpdateCustomer = [
        customerData.name,
        customerData.additional_login,
        customerData.username,
        customerData.profile_picture,
        customerData.emails_json,
        customerData.mobile,
        JSON.stringify(customerData.services),
        customerData.admin_id,
        customerId,
      ];

      connection.query(
        sqlUpdateCustomer,
        valuesUpdateCustomer,
        (err, results) => {
          connectionRelease(connection); // Ensure connection is released

          if (err) {
            console.error("Database update error for customers:", err);
            return callback({ message: err }, null);
          }

          callback(null, results);
        }
      );
    });
  },

  createCustomerMeta: (metaData, callback) => {
    const sqlCustomerMetas = `
      INSERT INTO \`customer_metas\` (
        \`customer_id\`, \`address\`,
        \`single_point_of_contact\`,
        \`escalation_point_contact\`,
        \`contact_person_name\`,
        \`gst_number\`, \`tat_days\`, 
        \`agreement_date\`, \`agreement_duration\`, \`custom_template\`,
        \`custom_address\`, \`state\`, \`state_code\`, 
        \`client_standard\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const valuesCustomerMetas = [
      metaData.customer_id,
      metaData.address,
      metaData.client_spoc,
      metaData.name_of_escalation,
      metaData.contact_person,
      metaData.gst_number,
      metaData.tat_days,
      metaData.agreement_date,
      metaData.agreement_duration,
      metaData.custom_template || "no",
      metaData.custom_address || null,
      metaData.state,
      metaData.state_code,
      metaData.client_standard,
    ];

    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      connection.query(
        sqlCustomerMetas,
        valuesCustomerMetas,
        (err, results) => {
          connectionRelease(connection);
          if (err) {
            console.error("Database insertion error for customer_metas:", err);
            return callback(
              {
                message: "Database insertion error for customer_metas",
                error: err,
              },
              null
            );
          }

          callback(null, results);
        }
      );
    });
  },

  updateCustomerMetaByCustomerId: (customerId, metaData, callback) => {
    const sqlUpdateCustomerMetas = `
      UPDATE \`customer_metas\` 
      SET 
        \`address\` = ?, 
        \`single_point_of_contact\` = ?,
        \`escalation_point_contact\` = ?,
        \`contact_person_name\` = ?,
        \`gst_number\` = ?, 
        \`tat_days\` = ?, 
        \`agreement_date\` = ?, 
        \`agreement_duration\` = ?, 
        \`custom_template\` = ?, 
        \`custom_address\` = ?, 
        \`state\` = ?, 
        \`state_code\` = ?, 
        \`client_standard\` = ?
      WHERE \`customer_id\` = ?
    `;

    const valuesUpdateCustomerMetas = [
      metaData.address,
      metaData.client_spoc,
      metaData.escalation_point_contact,
      metaData.contact_person,
      metaData.gst_number,
      metaData.tat_days,
      metaData.agreement_date,
      metaData.agreement_duration,
      metaData.custom_template || "no",
      metaData.custom_address || null,
      metaData.state,
      metaData.state_code,
      metaData.client_standard,
      customerId,
    ];

    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      connection.query(
        sqlUpdateCustomerMetas,
        valuesUpdateCustomerMetas,
        (err, results) => {
          connectionRelease(connection);
          if (err) {
            console.error("Database update error for customer_metas:", err);
            return callback(
              {
                message: "Database update error for customer_metas",
                error: err,
              },
              null
            );
          }

          callback(null, results);
        }
      );
    });
  },

  list: (callback) => {
    const sql = `
      SELECT 
        customers.*, 
        customers.id AS main_id, 
        customer_metas.*, 
        customer_metas.id AS meta_id,
        COALESCE(branch_counts.branch_count, 0) AS branch_count
      FROM 
        customers
      LEFT JOIN 
        customer_metas 
      ON 
        customers.id = customer_metas.customer_id
      LEFT JOIN 
        (
          SELECT 
            customer_id, 
            COUNT(*) AS branch_count
          FROM 
            branches
          GROUP BY 
            customer_id
        ) AS branch_counts
      ON 
        customers.id = branch_counts.customer_id
      WHERE 
        customers.status != '0'
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      connection.query(sql, (err, results) => {
        connectionRelease(connection);
        if (err) {
          console.error("Database query error: 57", err);
          return callback(err, null);
        }
        callback(null, results);
      });
    });
  },

  inactiveList: (callback) => {
    const sql = `
      SELECT 
        customers.*, 
        customers.id AS main_id, 
        customer_metas.*, 
        customer_metas.id AS meta_id,
        COALESCE(branch_counts.branch_count, 0) AS branch_count
      FROM 
        customers
      LEFT JOIN 
        customer_metas 
      ON 
        customers.id = customer_metas.customer_id
      LEFT JOIN 
        (
          SELECT 
            customer_id, 
            COUNT(*) AS branch_count
          FROM 
            branches
          GROUP BY 
            customer_id
        ) AS branch_counts
      ON 
        customers.id = branch_counts.customer_id
      WHERE 
        customers.status != '1'
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      connection.query(sql, (err, results) => {
        connectionRelease(connection);
        if (err) {
          console.error("Database query error: 58", err);
          return callback(err, null);
        }
        callback(null, results);
      });
    });
  },

  basicInfoByID: (customer_id, callback) => {
    const sql = `
      SELECT 
        customers.client_unique_id,
        customers.name, 
        customers.profile_picture, 
        customers.emails, 
        customers.mobile, 
        customers.services, 
        customer_metas.single_point_of_contact,
        customers.id, 
        customer_metas.address,
        customer_metas.gst_number,
        customer_metas.id AS meta_id
      FROM 
        customers
      LEFT JOIN 
        customer_metas 
      ON 
        customers.id = customer_metas.customer_id
      WHERE 
        customers.id = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      connection.query(sql, [customer_id], (err, results) => {
        connectionRelease(connection);
        if (err) {
          console.error("Database query error: 59", err);
          return callback(err, null);
        }
        callback(null, results);
      });
    });
  },

  getCustomerById: (id, callback) => {
    const sql = "SELECT * FROM `customers` WHERE `id` = ?";
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      connection.query(sql, [id], (err, results) => {
        connectionRelease(connection);
        if (err) {
          console.error("Database query error: 60", err);
          return callback(err, null);
        }
        callback(null, results[0]);
      });
    });
  },

  getActiveCustomerById: (id, callback) => {
    const sql = "SELECT * FROM `customers` WHERE `id` = ? AND `status` = ?";
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      connection.query(sql, [id, "1"], (err, results) => {
        connectionRelease(connection);
        if (err) {
          console.error("Database query error: 61", err);
          return callback(err, null);
        }
        callback(null, results[0]);
      });
    });
  },

  getAllBranchesByCustomerId: (customerId, callback) => {
    const sql = "SELECT * FROM `branches` WHERE `customer_id` = ?";
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      connection.query(sql, [customerId], (err, results) => {
        connectionRelease(connection);
        if (err) {
          console.error("Database query error: 62", err);
          return callback(err, null);
        }
        callback(null, results); // Returns all matching entries
      });
    });
  },

  getClientUniqueIDByCustomerId: (id, callback) => {
    const sql = "SELECT `client_unique_id` FROM `customers` WHERE `id` = ?";
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      connection.query(sql, [id], (err, results) => {
        connectionRelease(connection);
        if (err) {
          console.error("Database query error: 63", err);
          return callback(err, null);
        }

        // Check if the result exists and `client_unique_id` is not null or empty
        if (results.length > 0 && results[0].client_unique_id) {
          return callback(null, results[0].client_unique_id);
        } else {
          return callback(null, false); // Return false if not found or invalid
        }
      });
    });
  },

  getCustomerMetaById: (id, callback) => {
    const sql = "SELECT * FROM `customer_metas` WHERE `customer_id` = ?";
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      connection.query(sql, [id], (err, results) => {
        connectionRelease(connection);
        if (err) {
          console.error("Database query error: 64", err);
          return callback(err, null);
        }
        callback(null, results[0]);
      });
    });
  },

  active: (id, callback) => {
    const sql = `
      UPDATE \`customers\`
      SET \`status\` = ?
      WHERE \`id\` = ?
    `;
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      connection.query(sql, ["1", id], (err, results) => {
        connectionRelease(connection);
        if (err) {
          console.error("Database query error: 65", err);
          return callback(err, null);
        }
        callback(null, results);
      });
    });
  },

  inactive: (id, callback) => {
    const sql = `
      UPDATE \`customers\`
      SET \`status\` = ?
      WHERE \`id\` = ?
    `;
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      connection.query(sql, ["0", id], (err, results) => {
        connectionRelease(connection);
        if (err) {
          console.error("Database query error: 66", err);
          return callback(err, null);
        }
        callback(null, results);
      });
    });
  },

  delete: (id, callback) => {
    const sql = `
        DELETE FROM \`customers\`
        WHERE \`id\` = ?
      `;
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      connection.query(sql, [id], (err, results) => {
        connectionRelease(connection);
        if (err) {
          console.error("Database query error: 67", err);
          return callback(err, null);
        }
        callback(null, results);
      });
    });
  },

  findByEmailOrMobile: (username, callback) => {
    const sql = `
      SELECT \`id\`, \`email\`, \`mobile\`, \`password\`
      FROM \`customers\`
      WHERE \`email\` = ? OR \`mobile\` = ?
    `;
    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      connection.query(sql, [username, username], (err, results) => {
        connectionRelease(connection);
        if (err) {
          console.error("Database query error: 68", err);
          return callback(
            { message: "Database query error", error: err },
            null
          );
        }

        if (results.length === 0) {
          return callback(
            { message: "No customer found with the provided email or mobile" },
            null
          );
        }

        callback(null, results);
      });
    });
  },

  validatePassword: (username, password, callback) => {
    const sql = `
      SELECT \`id\`, \`password\` FROM \`customers\`
      WHERE \`email\` = ? OR \`mobile\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      connection.query(sql, [username, username], (err, results) => {
        connectionRelease(connection);
        if (err) {
          console.error("Database query error: 69", err);
          return callback(
            { message: "Database query error", error: err },
            null
          );
        }

        if (results.length === 0) {
          return callback(
            { message: "No customer found with the provided email or mobile" },
            null
          );
        }

        const customer = results[0];
        if (hashPassword(password) !== customer.password) {
          return callback({ message: "Incorrect password" }, null);
        }

        callback(null, results);
      });
    });
  },

  updateToken: (id, token, tokenExpiry, callback) => {
    const sql = `
      UPDATE \`customers\`
      SET \`login_token\` = ?, \`token_expiry\` = ?
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      connection.query(sql, [token, tokenExpiry, id], (err, results) => {
        connectionRelease(connection);
        if (err) {
          console.error("Database query error: 70", err);
          return callback(
            { message: "Database update error", error: err },
            null
          );
        }

        if (results.affectedRows === 0) {
          return callback(
            {
              message:
                "Token update failed. Customer not found or no changes made.",
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
      SELECT \`login_token\`
      FROM \`customers\`
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      connection.query(sql, [id], (err, results) => {
        connectionRelease(connection);
        if (err) {
          console.error("Database query error: 71", err);
          return callback(
            { message: "Database query error", error: err },
            null
          );
        }

        if (results.length === 0) {
          return callback({ message: "Customer not found" }, null);
        }

        callback(null, results);
      });
    });
  },

  fetchBranchPasswordByEmail: (email, callback) => {
    const sql = `
      SELECT \`password\` FROM \`branches\` WHERE \`email\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      connection.query(sql, [email], (err, results) => {
        connectionRelease(connection);
        if (err) {
          console.error("Database query error: 72", err);
          return callback(err, null);
        }

        // Check if results exist and are not empty
        if (results.length > 0 && results[0].password) {
          return callback(null, results[0].password); // Return the password
        } else {
          return callback(null, false); // Return false if no result found or empty
        }
      });
    });
  },

  logout: (id, callback) => {
    const sql = `
      UPDATE \`customers\`
      SET \`login_token\` = NULL, \`token_expiry\` = NULL
      WHERE \`id\` = ?
    `;

    startConnection((err, connection) => {
      if (err) {
        return callback(
          { message: "Failed to connect to the database", error: err },
          null
        );
      }
      connection.query(sql, [id], (err, results) => {
        connectionRelease(connection);
        if (err) {
          console.error("Database query error: 73", err);
          return callback(
            { message: "Database update error", error: err },
            null
          );
        }

        if (results.affectedRows === 0) {
          return callback(
            {
              message:
                "Token clear failed. Customer not found or no changes made.",
            },
            null
          );
        }

        callback(null, results);
      });
    });
  },
};

module.exports = Customer;
