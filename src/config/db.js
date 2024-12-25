require("dotenv").config();
const mysql = require("mysql2");

// Validate critical environment variables
if (
  !process.env.DB_HOST ||
  !process.env.DB_USER ||
  !process.env.DB_NAME ||
  !process.env.DB_PASSWORD
) {
  console.error(
    "Missing critical environment variables. Please check your .env file."
  );
  process.exit(1);
}

// Log environment variables for debugging (optional, avoid in production)
console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_NAME:", process.env.DB_NAME);

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 120000, // 2 minutes for individual connection attempts
});

// Function to start a connection with retry mechanism
const startConnection = (callback, retries = 20) => {
  if (typeof callback !== "function") {
    throw new Error("Callback must be a function");
  }

  const attemptConnection = (retriesLeft) => {
    pool.getConnection((err, connection) => {
      if (err) {
        console.error(`Error getting connection from pool: ${err.message}`);
        if (retriesLeft > 0) {
          console.log(
            `Connection attempt failed. Retrying... (${retriesLeft} attempts left)`
          );
          setTimeout(() => attemptConnection(retriesLeft - 1), 2000);
        } else {
          callback(err, null); // Return error after retries are exhausted
        }
      } else {
        console.log("Connection established"); // Log successful connection
        callback(null, connection); // Pass the connection to the callback
      }
    });
  };

  attemptConnection(retries); // Initial connection attempt
};

// Function to release a connection
const connectionRelease = (connection) => {
  if (connection) {
    try {
      connection.release(); // Release the connection back to the pool
      console.log("Connection released"); // Optional: Log connection release
    } catch (err) {
      console.error("Error releasing connection:", err.message);
    }
  } else {
    console.warn("No valid connection to release");
  }
};

module.exports = { pool, startConnection, connectionRelease };
