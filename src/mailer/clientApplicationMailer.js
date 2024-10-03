const nodemailer = require("nodemailer");
const connection = require("../config/db"); // Import the existing MySQL connection

// Function to generate HTML table from service details
const generateTable = (services) => {
  if (!Array.isArray(services) || services.length === 0) {
    return "<p>No services available</p>";
  }

  let rows = "";

  services.forEach((service, index) => {
    rows += `<tr>
                <td>${service}</td>
              </tr>`;
  });

  return rows;
};

const generateDocs = (docs) => {
  // Split the input string into an array of document names
  const docsArr = docs.split(",").map((doc) => doc.trim());

  // Check if the docsArr array is valid
  if (!Array.isArray(docsArr) || docsArr.length === 0) {
    return "<p>No documents available</p>";
  }

  let links = "";

  // Generate <a> tags for each document
  docsArr.forEach((doc, index) => {
    // Using the index to create unique identifiers for each document link
    links += `<a href="${doc}"><span>Doc ${index + 1}</span></a> `;
  });

  return links.trim(); // Remove any trailing spaces
};

// Function to send email
async function sendEmail(
  module,
  action,
  name,
  application_id,
  company_name,
  client_code,
  services,
  docs,
  toArr,
  ccArr
) {
  try {
    // Fetch email template
    const [emailRows] = await connection
      .promise()
      .query(
        "SELECT * FROM emails WHERE module = ? AND action = ? AND status = 1",
        [module, action]
      );
    if (emailRows.length === 0) throw new Error("Email template not found");
    const email = emailRows[0];

    // Fetch SMTP credentials
    const [smtpRows] = await connection
      .promise()
      .query(
        "SELECT * FROM smtp_credentials WHERE module = ? AND action = ? AND status = '1'",
        [module, action]
      );
    if (smtpRows.length === 0) throw new Error("SMTP credentials not found");
    const smtp = smtpRows[0];

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure, // true for 465, false for other ports
      auth: {
        user: smtp.username,
        pass: smtp.password,
      },
    });

    // Generate the HTML table from service details
    const table = generateTable(services);
    const docsHTML = generateDocs(docs);

    // Replace placeholders in the email template
    let template = email.template;
    template = template
      .replace(/{{company_name}}/g, company_name)
      .replace(/{{client_name}}/g, name)
      .replace(/{{application_id}}/g, application_id)
      .replace(/{{client_code}}/g, client_code)
      .replace(/{{docs}}/g, docsHTML)
      .replace(/{{services}}/g, table);

    // Prepare CC list
    const ccList = ccArr
      .map((entry) => {
        let emails = [];

        try {
          // Case 1: If it's already an array, use it
          if (Array.isArray(entry.email)) {
            emails = entry.email;
          } else if (typeof entry.email === "string") {
            // Case 2: If it's a JSON string (with brackets and quotes), clean and parse it
            let cleanedEmail = entry.email.trim();

            // Remove extra quotes and backslashes from the string
            cleanedEmail = cleanedEmail
              .replace(/\\"/g, '"')
              .replace(/^"|"$/g, "");

            // Check if the cleaned email is a JSON array
            if (cleanedEmail.startsWith("[") && cleanedEmail.endsWith("]")) {
              emails = JSON.parse(cleanedEmail);
            } else {
              // Case 3: If it's a plain string email, use it directly
              emails = [cleanedEmail];
            }
          }
        } catch (e) {
          console.error("Error parsing email JSON:", entry.email, e);
          return ""; // Skip this entry if parsing fails
        }

        // Ensure that emails array contains valid items, and format them
        return emails
          .filter((email) => email) // Ensure it's a valid non-empty string
          .map((email) => `"${entry.name}" <${email}>`)
          .join(", ");
      })
      .filter((cc) => cc !== "") // Remove any empty CCs from failed parses
      .join(", ");

    // Validate recipient email(s)
    if (!toArr || toArr.length === 0) {
      throw new Error("No recipient email provided");
    }

    // Prepare recipient list
    const toList = toArr
      .map((email) => `"${email.name}" <${email.email}>`)
      .join(", ");

    // Debugging: Log the email lists
    console.log("Recipient List:", toList);
    console.log("CC List:", ccList);

    // Send email
    const info = await transporter.sendMail({
      from: smtp.username,
      to: toList, // Main recipient list
      cc: ccList, // CC recipient list
      subject: email.title,
      html: template,
    });

    console.log("Email sent:", info.response);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

module.exports = { sendEmail };
