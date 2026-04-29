const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 🌟 دالة مساعدة لجلب أو إنشاء شراكة يوسف في الجدول المركزي
async function getYoussefPartnership() {
  let partnership = await prisma.partnership.findFirst({
    where: { name: "شراكة يوسف" },
  });

  if (!partnership) {
    partnership = await prisma.partnership.create({
      data: {
        name: "شراكة يوسف",
        capital: 0,
        reserve: 0,
      },
    });
    // إضافة الشركاء
    await prisma.partner.createMany({
      data: [
        { name: "أنا", sharePercent: 50, partnershipId: partnership.id },
        { name: "يوسف", sharePercent: 50, partnershipId: partnership.id },
      ],
    });
  }
  return partnership;
}

// 1. جلب البيانات
exports.getData = async (req, res) => {
  try {
    const partnership = await getYoussefPartnership();

    // جلب نسبة يوسف
    const partners = await prisma.partner.findMany({
      where: { partnershipId: partnership.id },
    });
    const youssefShare =
      partners.find((p) => p.name === "يوسف")?.sharePercent || 50;

    // تهيئة الإعدادات للواجهة الأمامية
    const settings = {
      id: partnership.id,
      youssefSharePercentage: youssefShare,
      establishmentDate: partnership.establishmentDate,
      showCapital: partnership.showCapital,
      showProfits: partnership.showProfits,
      showAiAnalysis: partnership.showAiAnalysis,
    };

    // جلب التسويات (من جدول المعاملات)
    const transactions = await prisma.transaction.findMany({
      where: { partnershipId: partnership.id },
      orderBy: { date: "desc" },
    });
    const settlements = transactions.map((t) => ({
      id: t.id,
      type: t.category, // نوع التسوية كان يخزن في category
      amount: t.amount,
      date: t.date,
      description: t.description,
    }));

    // جلب السلف والمساهمات (من جدول السلف المركزي)
    const allLoansAndContributions = await prisma.loan.findMany({
      where: { partnershipId: partnership.id },
      orderBy: { createdAt: "desc" },
    });

    const loans = allLoansAndContributions.filter((l) => l.type === "LOAN");

    // تجهيز المساهمات لتناسب الواجهة القديمة
    const contributions = allLoansAndContributions
      .filter((l) => l.type === "CONTRIBUTION")
      .map((c) => ({
        id: c.id,
        amount: c.amount,
        currency: c.currency,
        amountInSAR: c.amount, // تبسيط لتوافق الواجهة
        date: c.createdAt,
        description: c.description,
      }));

    res.json({ settings, settlements, loans, contributions });
  } catch (error) {
    console.error("Error fetching Youssef data:", error);
    res.status(500).json({ error: "خطأ في جلب البيانات" });
  }
};

// 2. تحديث الإعدادات
exports.updateSettings = async (req, res) => {
  try {
    const data = req.body;
    const current = await getYoussefPartnership();

    // تحديث تاريخ الإنشاء في جدول الشراكة
    const updated = await prisma.partnership.update({
      where: { id: current.id },
      data: { establishmentDate: new Date(data.establishmentDate) },
    });

    // تحديث نسبة الشريك
    const partners = await prisma.partner.findMany({
      where: { partnershipId: current.id },
    });
    const youssef = partners.find((p) => p.name === "يوسف");
    if (youssef && data.youssefSharePercentage) {
      await prisma.partner.update({
        where: { id: youssef.id },
        data: { sharePercent: parseFloat(data.youssefSharePercentage) },
      });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "خطأ في تحديث الإعدادات" });
  }
};

// 3. إضافة سلفة
exports.addLoan = async (req, res) => {
  try {
    const partnership = await getYoussefPartnership();
    const data = req.body;
    const loan = await prisma.loan.create({
      data: {
        type: "LOAN", // تثبيت النوع
        amount: parseFloat(data.amount),
        currency: data.currency || "SAR",
        fromPartner: data.fromPartner,
        toPartner: data.toPartner,
        description: data.description,
        repaymentDate: data.repaymentDate ? new Date(data.repaymentDate) : null,
        deductFromLiquidation: data.deductFromLiquidation === true,
        partnershipId: partnership.id,
      },
    });
    res.status(201).json(loan);
  } catch (error) {
    res.status(500).json({ error: "خطأ في إضافة السلفة" });
  }
};

// 4. إضافة مساهمة رأس مال
exports.addContribution = async (req, res) => {
  try {
    const partnership = await getYoussefPartnership();
    const data = req.body;
    const contribution = await prisma.loan.create({
      data: {
        type: "CONTRIBUTION", // تثبيت النوع كمساهمة
        amount: parseFloat(data.amount),
        currency: data.currency,
        fromPartner: "الشريك المانح",
        toPartner: "الشراكة",
        description: data.description,
        createdAt: new Date(data.date),
        partnershipId: partnership.id,
      },
    });
    res.status(201).json(contribution);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "خطأ في إضافة المساهمة" });
  }
};

// 5. إضافة تسوية (مصروفات وإيرادات)
exports.addSettlement = async (req, res) => {
  try {
    const partnership = await getYoussefPartnership();
    const data = req.body;

    // نحدد ما إذا كانت التسوية إيراد أو مصروف بناءً على النص القادم من الواجهة
    const dbType =
      data.type && data.type.includes("مقبوضات") ? "INCOME" : "EXPENSE";

    const settlement = await prisma.transaction.create({
      data: {
        type: dbType,
        category: data.type, // نحفظ النوع القديم هنا لتعرفه الواجهة
        amount: parseFloat(data.amount),
        date: new Date(data.date),
        description: data.description || "تسوية يوسف",
        partnershipId: partnership.id,
      },
    });
    res.status(201).json({
      ...settlement,
      type: settlement.category, // إعادة الاسم للواجهة
    });
  } catch (error) {
    res.status(500).json({ error: "خطأ في الإضافة" });
  }
};

// 6. دوال الحذف
exports.deleteContribution = async (req, res) => {
  try {
    await prisma.loan.delete({ where: { id: req.params.id } });
    res.json({ message: "تم الحذف" });
  } catch (error) {
    res.status(500).json({ error: "خطأ في الحذف" });
  }
};

exports.deleteLoan = async (req, res) => {
  try {
    await prisma.loan.delete({ where: { id: req.params.id } });
    res.json({ message: "تم الحذف" });
  } catch (error) {
    res.status(500).json({ error: "خطأ في الحذف" });
  }
};

exports.deleteSettlement = async (req, res) => {
  try {
    await prisma.transaction.delete({ where: { id: req.params.id } });
    res.json({ message: "تم الحذف" });
  } catch (error) {
    res.status(500).json({ error: "خطأ في الحذف" });
  }
};
