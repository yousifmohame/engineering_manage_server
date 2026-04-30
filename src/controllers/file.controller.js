const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const fs = require("fs");

// إعداد الاتصال بقاعدة البيانات بنفس الطريقة المستخدمة في باقي المشروع
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 1. جلب محتويات مجلد معين (أو المجلد الرئيسي إذا لم يتم تمرير ID)
exports.getFolderContents = async (req, res) => {
  try {
    const { folderId } = req.query;
    const contents = await prisma.fileNode.findMany({
      where: { parentId: folderId || null },
      orderBy: [{ isFolder: 'desc' }, { name: 'asc' }] // المجلدات أولاً ثم الملفات
    });
    res.json(contents);
  } catch (error) {
    res.status(500).json({ error: "خطأ في جلب الملفات" });
  }
};

// 2. إنشاء مجلد جديد
exports.createFolder = async (req, res) => {
  try {
    const { name, parentId } = req.body;
    const folder = await prisma.fileNode.create({
      data: {
        name: name || "مجلد جديد",
        isFolder: true,
        parentId: parentId || null
      }
    });
    res.status(201).json(folder);
  } catch (error) {
    res.status(500).json({ error: "خطأ في إنشاء المجلد" });
  }
};

// 3. رفع ملف (وإنشاء إصدار جديد إذا كان الملف موجوداً)
// 3. رفع ملف (وإنشاء إصدار جديد إذا كان الملف موجوداً)
exports.uploadFile = async (req, res) => {
  try {
    const { parentId, existingFileId } = req.body;
    const file = req.file; // الملف القادم من مكتبة Multer

    if (!file) return res.status(400).json({ error: "لم يتم رفع ملف" });

    // 🌟 السحر هنا: فك تشفير اسم الملف العربي
    // نقرأ الاسم بترميز latin1 الخاطئ، ثم نحوله إلى ترميز utf8 الصحيح
    const decodedFileName = Buffer.from(file.originalname, 'latin1').toString('utf8');

    const fileUrl = `/uploads/${file.filename}`;

    if (existingFileId) {
      // نظام الإصدارات: تحديث ملف موجود
      const existing = await prisma.fileNode.findUnique({ where: { id: existingFileId } });
      const versionsCount = await prisma.fileVersion.count({ where: { fileNodeId: existing.id } });

      await prisma.fileVersion.create({
        data: {
          fileNodeId: existing.id,
          url: existing.url,
          size: existing.size,
          versionNum: versionsCount + 1
        }
      });

      const updatedFile = await prisma.fileNode.update({
        where: { id: existing.id },
        data: { url: fileUrl, size: file.size, mimeType: file.mimetype }
      });
      return res.json(updatedFile);
    } else {
      // إنشاء ملف جديد واستخدام الاسم المعالج (decodedFileName)
      const newFile = await prisma.fileNode.create({
        data: {
          name: decodedFileName, // 👈 استخدمنا الاسم الصحيح هنا
          isFolder: false,
          mimeType: file.mimetype,
          size: file.size,
          url: fileUrl,
          parentId: parentId || null
        }
      });
      return res.status(201).json(newFile);
    }
  } catch (error) {
    console.error("Upload Error:", error);
    res.status(500).json({ error: "خطأ في رفع الملف" });
  }
};

// 4. إعادة التسمية
exports.renameNode = async (req, res) => {
  try {
    const { id } = req.params;
    const { newName } = req.body;
    const updated = await prisma.fileNode.update({
      where: { id },
      data: { name: newName }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "خطأ في إعادة التسمية" });
  }
};

// 5. الحذف
exports.deleteNode = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.fileNode.delete({ where: { id } });
    res.json({ message: "تم الحذف" });
  } catch (error) {
    res.status(500).json({ error: "خطأ في الحذف" });
  }
};