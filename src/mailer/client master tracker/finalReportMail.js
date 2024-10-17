const nodemailer = require("nodemailer");
const connection = require("../../config/db"); // Import the existing MySQL connection

// Function to check if a file exists
const checkFileExists = async (url) => {
  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok; // Returns true if the status is in the range 200-299
  } catch {
    return false; // Return false if there was an error (e.g., network issue)
  }
};

// Function to create attachments from URLs
const createAttachments = async (attachments_url) => {
  const urls =
    attachments_url && typeof attachments_url === "string"
      ? attachments_url.split(",")
      : [""]; // Default to an empty array if attachments_url is not a valid string

  const attachments = [];

  for (const url of urls) {
    const trimmedUrl = url.trim(); // Remove any extra whitespace
    if (trimmedUrl) {
      // Check for non-empty URL
      const exists = await checkFileExists(trimmedUrl);
      if (exists) {
        const filename = trimmedUrl.split("/").pop(); // Extract the filename from the URL
        attachments.push({
          filename: filename,
          path: trimmedUrl,
        });
      } else {
        console.warn(`File does not exist: ${trimmedUrl}`); // Log warning for missing file
      }
    } else {
      console.warn(`Empty or invalid URL: ${url}`); // Log warning for invalid URL
    }
  }

  return attachments;
};

// Function to send email
async function finalReportMail(
  module,
  action,
  company_name,
  gender_title,
  client_name,
  application_id,
  attachments_url,
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

    // Create attachments
    const attachments = await createAttachments(attachments_url);
    if (attachments.length === 0) {
      console.warn("No valid attachments to send.");
    }

    // Replace placeholders in the email template
    let template = email.template;
    template = template
      .replace(/{{company_name}}/g, company_name)
      .replace(/{{gender_title}}/g, gender_title)
      .replace(/{{client_name}}/g, client_name)
      .replace(/{{application_id}}/g, application_id);

    // Prepare CC list
    const ccList = ccArr
      .map((entry) => {
        let emails = [];

        try {
          if (Array.isArray(entry.email)) {
            emails = entry.email;
          } else if (typeof entry.email === "string") {
            let cleanedEmail = entry.email
              .trim()
              .replace(/\\"/g, '"')
              .replace(/^"|"$/g, "");

            if (cleanedEmail.startsWith("[") && cleanedEmail.endsWith("]")) {
              emails = JSON.parse(cleanedEmail);
            } else {
              emails = [cleanedEmail];
            }
          }
        } catch (e) {
          console.error("Error parsing email JSON:", entry.email, e);
          return ""; // Skip this entry if parsing fails
        }

        // Ensure it's a valid non-empty string
        return emails
          .filter((email) => email) // Filter out invalid emails
          .map((email) => `"${entry.name}" <${email.trim()}>`) // Trim to remove whitespace
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
      
    // Send email
    const mailOptions = {
      from: smtp.username,
      to: toList,
      cc: ccList,
      subject: email.title,
      html: template,
      ...(attachments.length > 0 && { attachments }), // Only include attachments if present
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

module.exports = { finalReportMail };
