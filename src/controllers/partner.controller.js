const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 1. جلب جميع الشركاء مع عقاراتهم المرتبطة
exports.getAllPartners = async (req, res) => {
  try {
    const partners = await prisma.RealEstatePartner.findMany({
      include: { properties: true }, // جلب بيانات العقارات المرتبطة بكل شريك
      orderBy: { createdAt: 'desc' }
    });
    res.json(partners);
  } catch (error) {
    console.error("Error fetching partners:", error);
    res.status(500).json({ error: "خطأ في جلب بيانات الشركاء" });
  }
};

// 2. إضافة شريك جديد
exports.createPartner = async (req, res) => {
  try {
    const { name, percentage, propertyIds } = req.body;

    const newPartner = await prisma.RealEstatePartner.create({
      data: {
        name,
        percentage: Number(percentage),
        // ربط الشريك بالعقارات المختارة بناءً على مصفوفة الـ IDs
        properties: {
          connect: propertyIds.map(id => ({ id }))
        }
      },
      include: { properties: true }
    });

    res.status(201).json(newPartner);
  } catch (error) {
    console.error("Error creating partner:", error);
    res.status(500).json({ error: "خطأ في حفظ الشريك" });
  }
};

// 3. تعديل بيانات شريك
exports.updatePartner = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, percentage, propertyIds } = req.body;

    const updatedPartner = await prisma.RealEstatePartner.update({
      where: { id },
      data: {
        name,
        percentage: Number(percentage),
        // استخدام 'set' لمسح الروابط القديمة ووضع الروابط الجديدة فقط
        properties: {
          set: propertyIds.map(propId => ({ id: propId }))
        }
      },
      include: { properties: true }
    });

    res.json(updatedPartner);
  } catch (error) {
    console.error("Error updating partner:", error);
    res.status(500).json({ error: "خطأ في تعديل الشريك" });
  }
};

// 4. حذف شريك
exports.deletePartner = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.RealEstatePartner.delete({ where: { id } });
    res.json({ message: "تم حذف الشريك بنجاح" });
  } catch (error) {
    console.error("Error deleting partner:", error);
    res.status(500).json({ error: "خطأ في حذف الشريك" });
  }
};