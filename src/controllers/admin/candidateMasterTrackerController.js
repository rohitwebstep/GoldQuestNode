const crypto = require("crypto");
const CandidateMasterTrackerModel = require("../../models/admin/candidateMasterTrackerModel");
const Customer = require("../../models/customer/customerModel");
const CandidateApplication = require("../../models/customer/branch/candidateApplicationModel");
const Branch = require("../../models/customer/branch/branchModel");
const AdminCommon = require("../../models/admin/commonModel");
const Admin = require("../../models/admin/adminModel");
const App = require("../../models/appModel");
const BranchCommon = require("../../models/customer/branch/commonModel");
const {
  finalReportMail,
} = require("../../mailer/admin/client-master-tracker/finalReportMail");
const {
  qcReportCheckMail,
} = require("../../mailer/admin/client-master-tracker/qcReportCheckMail");
const {
  readyForReport,
} = require("../../mailer/admin/client-master-tracker/readyForReport");

const fs = require("fs");
const path = require("path");
const { generatePDF } = require("../../utils/finalReportPdf");
const { cdfDataPDF } = require("../../utils/cdfDataPDF");
const { upload, saveImage, saveImages } = require("../../utils/cloudImageSave");

// Controller to list all customers
exports.list = (req, res) => {
  const { admin_id, _token, filter_status } = req.query;

  // Check for missing fields
  const missingFields = [];
  if (!admin_id) missingFields.push("Admin ID");
  if (!_token) missingFields.push("Token");

  // Return error if there are missing fields
  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "cmt_application";
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

      // Fetch all required data
      const dataPromises = [
        new Promise((resolve) =>
          CandidateMasterTrackerModel.list(filter_status, (err, result) => {
            if (err) return resolve([]);
            resolve(result);
          })
        ),
      ];

      Promise.all(dataPromises).then(([customers, filterOptions]) => {
        res.json({
          status: true,
          message: "Clients fetched successfully",
          data: {
            customers,
          },
          totalResults: {
            customers: customers.length,
          },
          token: newToken,
        });
      });
    });
  });
};

exports.test = async (req, res) => {
  try {
    const client_application_id = 3;
    const client_unique_id = "GQ-INDV";
    const application_id = "GQ-INDV-1";
    const branch_id = 3;
    const customer_id = 2;
    const name = "Rohit Sisodia";

    const today = new Date();
    const formattedDate = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    // Generate the PDF
    const pdfTargetDirectory = `uploads/customers/${client_unique_id}/client-applications/${application_id}/final-reports/`;

    const pdfFileName = `${name}_${formattedDate}.pdf`
      .replace(/\s+/g, "-")
      .toLowerCase();
    const pdfPath = await cdfDataPDF(
      client_application_id,
      branch_id,
      customer_id,
      pdfFileName,
      pdfTargetDirectory
    );
    console.log("PDF generated at:", pdfPath);
    // If successful, return the result
    res.json({
      status: true,
      message: "PDF generated successfully",
      pdfPath,
    });
  } catch (error) {
    console.error("Error:", error.message);

    // Return error response
    res.status(500).json({
      status: false,
      message: "Failed to generate PDF",
      error: error.message,
    });
  }
};

exports.listByCustomerId = (req, res) => {
  const { customer_id, filter_status, admin_id, _token } = req.query;

  let missingFields = [];
  if (!customer_id || customer_id === "") missingFields.push("Customer ID");
  if (!admin_id || admin_id === "") missingFields.push("Admin ID");
  if (!_token || _token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "cmt_application";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }

    // Verify admin token
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      CandidateMasterTrackerModel.listByCustomerID(
        customer_id,
        filter_status,
        (err, result) => {
          if (err) {
            console.error("Database error:", err);
            return res
              .status(500)
              .json({ status: false, message: err.message, token: newToken });
          }

          res.json({
            status: true,
            message: "Branches tracker fetched successfully",
            customers: result,
            totalResults: result.length,
            token: newToken,
          });
        }
      );
    });
  });
};

exports.applicationListByBranch = (req, res) => {
  const { filter_status, branch_id, admin_id, _token, status } = req.query;

  let missingFields = [];
  if (
    !branch_id ||
    branch_id === "" ||
    branch_id === undefined ||
    branch_id === "undefined"
  )
    missingFields.push("Branch ID");
  if (
    !admin_id ||
    admin_id === "" ||
    admin_id === undefined ||
    admin_id === "undefined"
  )
    missingFields.push("Admin ID");
  if (
    !_token ||
    _token === "" ||
    _token === undefined ||
    _token === "undefined"
  )
    missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "cmt_application";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }
    // Verify admin token
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      if (
        !status ||
        status === "" ||
        status === undefined ||
        status === "undefined"
      ) {
        let status = null;
      }

      const dataPromises = [
        new Promise((resolve) =>
          CandidateMasterTrackerModel.applicationListByBranch(
            filter_status,
            branch_id,
            status,
            (err, result) => {
              if (err) return resolve([]);
              resolve(result);
            }
          )
        ),
      ];

      Promise.all(dataPromises).then(([applications]) => {
        res.json({
          status: true,
          message: "candidate applications fetched successfully",
          data: {
            applications,
          },
          totalResults: {
            applications: applications.length,
          },
          token: newToken,
        });
      });
    });
  });
};

exports.cefApplicationByID = (req, res) => {
  const { application_id, branch_id, admin_id, _token } = req.query;

  let missingFields = [];
  if (
    !application_id ||
    application_id === "" ||
    application_id === undefined ||
    application_id === "undefined"
  )
    missingFields.push("Application ID");
  if (
    !branch_id ||
    branch_id === "" ||
    branch_id === undefined ||
    branch_id === "undefined"
  )
    missingFields.push("Branch ID");
  if (
    !admin_id ||
    admin_id === "" ||
    admin_id === undefined ||
    admin_id === "undefined"
  )
    missingFields.push("Admin ID");
  if (
    !_token ||
    _token === "" ||
    _token === undefined ||
    _token === "undefined"
  )
    missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "cmt_application";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }

    // Verify admin token
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      CandidateMasterTrackerModel.applicationByID(
        application_id,
        branch_id,
        (err, application) => {
          if (err) {
            console.error("Database error:", err);
            return res
              .status(500)
              .json({ status: false, message: err.message, token: newToken });
          }

          if (!application) {
            return res.status(404).json({
              status: false,
              message: "Application not found",
              token: newToken,
            });
          }

          const service_ids = Array.isArray(application.services)
            ? application.services
            : application.services.split(",").map((item) => item.trim());

          CandidateMasterTrackerModel.cefApplicationByID(
            application_id,
            branch_id,
            (err, CEFApplicationData) => {
              if (err) {
                console.error("Database error:", err);
                return res.status(500).json({
                  status: false,
                  message: err.message,
                  token: newToken,
                });
              }

              Branch.getBranchById(branch_id, (err, currentBranch) => {
                if (err) {
                  console.error("Database error during branch retrieval:", err);
                  return res.status(500).json({
                    status: false,
                    message: "Failed to retrieve Branch. Please try again.",
                    token: newToken,
                  });
                }

                if (!currentBranch) {
                  return res.status(404).json({
                    status: false,
                    message: "Branch not found.",
                    token: newToken,
                  });
                }

                Admin.list((err, adminList) => {
                  if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({
                      status: false,
                      message: err.message,
                      token: newToken,
                    });
                  }
                  Customer.getCustomerById(
                    parseInt(currentBranch.customer_id),
                    (err, currentCustomer) => {
                      if (err) {
                        console.error(
                          "Database error during customer retrieval:",
                          err
                        );
                        return res.status(500).json({
                          status: false,
                          message:
                            "Failed to retrieve Customer. Please try again.",
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

                      const serviceResults = []; // Array to store results of service calls

                      // Use Promise.all to handle multiple async requests
                      const servicePromises = service_ids.map((service_id) => {
                        return new Promise((resolve, reject) => {
                          CEF.formJson(service_id, (err, result) => {
                            if (err) {
                              console.error("Database error:", err);
                              reject({
                                status: false,
                                message:
                                  "An error occurred while fetching service form json.",
                              });
                            } else {
                              resolve(result);
                            }
                          });
                        });
                      });

                      // Wait for all service requests to complete
                      Promise.all(servicePromises)
                        .then((allResults) => {
                          return res.json({
                            status: true,
                            message: "Application fetched successfully 2",
                            application,
                            CEFData: CEFApplicationData,
                            branchInfo: currentBranch,
                            customerInfo: currentCustomer,
                            serviceData: allResults,
                            admins: adminList,
                            token: newToken,
                          });
                        })
                        .catch((err) => {
                          return res.json({
                            status: true,
                            message: "Application fetched successfully 2",
                            application,
                            CEFData: CEFApplicationData,
                            branchInfo: currentBranch,
                            customerInfo: currentCustomer,
                            admins: adminList,
                            token: newToken,
                            err,
                          });
                        });
                    }
                  );
                });
              });
            }
          );
        }
      );
    });
  });
};

exports.davApplicationByID = (req, res) => {
  const { application_id, branch_id, admin_id, _token } = req.query;

  let missingFields = [];
  if (
    !application_id ||
    application_id === "" ||
    application_id === undefined ||
    application_id === "undefined"
  )
    missingFields.push("Application ID");
  if (
    !branch_id ||
    branch_id === "" ||
    branch_id === undefined ||
    branch_id === "undefined"
  )
    missingFields.push("Branch ID");
  if (
    !admin_id ||
    admin_id === "" ||
    admin_id === undefined ||
    admin_id === "undefined"
  )
    missingFields.push("Admin ID");
  if (
    !_token ||
    _token === "" ||
    _token === undefined ||
    _token === "undefined"
  )
    missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "cmt_application";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }

    // Verify admin token
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      CandidateMasterTrackerModel.applicationByID(
        application_id,
        branch_id,
        (err, application) => {
          if (err) {
            console.error("Database error:", err);
            return res
              .status(500)
              .json({ status: false, message: err.message, token: newToken });
          }

          if (!application) {
            return res.status(404).json({
              status: false,
              message: "Application not found",
              token: newToken,
            });
          }

          CandidateMasterTrackerModel.davApplicationByID(
            application_id,
            branch_id,
            (err, DAVApplicationData) => {
              if (err) {
                console.error("Database error:", err);
                return res.status(500).json({
                  status: false,
                  message: err.message,
                  token: newToken,
                });
              }

              Branch.getBranchById(branch_id, (err, currentBranch) => {
                if (err) {
                  console.error("Database error during branch retrieval:", err);
                  return res.status(500).json({
                    status: false,
                    message: "Failed to retrieve Branch. Please try again.",
                    token: newToken,
                  });
                }

                if (!currentBranch) {
                  return res.status(404).json({
                    status: false,
                    message: "Branch not found.",
                    token: newToken,
                  });
                }

                Admin.list((err, adminList) => {
                  if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({
                      status: false,
                      message: err.message,
                      token: newToken,
                    });
                  }
                  Customer.getCustomerById(
                    parseInt(currentBranch.customer_id),
                    (err, currentCustomer) => {
                      if (err) {
                        console.error(
                          "Database error during customer retrieval:",
                          err
                        );
                        return res.status(500).json({
                          status: false,
                          message:
                            "Failed to retrieve Customer. Please try again.",
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

                      return res.json({
                        status: true,
                        message: "Application fetched successfully 2",
                        application,
                        CEFData: DAVApplicationData,
                        branchInfo: currentBranch,
                        customerInfo: currentCustomer,
                        admins: adminList,
                        token: newToken,
                      });
                    }
                  );
                });
              });
            }
          );
        }
      );
    });
  });
};

exports.filterOptions = (req, res) => {
  const { admin_id, _token } = req.query;

  let missingFields = [];
  if (
    !admin_id ||
    admin_id === "" ||
    admin_id === undefined ||
    admin_id === "undefined"
  )
    missingFields.push("Admin ID");
  if (
    !_token ||
    _token === "" ||
    _token === undefined ||
    _token === "undefined"
  )
    missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "cmt_application";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }

    // Verify admin token
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      CandidateMasterTrackerModel.filterOptions((err, filterOptions) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({
            status: false,
            message: "An error occurred while fetching Filter options data.",
            error: err,
            token: newToken,
          });
        }

        if (!filterOptions) {
          return res.status(404).json({
            status: false,
            message: "Filter options Data not found.",
            token: newToken,
          });
        }

        res.status(200).json({
          status: true,
          message: "Filter options fetched successfully.",
          filterOptions,
          token: newToken,
        });
      });
    });
  });
};

exports.filterOptionsForBranch = (req, res) => {
  const { branch_id, admin_id, _token } = req.query;

  let missingFields = [];
  if (
    !branch_id ||
    branch_id === "" ||
    branch_id === undefined ||
    branch_id === "undefined"
  ) {
    missingFields.push("Branch ID");
  }
  if (
    !admin_id ||
    admin_id === "" ||
    admin_id === undefined ||
    admin_id === "undefined"
  ) {
    missingFields.push("Admin ID");
  }
  if (
    !_token ||
    _token === "" ||
    _token === undefined ||
    _token === "undefined"
  ) {
    missingFields.push("Token");
  }

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "cmt_application";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }

    // Verify admin token
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      CandidateMasterTrackerModel.filterOptionsForBranch(
        branch_id,
        (err, filterOptions) => {
          if (err) {
            console.error("Database error:", err);
            return res.status(500).json({
              status: false,
              message: "An error occurred while fetching Filter options data.",
              error: err,
              token: newToken,
            });
          }

          if (!filterOptions) {
            return res.status(404).json({
              status: false,
              message: "Filter options Data not found.",
              token: newToken,
            });
          }

          res.status(200).json({
            status: true,
            message: "Filter options fetched successfully.",
            filterOptions,
            token: newToken,
          });
        }
      );
    });
  });
};

exports.sendLink = (req, res) => {
  const { application_id, branch_id, customer_id, admin_id, _token } =
    req.query;

  // Define required fields
  const requiredFields = {
    application_id,
    branch_id,
    customer_id,
    admin_id,
    _token,
  };

  // Check for missing fields
  const missingFields = Object.keys(requiredFields)
    .filter((field) => !requiredFields[field] || requiredFields[field] === "")
    .map((field) => field.replace(/_/g, " "));

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "cmt_application";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }

    // Verify admin token
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json({ status: false, message: err.message });
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      CandidateMasterTrackerModel.applicationByID(
        application_id,
        branch_id,
        (err, application) => {
          if (err) {
            console.error("Database error:", err);
            return res
              .status(500)
              .json({ status: false, message: err.message, token: newToken });
          }

          if (!application) {
            return res.status(404).json({
              status: false,
              message: "Application not found",
              token: newToken,
            });
          }

          CandidateMasterTrackerModel.cefApplicationByID(
            application_id,
            branch_id,
            (err, CEFApplicationData) => {
              if (err) {
                if (
                  err.message.toLowerCase().includes("bgv") &&
                  err.message.toLowerCase().includes("not") &&
                  err.message.toLowerCase().includes("submitted")
                ) {
                  // Your logic here
                } else {
                  console.error("Database error:", err);
                  return res.status(500).json({
                    status: false,
                    message: err.message,
                    token: newToken,
                  });
                }
              } else {
                return res.status(500).json({
                  status: false,
                  message: "BFV form already submited",
                  token: newToken,
                });
              }
              const action = "candidate_application";
              BranchCommon.isBranchAuthorizedForAction(
                branch_id,
                action,
                (result) => {
                  if (!result.status) {
                    return res.status(403).json({
                      status: false,
                      message: result.message,
                    });
                  }
                  let sub_user_id;
                  BranchCommon.isBranchTokenValid(
                    _token,
                    sub_user_id || null,
                    branch_id,
                    (err, result) => {
                      if (err) {
                        console.error("Error checking token validity:", err);
                        return res
                          .status(500)
                          .json({ status: false, message: err.message });
                      }

                      if (!result.status) {
                        return res
                          .status(401)
                          .json({ status: false, message: result.message });
                      }

                      const newToken = result.newToken;

                      Candidate.checkUniqueEmpId(employee_id, (err, exists) => {
                        if (err) {
                          console.error("Error checking unique ID:", err);
                          return res.status(500).json({
                            status: false,
                            message: err.message,
                            token: newToken,
                          });
                        }

                        if (exists) {
                          return res.status(400).json({
                            status: false,
                            message: `Candidate Employee ID '${employee_id}' already exists.`,
                            token: newToken,
                          });
                        }

                        Candidate.create(
                          {
                            branch_id,
                            name,
                            employee_id,
                            mobile_number,
                            email,
                            services: services || null,
                            package: package || null,
                            customer_id,
                          },
                          (err, result) => {
                            if (err) {
                              console.error(
                                "Database error during candidate application creation:",
                                err
                              );
                              BranchCommon.branchActivityLog(
                                branch_id,
                                "Candidate Application",
                                "Create",
                                "0",
                                null,
                                err,
                                () => {}
                              );
                              return res.status(500).json({
                                status: false,
                                message: err.message,
                                token: newToken,
                              });
                            }

                            BranchCommon.branchActivityLog(
                              branch_id,
                              "Candidate Application",
                              "Create",
                              "1",
                              `{id: ${result.insertId}}`,
                              null,
                              () => {}
                            );

                            BranchCommon.getBranchandCustomerEmailsForNotification(
                              branch_id,
                              (emailError, emailData) => {
                                if (emailError) {
                                  console.error(
                                    "Error fetching emails:",
                                    emailError
                                  );
                                  return res.status(500).json({
                                    status: false,
                                    message:
                                      "Failed to retrieve email addresses.",
                                    token: newToken,
                                  });
                                }

                                const { branch, customer } = emailData;

                                // Prepare recipient and CC lists

                                const toArr = [{ name, email }];
                                let ccArr = [];

                                /*
                  const toArr = [
                    { name: branch.name, email: branch.email },
                    { name, email },
                  ];
                  ccArr = JSON.parse(customer.emails).map((email) => ({
                    name: customer.name,
                    email: email.trim(),
                  }));
                  */

                                const serviceIds = services
                                  ? services
                                      .split(",")
                                      .map((id) => parseInt(id.trim(), 10))
                                      .filter(Number.isInteger)
                                  : [];

                                const serviceNames = [];

                                // Function to fetch service names recursively
                                const fetchServiceNames = (index = 0) => {
                                  if (index >= serviceIds.length) {
                                    // Once all service names are fetched, get app info
                                    AppModel.appInfo(
                                      "frontend",
                                      (err, appInfo) => {
                                        if (err) {
                                          console.error("Database error:", err);
                                          return res.status(500).json({
                                            status: false,
                                            message: err.message,
                                            token: newToken,
                                          });
                                        }

                                        if (appInfo) {
                                          const appHost =
                                            appInfo.host ||
                                            "www.goldquestglobal.com";
                                          const base64_app_id = btoa(
                                            result.insertId
                                          );
                                          const base64_branch_id =
                                            btoa(branch_id);
                                          const base64_customer_id =
                                            btoa(customer_id);
                                          const base64_link_with_ids = `YXBwX2lk=${base64_app_id}&YnJhbmNoX2lk=${base64_branch_id}&Y3VzdG9tZXJfaWQ==${base64_customer_id}`;

                                          const dav_href = `${appHost}/digital-form?${base64_link_with_ids}`;
                                          const bgv_href = `${appHost}/background-form?${base64_link_with_ids}`;

                                          // Fetch and process digital address service
                                          Service.digitlAddressService(
                                            (err, serviceEntry) => {
                                              if (err) {
                                                console.error(
                                                  "Database error:",
                                                  err
                                                );
                                                return res.status(500).json({
                                                  status: false,
                                                  message: err.message,
                                                  token: newToken,
                                                });
                                              }

                                              if (serviceEntry) {
                                                const digitalAddressID =
                                                  parseInt(serviceEntry.id, 10);
                                                if (
                                                  serviceIds.includes(
                                                    digitalAddressID
                                                  )
                                                ) {
                                                  davMail(
                                                    "candidate application",
                                                    "dav",
                                                    name,
                                                    customer.name,
                                                    dav_href,
                                                    [
                                                      {
                                                        name: name,
                                                        email: email.trim(),
                                                      },
                                                    ]
                                                  )
                                                    .then(() => {
                                                      console.log(
                                                        "Digital address verification mail sent."
                                                      );
                                                    })
                                                    .catch((emailError) => {
                                                      console.error(
                                                        "Error sending digital address email:",
                                                        emailError
                                                      );
                                                    });
                                                }
                                              }
                                            }
                                          );

                                          // Send application creation email
                                          createMail(
                                            "candidate application",
                                            "create",
                                            name,
                                            result.insertId,
                                            bgv_href,
                                            serviceNames,
                                            toArr || [],
                                            ccArr || []
                                          )
                                            .then(() => {
                                              return res.status(201).json({
                                                status: true,
                                                message:
                                                  "Candidate application created successfully and email sent.",
                                                data: {
                                                  candidate: result,
                                                  package,
                                                },
                                                token: newToken,
                                                toArr: toArr || [],
                                                ccArr: ccArr || [],
                                              });
                                            })
                                            .catch((emailError) => {
                                              console.error(
                                                "Error sending application creation email:",
                                                emailError
                                              );
                                              return res.status(201).json({
                                                status: true,
                                                message:
                                                  "Candidate application created successfully, but email failed to send.",
                                                candidate: result,
                                                token: newToken,
                                              });
                                            });
                                        }
                                      }
                                    );
                                    return;
                                  }

                                  const id = serviceIds[index];

                                  // Fetch service required documents for each service ID
                                  Service.getServiceRequiredDocumentsByServiceId(
                                    id,
                                    (err, currentService) => {
                                      if (err) {
                                        console.error(
                                          "Error fetching service data:",
                                          err
                                        );
                                        return res.status(500).json({
                                          status: false,
                                          message: err.message,
                                          token: newToken,
                                        });
                                      }

                                      if (
                                        !currentService ||
                                        !currentService.title
                                      ) {
                                        // Skip invalid services and continue to the next service
                                        return fetchServiceNames(index + 1);
                                      }

                                      // Add the service name and description to the array
                                      serviceNames.push(
                                        `${currentService.title}: ${currentService.description}`
                                      );

                                      // Recursively fetch the next service
                                      fetchServiceNames(index + 1);
                                    }
                                  );
                                };

                                // Start fetching service names
                                fetchServiceNames();
                              }
                            );
                          }
                        );
                      });
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  });
};
