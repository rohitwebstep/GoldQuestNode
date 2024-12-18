const ClientMasterTrackerModel = require("../models/admin/clientMasterTrackerModel");
const { jsPDF } = require("jspdf");
require("jspdf-autotable");
const fs = require("fs");
const path = require("path");

module.exports = {
  generatePDF: async (id, pdfFileName) => {
    const application_id = 1;
    const branch_id = 1;

    return new Promise((resolve, reject) => {
      // Fetch application data
      ClientMasterTrackerModel.applicationByID(
        application_id,
        branch_id,
        async (err, application) => {
          if (err) {
            console.error("Database error:", err);
            return reject(new Error(`Database error: ${err.message}`));
          }

          if (!application) {
            return reject(new Error("Application not found"));
          }

          // Fetch CMT Application Data
          ClientMasterTrackerModel.getCMTApplicationById(
            application_id,
            async (err, CMTApplicationData) => {
              if (err) {
                console.error("Database error:", err);
                return reject(new Error(`Database error: ${err.message}`));
              }

              const pdfPath = path.join(__dirname, pdfFileName);

              // Example: Replace this with actual data fetching logic based on `id`
              const tableData = [
                [
                  "1",
                  "Authentication",
                  "Login",
                  "200 OK",
                  "Success",
                  "2024-12-18 10:00:00",
                  "New York, USA",
                ],
                [
                  "2",
                  "Orders",
                  "Place Order",
                  "201 Created",
                  "Success",
                  "2024-12-18 10:05:00",
                  "New York, USA",
                ],
                [
                  "3",
                  "Orders",
                  "Cancel Order",
                  "400 Bad Request",
                  "Failure",
                  "2024-12-18 10:10:00",
                  "Chicago, USA",
                ],
              ];

              try {
                const doc = new jsPDF();

                // Add Title and Header
                doc.setFontSize(18);
                doc.text("Company Report", 105, 15, { align: "center" });
                doc.setFontSize(12);
                doc.text(`Generated For ID: ${id}`, 105, 22, {
                  align: "center",
                });
                doc.text(
                  `Generated On: ${new Date().toLocaleString()}`,
                  105,
                  30,
                  { align: "center" }
                );

                // Add Table
                doc.autoTable({
                  head: [
                    [
                      "Sr. No.",
                      "Module Name",
                      "Action",
                      "Response",
                      "Result",
                      "Time",
                      "Location",
                    ],
                  ],
                  body: tableData,
                  startY: 40,
                  theme: "grid",
                  styles: { fontSize: 10 },
                });

                // Save PDF to a file
                doc.save(pdfPath);
                resolve(pdfPath);
              } catch (error) {
                console.error("PDF generation error:", error);
                reject(new Error("Error generating PDF"));
              }
            }
          );
        }
      );
    });
  },
};
