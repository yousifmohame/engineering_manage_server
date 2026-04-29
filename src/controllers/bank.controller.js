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

const generateHash = (accountId, date, amount, type, description) => {
  const dataString = `${accountId}_${date}_${amount}_${type}_${description}`;
  return crypto.createHash("sha256").update(dataString).digest("hex");
};

// 1. تحليل كشف الحساب وتحديث الرصيد التلقائي
exports.analyzeStatement = async (req, res) => {
  try {
    const { bankAccountId } = req.body;
    const file = req.file;

    if (!file || !bankAccountId) return res.status(400).json({ error: "بيانات مفقودة" });

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
      accountId: bankAccountId,
      type: tx.type === "إيداع" ? "INCOME" : "EXPENSE",
      amount: parseFloat(tx.amount),
      description: tx.description,
      date: new Date(tx.date),
      transactionHash: generateHash(bankAccountId, tx.date, tx.amount, tx.type, tx.description),
    }));

    const result = await prisma.transaction.createMany({
      data: transactionsToInsert,
      skipDuplicates: true,
    });

    // إعادة حساب رصيد البنك
    const allTx = await prisma.transaction.findMany({ where: { accountId: bankAccountId } });
    const newBalance = allTx.reduce((sum, t) => (t.type === "INCOME" ? sum + t.amount : sum - t.amount), 0);

    await prisma.financialAccount.update({
      where: { id: bankAccountId },
      data: { balance: newBalance },
    });

    fs.unlinkSync(file.path);
    res.json({ message: "تم التحليل", added: result.count });
  } catch (error) {
    if (req.file && req.file.path) fs.unlinkSync(req.file.path);
    console.error(error);
    res.status(500).json({ error: "خطأ في التحليل" });
  }
};

// 2. جلب الحسابات البنكية
exports.getAccounts = async (req, res) => {
  try {
    const accounts = await prisma.financialAccount.findMany({
      where: { type: "BANK" },
      include: { transactions: { orderBy: { date: "desc" } } },
    });
    
    // 🌟 ترجمة الحركات والمرفقات للواجهة
    const formattedAccounts = accounts.map(acc => ({
      ...acc,
      transactions: acc.transactions.map(t => ({
        ...t,
        type: t.type === "INCOME" ? "إيداع" : "سحب",
        attachment: t.attachmentUrl // ✨ السر هنا أيضاً
      }))
    }));

    const totalAllBanks = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    res.json({ accounts: formattedAccounts, totalAllBanks });
  } catch (error) {
    console.error("Error fetching bank accounts:", error);
    res.status(500).json({ error: "خطأ في جلب الحسابات" });
  }
};

// 3. إنشاء حساب بنكي
exports.createAccount = async (req, res) => {
  try {
    const data = req.body;
    const account = await prisma.financialAccount.create({
      data: {
        name: data.bankName || "بنك جديد",
        type: "BANK",
        accountNumber: data.accountNumber,
        iban: data.iban,
        swiftCode: data.swiftCode,
        currency: data.currency || "EGP",
        balance: parseFloat(data.balance || 0),
      },
    });
    res.status(201).json(account);
  } catch (error) {
    res.status(500).json({ error: "خطأ في الإنشاء" });
  }
};

// 4. إضافة حركة يدوية
exports.addTransaction = async (req, res) => {
  try {
    const { bankAccountId, type, amount, description, date, referenceNumber } = req.body;
    const numAmount = parseFloat(amount);
    let attachmentUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const dbType = type === "إيداع" ? "INCOME" : "EXPENSE";
    const balanceChange = type === "إيداع" ? numAmount : -numAmount;

    const [transaction, account] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          accountId: bankAccountId,
          type: dbType,
          amount: numAmount,
          description,
          referenceNumber,
          attachmentUrl,
          date: new Date(date),
        },
      }),
      prisma.financialAccount.update({
        where: { id: bankAccountId },
        data: { balance: { increment: balanceChange } },
      })
    ]);

    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ error: "خطأ في تسجيل الحركة" });
  }
};

exports.updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, description, date, referenceNumber } = req.body;
    const newAmount = parseFloat(amount);

    // 1. جلب الحركة القديمة لمعرفة قيمتها وتأثيرها
    const oldTx = await prisma.transaction.findUnique({ where: { id } });
    if (!oldTx) return res.status(404).json({ error: "الحركة غير موجودة" });

    // التأكد من المرفقات
    let attachmentUrl = oldTx.attachmentUrl;
    if (req.file) attachmentUrl = `/uploads/${req.file.filename}`;

    // 2. المعادلة المحاسبية: عكس القديم وتطبيق الجديد
    const reverseOld = oldTx.type === "INCOME" ? -oldTx.amount : oldTx.amount;
    const dbType = type === "إيداع" ? "INCOME" : "EXPENSE";
    const applyNew = type === "إيداع" ? newAmount : -newAmount;
    
    const netBalanceChange = reverseOld + applyNew;

    // 3. تطبيق التعديل على الحركة والرصيد
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id },
        data: {
          type: dbType,
          amount: newAmount,
          description,
          referenceNumber,
          attachmentUrl,
          date: new Date(date),
        },
      }),
      prisma.financialAccount.update({
        where: { id: oldTx.accountId },
        data: { balance: { increment: netBalanceChange } },
      }),
    ]);

    res.json({ message: "تم التعديل والتسوية بنجاح" });
  } catch (error) {
    console.error("Error updating bank tx:", error);
    res.status(500).json({ error: "خطأ في التعديل" });
  }
};

// 5. حذف حركة
exports.deleteTransaction = async (req, res) => {
  try {
    const tx = await prisma.transaction.findUnique({ where: { id: req.params.id } });
    if (!tx) return res.status(404).json({ error: "غير موجودة" });

    const balanceChange = tx.type === "INCOME" ? -tx.amount : tx.amount;

    await prisma.$transaction([
      prisma.transaction.delete({ where: { id: tx.id } }),
      prisma.financialAccount.update({
        where: { id: tx.accountId },
        data: { balance: { increment: balanceChange } },
      }),
    ]);

    res.json({ message: "تم الحذف" });
  } catch (error) {
    res.status(500).json({ error: "خطأ في الحذف" });
  }
};

// 6. حذف الحساب
exports.deleteAccount = async (req, res) => {
  try {
    await prisma.financialAccount.delete({ where: { id: req.params.id } });
    res.json({ message: "تم الحذف" });
  } catch (error) {
    res.status(500).json({ error: "خطأ في الحذف" });
  }
};