require("dotenv").config();
const mysql = require("mysql2");

/*
// Validate critical environment variables
const requiredEnv = ["DB_HOST", "DB_USER", "DB_NAME", "DB_PASSWORD"];
const missingEnv = requiredEnv.filter((env) => !process.env[env]);

if (missingEnv.length > 0) {
  console.error(
    `Missing critical environment variables: ${missingEnv.join(
      ", "
    )}. Please check your .env file.`
  );
  process.exit(1);
}


// Log environment variables for debugging (optional, avoid in production)
if (process.env.NODE_ENV !== "production") {
  console.log("Environment Variables:");
  console.log("DB_HOST:", process.env.DB_HOST);
  console.log("DB_USER:", process.env.DB_USER);
  console.log("DB_NAME:", process.env.DB_NAME);
}
  */
 
const dbHost = process.env.DB_HOST || "localhost";
const dbUser = process.env.DB_USER | "goldquest";
const dbName = process.env.DB_NAME | "goldquest";
const dbPassword = process.env.DB_PASSWORD | "GoldQuest@135";

// Create a connection pool
const pool = mysql.createPool({
  host: dbHost,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 120000, // 2 minutes for individual connection attempts
});

// Function to start a connection with retry mechanism
const startConnection = (callback, retries = 20, retryDelay = 500) => {
  if (typeof callback !== "function") {
    throw new Error("Callback must be a function");
  }

  const attemptConnection = (retriesLeft) => {
    pool.getConnection((err, connection) => {
      if (err) {
        console.error(`Error getting connection from pool: ${err.message}`);
        if (retriesLeft > 0) {
          console.log(
            `Connection attempt failed. Retrying in ${retryDelay}ms... (${retriesLeft} attempts left)`
          );
          setTimeout(() => attemptConnection(retriesLeft - 1), retryDelay);
        } else {
          callback(err, null);
        }
      } else if (connection.state === "disconnected") {
        console.warn("Connection is disconnected. Retrying...");
        connection.release();
        attemptConnection(retriesLeft - 1);
      } else {
        console.log("Connection established successfully");
        callback(null, connection);
      }
    });
  };

  attemptConnection(retries);
};

// Function to release a connection
const connectionRelease = (connection) => {
  if (connection) {
    try {
      connection.release(); // Release the connection back to the pool
      console.log("Connection successfully released back to the pool");
    } catch (err) {
      console.error("Error releasing connection:", err.message);
      console.debug("Error details:", err); // Log full error details for debugging
    }
  } else {
    console.warn("No valid connection to release");
  }
};

// Exporting the pool and helper functions
module.exports = { pool, startConnection, connectionRelease };
