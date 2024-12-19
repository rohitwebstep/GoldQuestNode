const { jsPDF } = require("jspdf");
require("jspdf-autotable");

module.exports = {
  cdfDataPDF: async (
    client_applicaton_id,
    branch_id,
    pdfFileName,
    targetDirectory
  ) => {
    console.log(`targetDirectory - 1 - `, targetDirectory);
    // Sample data variables
    const candidateData = {
      companyName: "INDIVIDUAL",
      position: "Software Engineer",
      jobLocation: "Bangalore",
      name: "Stephanie Sawyer",
      pancardNumber: "ABCDE1234F",
      aadharNumber: "1234-5678-9012",
      fathersName: "Flynn Zimmerman",
      dateOfBirth: "30-Jan-2013",
      husbandsName: "Cally Santana",
      gender: "Female",
      mobileNumber: "1111111111",
      nationality: "Indian",
      maritalStatus: "Married",
      address: "IndiQube - Gamma Building, Bangalore",
      periodOfStay: "24-Mar-2007 to 01-May-2022",
      residenceLandline: "981",
      alternateMobile: "1234567890",
      landmark: "Outer Ring Road",
      policeStation: "Kadubeesanahalli",
      declarationDate: "02-02-1983",
      candidateSignature: "Stephanie Sawyer",
    };

    // Create PDF
    definePDF(candidateData);

    function definePDF(data) {
      const doc = new jsPDF();

      // Title centered
      doc.setFont("helvetica", "bold");
      // First Table (Centered) with background color rgba(196,216,240,255)
      doc.autoTable({
        body: [["EMPLOYEE BACKGROUND VERIFICATION FORM"]],
        startY: 60,
        theme: "grid",
        headStyles: { fillColor: [196, 216, 240] }, // Use RGB format for fill color
        bodyStyles: { fontSize: 10, cellPadding: 5 },
        styles: { cellWidth: "auto", halign: "center" }, // Center the first table content
      });

      // Second Table (Left-aligned, attached directly to the first)
      doc.autoTable({
        body: [["COMPANY NAME: INDIVIDUAL"]],
        startY: doc.autoTable.previous.finalY, // Attach directly to the first table
        theme: "grid",
        headStyles: { fillColor: [22, 160, 133] }, // Different color for the second table
        bodyStyles: { fontSize: 10, cellPadding: 5 },
        styles: { cellWidth: "auto", halign: "left" }, // Align the second table content to the left
      });

      // Third Table (Body content, attached directly to the second table)
      doc.autoTable({
        body: [
          ["Please note that it is mandatory for you to complete the form in all respects. The information you provide must be complete and correct and the same shall be treated in strict confidence. The details on this form will be used for all official requirements you should join the organization."]
        ],
        startY: doc.autoTable.previous.finalY, // Attach directly to the previous table
        theme: "grid",
        headStyles: { fillColor: [22, 160, 133] }, // Optional, you can add or remove this
        bodyStyles: { fontSize: 10, cellPadding: 5 },
        styles: { cellWidth: "auto", halign: "left" }, // Align the third table content to the left
      });

      // Footer with page number
      addFooter(doc);

      // Save PDF
      doc.save(pdfFileName || "CandidateForm.pdf");
    }

    function addFooter(doc) {
      const footerHeight = 15;
      const pageHeight = doc.internal.pageSize.height;
      const footerYPosition = pageHeight - footerHeight + 10;
      const pageWidth = doc.internal.pageSize.width;
      const margin = 10;
      const availableWidth = pageWidth - 2 * margin;
      const centerX = pageWidth / 2;

      // Footer text and page number
      const footerText =
        "No 293/154/172, 4th Floor, Outer Ring Road, Kadubeesanahalli, Marathahalli, Bangalore-560103 | www.goldquestglobal.in";
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(7);
      doc.text(footerText, centerX, footerYPosition - 3, { align: "center" });

      const pageCount = doc.internal.getNumberOfPages();
      const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
      const pageNumberText = `Page ${currentPage} / ${pageCount}`;
      const pageNumberWidth = doc.getTextWidth(pageNumberText);
      const pageNumberX = pageWidth - margin - pageNumberWidth;
      doc.text(pageNumberText, pageNumberX, footerYPosition - 3);

      // Draw a line above the footer
      doc.setLineWidth(0.3);
      doc.setDrawColor(0, 0, 0);
      doc.line(
        margin,
        footerYPosition - 7,
        pageWidth - margin,
        footerYPosition - 7
      );
    }
  },
};
