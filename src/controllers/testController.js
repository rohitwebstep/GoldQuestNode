const fs = require("fs");
const path = require("path");
const Test = require("../models/testModel");

const { upload, saveImage, saveImages } = require("../utils/cloudImageSave");

exports.uploadImage = (req, res) => {
  // Define the target directory to move files to
  const targetDir = "uploads/rohit"; // Specify your target directory here
  fs.mkdir(targetDir, { recursive: true }, (err) => {
    if (err) {
      console.error("Error creating directory:", err);
      return res.status(500).json({
        status: false,
        message: "Error creating directory.",
      });
    }
    // Use multer to handle the upload
    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          status: false,
          message: "Error uploading file.",
        });
      }

      try {
        let savedImagePaths = [];

        // Check if multiple files are uploaded under the "images" field
        if (req.files.images) {
          savedImagePaths = await saveImages(req.files.images, targetDir); // Pass targetDir to saveImages
        }

        // Check if a single file is uploaded under the "image" field
        if (req.files.image && req.files.image.length > 0) {
          const savedImagePath = await saveImage(req.files.image[0], targetDir); // Pass targetDir to saveImage
          savedImagePaths.push(savedImagePath);
        }

        // Return success response
        return res.status(201).json({
          status: true,
          message:
            savedImagePaths.length > 0
              ? "Image(s) saved successfully"
              : "No images uploaded",
          data: savedImagePaths,
        });
      } catch (error) {
        console.error("Error saving image:", error);
        return res.status(500).json({
          status: false,
          message: "An error occurred while saving the image",
        });
      }
    });
  });
};
exports.connectionCheck = (req, res) => {

  // Get the IP address from the request
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  console.log("Request received from IP address:", ipAddress);

  Test.connectionCheck((err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({
        status: false,
        message: err.message,
      });
    }

    if (!result) {
      return res.json({
        status: true,
        message: "No matching customers found",
        customers: [],
        totalResults: 0,
      });
    }

    res.json({
      status: true,
      message: "Customers fetched successfully",
      customers: result,
      totalResults: Array.isArray(result) ? result.length : 1,
    });
  });
};
