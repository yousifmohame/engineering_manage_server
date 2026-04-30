const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const fs = require("fs"); // للتعامل مع الملفات

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 1. جلب جميع العقارات
exports.getAllRealEstates = async (req, res) => {
  try {
    const properties = await prisma.realEstate.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(properties);
  } catch (error) {
    console.error("Error fetching real estates:", error);
    res.status(500).json({ error: "خطأ في جلب بيانات العقارات" });
  }
};

// 2. إضافة عقار جديد (مُحدث ليدعم الصور)
exports.createRealEstate = async (req, res) => {
  try {
    const { name, type, location, status, totalPrice, currency, paidAmount, notes } = req.body;
    const file = req.file; // استلام الصورة من مكتبة Multer

    // إذا تم رفع صورة، نقوم بإنشاء مسارها، وإلا نتركه فارغاً
    const imageUrl = file ? `/uploads/${file.filename}` : null;

    // حساب المبالغ المتبقية ونسبة السداد برمجياً
    const remainingAmount = Number(totalPrice) - Number(paidAmount || 0);
    const progress = Number(totalPrice) > 0 ? (Number(paidAmount || 0) / Number(totalPrice)) * 100 : 0;

    const newProperty = await prisma.realEstate.create({
      data: {
        name,
        type,
        location,
        status: status || "متاح",
        totalPrice: Number(totalPrice),
        currency: currency || "SAR",
        paidAmount: Number(paidAmount || 0),
        remainingAmount,
        progress: Number(progress.toFixed(2)),
        notes,
        imageUrl // حفظ مسار الصورة هنا
      }
    });

    res.status(201).json(newProperty);
  } catch (error) {
    console.error("Error creating real estate:", error);
    res.status(500).json({ error: "خطأ في حفظ العقار" });
  }
};

// 3. تعديل عقار موجود (الدالة الجديدة)
exports.updateRealEstate = async (req, res) => {
  try {
    const { id } = req.params; // الحصول على معرف العقار من الرابط
    const { name, type, location, status, totalPrice, currency, paidAmount, notes } = req.body;
    const file = req.file; // التحقق مما إذا كان المستخدم قد رفع صورة جديدة

    // البحث عن العقار القديم
    const existingProperty = await prisma.realEstate.findUnique({ where: { id } });
    if (!existingProperty) {
      return res.status(404).json({ error: "العقار غير موجود" });
    }

    // إذا رفع المستخدم صورة جديدة نستخدمها، وإلا نحتفظ بالصورة القديمة
    const imageUrl = file ? `/uploads/${file.filename}` : existingProperty.imageUrl;

    // إعادة حساب المبالغ في حال تم تغيير السعر أو الدفعة المقدمة
    const newTotalPrice = Number(totalPrice || existingProperty.totalPrice);
    const newPaidAmount = Number(paidAmount || existingProperty.paidAmount);
    
    const remainingAmount = newTotalPrice - newPaidAmount;
    const progress = newTotalPrice > 0 ? (newPaidAmount / newTotalPrice) * 100 : 0;

    // تحديث البيانات في قاعدة البيانات
    const updatedProperty = await prisma.realEstate.update({
      where: { id },
      data: {
        name,
        type,
        location,
        status,
        totalPrice: newTotalPrice,
        currency,
        paidAmount: newPaidAmount,
        remainingAmount,
        progress: Number(progress.toFixed(2)),
        notes,
        imageUrl // تحديث مسار الصورة
      }
    });

    res.json(updatedProperty);
  } catch (error) {
    console.error("Error updating real estate:", error);
    res.status(500).json({ error: "خطأ في تعديل العقار" });
  }
};

// 4. حذف عقار
exports.deleteRealEstate = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.realEstate.delete({ where: { id } });
    res.json({ message: "تم حذف العقار بنجاح" });
  } catch (error) {
    console.error("Error deleting real estate:", error);
    res.status(500).json({ error: "خطأ في حذف العقار" });
  }
};