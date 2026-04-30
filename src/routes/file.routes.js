const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fileController = require('../controllers/file.controller');

// ---------------------------------------------------------
// 1. إعدادات مكتبة Multer لرفع الملفات
// ---------------------------------------------------------
const storage = multer.diskStorage({
  // تحديد المجلد الذي سيتم حفظ الملفات فيه فعلياً
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // تأكد من وجود مجلد باسم uploads في جذر المشروع
  },
  // تحديد اسم الملف لتجنب تكرار الأسماء (نضيف طابع زمني)
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // دمج الاسم الجديد مع امتداد الملف الأصلي (مثل .pdf أو .jpg)
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// تهيئة أداة الرفع
const upload = multer({ storage: storage });

// ---------------------------------------------------------
// 2. تعريف المسارات (Routes) وربطها بالمتحكم (Controller)
// ---------------------------------------------------------

// مسار جلب محتويات مجلد معين (يقبل folderId كـ Query Parameter)
router.get('/', fileController.getFolderContents);

// مسار إنشاء مجلد جديد
router.post('/folder', fileController.createFolder);

// مسار رفع ملف جديد (نستخدم upload.single('file') لاستقبال الملف المرفق)
// واجهة React يجب أن ترسل الملف في حقل اسمه 'file'
router.post('/upload', upload.single('file'), fileController.uploadFile);

// مسار إعادة تسمية ملف أو مجلد (نمرر المعرف ID في الرابط)
router.put('/:id/rename', fileController.renameNode);

// مسار حذف ملف أو مجلد
router.delete('/:id', fileController.deleteNode);

module.exports = router;