const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// دالة مساعدة للحصول على حساب الخزنة الرئيسي (أو إنشائه)
async function getSafeAccount() {
  let safe = await prisma.financialAccount.findFirst({
    where: { type: "SAFE" }
  });
  if (!safe) {
    safe = await prisma.financialAccount.create({
      data: { name: "الخزنة الرئيسية", type: "SAFE", balance: 0, currency: "SAR" }
    });
  }
  return safe;
}

// 1. جلب بيانات الخزنة
exports.getTransactions = async (req, res) => {
  try {
    const safe = await getSafeAccount();
    const transactions = await prisma.transaction.findMany({
      where: { accountId: safe.id },
      orderBy: { date: "desc" },
    });

    // ترجمة البيانات لتناسب الواجهة الأمامية
    const formattedTransactions = transactions.map(t => ({
      ...t,
      type: t.type === "INCOME" ? "إيداع" : "سحب",
      reason: t.description,    
      assetType: t.category     
    }));

    // 🌟 السحر هنا: حساب الإحصائيات (Summary) التي تنتظرها الواجهة الأمامية
    const totalDeposits = transactions
      .filter(t => t.type === "INCOME")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalWithdrawals = transactions
      .filter(t => t.type === "EXPENSE")
      .reduce((sum, t) => sum + t.amount, 0);

    // إرسال البيانات بنفس الهيكل الذي تتوقعه واجهة React
    res.json({
        transactions: formattedTransactions,
        summary: {
            totalBalance: safe.balance,
            totalDeposits: totalDeposits,
            totalWithdrawals: totalWithdrawals
        }
    });

  } catch (error) {
    console.error("Error fetching safe transactions:", error);
    res.status(500).json({ error: "خطأ في جلب بيانات الخزنة" });
  }
};

exports.addTransaction = async (req, res) => {
  try {
    const safe = await getSafeAccount();
    const { type, amount, currency, assetType, reason, date } = req.body;
    const numAmount = parseFloat(amount);

    const dbType = type === "إيداع" ? "INCOME" : "EXPENSE";
    const balanceChange = type === "إيداع" ? numAmount : -numAmount;

    // استخدام Prisma Transaction لضمان تحديث الحركة والرصيد معاً
    const [transaction, updatedSafe] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          type: dbType,
          amount: numAmount,
          currency: currency || "SAR",
          description: reason || "بدون وصف", 
          category: assetType || "كاش",      
          date: date ? new Date(date) : new Date(),
          accountId: safe.id,
        },
      }),
      prisma.financialAccount.update({
        where: { id: safe.id },
        data: { balance: { increment: balanceChange } },
      })
    ]);

    res.status(201).json({
      ...transaction,
      type: type,
      reason: transaction.description,
      assetType: transaction.category
    });
  } catch (error) {
    console.error("Error adding safe transaction:", error);
    res.status(500).json({ error: "خطأ في إضافة الحركة للخزنة" });
  }
};

exports.updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, currency, assetType, reason, date } = req.body;
    const newAmount = parseFloat(amount);

    // 1. جلب الحركة القديمة لمعرفة قيمتها وتأثيرها
    const oldTx = await prisma.transaction.findUnique({ where: { id } });
    if (!oldTx) return res.status(404).json({ error: "الحركة غير موجودة" });

    // 2. المعادلة المحاسبية: عكس القديم وتطبيق الجديد
    const reverseOld = oldTx.type === "INCOME" ? -oldTx.amount : oldTx.amount;
    const dbType = type === "إيداع" ? "INCOME" : "EXPENSE";
    const applyNew = type === "إيداع" ? newAmount : -newAmount;
    
    const netBalanceChange = reverseOld + applyNew; // صافي التغيير في الرصيد

    // 3. تطبيق التعديل على الحركة والرصيد في نفس اللحظة
    const [updatedTx] = await prisma.$transaction([
      prisma.transaction.update({
        where: { id },
        data: {
          type: dbType,
          amount: newAmount,
          currency: currency || "SAR",
          description: reason || "بدون وصف",
          category: assetType || "كاش",
          date: date ? new Date(date) : new Date(),
        },
      }),
      prisma.financialAccount.update({
        where: { id: oldTx.accountId },
        data: { balance: { increment: netBalanceChange } },
      })
    ]);

    // إرجاع البيانات للواجهة بالشكل القديم
    res.json({
      ...updatedTx,
      type: type,
      reason: updatedTx.description,
      assetType: updatedTx.category
    });
  } catch (error) {
    console.error("Error updating safe tx:", error);
    res.status(500).json({ error: "خطأ في تعديل الحركة" });
  }
};

exports.deleteTransaction = async (req, res) => {
  try {
    const tx = await prisma.transaction.findUnique({ where: { id: req.params.id } });
    if (!tx) return res.status(404).json({ error: "الحركة غير موجودة" });

    // عكس العملية لضبط الرصيد
    const balanceChange = tx.type === "INCOME" ? -tx.amount : tx.amount;

    await prisma.$transaction([
      prisma.transaction.delete({ where: { id: req.params.id } }),
      prisma.financialAccount.update({
        where: { id: tx.accountId },
        data: { balance: { increment: balanceChange } }
      })
    ]);

    res.json({ message: "تم الحذف بنجاح" });
  } catch (error) {
    console.error("Error deleting safe tx:", error);
    res.status(500).json({ error: "خطأ في الحذف" });
  }
};