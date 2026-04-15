const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const crypto = require("crypto");
const fs = require("fs");
const { GoogleGenAI } = require("@google/genai");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const generateHash = (bankAccountId, date, amount, type, description) => {
  const dataString = `${bankAccountId}_${date}_${amount}_${type}_${description}`;
  return crypto.createHash("sha256").update(dataString).digest("hex");
};

// ✅ 1. تحليل كشف الحساب وتحديث الرصيد التلقائي
exports.analyzeStatement = async (req, res) => {
  try {
    const { bankAccountId } = req.body;
    const file = req.file;

    if (!file || !bankAccountId)
      return res.status(400).json({ error: "بيانات مفقودة" });

    const fileBuffer = fs.readFileSync(file.path);
    const mimeType = file.mimetype;

    const prompt = `
      أنت مراجع حسابات خبير. اقرأ كشف الحساب المرفق واستخرج الحركات بصيغة JSON Array فقط.
      [{"date": "YYYY-MM-DD", "amount": 1500.50, "type": "إيداع" أو "سحب", "description": "وصف"}]
      يجب أن يكون المبلغ رقماً موجباً.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        prompt,
        { inlineData: { data: fileBuffer.toString("base64"), mimeType } },
      ],
      config: { responseMimeType: "application/json" },
    });

    const parsedTransactions = JSON.parse(response.text);

    const transactionsToInsert = parsedTransactions.map((tx) => ({
      bankAccountId,
      type: tx.type,
      amount: parseFloat(tx.amount),
      description: tx.description,
      date: new Date(tx.date),
      transactionHash: generateHash(
        bankAccountId,
        tx.date,
        tx.amount,
        tx.type,
        tx.description,
      ),
    }));

    const result = await prisma.bankTransaction.createMany({
      data: transactionsToInsert,
      skipDuplicates: true,
    });

    // 🌟 السحر المحاسبي: إعادة حساب رصيد البنك بعد إضافة حركات الكشف
    const allTx = await prisma.bankTransaction.findMany({
      where: { bankAccountId },
    });
    const newBalance = allTx.reduce(
      (sum, t) => (t.type === "إيداع" ? sum + t.amount : sum - t.amount),
      0,
    );

    await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: { balance: newBalance },
    });

    fs.unlinkSync(file.path);
    res.json({
      message: "تم التحليل",
      totalFound: parsedTransactions.length,
      added: result.count,
      skipped: parsedTransactions.length - result.count,
    });
  } catch (error) {
    if (req.file && req.file.path) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "خطأ في التحليل بالذكاء الاصطناعي" });
  }
};

// ✅ 2. جلب الحسابات (شاملة كل الحركات بدلاً من 5 فقط لتفاصيل الحساب)
exports.getAccounts = async (req, res) => {
  try {
    const accounts = await prisma.bankAccount.findMany({
      include: { transactions: { orderBy: { date: "desc" } } },
    });
    const totalAllBanks = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    res.json({ accounts, totalAllBanks });
  } catch (error) {
    res.status(500).json({ error: "خطأ في جلب الحسابات" });
  }
};

// ✅ 3. إنشاء حساب
exports.createAccount = async (req, res) => {
  try {
    const data = req.body;
    const account = await prisma.bankAccount.create({
      data: {
        ...data,
        balance: parseFloat(data.balance),
        depositFees: parseFloat(data.depositFees || 0),
        exchangeRateUSD: parseFloat(data.exchangeRateUSD || 0.2667),
        exchangeRateEGP: parseFloat(data.exchangeRateEGP || 12.8),
      },
    });
    res.status(201).json(account);
  } catch (error) {
    res.status(500).json({ error: "خطأ في الإنشاء" });
  }
};

// ✅ 4. إضافة حركة يدوية (تدعم المرفقات)
exports.addTransaction = async (req, res) => {
  try {
    const { bankAccountId, type, amount, description, date, referenceNumber } =
      req.body;
    const numAmount = parseFloat(amount);
    let attachment = null;

    if (req.file) attachment = `/uploads/${req.file.filename}`;

    const transaction = await prisma.bankTransaction.create({
      data: {
        bankAccountId,
        type,
        amount: numAmount,
        description,
        referenceNumber,
        attachment,
        date: new Date(date),
      },
    });

    const balanceChange = type === "إيداع" ? numAmount : -numAmount;
    await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: { balance: { increment: balanceChange } },
    });

    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ error: "خطأ في تسجيل الحركة" });
  }
};

// ✅ 5. تعديل حركة (مع تسوية الرصيد تلقائياً)
exports.updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, description, date, referenceNumber } = req.body;
    const newAmount = parseFloat(amount);

    const oldTx = await prisma.bankTransaction.findUnique({ where: { id } });
    if (!oldTx) return res.status(404).json({ error: "الحركة غير موجودة" });

    let attachment = oldTx.attachment;
    if (req.file) attachment = `/uploads/${req.file.filename}`;

    // عكس تأثير الحركة القديمة من الرصيد
    const reverseOld = oldTx.type === "إيداع" ? -oldTx.amount : oldTx.amount;
    // إضافة تأثير الحركة الجديدة
    const applyNew = type === "إيداع" ? newAmount : -newAmount;
    const netBalanceChange = reverseOld + applyNew;

    await prisma.$transaction([
      prisma.bankTransaction.update({
        where: { id },
        data: {
          type,
          amount: newAmount,
          description,
          referenceNumber,
          attachment,
          date: new Date(date),
        },
      }),
      prisma.bankAccount.update({
        where: { id: oldTx.bankAccountId },
        data: { balance: { increment: netBalanceChange } },
      }),
    ]);

    res.json({ message: "تم التعديل والتسوية" });
  } catch (error) {
    res.status(500).json({ error: "خطأ في التعديل" });
  }
};

// ✅ 6. حذف حركة (مع إرجاع الرصيد)
exports.deleteTransaction = async (req, res) => {
  try {
    const tx = await prisma.bankTransaction.findUnique({
      where: { id: req.params.id },
    });
    if (!tx) return res.status(404).json({ error: "غير موجودة" });

    const balanceChange = tx.type === "إيداع" ? -tx.amount : tx.amount;

    await prisma.$transaction([
      prisma.bankTransaction.delete({ where: { id: tx.id } }),
      prisma.bankAccount.update({
        where: { id: tx.bankAccountId },
        data: { balance: { increment: balanceChange } },
      }),
    ]);

    res.json({ message: "تم حذف الحركة وتحديث الرصيد" });
  } catch (error) {
    res.status(500).json({ error: "خطأ في الحذف" });
  }
};

// ✅ 7. حذف حساب بنكي بالكامل
exports.deleteAccount = async (req, res) => {
  try {
    await prisma.bankAccount.delete({ where: { id: req.params.id } });
    res.json({ message: "تم الحذف" });
  } catch (error) {
    res.status(500).json({ error: "خطأ في الحذف" });
  }
};
