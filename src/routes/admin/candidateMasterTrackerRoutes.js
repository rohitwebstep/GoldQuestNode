const express = require("express");
const router = express.Router();
const candidateMasterTrackerController = require("../../controllers/admin/candidateMasterTrackerController");

// Authentication routes
router.get("/list", candidateMasterTrackerController.list);
router.get("/test", candidateMasterTrackerController.test);
router.get(
  "/branch-list-by-customer",
  candidateMasterTrackerController.listByCustomerId
);
router.get(
  "/applications-by-branch",
  candidateMasterTrackerController.applicationListByBranch
);
router.get("/application-by-id", candidateMasterTrackerController.applicationByID);
router.get("/filter-options", candidateMasterTrackerController.filterOptions);
router.get("/branch-filter-options", candidateMasterTrackerController.filterOptionsForBranch);
router.get("/annexure-data", candidateMasterTrackerController.annexureData);
router.put("/generate-report", candidateMasterTrackerController.generateReport);
router.get(
  "/report-form-json-by-service-id",
  candidateMasterTrackerController.reportFormJsonByServiceID
);

router.get(
  "/customer-info",
  candidateMasterTrackerController.customerBasicInfoWithAdminAuth
);

router.get(
  "/services-annexure-data",
  candidateMasterTrackerController.annexureDataByServiceIds
);

router.get(
  "/application-service",
  candidateMasterTrackerController.annexureDataByServiceIdofApplication
);
router.post("/upload", candidateMasterTrackerController.upload);

module.exports = router;
