require("dotenv").config();
const mysql = require("mysql2");

// Log environment variables for debugging
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
  const attemptConnection = (retriesLeft) => {
    pool.getConnection((err, connection) => {
      if (err) {
        console.error("Error getting connection from pool:", err);
        if (retriesLeft > 0) {
          console.log(
            `Connection attempt failed. Retrying... (${retriesLeft} attempts left)`
          );
          setTimeout(() => attemptConnection(retriesLeft - 1), 2000);
          // attemptConnection(retriesLeft - 1);
        } else {
          console.error("Error getting connection from pool:", err); // Log error for debugging
          return callback(err, null); // Return error after retries are exhausted
        }
      } else {
        console.log("Connection established"); // Optional: Log successful connection
        callback(null, connection); // Pass the connection to the callback
      }
    });
  };

  attemptConnection(retries); // Initial connection attempt
};

// Function to release a connection
const connectionRelease = (connection) => {
  if (connection && !connection._closing) {
    connection.release(); // Release the connection back to the pool
    console.log("Connection released"); // Optional: Log connection release
  } else {
    console.warn("Attempted to release an already closed connection");
  }
};

module.exports = { pool, startConnection, connectionRelease };
