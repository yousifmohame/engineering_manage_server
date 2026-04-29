const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { GoogleGenAI } = require("@google/genai");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// دالة مساعدة للحصول على أو إنشاء شراكة نظمي
async function getNazmiPartnership() {
  let partnership = await prisma.partnership.findFirst({
    where: { name: "شراكة المكتب الهندسي" },
    include: { transactions: { orderBy: { date: "desc" } } },
  });

  if (!partnership) {
    partnership = await prisma.partnership.create({
      data: {
        name: "شراكة المكتب الهندسي",
        capital: 1000000,
        reserve: 50000,
      },
      include: { transactions: true },
    });

    // إضافة الشركاء الافتراضيين
    await prisma.partner.createMany({
      data: [
        { name: "أنا", sharePercent: 50, partnershipId: partnership.id },
        { name: "نظمي", sharePercent: 50, partnershipId: partnership.id },
      ],
    });
  }
  return partnership;
}
const getDbType = (frontendType) => {
  if (frontendType === "إيراد") return "INCOME";
  if (frontendType === "مصروف") return "EXPENSE";
  if (frontendType === "توزيع" || frontendType === "توزيع أرباح")
    return "DISTRIBUTION";
  return frontendType; // لأي نوع آخر مستقبلي
};

// 1. جلب البيانات
exports.getData = async (req, res) => {
  try {
    const partnership = await getNazmiPartnership();

    // 🌟 ترجمة الأنواع واسم حقل المرفقات لكي تفهمها الواجهة الأمامية
    const formattedTransactions = partnership.transactions.map((t) => {
      let uiType = t.type;
      if (t.type === "INCOME") uiType = "إيراد";
      else if (t.type === "EXPENSE") uiType = "مصروف";
      else if (t.type === "DISTRIBUTION") uiType = "توزيع";

      return {
        ...t,
        type: uiType,
        attachment: t.attachmentUrl, // ✨ السر هنا: إرسال الرابط بالاسم القديم
      };
    });

    const partners = await prisma.partner.findMany({
      where: { partnershipId: partnership.id },
    });
    const myShare = partners.find((p) => p.name === "أنا")?.sharePercent || 50;
    const partnerShare =
      partners.find((p) => p.name === "نظمي")?.sharePercent || 50;

    res.json({
      ...partnership,
      transactions: formattedTransactions,
      mySharePercent: myShare,
      partnerShare: partnerShare,
    });
  } catch (error) {
    console.error("Error fetching Nazmi data:", error);
    res.status(500).json({ error: "خطأ في جلب البيانات" });
  }
};

// 2. تحديث إعدادات الشراكة
exports.updateSettings = async (req, res) => {
  try {
    const { capital, reserve, mySharePercent, partnerShare } = req.body;
    const currentPartnership = await getNazmiPartnership();

    // تحديث الشراكة
    const updatedPartnership = await prisma.partnership.update({
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
      },
    });

    // تحديث نسب الشركاء إذا تم إرسالها
    if (mySharePercent !== undefined || partnerShare !== undefined) {
      const partners = await prisma.partner.findMany({
        where: { partnershipId: currentPartnership.id },
      });
      for (const partner of partners) {
        if (partner.name === "أنا" && mySharePercent !== undefined) {
          await prisma.partner.update({
            where: { id: partner.id },
            data: { sharePercent: parseFloat(mySharePercent) },
          });
        } else if (partner.name === "نظمي" && partnerShare !== undefined) {
          await prisma.partner.update({
            where: { id: partner.id },
            data: { sharePercent: parseFloat(partnerShare) },
          });
        }
      }
    }

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
    const partnership = await getNazmiPartnership();

    let attachmentUrl = null;
    if (req.file) {
      attachmentUrl = `/uploads/${req.file.filename}`;
    }

    // 🌟 استخدام الدالة الذكية لتحديد النوع
    const dbType = getDbType(data.type);

    let description = data.description;
    if (data.isRecurring === "true") {
      description += ` (متكرر: ${data.recurrenceRate})`;
    }

    const transaction = await prisma.transaction.create({
      data: {
        type: dbType,
        category: data.category,
        amount: parseFloat(data.amount),
        currency: data.currency || "SAR",
        date: new Date(data.date),
        description: description,
        attachmentUrl: attachmentUrl,
        partnershipId: partnership.id,
      },
    });

    res.status(201).json({
      ...transaction,
      type: data.type, // إرجاع النوع بالعربي للواجهة
      isRecurring: data.isRecurring === "true",
      recurrenceRate: data.isRecurring === "true" ? data.recurrenceRate : null,
      attachment: transaction.attachmentUrl,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "خطأ في إضافة الحركة" });
  }
};

// 4. تحديث حركة
exports.updateTransaction = async (req, res) => {
  try {
    const data = req.body;
    const partnership = await getNazmiPartnership();

    // 🌟 استخدام الدالة الذكية لتحديد النوع
    const dbType = getDbType(data.type);

    let description = data.description;
    if (data.isRecurring === "true") {
      description += ` (متكرر: ${data.recurrenceRate})`;
    }

    const updateData = {
      type: dbType,
      category: data.category,
      amount: parseFloat(data.amount),
      date: new Date(data.date),
      description: description,
      partnershipId: partnership.id,
    };

    if (req.file) {
      updateData.attachmentUrl = `/uploads/${req.file.filename}`;
    }

    const transaction = await prisma.transaction.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json({
      ...transaction,
      type: data.type,
      attachment: transaction.attachmentUrl,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "خطأ في تعديل الحركة" });
  }
};

// 5. حذف حركة
exports.deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.transaction.delete({ where: { id } });
    res.json({ message: "تم الحذف" });
  } catch (error) {
    console.error("Error deleting Nazmi transaction:", error);
    res.status(500).json({ error: "خطأ في الحذف" });
  }
};

// 6. تقرير الذكاء الاصطناعي
exports.generateAIReport = async (req, res) => {
  try {
    const partnership = await getNazmiPartnership();

    const partners = await prisma.partner.findMany({
      where: { partnershipId: partnership.id },
    });
    const mySharePercent =
      partners.find((p) => p.name === "أنا")?.sharePercent || 50;

    const totalRev = partnership.transactions
      .filter((t) => t.type === "INCOME")
      .reduce((s, t) => s + t.amount, 0);
    const totalExp = partnership.transactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((s, t) => s + t.amount, 0);

    const prompt = `بصفتي شريك بنسبة ${mySharePercent}% في مكتب هندسي. إجمالي الإيرادات: ${totalRev} ريال، والمصاريف: ${totalExp} ريال.
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
