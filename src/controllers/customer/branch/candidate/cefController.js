const Candidate = require("../../../../models/customer/branch/candidateApplicationModel");
const Customer = require("../../../../models/customer/customerModel");
const Branch = require("../../../../models/customer/branch/branchModel");
const BranchCommon = require("../../../../models/customer/branch/commonModel");
const CEF = require("../../../../models/customer/branch/cefModel");
const Service = require("../../../../models/admin/serviceModel");
const App = require("../../../../models/appModel");
const Admin = require("../../../../models/admin/adminModel");

const { cdfDataPDF } = require("../../../../utils/cdfDataPDF");
const fs = require("fs");
const path = require("path");
const {
  upload,
  saveImage,
  saveImages,
} = require("../../../../utils/cloudImageSave");

const {
  cefSubmitMail,
} = require("../../../../mailer/customer/branch/candidate/cefSubmitMail");

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
          err,
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

exports.test = (req, res) => {
  CEF.getAttachmentsByClientAppID(15, async (err, attachments) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({
        status: false,
        message: "Database error occurred",
      });
    }
    console.log(`attachments - `, attachments);
    // return res.status(500).json({
    //   status: false,
    //   message: "Database error occurred",
    // });
    sendNotificationEmails(15, 3, "Paula Merrill", 10, 5, "65", "Test 2", res);
    // (candidateAppId,cefID,name,branch_id,customer_id,client_unique_id,customer_name,res)
  });
};

exports.submit = (req, res) => {
  const {
    branch_id,
    customer_id,
    application_id,
    personal_information,
    annexure,
    send_mail,
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
            "name_declaration",
            "declaration_date",
            "blood_group",
            "pan_card_name",
            "aadhar_card_name",
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
            "icc_bank_acc",
            "food_coupon",
            "passport_photo",
            "aadhar_card_image",
            "pan_card_image",
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
                (err, cefResult) => {
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
                                cefResult.insertId,
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
                        if (parseInt(send_mail) === 1) {
                          sendNotificationEmails(
                            application_id,
                            cefResult.insertId,
                            currentCandidateApplication.name,
                            branch_id,
                            customer_id,
                            currentCustomer.client_unique_id,
                            currentCustomer.name,
                            res
                          );
                        } else {
                          return res.status(200).json({
                            status: true,
                            cef_id: cefResult.insertId,
                            message: "CEF Application submitted successfully.",
                          });
                        }
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
const sendNotificationEmails = (
  candidateAppId,
  cefID,
  name,
  branch_id,
  customer_id,
  client_unique_id,
  customer_name,
  res
) => {
  CEF.getCEFApplicationById(
    candidateAppId,
    branch_id,
    customer_id,
    (err, currentCEFApplication) => {
      if (err) {
        console.error("Database error during CEF application retrieval:", err);
        return res.status(500).json({
          status: false,
          message: "Failed to retrieve CEF Application. Please try again.",
        });
      }
      BranchCommon.getBranchandCustomerEmailsForNotification(
        branch_id,
        async (err, emailData) => {
          if (err) {
            console.error("Error fetching emails:", err);
            return res.status(500).json({
              status: false,
              message: "Failed to retrieve email addresses.",
            });
          }
          CEF.getAttachmentsByClientAppID(
            candidateAppId,
            async (err, attachments) => {
              if (err) {
                console.error("Database error:", err);
                return res.status(500).json({
                  status: false,
                  message: "Database error occurred",
                });
              }

              App.appInfo("backend", async (err, appInfo) => {
                if (err) {
                  console.error("Database error:", err);
                  return res.status(500).json({
                    status: false,
                    err,
                    message: err.message,
                  });
                }

                let imageHost = "www.example.in";

                if (appInfo) {
                  imageHost = appInfo.cloud_host || "www.example.in";
                }

                const today = new Date();
                const formattedDate = `${today.getFullYear()}-${String(
                  today.getMonth() + 1
                ).padStart(2, "0")}-${String(today.getDate()).padStart(
                  2,
                  "0"
                )}`;

                // Generate the PDF
                const pdfTargetDirectory = `uploads/customers/${client_unique_id}/candidate-applications/CD-${client_unique_id}-${candidateAppId}/background-reports`;

                const pdfFileName = `${name}_${formattedDate}.pdf`
                  .replace(/\s+/g, "-")
                  .toLowerCase();
                const pdfPath = await cdfDataPDF(
                  candidateAppId,
                  branch_id,
                  customer_id,
                  pdfFileName,
                  pdfTargetDirectory
                );
                attachments +=
                  (attachments ? "," : "") + `${imageHost}/${pdfPath}`;

                Admin.list((err, adminResult) => {
                  if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({
                      status: false,
                      message: "Error retrieving admin details.",
                      token: newToken,
                    });
                  }
                  const { branch, customer } = emailData;

                  // Prepare recipient and CC lists
                  const toArr = [{ name: branch.name, email: branch.email }];

                  const emailList = JSON.parse(customer.emails);
                  const ccArr1 = emailList.map(email => ({ name: customer.name, email }));

                  const mergedEmails = [
                    ...ccArr1,
                    ...adminResult.map(admin => ({ name: admin.name, email: admin.email }))
                  ];

                  const uniqueEmails = [
                    ...new Map(mergedEmails.map(item => [item.email, item])).values()
                  ];

                  const ccArr = [
                    ...new Map([...ccArr1, ...uniqueEmails].map(item => [item.email, item])).values()
                  ];

                  // Send application creation email
                  cefSubmitMail(
                    "Candidate Background Form",
                    "submit",
                    name,
                    customer_name,
                    attachments,
                    toArr || [],
                    ccArr || []
                  )
                    .then(() => {
                      return res.status(201).json({
                        status: true,
                        message:
                          "CEF Application submitted successfully and notifications sent.",
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
                          "CEF Application submitted successfully, but email failed to send.",
                      });
                    });
                });
              });
            }
          );
        }
      );
    }
  );
};

exports.upload = async (req, res) => {
  console.log("Starting upload process...");

  // Use multer to handle the upload
  upload(req, res, async (err) => {
    console.log("File upload middleware executed.");
    if (err) {
      console.error(`Upload error:`, err);
      return res.status(400).json({
        status: false,
        message: "Error uploading file.",
      });
    }

    console.log("Extracting fields from request body...");
    const {
      cef_id: CefID,
      branch_id: branchId,
      customer_id: customerID,
      candidate_application_id: candidateAppId,
      db_table: dbTable,
      db_column: dbColumn,
      send_mail,
    } = req.body;

    console.log("Validating required fields...");
    const requiredFields = { branchId, customerID, candidateAppId, dbTable, dbColumn };

    const missingFields = Object.keys(requiredFields)
      .filter(
        (field) =>
          !requiredFields[field] ||
          requiredFields[field] === "" ||
          requiredFields[field] == "undefined" ||
          requiredFields[field] == undefined
      )
      .map((field) => field.replace(/_/g, " "));

    if (missingFields.length > 0) {
      console.warn("Missing required fields:", missingFields);
      return res.status(400).json({
        status: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    console.log("Checking if candidate application exists...");
    Candidate.isApplicationExist(
      candidateAppId,
      branchId,
      customerID,
      (err, currentCandidateApplication) => {
        if (err) {
          console.error("Database error during application existence check:", err);
          return res.status(500).json({
            status: false,
            message: "An error occurred while checking application existence.",
          });
        }

        if (currentCandidateApplication) {
          console.log("Candidate application exists. Retrieving branch details...");
          Branch.getBranchById(branchId, (err, currentBranch) => {
            if (err) {
              console.error("Database error during branch retrieval:", err);
              return res.status(500).json({
                status: false,
                message: "Failed to retrieve Branch. Please try again.",
              });
            }

            if (
              !currentBranch ||
              parseInt(currentBranch.customer_id) !== parseInt(customerID)
            ) {
              console.warn("Branch not found or customer mismatch.");
              return res.status(404).json({
                status: false,
                message: "Branch not found or customer mismatch.",
              });
            }

            console.log("Retrieving customer details...");
            Customer.getCustomerById(customerID, async (err, currentCustomer) => {
              if (err) {
                console.error("Database error during customer retrieval:", err);
                return res.status(500).json({
                  status: false,
                  message: "Failed to retrieve Customer. Please try again.",
                });
              }

              if (!currentCustomer) {
                console.warn("Customer not found.");
                return res.status(404).json({
                  status: false,
                  message: "Customer not found.",
                });
              }

              console.log("Defining target directory for uploads...");
              const modifiedDbTable = dbTable.replace(/-/g, "_").toLowerCase();
              const cleanDBColumnForQry = dbColumn.replace(/-/g, "_").toLowerCase();
              const modifiedDbTableForDbQuery = `cef_${dbTable.replace(/-/g, "_")}`;
              const targetDirectory = `uploads/customers/${currentCustomer.client_unique_id}/candidate-applications/CD-${currentCustomer.client_unique_id}-${candidateAppId}/annexures/${modifiedDbTable}`;

              console.log("Creating target directory...");
              await fs.promises.mkdir(targetDirectory, { recursive: true });

              console.log("Retrieving app info...");
              App.appInfo("backend", async (err, appInfo) => {
                if (err) {
                  console.error("Database error during app info retrieval:", err);
                  return res.status(500).json({
                    status: false,
                    err,
                    message: err.message,
                  });
                }

                let imageHost = appInfo?.cloud_host || "www.example.in";
                let savedImagePaths = [];

                console.log("Handling file uploads...");
                if (req.files.images && req.files.images.length > 0) {
                  console.log("Processing multiple images...");
                  const uploadedImages = await saveImages(req.files.images, targetDirectory);
                  uploadedImages.forEach((imagePath) => {
                    savedImagePaths.push(`${imageHost}/${imagePath}`);
                  });
                }

                if (req.files.image && req.files.image.length > 0) {
                  console.log("Processing single image...");
                  const uploadedImage = await saveImage(req.files.image[0], targetDirectory);
                  savedImagePaths.push(`${imageHost}/${uploadedImage}`);
                }

                console.log("Uploading data to CEF...");
                CEF.upload(
                  CefID,
                  candidateAppId,
                  modifiedDbTableForDbQuery,
                  cleanDBColumnForQry,
                  savedImagePaths,
                  async (success, result) => {
                    if (!success) {
                      console.error("CEF upload failed:", result);
                      return res.status(500).json({
                        status: false,
                        message: result || "An error occurred while saving the image.",
                        savedImagePaths,
                      });
                    }

                    console.log("Checking if notification email needs to be sent...");
                    if (parseInt(send_mail) === 1) {
                      console.log("Sending notification email...");
                      sendNotificationEmails(
                        candidateAppId,
                        CefID,
                        currentCandidateApplication.name,
                        branchId,
                        customerID,
                        currentCustomer.client_unique_id,
                        currentCustomer.name,
                        res
                      );
                    } else {
                      console.log("Upload successful. Returning response...");
                      return res.status(201).json({
                        status: true,
                        message: "Candidate background Form submitted successfully.",
                        savedImagePaths,
                      });
                    }
                  }
                );
              });
            });
          });
        } else {
          console.warn("Candidate application does not exist.");
          return res.status(404).json({
            status: false,
            message: "Application does not exist.",
          });
        }
      }
    );
  });
};

