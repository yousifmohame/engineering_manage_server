const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { GoogleGenAI } = require("@google/genai");

// الإعداد الصحيح والمثالي لـ Prisma
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 1. جلب البيانات
exports.getData = async (req, res) => {
  try {
    let partnership = await prisma.nazmiPartnership.findFirst({
      include: { transactions: { orderBy: { date: "desc" } } },
    });
    if (!partnership) {
      partnership = await prisma.nazmiPartnership.create({
        data: {},
        include: { transactions: true },
      });
    }
    res.json(partnership);
  } catch (error) {
    console.error("Error fetching Nazmi data:", error);
    res.status(500).json({ error: "خطأ في جلب البيانات" });
  }
};

// 2. تحديث إعدادات الشراكة (الجديد ✨)
exports.updateSettings = async (req, res) => {
  try {
    const { capital, reserve, mySharePercent, partnerShare } = req.body;

    const currentPartnership = await prisma.nazmiPartnership.findFirst();

    if (!currentPartnership) {
      return res.status(404).json({ error: "الشراكة غير موجودة" });
    }

    // تحديث البيانات مع التأكد من وجودها لتجنب تفريغ الحقول
    const updatedPartnership = await prisma.nazmiPartnership.update({
      where: { id: currentPartnership.id },
      data: {
        capital:
          capital !== undefined
            ? parseFloat(capital)
            : currentPartnership.capital,
        reserve:
          reserve !== undefined
            ? parseFloat(reserve)
            : currentPartnership.reserve,
        mySharePercent:
          mySharePercent !== undefined
            ? parseFloat(mySharePercent)
            : currentPartnership.mySharePercent,
        partnerShare:
          partnerShare !== undefined
            ? parseFloat(partnerShare)
            : currentPartnership.partnerShare,
      },
    });

    res.json(updatedPartnership);
  } catch (error) {
    console.error("Error updating Nazmi settings:", error);
    res.status(500).json({ error: "خطأ في تحديث الإعدادات" });
  }
};

// 3. إضافة حركة جديدة
exports.addTransaction = async (req, res) => {
  try {
    const data = req.body;
    const transaction = await prisma.nazmiTransaction.create({
      data: {
        ...data,
        amount: parseFloat(data.amount),
        date: new Date(data.date),
        isRecurring: data.isRecurring || false,
      },
    });
    res.status(201).json(transaction);
  } catch (error) {
    console.error("Error adding Nazmi transaction:", error);
    res.status(500).json({ error: "خطأ في الإضافة" });
  }
};

// 4. تعديل حركة
exports.updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const transaction = await prisma.nazmiTransaction.update({
      where: { id },
      data: {
        ...data,
        amount: parseFloat(data.amount),
        date: new Date(data.date),
        isRecurring: data.isRecurring || false,
      },
    });
    res.json(transaction);
  } catch (error) {
    console.error("Error updating Nazmi transaction:", error);
    res.status(500).json({ error: "خطأ في التعديل" });
  }
};

// 5. حذف حركة
exports.deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.nazmiTransaction.delete({ where: { id } });
    res.json({ message: "تم الحذف" });
  } catch (error) {
    console.error("Error deleting Nazmi transaction:", error);
    res.status(500).json({ error: "خطأ في الحذف" });
  }
};

// 6. تقرير الذكاء الاصطناعي
exports.generateAIReport = async (req, res) => {
  try {
    const partnership = await prisma.nazmiPartnership.findFirst({
      include: { transactions: true },
    });
    const totalRev = partnership.transactions
      .filter((t) => t.type === "إيراد")
      .reduce((s, t) => s + t.amount, 0);
    const totalExp = partnership.transactions
      .filter((t) => t.type === "مصروف")
      .reduce((s, t) => s + t.amount, 0);

    const prompt = `بصفتي شريك بنسبة ${partnership.mySharePercent}% في مكتب هندسي. إجمالي الإيرادات: ${totalRev} ريال، والمصاريف: ${totalExp} ريال.
    اكتب لي 3 نصائح مالية استراتيجية (بالعربية، لغة إدارية قوية، بدون مقدمات) بشأن السيولة وإدارة المصاريف.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    res.json({ report: response.text });
  } catch (error) {
    console.error("AI Error:", error);
    res.status(500).json({ error: "خطأ في توليد تقرير الذكاء الاصطناعي" });
  }
};
