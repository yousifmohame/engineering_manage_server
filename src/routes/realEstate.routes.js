const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const realEstateController = require('../controllers/realEstate.controller');

// ---------------------------------------------------------
// إعدادات مكتبة Multer لرفع صور العقارات
// ---------------------------------------------------------
const storage = multer.diskStorage({
  // تحديد المجلد الذي ستحفظ فيه الصور
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); 
  },
  // تغيير اسم الصورة ليكون فريداً (لتجنب استبدال صورة بصورة أخرى بالخطأ)
  filename: function (req, file, cb) {
    // نستخدم التوقيت الحالي مع رقم عشوائي لضمان اسم فريد
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // دمج الاسم الفريد مع امتداد الصورة (مثل .jpg أو .png)
    // لحل مشكلة الأسماء العربية، نقوم بتحويل الاسم الأصلي إلى حروف إنجليزية آمنة
    cb(null, 'property-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// إنشاء وسيط (Middleware) الرفع
const upload = multer({ storage: storage });

// ---------------------------------------------------------
// تعريف المسارات (Routes)
// ---------------------------------------------------------

// جلب جميع العقارات
router.get('/', realEstateController.getAllRealEstates);

// إضافة عقار (مع استقبال صورة واحدة في حقل اسمه 'image')
router.post('/', upload.single('image'), realEstateController.createRealEstate);

// تعديل عقار (مع استقبال صورة جديدة إن وُجدت)
router.put('/:id', upload.single('image'), realEstateController.updateRealEstate);

// حذف عقار
router.delete('/:id', realEstateController.deleteRealEstate);

module.exports = router;