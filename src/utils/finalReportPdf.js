const ClientMasterTrackerModel = require("../models/admin/clientMasterTrackerModel");
const { jsPDF } = require("jspdf");
require("jspdf-autotable");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const getImageFormat = (url) => {
  const ext = url.split(".").pop().toLowerCase();
  if (ext === "png") return "PNG";
  if (ext === "jpg" || ext === "jpeg") return "JPEG";
  if (ext === "webp") return "WEBP";
  return "PNG"; // Default to PNG if not recognized
};

async function checkImageExists(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok; // Returns true if HTTP status is 200-299
  } catch (error) {
    console.error(`Error checking image existence at ${url}:`, error);
    return false;
  }
}

async function validateImage(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Image fetch failed for URL: ${url}`);
      return null;
    }

    const blob = await response.blob();
    const img = new Image();
    img.src = URL.createObjectURL(blob);

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    return img; // Return the validated image
  } catch (error) {
    console.error(`Error validating image from ${url}:`, error);
    return null;
  }
}

async function fetchImageAsBase64(imageUrl) {
  try {
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    return `data:image/png;base64,${Buffer.from(
      response.data,
      "binary"
    ).toString("base64")}`;
  } catch (error) {
    console.error("Error fetching or converting image:", error.message);
    throw new Error("Failed to fetch image");
  }
}

function addFooter(doc) {
  // Define the height of the footer and its position
  const footerHeight = 15; // Footer height
  const pageHeight = doc.internal.pageSize.height; // Get the total page height
  const footerYPosition = pageHeight - footerHeight + 10; // Position footer closer to the bottom

  // Define page width and margins
  const pageWidth = doc.internal.pageSize.width;
  const margin = 10; // Margins on the left and right

  // Space between sections (adjust dynamically based on page width)
  const availableWidth = pageWidth - 2 * margin; // Usable width excluding margins
  const centerX = pageWidth / 2; // Center of the page

  // Insert text into the center column (centered)
  const footerText =
    "No 293/154/172, 4th Floor, Outer Ring Road, Kadubeesanahalli, Marathahalli, Bangalore-560103 | www.goldquestglobal.in";
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0); // Set text color to black (RGB: 0, 0, 0)
  doc.setFontSize(7);
  doc.text(footerText, centerX, footerYPosition - 3, { align: "center" }); // Adjusted vertical position

  // Insert page number into the right column (right-aligned)
  const pageCount = doc.internal.getNumberOfPages(); // Get total number of pages
  const currentPage = doc.internal.getCurrentPageInfo().pageNumber; // Get current page number
  const pageNumberText = `Page ${currentPage} / ${pageCount}`;
  const pageNumberWidth = doc.getTextWidth(pageNumberText); // Calculate text width

  // Right-align page number with respect to the page width
  const pageNumberX = pageWidth - margin - pageNumberWidth;
  doc.text(pageNumberText, pageNumberX, footerYPosition - 3); // Adjusted vertical position

  // Draw a line above the footer
  doc.setLineWidth(0.3);
  doc.setDrawColor(0, 0, 0); // Set line color to black (RGB: 0, 0, 0)
  doc.line(
    margin,
    footerYPosition - 7,
    pageWidth - margin,
    footerYPosition - 7
  ); // Line above the footer
}

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
              // Split service_id into an array
              const serviceIds = application.services
                .split(",")
                .map((id) => id.trim());
              const annexureResults = [];
              let pendingRequests = serviceIds.length;

              if (pendingRequests === 0) {
                reject(new Error("No service IDs to process."));
              }

              serviceIds.forEach((id) => {
                ClientMasterTrackerModel.reportFormJsonByServiceID(
                  id,
                  (err, reportFormJson) => {
                    if (err) {
                      console.error(
                        `Error fetching report form JSON for service ID ${id}:`,
                        err
                      );
                      annexureResults.push({
                        service_id: id,
                        serviceStatus: false,
                        message: err.message,
                      });
                      finalizeRequest();
                      return;
                    }

                    if (!reportFormJson) {
                      console.warn(
                        `Report form JSON not found for service ID ${id}`
                      );
                      annexureResults.push({
                        service_id: id,
                        serviceStatus: false,
                        message: "Report form JSON not found",
                      });
                      finalizeRequest();
                      return;
                    }

                    const parsedData = JSON.parse(reportFormJson.json);
                    const db_table = parsedData.db_table.replace(/-/g, "_"); // Modify table name
                    const heading = parsedData.heading;

                    ClientMasterTrackerModel.annexureData(
                      application_id,
                      db_table,
                      (err, annexureData) => {
                        if (err) {
                          console.error(
                            `Error fetching annexure data for service ID ${id}:`,
                            err
                          );
                          annexureResults.push({
                            service_id: id,
                            annexureStatus: false,
                            annexureData: null,
                            serviceStatus: true,
                            reportFormJson,
                            message:
                              "An error occurred while fetching annexure data.",
                            error: err,
                          });
                        } else if (!annexureData) {
                          console.warn(
                            `Annexure data not found for service ID ${id}`
                          );
                          annexureResults.push({
                            service_id: id,
                            annexureStatus: false,
                            annexureData: null,
                            serviceStatus: true,
                            reportFormJson,
                            message: "Annexure Data not found.",
                          });
                        } else {
                          annexureResults.push({
                            service_id: id,
                            annexureStatus: true,
                            serviceStatus: true,
                            reportFormJson,
                            annexureData,
                            heading,
                          });
                        }
                        finalizeRequest();
                      }
                    );
                  }
                );
              });

              async function finalizeRequest() {
                pendingRequests -= 1;
                if (pendingRequests === 0) {
                  // Define the directory where the PDF will be saved
                  const directoryPath = path.join(
                    "uploads/customers/GQ-INDV/client-applications/GQ-INDV-1/final-reports"
                  );
                  const pdfPath = path.join(directoryPath, pdfFileName);

                  // Check if directory exists, and create it if not
                  if (!fs.existsSync(directoryPath)) {
                    fs.mkdirSync(directoryPath, { recursive: true });
                    console.log(`Directory created: ${directoryPath}`);
                  }

                  try {
                    const filteredResults = annexureResults.filter(
                      (item) => item != null
                    );
                    const servicesData = filteredResults;
                    const doc = new jsPDF();
                    const pageWidth = doc.internal.pageSize.getWidth();
                    let yPosition = 10;
                    const backgroundColor = "#f5f5f5";

                    const base64Logo = await fetchImageAsBase64(
                      "https://i0.wp.com/goldquestglobal.in/wp-content/uploads/2024/03/goldquestglobal.png"
                    );
                    console.log(`Step - 1`);
                    // Add the image to the PDF
                    doc.addImage(base64Logo, "PNG", 10, yPosition, 50, 20);
                    console.log(`Step - 2`);

                    const rightImageX = pageWidth - 10 - 50; // Page width minus margin (10) and image width (50)
                    console.log(`Step - 3`);

                    doc.addImage(
                      await fetchImageAsBase64(
                        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSjDtQL92lFVchI1eVL0Gpb7xrNnkqW1J7c1A&s"
                      ),
                      "PNG",
                      rightImageX,
                      yPosition,
                      50,
                      30
                    );

                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(10);
                    doc.setTextColor(0, 0, 0);

                    doc.text(
                      "CONFIDENTIAL BACKGROUND VERIFICATION REPORT",
                      105,
                      40,
                      {
                        align: "center",
                      }
                    );
                    console.log(`Step - 4`);
                    // First Table
                    const firstTableData = [
                      [
                        {
                          content: "Name of the Candidate",
                          styles: {
                            cellWidth: "auto",
                            fontStyle: "bold",
                          },
                        },
                        { content: application.name || "N/A" },
                        {
                          content: "Client Name",
                          styles: {
                            cellWidth: "auto",
                            fontStyle: "bold",
                          },
                        },
                        {
                          content: application.customer_name || "N/A",
                        },
                      ],
                      [
                        {
                          content: "Application ID",
                          styles: { fontStyle: "bold" },
                        },
                        {
                          content: application.application_id || "N/A",
                        },
                        {
                          content: "Report Status",
                          styles: { fontStyle: "bold" },
                        },
                        {
                          content: application.report_status || "N/A",
                        },
                      ],
                      [
                        {
                          content: "Date of Birth",
                          styles: { fontStyle: "bold" },
                        },
                        {
                          content: CMTApplicationData.dob
                            ? new Date(
                                CMTApplicationData.dob
                              ).toLocaleDateString()
                            : "N/A",
                        },
                        {
                          content: "Application Received",
                          styles: { fontStyle: "bold" },
                        },
                        {
                          content: application.updated_at
                            ? new Date(
                                application.updated_at
                              ).toLocaleDateString()
                            : "N/A",
                        },
                      ],
                      [
                        {
                          content: "Candidate Employee ID",
                          styles: { fontStyle: "bold" },
                        },
                        {
                          content: application.employee_id || "N/A",
                        },
                        {
                          content: "Insuff Cleared/Reopened",
                          styles: { fontStyle: "bold" },
                        },
                        {
                          content: application.application_id || "N/A",
                        },
                      ],
                      [
                        {
                          content: "Report Type",
                          styles: { fontStyle: "bold" },
                        },
                        {
                          content: application.report_type || "N/A",
                        },
                        {
                          content: "Final Report Date",
                          styles: { fontStyle: "bold" },
                        },
                        {
                          content: CMTApplicationData.report_date
                            ? new Date(
                                CMTApplicationData.report_date
                              ).toLocaleDateString()
                            : "N/A",
                        },
                      ],
                      [
                        {
                          content: "Verification Purpose",
                          styles: { fontStyle: "bold" },
                        },
                        {
                          content: application.overall_status || "N/A",
                        },
                        {
                          content: "Overall Report Status",
                          styles: { fontStyle: "bold" },
                        },
                        { content: application.status || "N/A" },
                      ],
                    ];
                    console.log(`Step - 5`);
                    doc.autoTable({
                      head: [], // Remove the header by setting it to an empty array
                      body: firstTableData,
                      styles: {
                        cellPadding: 3,
                        fontSize: 10,
                        valign: "middle",
                        lineColor: [62, 118, 165],
                        lineWidth: 0.4, // Reduced border width (you can adjust this value further)
                        textColor: "#000", // Set text color to black (#000)
                      },
                      headStyles: {
                        fillColor: [255, 255, 255], // Ensure no background color for header
                        textColor: 0, // Optional: Ensure header text color is reset (not needed if header is removed)
                        lineColor: [62, 118, 165],
                        lineWidth: 0.2, // Reduced border width for header (if header is re-enabled)
                      },
                      theme: "grid",
                      margin: { top: 50 },
                    });
                    console.log(`Step - 6`);
                    addFooter(doc);
                    const secondTableData = servicesData.map((item) => {
                      const sourceKey = item.annexureData
                        ? Object.keys(item.annexureData).find(
                            (key) =>
                              key.startsWith("info_source") ||
                              key.startsWith("information_source") ||
                              key.endsWith("info_source") ||
                              key.endsWith("information_source")
                          )
                        : undefined;
                      const dateKey =
                        item.annexureData &&
                        Object.keys(item.annexureData).find((key) =>
                          key.includes("verified_date")
                        );

                      return {
                        component: item.heading || "NIL",
                        source: sourceKey
                          ? item.annexureData[sourceKey]
                          : "NIL",
                        completedDate:
                          dateKey &&
                          item.annexureData[dateKey] &&
                          !isNaN(new Date(item.annexureData[dateKey]).getTime())
                            ? new Date(
                                item.annexureData[dateKey]
                              ).toLocaleDateString()
                            : "NIL",
                        status:
                          item.annexureData && item.annexureData.status
                            ? item.annexureData.status.replace(/[_-]/g, " ")
                            : "NIL",
                      };
                    });
                    console.log(`Step - 7`);
                    // Generate the Second Table
                    doc.autoTable({
                      head: [
                        [
                          {
                            content: "REPORT COMPONENT",
                            styles: {
                              halign: "center",
                              fillColor: "#6495ed",
                              lineColor: [255, 255, 255],
                              textColor: [0, 0, 0],
                              fontStyle: "bold",
                            },
                          },
                          {
                            content: "INFORMATION SOURCE",
                            styles: {
                              halign: "center",
                              fillColor: "#6495ed",
                              lineColor: [255, 255, 255],
                              textColor: [0, 0, 0],
                              fontStyle: "bold",
                            },
                          },
                          {
                            content: "COMPLETED DATE",
                            styles: {
                              halign: "center",
                              fillColor: "#6495ed",
                              lineColor: [255, 255, 255],
                              textColor: [0, 0, 0],
                              fontStyle: "bold",
                            },
                          },
                          {
                            content: "COMPONENT STATUS",
                            styles: {
                              halign: "center",
                              fillColor: "#6495ed",
                              lineColor: [255, 255, 255],
                              textColor: [0, 0, 0],
                              fontStyle: "bold",
                            },
                          },
                        ],
                      ],
                      body: secondTableData.map((row) => [
                        row.component,
                        row.source,
                        row.completedDate, // Show completedDate in its own column
                        row.status, // Show status in its own column
                      ]),
                      styles: {
                        cellPadding: 3,
                        fontSize: 10,
                        valign: "middle",
                        lineWidth: 0.3,
                        lineColor: "#6495ed",
                      },
                      theme: "grid",
                      headStyles: {
                        lineWidth: 0.4, // No border for the header
                        fillColor: [61, 117, 166], // Color for the header background
                        textColor: [0, 0, 0], // Text color for the header
                        fontStyle: "bold",
                      },
                      bodyStyles: {
                        lineWidth: 0.5, // Border for the body rows
                        lineColor: [61, 117, 166], // Border color for the body
                      },
                      columnStyles: {
                        0: { halign: "left" },
                        1: { halign: "center" },
                        2: { halign: "center" }, // Center alignment for the completed date column
                        3: { halign: "center" }, // Center alignment for the status column
                      },
                    });
                    console.log(`Step - 8`);
                    addFooter(doc);

                    const tableStartX = 15; // Adjusted X position for full-width table
                    const tableStartY = doc.previousAutoTable.finalY + 20; // Y position of the table
                    const totalTableWidth = pageWidth - 2 * tableStartX; // Total table width
                    const legendColumnWidth = 15; // Smaller width for the "Legend" column
                    const remainingTableWidth =
                      totalTableWidth - legendColumnWidth; // Remaining space for other columns
                    const columnCount = 5; // Number of remaining columns
                    const otherColumnWidth = remainingTableWidth / columnCount; // Width of each remaining column
                    const tableHeight = 12; // Reduced height of the table
                    const boxWidth = 5; // Width of the color box
                    const boxHeight = 9; // Height of the color box
                    const textBoxGap = 1; // Gap between text and box
                    console.log(`Step - 9`);
                    // Data for the columns
                    const columns = [
                      { label: "Legend:", color: null, description: "" },
                      {
                        label: "",
                        color: "#FF0000",
                        description: "-Major discrepancy",
                      },
                      {
                        label: "",
                        color: "#FFFF00",
                        description: "-Minor discrepancy",
                      },
                      {
                        label: "",
                        color: "#FFA500",
                        description: "-Unable to verify",
                      },
                      {
                        label: "",
                        color: "#FFC0CB",
                        description: "-Pending from source",
                      },
                      {
                        label: "",
                        color: "#008000",
                        description: "-All clear",
                      },
                    ];
                    console.log(`Step - 10`);
                    // Set the border color
                    doc.setDrawColor("#3e76a5");

                    // Draw table border
                    doc.setLineWidth(0.5);
                    doc.rect(
                      tableStartX,
                      tableStartY,
                      totalTableWidth,
                      tableHeight
                    );
                    console.log(`Step - 11`);
                    // Draw columns
                    columns.forEach((col, index) => {
                      const columnStartX =
                        index === 0
                          ? tableStartX // "Legend" column starts at tableStartX
                          : tableStartX +
                            legendColumnWidth +
                            (index - 1) * otherColumnWidth; // Remaining columns start after the "Legend" column

                      const columnWidth =
                        index === 0 ? legendColumnWidth : otherColumnWidth;

                      // Draw column separators
                      if (index > 0) {
                        doc.line(
                          columnStartX,
                          tableStartY,
                          columnStartX,
                          tableStartY + tableHeight
                        );
                      }
                      console.log(`Step - 12`);
                      // Add label text (for Legend)
                      if (col.label) {
                        doc.setFont("helvetica", "bold");
                        doc.setFontSize(7); // Reduced font size for better fit
                        doc.text(
                          col.label,
                          columnStartX + 3, // Padding for text inside "Legend" column
                          tableStartY + tableHeight / 2 + 2,
                          { baseline: "middle" }
                        );
                      }
                      console.log(`Step - 13`);
                      // Add color box
                      if (col.color) {
                        const boxX = columnStartX + 3; // Adjusted padding for color box
                        const boxY =
                          tableStartY + tableHeight / 2 - boxHeight / 2;
                        doc.setFillColor(col.color);
                        doc.rect(boxX, boxY, boxWidth, boxHeight, "F");
                      }

                      // Add description text
                      if (col.description) {
                        doc.setFont("helvetica", "normal");
                        doc.setFontSize(7); // Reduced font size for better fit
                        const textX = columnStartX + 3 + boxWidth + textBoxGap;
                        const textY = tableStartY + tableHeight / 2 + 2;
                        doc.text(col.description, textX, textY, {
                          baseline: "middle",
                        });
                      }
                    });
                    console.log(`Step - 14`);
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(12);
                    doc.text(
                      "End of summary report",
                      pageWidth / 2,
                      doc.previousAutoTable.finalY + 10,
                      { align: "center" }
                    );

                    addFooter(doc);
                    console.log(`Step - 15`);
                    yPosition = 20;
                    let annexureIndex = 1;
                    for (const service of servicesData) {
                      doc.addPage();
                      addFooter(doc);

                      let yPosition = 20;

                      const reportFormJson = JSON.parse(
                        service.reportFormJson.json
                      );
                      const rows = reportFormJson.rows || [];
                      const serviceData = [];
                      console.log("rows", rows);

                      rows.forEach((row) => {
                        console.log("Processing row:", row);

                        const inputLabel =
                          row.inputs.length > 0
                            ? row.inputs[0].label || "Unnamed Label"
                            : "Unnamed Label";
                        console.log("Input label:", inputLabel);

                        const valuesObj = {};
                        console.log("Initializing valuesObj:", valuesObj);

                        row.inputs.forEach((input) => {
                          const inputName = input.name;
                          console.log("Processing input:", input);

                          let reportDetailsInputName = inputName.includes(
                            "report_details_"
                          )
                            ? inputName
                            : `report_details_${inputName}`;
                          console.log(
                            "Generated reportDetailsInputName:",
                            reportDetailsInputName
                          );

                          if (input.label && typeof input.label === "string") {
                            input.label = input.label.replace(/:/g, "");
                          }
                          console.log("Cleaned label:", input.label);

                          if (service.annexureData) {
                            const value =
                              service.annexureData[inputName] !== undefined &&
                              service.annexureData[inputName] !== null
                                ? service.annexureData[inputName]
                                : "";

                            const reportDetailsValue =
                              service.annexureData[reportDetailsInputName] !==
                                undefined &&
                              service.annexureData[reportDetailsInputName] !==
                                null
                                ? service.annexureData[reportDetailsInputName]
                                : "";

                            console.log(
                              "Fetched value:",
                              value,
                              "Fetched reportDetailsValue:",
                              reportDetailsValue
                            );

                            valuesObj[inputName] = value;
                            valuesObj["isReportDetailsExist"] =
                              !!reportDetailsValue;
                            if (reportDetailsValue) {
                              valuesObj[reportDetailsInputName] =
                                reportDetailsValue;
                            }

                            console.log("Updated valuesObj:", valuesObj);

                            valuesObj["name"] = inputName.replace(
                              "report_details_",
                              ""
                            );
                            console.log(
                              "Simplified name stored:",
                              valuesObj["name"]
                            );
                          } else {
                            console.error(
                              "service.annexureData is not available for input:",
                              inputName
                            );
                            valuesObj[inputName] = "";
                            valuesObj["isReportDetailsExist"] = false;
                            valuesObj[reportDetailsInputName] = "";
                            console.log(
                              "service.annexureData is missing, using fallback values:",
                              valuesObj
                            );
                          }
                        });

                        serviceData.push({
                          label: inputLabel,
                          values: valuesObj,
                        });
                      });
                      console.log(`Step - 16`);
                      const tableData = serviceData
                        .map((data) => {
                          console.log("Processing data for table:", data);

                          if (!data || !data.values) {
                            console.log(
                              "Skipping invalid data (empty values)."
                            );
                            return null;
                          }

                          const name = data.values.name;
                          console.log("Processing name:", name);

                          if (!name || name.startsWith("annexure")) {
                            console.log(
                              "Skipping annexure data for name:",
                              name
                            );
                            return null;
                          }

                          const isReportDetailsExist =
                            data.values.isReportDetailsExist;
                          const value = data.values[name];
                          const reportDetails =
                            data.values[`report_details_${name}`];

                          console.log(
                            "isReportDetailsExist:",
                            isReportDetailsExist,
                            "value:",
                            value,
                            "reportDetails:",
                            reportDetails
                          );

                          if (
                            value === undefined ||
                            value === "" ||
                            (isReportDetailsExist && !reportDetails)
                          ) {
                            console.log(
                              "Skipping data due to missing value or report details."
                            );
                            return null;
                          }

                          if (isReportDetailsExist && reportDetails) {
                            console.log("Row with reportDetails:", [
                              data.label,
                              value,
                              reportDetails,
                            ]);
                            return [data.label, value, reportDetails];
                          } else {
                            console.log("Row without reportDetails:", [
                              data.label,
                              value,
                            ]);
                            return [data.label, value];
                          }
                        })
                        .filter(Boolean);
                      console.log(`Step - 17`);
                      console.log("Final tableData:", tableData);

                      const pageWidth = doc.internal.pageSize.width;

                      const headingText = reportFormJson.heading.toUpperCase();
                      const backgroundColor = "#f5f5f5";
                      const backgroundColorHeading = "#6495ed";
                      const borderColor = "#6495ed";
                      const xsPosition = 10;
                      const rectHeight = 10;

                      doc.setFillColor(backgroundColorHeading);
                      doc.setDrawColor(borderColor);
                      doc.rect(
                        xsPosition,
                        yPosition,
                        pageWidth - 20,
                        rectHeight,
                        "FD"
                      );
                      console.log(`Step - 18`);
                      doc.setFontSize(12);
                      doc.setFont("helvetica", "bold");

                      const textHeight = doc.getTextDimensions(headingText).h;
                      const verticalCenter =
                        yPosition + rectHeight / 2 + textHeight / 4;

                      doc.setTextColor("#fff");
                      doc.text(headingText, pageWidth / 2, verticalCenter, {
                        align: "center",
                      });

                      yPosition += rectHeight;
                      console.log(`Step - 19`);
                      doc.autoTable({
                        head: [
                          [
                            {
                              content: "PARTICULARS",
                              styles: { halign: "left" },
                            },
                            "APPLICATION DETAILS",
                            "REPORT DETAILS",
                          ],
                        ],
                        body: tableData.map((row) => {
                          if (row.length === 2) {
                            return [
                              {
                                content: row[0],
                                styles: {
                                  halign: "left",
                                  fontStyle: "bold",
                                },
                              },
                              {
                                content: row[1],
                                colSpan: 2,
                                styles: { halign: "left" },
                              },
                            ];
                          } else {
                            return [
                              {
                                content: row[0],
                                styles: {
                                  halign: "left",
                                  fontStyle: "bold",
                                },
                              },
                              {
                                content: row[1],
                                styles: { halign: "left" },
                              },
                              {
                                content: row[2],
                                styles: { halign: "left" },
                              },
                            ];
                          }
                        }),
                        startY: yPosition,
                        styles: {
                          fontSize: 9,
                          cellPadding: 3,
                          lineWidth: 0.3,
                          lineColor: [62, 118, 165],
                        },
                        theme: "grid",
                        headStyles: {
                          fillColor: backgroundColor,
                          textColor: [0, 0, 0],
                          halign: "center",
                          fontSize: 10,
                        },
                        bodyStyles: {
                          textColor: [0, 0, 0],
                          halign: "left",
                        },
                        tableLineColor: [62, 118, 165],
                        tableLineWidth: 0.5,
                        margin: { horizontal: 10 },
                      });
                      addFooter(doc);

                      yPosition = doc.lastAutoTable.finalY + 5;

                      const remarksData = serviceData.find(
                        (data) => data.label === "Remarks"
                      );
                      if (remarksData) {
                        const remarks =
                          service.annexureData[remarksData.values.name] ||
                          "No remarks available.";
                        doc.setFont("helvetica", "italic");
                        doc.setFontSize(10);
                        doc.setTextColor(100, 100, 100);
                        doc.text(`Remarks: ${remarks}`, 10, yPosition);
                        yPosition += 7;
                      }

                      const annexureData = service.annexureData || {}; // Ensure annexureData is an empty object if it's null or undefined

                      const annexureImagesKey = Object.keys(annexureData).find(
                        (key) =>
                          key.toLowerCase().startsWith("annexure") &&
                          !key.includes("[") &&
                          !key.includes("]")
                      );
                      console.log(`Step - 20`);
                      if (annexureImagesKey) {
                        const annexureImagesStr =
                          annexureData[annexureImagesKey];
                        const annexureImagesSplitArr = annexureImagesStr
                          ? annexureImagesStr.split(",")
                          : [];

                        if (annexureImagesSplitArr.length === 0) {
                          doc.setFont("helvetica", "italic");
                          doc.setFontSize(10);
                          doc.setTextColor(150, 150, 150);
                          doc.text(
                            "No annexure images available.",
                            10,
                            yPosition
                          );
                          yPosition += 10;
                        } else {
                          for (const [
                            index,
                            imageUrl,
                          ] of annexureImagesSplitArr.entries()) {
                            const imageUrlFull = imageUrl.trim();
                            const imageFormat = getImageFormat(imageUrlFull);

                            if (!(await checkImageExists(imageUrlFull)))
                              continue;

                            const img = await validateImage(imageUrlFull);
                            if (!img) continue;

                            try {
                              const { width, height } = scaleImage(
                                img,
                                doc.internal.pageSize.width - 20,
                                80
                              );
                              if (
                                yPosition + height >
                                doc.internal.pageSize.height - 20
                              ) {
                                doc.addPage();
                                yPosition = 10;
                              }

                              const annexureText = `Annexure ${annexureIndex} (${String.fromCharCode(
                                97 + index
                              )})`;
                              const textWidth = doc.getTextWidth(annexureText);
                              const centerX =
                                (doc.internal.pageSize.width - textWidth) / 2;

                              doc.setFont("helvetica", "bold");
                              doc.setFontSize(10);
                              doc.setTextColor(0, 0, 0);
                              doc.text(annexureText, centerX, yPosition + 10);
                              yPosition += 15;

                              const centerXImage =
                                (doc.internal.pageSize.width - width) / 2;
                              doc.addImage(
                                img.src,
                                imageFormat,
                                centerXImage,
                                yPosition,
                                width,
                                height
                              );
                              yPosition += height + 15;
                            } catch (error) {
                              console.error(
                                `Failed to add image to PDF: ${imageUrlFull}`,
                                error
                              );
                            }
                          }
                        }
                        console.log(`Step - 21`);
                      } else {
                        doc.setFont("helvetica", "italic");
                        doc.setFontSize(10);
                        doc.setTextColor(150, 150, 150);
                        doc.text(
                          "No annexure images available.",
                          10,
                          yPosition
                        );
                        yPosition += 15;
                      }

                      addFooter(doc);
                      annexureIndex++;
                      yPosition += 20;
                    }
                    console.log(`Step - 22`);
                    doc.addPage();
                    addFooter(doc);

                    const disclaimerButtonHeight = 10;
                    const disclaimerButtonWidth =
                      doc.internal.pageSize.width - 20;

                    const buttonBottomPadding = 5;
                    const disclaimerTextTopMargin = 5;

                    const adjustedDisclaimerButtonHeight =
                      disclaimerButtonHeight + buttonBottomPadding;

                    const disclaimerTextPart1 = `This report is confidential and is meant for the exclusive use of the Client. This report has been prepared solely for the purpose set out pursuant to our letter of engagement (LoE)/Agreement signed with you and is not to be used for any other purpose. The Client recognizes that we are not the source of the data gathered and our reports are based on the information provided. The Client is responsible for employment decisions based on the information provided in this report.You can mail us at `;
                    const anchorText = "compliance@screeningstar.com";
                    const disclaimerTextPart2 = " for any clarifications.";

                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(10);
                    doc.setTextColor(0, 0, 0);
                    const disclaimerLinesPart1 = doc.splitTextToSize(
                      disclaimerTextPart1,
                      disclaimerButtonWidth
                    );
                    const disclaimerLinesPart2 = doc.splitTextToSize(
                      disclaimerTextPart2,
                      disclaimerButtonWidth
                    );
                    console.log(`Step - 23`);
                    const lineHeight = 7;
                    const disclaimerTextHeight =
                      disclaimerLinesPart1.length * lineHeight +
                      disclaimerLinesPart2.length * lineHeight +
                      lineHeight;

                    const totalContentHeight =
                      adjustedDisclaimerButtonHeight +
                      disclaimerTextHeight +
                      disclaimerTextTopMargin;

                    const availableSpace = doc.internal.pageSize.height - 40;

                    let disclaimerY = 20;

                    if (disclaimerY + totalContentHeight > availableSpace) {
                      doc.addPage();
                      addFooter(doc);
                      disclaimerY = 20;
                    }
                    console.log(`Step - 24`);
                    const disclaimerButtonXPosition =
                      (doc.internal.pageSize.width - disclaimerButtonWidth) / 2;

                    console.log(
                      "disclaimerButtonXPosition:",
                      disclaimerButtonXPosition
                    );
                    console.log("disclaimerY:", disclaimerY);
                    console.log(
                      "disclaimerButtonWidth:",
                      disclaimerButtonWidth
                    );
                    console.log(
                      "disclaimerButtonHeight:",
                      disclaimerButtonHeight
                    );
                    console.log(`Step - 24`);
                    if (
                      disclaimerButtonWidth > 0 &&
                      disclaimerButtonHeight > 0 &&
                      !isNaN(disclaimerButtonXPosition) &&
                      !isNaN(disclaimerY)
                    ) {
                      doc.setDrawColor(62, 118, 165);
                      doc.setFillColor(backgroundColor);
                      doc.rect(
                        disclaimerButtonXPosition,
                        disclaimerY,
                        disclaimerButtonWidth,
                        disclaimerButtonHeight,
                        "F"
                      );
                      doc.rect(
                        disclaimerButtonXPosition,
                        disclaimerY,
                        disclaimerButtonWidth,
                        disclaimerButtonHeight,
                        "D"
                      );
                    } else {
                      console.error(
                        "Invalid rectangle dimensions:",
                        disclaimerButtonXPosition,
                        disclaimerY,
                        disclaimerButtonWidth,
                        disclaimerButtonHeight
                      );
                    }
                    console.log(`Step - 25`);
                    doc.setTextColor(0, 0, 0);
                    doc.setFont("helvetica", "bold");

                    const disclaimerButtonTextWidth =
                      doc.getTextWidth("DISCLAIMER");
                    const buttonTextHeight = doc.getFontSize();

                    const disclaimerTextXPosition =
                      disclaimerButtonXPosition +
                      disclaimerButtonWidth / 2 -
                      disclaimerButtonTextWidth / 2 -
                      1;
                    const disclaimerTextYPosition =
                      disclaimerY +
                      disclaimerButtonHeight / 2 +
                      buttonTextHeight / 4 -
                      1;

                    doc.text(
                      "DISCLAIMER",
                      disclaimerTextXPosition,
                      disclaimerTextYPosition
                    );

                    let currentY =
                      disclaimerY +
                      adjustedDisclaimerButtonHeight +
                      disclaimerTextTopMargin;

                    doc.setFont("helvetica", "normal");
                    doc.setTextColor(0, 0, 0);
                    disclaimerLinesPart1.forEach((line) => {
                      doc.text(line, 10, currentY);
                      currentY += lineHeight;
                    });
                    console.log(`Step - 26`);
                    doc.setTextColor(0, 0, 255);
                    doc.textWithLink(
                      anchorText,
                      10 +
                        doc.getTextWidth(
                          disclaimerLinesPart1[disclaimerLinesPart1.length - 1]
                        ),
                      currentY - lineHeight,
                      {
                        url: "mailto:compliance@screeningstar.com",
                      }
                    );

                    doc.setTextColor(0, 0, 0);
                    disclaimerLinesPart2.forEach((line) => {
                      doc.text(line, 10, currentY);
                      currentY += lineHeight;
                    });

                    let endOfDetailY = currentY + disclaimerTextTopMargin - 5;

                    if (
                      endOfDetailY + disclaimerButtonHeight >
                      doc.internal.pageSize.height - 20
                    ) {
                      doc.addPage();
                      endOfDetailY = 20;
                    }

                    const endButtonXPosition =
                      (doc.internal.pageSize.width - disclaimerButtonWidth) / 2; // Centering horizontally

                    if (
                      disclaimerButtonWidth > 0 &&
                      disclaimerButtonHeight > 0 &&
                      !isNaN(endButtonXPosition) &&
                      !isNaN(endOfDetailY)
                    ) {
                      doc.setDrawColor(62, 118, 165);
                      doc.setFillColor(backgroundColor);
                      doc.rect(
                        endButtonXPosition,
                        endOfDetailY,
                        disclaimerButtonWidth,
                        disclaimerButtonHeight,
                        "F"
                      );
                      doc.rect(
                        endButtonXPosition,
                        endOfDetailY,
                        disclaimerButtonWidth,
                        disclaimerButtonHeight,
                        "D"
                      );
                    } else {
                      console.error(
                        "Invalid rectangle dimensions for END OF DETAIL REPORT button:",
                        endButtonXPosition,
                        endOfDetailY,
                        disclaimerButtonWidth,
                        disclaimerButtonHeight
                      );
                    }

                    doc.setTextColor(0, 0, 0);
                    doc.setFont("helvetica", "bold");

                    const endButtonTextWidth = doc.getTextWidth(
                      "END OF DETAIL REPORT"
                    );
                    const endButtonTextHeight = doc.getFontSize();

                    const endButtonTextXPosition =
                      endButtonXPosition +
                      disclaimerButtonWidth / 2 -
                      endButtonTextWidth / 2 -
                      1;
                    const endButtonTextYPosition =
                      endOfDetailY +
                      disclaimerButtonHeight / 2 +
                      endButtonTextHeight / 4 -
                      1;

                    doc.text(
                      "END OF DETAIL REPORT",
                      endButtonTextXPosition,
                      endButtonTextYPosition
                    );

                    addFooter(doc);
                    console.log(`SAVED`);
                    doc.save(pdfPath);
                    resolve(pdfPath);
                  } catch (error) {
                    console.error("PDF generation error:", error);
                    reject(new Error("Error generating PDF"));
                  }
                }
              }
            }
          );
        }
      );
    });
  },
};
