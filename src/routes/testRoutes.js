const express = require("express");
const router = express.Router();
const testController = require("../controllers/testController");

// Authentication routes
router.post("/upload-image", testController.uploadImage);
router.get("/connection", testController.connectionCheck);

module.exports = router;
