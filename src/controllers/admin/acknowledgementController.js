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

  const action = "acknowledgement_email";
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

  const action = "acknowledgement_email";
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
                    for (const branch of customer.branches) {
                      for (const application of branch.applications) {
                        const serviceIds =
                          typeof application.services === "string" &&
                          application.services.trim() !== ""
                            ? application.services
                                .split(",")
                                .map((id) => id.trim())
                            : [];

                        // Fetch and log service names in series
                        const serviceNames = await getServiceNames(serviceIds);
                        application.serviceNames = serviceNames.join(", ");
                      }
                    }
                  }
                  if (customers.data.length > 0) {
                    for (const customer of customers.data) {
                      // Loop through the branches
                      for (const branch of customer.branches) {
                        let emailApplicationArr;
                        let ccArr;
                        if (branch.is_head !== 1) {
                          emailApplicationArr = branch.applications;
                          ccArr = [];
                        } else {
                          emailApplicationArr = customers.data;
                          ccArr = JSON.parse(currentCustomer.emails).map(
                            (email) => ({
                              name: currentCustomer.name,
                              email: email.trim(),
                            })
                          );
                        }

                        const toArr = [
                          { name: branch.name, email: branch.email },
                        ];

                        acknowledgementMail(
                          "acknowledgement",
                          "email",
                          branch.is_head,
                          customer.name.trim(),
                          customer.client_unique_id,
                          emailApplicationArr,
                          toArr,
                          ccArr
                        )
                          .then(() => {})
                          .catch((emailError) => {
                            console.error("Error sending email:", emailError);

                            return res.status(200).json({
                              status: true,
                              message: `failed to send mail.`,
                              token: newToken,
                            });
                          });
                      }
                    }
                  }
                  // Send response
                  if (customers.data.length > 0) {
                    let applicationIds = [];

                    customers.data.forEach((customer) => {
                      customer.branches.forEach((branch) => {
                        branch.applications.forEach((application) => {
                          applicationIds.push(application.id);
                        });
                      });
                    });

                    // Join the IDs into a comma-separated string
                    const applicationIdsString = applicationIds.join(",");
                    Acknowledgement.updateAckByCustomerID(
                      applicationIdsString,
                      customer_id,
                      (err, affectedRows) => {
                        if (err) {
                          return res.status(500).json({
                            message: "Error updating acknowledgment status",
                            error: err,
                            token: newToken,
                          });
                        }

                        return res.json({
                          status: true,
                          message: "Customers fetched successfully",
                          customers: customers.data,
                          totalResults: customers.data.length,
                          token: newToken,
                        });
                      }
                    );
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
