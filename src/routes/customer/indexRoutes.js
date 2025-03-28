const express = require("express");
const router = express.Router();
const profileController = require("../../controllers/customer/profileController");

// Profile routes
router.post("/create", profileController.create);
router.post("/upload", profileController.upload);
router.get("/list", profileController.list);
router.get("/add-customer-listings", profileController.addCustomerListings);
router.get("/inactive-list", profileController.inactiveList);
router.put("/update", profileController.update);
router.get("/fetch-branch-password", profileController.fetchBranchPassword);
router.get("/active", profileController.active);
router.get("/inactive", profileController.inactive);
router.delete("/delete", profileController.delete);

module.exports = router;
