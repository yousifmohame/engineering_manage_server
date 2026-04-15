const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const nazmiController = require("../controllers/nazmi.controller");
// تحديد المسار الكامل للمجلد
const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// إعداد التخزين للملفات
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

router.get("/", nazmiController.getData);
router.put("/settings", nazmiController.updateSettings); // مسار إعدادات الشراكة (الجديد ✨)
router.post(
  "/transactions",
  upload.single("attachment"),
  nazmiController.addTransaction,
);

router.put(
  "/transactions/:id",
  upload.single("attachment"),
  nazmiController.updateTransaction,
);

router.delete("/transactions/:id", nazmiController.deleteTransaction);
router.get("/ai-report", nazmiController.generateAIReport);

module.exports = router;
