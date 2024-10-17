const crypto = require("crypto");
const Acknowledgement = require("../../models/admin/acknowledgementModel");
const Customer = require("../../models/customer/customerModel");
const AdminCommon = require("../../models/admin/commonModel");
const Service = require("../../models/admin/serviceModel");

const {
  acknowledgementMail,
} = require("../../mailer/customer/acknowledgementMail");

// Helper function to fetch service names in series
const getServiceNames = async (serviceIds) => {
  let serviceNames = [];

  for (let i = 0; i < serviceIds.length; i++) {
    try {
      const currentService = await new Promise((resolve, reject) => {
        Service.getServiceById(serviceIds[i], (err, service) => {
          if (err) return reject(err);
          resolve(service);
        });
      });

      if (currentService && currentService.title) {
        serviceNames.push(currentService.title);
      }
    } catch (error) {
      console.error("Error fetching service data:", error);
    }
  }

  return serviceNames;
};

// Controller to list all customers
exports.list = (req, res) => {
  const { admin_id, _token } = req.query;

  let missingFields = [];
  if (!admin_id || admin_id === "") missingFields.push("Admin ID");
  if (!_token || _token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = JSON.stringify({ acknowledgement: "view" });
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (authResult) => {
    if (!authResult.status) {
      return res.status(403).json({
        status: false,
        message: authResult.message, // Return the message from the authorization function
      });
    }

    // Verify admin token
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, tokenResult) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!tokenResult.status) {
        return res
          .status(401)
          .json({ status: false, message: tokenResult.message });
      }

      const newToken = tokenResult.newToken;

      // Fetch customers from Acknowledgement model
      Acknowledgement.list((err, customers) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({
            status: false,
            message: err.message,
            token: newToken,
          });
        }

        res.json({
          status: true,
          message: "Customers fetched successfully",
          customers: customers,
          totalResults: customers ? customers.length : 0,
          token: newToken,
        });
      });
    });
  });
};

exports.sendNotification = async (req, res) => {
  const { admin_id, _token, customer_id } = req.body;

  // Check for missing fields
  const requiredFields = { admin_id, _token, customer_id };
  const missingFields = Object.keys(requiredFields)
    .filter((field) => !requiredFields[field])
    .map((field) => field.replace(/_/g, " "));

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = JSON.stringify({ acknowledgement: "send-notification" });

  // Check admin authorization
  AdminCommon.isAdminAuthorizedForAction(
    admin_id,
    action,
    async (authResult) => {
      if (!authResult.status) {
        return res.status(403).json({
          status: false,
          message: authResult.message,
        });
      }

      // Verify admin token
      AdminCommon.isAdminTokenValid(
        _token,
        admin_id,
        async (err, tokenResult) => {
          if (err) {
            console.error("Error checking token validity:", err);
            return res
              .status(500)
              .json({ status: false, message: err.message });
          }

          if (!tokenResult.status) {
            return res.status(401).json({
              status: false,
              message: tokenResult.message,
            });
          }

          const newToken = tokenResult.newToken;

          // Fetch the specific customer
          Customer.getActiveCustomerById(
            customer_id,
            async (err, currentCustomer) => {
              if (err) {
                console.error("Database error during customer retrieval:", err);
                return res.status(500).json({
                  status: false,
                  message: "Failed to retrieve customer. Please try again.",
                  token: newToken,
                });
              }

              if (!currentCustomer) {
                return res.status(404).json({
                  status: false,
                  message: "Customer not found.",
                  token: newToken,
                });
              }

              // Fetch acknowledgements for the customer
              Acknowledgement.listByCustomerID(
                customer_id,
                async (err, customers) => {
                  if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({
                      status: false,
                      message: err.message,
                      token: newToken,
                    });
                  }

                  // Ensure customers is in the correct format
                  if (!Array.isArray(customers.data)) {
                    return res.status(500).json({
                      status: false,
                      message: "Invalid data format.",
                      token: newToken,
                    });
                  }

                  // Process each customer
                  for (const customer of customers.data) {
                    console.log(`Customer ID: ${customer.id}`);
                    console.log(`Admin ID: ${customer.admin_id}`);
                    console.log(
                      `Client Unique ID: ${customer.client_unique_id}`
                    );
                    console.log(`Customer Name: ${customer.name.trim()}`);
                    console.log(
                      `Application Count: ${customer.applicationCount}`
                    );

                    // Loop through the branches
                    for (const branch of customer.branches) {
                      console.log(`  Branch ID: ${branch.id}`);
                      console.log(`  Branch Name: ${branch.name.trim()}`);
                      console.log(
                        `  Is Head: ${branch.is_head ? "Yes" : "No"}`
                      );
                      console.log(`  Applications:`);

                      // Process applications
                      for (const application of branch.applications) {
                        console.log(
                          `    Application ID: ${application.application_id}`
                        );
                        console.log(
                          `    Application Name: ${application.name}`
                        );
                        console.log(`    Services: ${application.services}`);

                        const serviceIds =
                          typeof application.services === "string" &&
                          application.services.trim() !== ""
                            ? application.services
                                .split(",")
                                .map((id) => id.trim())
                            : [];

                        // Fetch and log service names in series
                        const serviceNames = await getServiceNames(serviceIds);
                        console.log(
                          `    Service Names: ${serviceNames.join(", ")}`
                        );
                      }

                      console.log(
                        `  Application Count: ${branch.applicationCount}`
                      );
                    }

                    console.log("-------------------------");
                  }

                  // Send response
                  if (customers.data.length > 0) {
                    return res.json({
                      status: true,
                      message: "Customers fetched successfully",
                      customers: customers.data,
                      totalResults: customers.data.length,
                      token: newToken,
                    });
                  } else {
                    return res.json({
                      status: false,
                      message: "No applications for acknowledgement",
                      token: newToken,
                    });
                  }
                }
              );
            }
          );
        }
      );
    }
  );
};
