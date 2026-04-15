const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

exports.getData = async (req, res) => {
  try {
    let settings = await prisma.youssefPartnership.findFirst();
    if (!settings) {
      settings = await prisma.youssefPartnership.create({ data: {} });
    }
    const settlements = await prisma.youssefSettlement.findMany({ orderBy: { date: 'desc' } });
    const loans = await prisma.youssefLoan.findMany({ orderBy: { createdAt: 'desc' } });
    
    // إضافة جلب المساهمات
    const contributions = await prisma.youssefContribution.findMany({ orderBy: { date: 'desc' } });
    
    // إرسال المساهمات مع باقي البيانات
    res.json({ settings, settlements, loans, contributions });
  } catch (error) {
    console.error("Error fetching Youssef data:", error);
    res.status(500).json({ error: "خطأ في جلب البيانات" });
  }
};

exports.addLoan = async (req, res) => {
  try {
    const data = req.body;
    const loan = await prisma.youssefLoan.create({
      data: {
        amount: parseFloat(data.amount),
        currency: data.currency || 'SAR',
        fromPartner: data.fromPartner,
        toPartner: data.toPartner,
        description: data.description,
        repaymentDate: data.repaymentDate ? new Date(data.repaymentDate) : null, // يقبل Null
        deductFromLiquidation: data.deductFromLiquidation === true
      }
    });
    res.status(201).json(loan);
  } catch (error) {
    res.status(500).json({ error: 'خطأ في إضافة السلفة' });
  }
};

// دالة جديدة: إضافة مساهمة رأس مال
exports.addContribution = async (req, res) => {
  try {
    const data = req.body;
    const contribution = await prisma.youssefContribution.create({
      data: {
        amount: parseFloat(data.amount),
        currency: data.currency,
        amountInSAR: parseFloat(data.amountInSAR),
        date: new Date(data.date),
        description: data.description
      }
    });
    res.status(201).json(contribution);
  } catch (error) {
    res.status(500).json({ error: 'خطأ في إضافة المساهمة' });
  }
};

// دالة جديدة: حذف مساهمة
exports.deleteContribution = async (req, res) => {
  try {
    await prisma.youssefContribution.delete({ where: { id: req.params.id } });
    res.json({ message: 'تم الحذف' });
  } catch (error) {
    res.status(500).json({ error: 'خطأ في الحذف' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const data = req.body;
    const current = await prisma.youssefPartnership.findFirst();
    const updated = await prisma.youssefPartnership.update({
      where: { id: current.id },
      data: {
        ...data,
        youssefSharePercentage: parseFloat(data.youssefSharePercentage),
        establishmentDate: new Date(data.establishmentDate)
      },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "خطأ في تحديث الإعدادات" });
  }
};

exports.addSettlement = async (req, res) => {
  try {
    const data = req.body;
    const settlement = await prisma.youssefSettlement.create({
      data: { ...data, amount: parseFloat(data.amount), date: new Date(data.date) }
    });
    res.status(201).json(settlement);
  } catch (error) {
    res.status(500).json({ error: "خطأ في الإضافة" });
  }
};

exports.deleteSettlement = async (req, res) => {
  try {
    await prisma.youssefSettlement.delete({ where: { id: req.params.id } });
    res.json({ message: "تم الحذف" });
  } catch (error) { res.status(500).json({ error: "خطأ في الحذف" }); }
};


exports.deleteLoan = async (req, res) => {
  try {
    await prisma.youssefLoan.delete({ where: { id: req.params.id } });
    res.json({ message: "تم الحذف" });
  } catch (error) { res.status(500).json({ error: "خطأ في الحذف" }); }
};