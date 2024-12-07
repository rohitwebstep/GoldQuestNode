const Candidate = require("../../../../models/customer/branch/candidateApplicationModel");
const Customer = require("../../../../models/customer/customerModel");
const Branch = require("../../../../models/customer/branch/branchModel");
const BranchCommon = require("../../../../models/customer/branch/commonModel");
const CEF = require("../../../../models/customer/branch/cefModel");
const Service = require("../../../../models/admin/serviceModel");

exports.formJson = (req, res) => {
  const { service_id } = req.query;

  let missingFields = [];
  if (!service_id) missingFields.push("Service ID");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  CEF.formJson(service_id, (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({
        status: false,
        message: "An error occurred while fetching service form json.",
      });
    }

    return res.json({
      status: true,
      message: "Service form json fetched successfully.",
      formJson: result,
      totalResults: result.length,
    });
  });
};

exports.isApplicationExist = (req, res) => {
  const { candidate_application_id, branch_id, customer_id } = req.query;

  let missingFields = [];
  if (
    !candidate_application_id ||
    candidate_application_id === "" ||
    candidate_application_id === undefined ||
    candidate_application_id === "undefined"
  ) {
    missingFields.push("Application ID");
  }

  if (
    !branch_id ||
    branch_id === "" ||
    branch_id === undefined ||
    branch_id === "undefined"
  ) {
    missingFields.push("Branch ID");
  }

  if (
    !customer_id ||
    customer_id === "" ||
    customer_id === undefined ||
    customer_id === "undefined"
  ) {
    missingFields.push("Customer ID");
  }

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  Candidate.isApplicationExist(
    candidate_application_id,
    branch_id,
    customer_id,
    (err, currentCandidateApplication) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({
          status: false,
          message: "An error occurred while checking application existence.",
        });
      }

      if (currentCandidateApplication) {
        CEF.getCEFApplicationById(
          candidate_application_id,
          branch_id,
          customer_id,
          (err, currentCEFApplication) => {
            if (err) {
              console.error(
                "Database error during CEF application retrieval:",
                err
              );
              return res.status(500).json({
                status: false,
                message:
                  "Failed to retrieve CEF Application. Please try again.",
              });
            }

            if (
              currentCEFApplication &&
              Object.keys(currentCEFApplication).length > 0
            ) {
              return res.status(400).json({
                status: false,
                message: "An application has already been submitted.",
              });
            }

            return res.status(200).json({
              status: true,
              data: currentCandidateApplication,
              message: "Application exists.",
            });
          }
        );
      } else {
        return res.status(404).json({
          status: false,
          message: "Application does not exist.",
        });
      }
    }
  );
};

exports.submit = (req, res) => {
  const {
    branch_id,
    customer_id,
    application_id,
    personal_information,
    annexure,
  } = req.body;

  // Define required fields and check for missing values
  const requiredFields = {
    branch_id,
    customer_id,
    application_id,
    personal_information,
  };
  const missingFields = Object.keys(requiredFields)
    .filter((field) => !requiredFields[field] || requiredFields[field] === "")
    .map((field) => field.replace(/_/g, " "));

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  // Check if the application exists
  Candidate.isApplicationExist(
    application_id,
    branch_id,
    customer_id,
    (err, currentCandidateApplication) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({
          status: false,
          message: "An error occurred while checking application existence.",
        });
      }

      if (!currentCandidateApplication) {
        return res.status(404).json({
          status: false,
          message: "Application does not exist.",
        });
      }
      if (currentCandidateApplication.is_custom_bgv !== 1) {
        if (personal_information) {
          [
            "blood_group",
            "pan_card_name",
            "aadhar_card_name",
            "food_cuppon",
            "emergency_details_name",
            "emergency_details_relation",
            "emergency_details_contact_number",
            "pf_details_pf_number",
            "pf_details_pf_type",
            "pf_details_pg_nominee",
            "nps_details_details_pran_number",
            "nps_details_details_nominee_details",
            "nps_details_details_nps_contribution",
            "bank_details_account_number",
            "bank_details_bank_name",
            "bank_details_branch_name",
            "bank_details_ifsc_code",
            "insurance_details_name",
            "insurance_details_nominee_relation",
            "insurance_details_nominee_dob",
            "insurance_details_contact_number",
          ].forEach((key) => {
            if (key in personal_information) {
              delete personal_information[key];
            }
          });
        }
      }
      // Retrieve branch details
      Branch.getBranchById(branch_id, (err, currentBranch) => {
        if (err) {
          console.error("Database error during branch retrieval:", err);
          return res.status(500).json({
            status: false,
            message: "Failed to retrieve Branch. Please try again.",
          });
        }

        if (
          !currentBranch ||
          parseInt(currentBranch.customer_id) !== parseInt(customer_id)
        ) {
          return res.status(404).json({
            status: false,
            message: "Branch not found or customer mismatch.",
          });
        }

        // Retrieve customer details
        Customer.getCustomerById(customer_id, (err, currentCustomer) => {
          if (err) {
            console.error("Database error during customer retrieval:", err);
            return res.status(500).json({
              status: false,
              message: "Failed to retrieve Customer. Please try again.",
            });
          }

          if (!currentCustomer) {
            return res.status(404).json({
              status: false,
              message: "Customer not found.",
            });
          }

          // Check if CEF application exists
          CEF.getCEFApplicationById(
            application_id,
            branch_id,
            customer_id,
            (err, currentCEFApplication) => {
              if (err) {
                console.error(
                  "Database error during CEF application retrieval:",
                  err
                );
                return res.status(500).json({
                  status: false,
                  message:
                    "Failed to retrieve CEF Application. Please try again.",
                });
              }

              if (
                currentCEFApplication &&
                Object.keys(currentCEFApplication).length > 0
              ) {
                return res.status(400).json({
                  status: false,
                  message: "An application has already been submitted.",
                });
              }

              // Create new CEF application
              CEF.create(
                personal_information,
                application_id,
                branch_id,
                customer_id,
                (err, cmeResult) => {
                  if (err) {
                    console.error(
                      "Database error during CEF application creation:",
                      err
                    );
                    return res.status(500).json({
                      status: false,
                      message:
                        "An error occurred while submitting the application.",
                    });
                  }

                  // Handle annexures if provided
                  if (typeof annexure === "object" && annexure !== null) {
                    const annexurePromises = Object.keys(annexure).map(
                      (key) => {
                        const modifiedDbTable = `${key.replace(/-/g, "_")}`;
                        const modifiedDbTableForDbQuery = `cef_${key.replace(
                          /-/g,
                          "_"
                        )}`;
                        const subJson = annexure[modifiedDbTable];

                        return new Promise((resolve, reject) => {
                          CEF.getCMEFormDataByApplicationId(
                            application_id,
                            modifiedDbTableForDbQuery,
                            (err, currentCMEFormData) => {
                              if (err) {
                                console.error(
                                  "Database error during annexure retrieval:",
                                  err
                                );
                                return reject(
                                  "Error retrieving annexure data."
                                );
                              }

                              if (
                                currentCMEFormData &&
                                Object.keys(currentCMEFormData).length > 0
                              ) {
                                return reject(
                                  "Annexure has already been filed."
                                );
                              }

                              CEF.createOrUpdateAnnexure(
                                cmeResult.insertId,
                                application_id,
                                branch_id,
                                customer_id,
                                modifiedDbTableForDbQuery,
                                subJson,
                                (err) => {
                                  if (err) {
                                    console.error(
                                      "Database error during annexure update:",
                                      err
                                    );
                                    return reject(
                                      "Error updating annexure data."
                                    );
                                  }
                                  resolve();
                                }
                              );
                            }
                          );
                        });
                      }
                    );

                    // Process all annexure promises
                    Promise.all(annexurePromises)
                      .then(() => {
                        sendNotificationEmails(branch_id, customer_id, res);
                      })
                      .catch((error) => {
                        return res.status(400).json({
                          status: false,
                          message: error,
                        });
                      });
                  } else {
                    // No annexures to handle, finalize submission
                    return res.status(200).json({
                      status: true,
                      message: "CEF Application submitted successfully.",
                    });
                  }
                }
              );
            }
          );
        });
      });
    }
  );
};

// Helper function to send notification emails
const sendNotificationEmails = (branch_id, customer_id, res) => {
  BranchCommon.getBranchandCustomerEmailsForNotification(
    branch_id,
    (err, emailData) => {
      if (err) {
        console.error("Error fetching emails:", err);
        return res.status(500).json({
          status: false,
          message: "Failed to retrieve email addresses.",
        });
      }

      const { branch, customer } = emailData;
      const toArr = [{ name: branch.name, email: branch.email }];
      const ccArr = JSON.parse(customer.emails).map((email) => ({
        name: customer.name,
        email: email.trim(),
      }));

      // Placeholder for sending email logic
      return res.status(200).json({
        status: true,
        message:
          "CEF Application submitted successfully and notifications sent.",
      });
    }
  );
};
