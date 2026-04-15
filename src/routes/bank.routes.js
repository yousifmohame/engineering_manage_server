const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const bankController = require("../controllers/bank.controller");

const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

router.get("/", bankController.getAccounts);
router.post("/", bankController.createAccount);
router.delete("/:id", bankController.deleteAccount);

// مسارات الحركات المالية (شاملة المرفقات)
router.post(
  "/transaction",
  upload.single("attachment"),
  bankController.addTransaction,
);
router.put(
  "/transaction/:id",
  upload.single("attachment"),
  bankController.updateTransaction,
);
router.delete("/transaction/:id", bankController.deleteTransaction);

// الذكاء الاصطناعي
router.post(
  "/analyze-statement",
  upload.single("statement"),
  bankController.analyzeStatement,
);

module.exports = router;
