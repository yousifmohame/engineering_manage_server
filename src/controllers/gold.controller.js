const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 1. جلب استثمارات الذهب
exports.getGoldInvestments = async (req, res) => {
  try {
    const assets = await prisma.asset.findMany({
      where: { type: "GOLD" },
      orderBy: { date: "desc" },
    });

    // ترجمة البيانات للواجهة الأمامية
    const formattedAssets = assets.map(asset => ({
      ...asset,
      itemType: asset.subType, // الواجهة تتوقع itemType
      notes: asset.description  // الواجهة تتوقع notes
    }));

    const totalWeight = assets.reduce((sum, a) => sum + (a.weight || 0), 0);
    const totalCost = assets.reduce((sum, a) => sum + a.buyPrice, 0);

    res.json({
      investments: formattedAssets,
      summary: { totalWeight, totalCost }
    });
  } catch (error) {
    console.error("Error fetching gold:", error);
    res.status(500).json({ error: "خطأ في جلب بيانات الذهب" });
  }
};

// 2. إضافة ذهب جديد
exports.addGold = async (req, res) => {
  try {
    const data = req.body;
    const newAsset = await prisma.asset.create({
      data: {
        type: "GOLD",
        subType: data.itemType, // سبيكة، جنيه، إلخ
        karat: parseInt(data.karat) || 24,
        weight: parseFloat(data.weight),
        buyPrice: parseFloat(data.buyPrice),
        date: new Date(data.date),
        description: data.notes
      }
    });

    res.status(201).json({
      ...newAsset,
      itemType: newAsset.subType,
      notes: newAsset.description
    });
  } catch (error) {
    console.error("Error adding gold:", error);
    res.status(500).json({ error: "خطأ في إضافة الذهب" });
  }
};

// 4. تعديل بيانات الذهب
exports.updateGold = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const updatedAsset = await prisma.asset.update({
      where: { id: id },
      data: {
        subType: data.itemType, // الواجهة ترسل itemType، ونحن نحفظها في subType
        karat: parseInt(data.karat) || 24,
        weight: parseFloat(data.weight),
        buyPrice: parseFloat(data.buyPrice),
        date: new Date(data.date),
        description: data.notes // الواجهة ترسل notes، ونحن نحفظها في description
      }
    });

    // نعيد البيانات للواجهة بنفس الأسماء التي تفهمها
    res.json({
      ...updatedAsset,
      itemType: updatedAsset.subType,
      notes: updatedAsset.description
    });
  } catch (error) {
    console.error("Error updating gold:", error);
    res.status(500).json({ error: "خطأ في تعديل بيانات الذهب" });
  }
};

// 3. حذف ذهب
exports.deleteGold = async (req, res) => {
  try {
    await prisma.asset.delete({ where: { id: req.params.id } });
    res.json({ message: "تم الحذف بنجاح" });
  } catch (error) {
    res.status(500).json({ error: "خطأ في الحذف" });
  }
};


