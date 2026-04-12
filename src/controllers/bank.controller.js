const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// جلب كل الحسابات مع إجمالي الأرصدة
exports.getAccounts = async (req, res) => {
  try {
    const accounts = await prisma.bankAccount.findMany({
      include: { transactions: { orderBy: { date: 'desc' }, take: 5 } }
    });
    const totalAllBanks = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    res.json({ accounts, totalAllBanks });
  } catch (error) { res.status(500).json({ error: 'خطأ في جلب الحسابات' }); }
};

// إنشاء حساب بنكي جديد
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
      }
    });
    res.status(201).json(account);
  } catch (error) { res.status(500).json({ error: 'خطأ في إنشاء الحساب' }); }
};

// إضافة حركة (إيداع/سحب) وتحديث رصيد البنك
exports.addTransaction = async (req, res) => {
  try {
    const { bankAccountId, type, amount, description, date } = req.body;
    const numAmount = parseFloat(amount);

    // 1. تسجيل الحركة
    const transaction = await prisma.bankTransaction.create({
      data: { bankAccountId, type, amount: numAmount, description, date: new Date(date) }
    });

    // 2. تحديث رصيد الحساب (إضافة إذا إيداع، طرح إذا سحب)
    const balanceChange = type === 'إيداع' ? numAmount : -numAmount;
    await prisma.bankAccount.update({
      where: { id: bankAccountId },
      data: { balance: { increment: balanceChange } }
    });

    res.status(201).json(transaction);
  } catch (error) { res.status(500).json({ error: 'خطأ في تسجيل الحركة' }); }
};

// حذف حساب بنكي
exports.deleteAccount = async (req, res) => {
  try {
    await prisma.bankAccount.delete({ where: { id: req.params.id } });
    res.json({ message: 'تم حذف الحساب' });
  } catch (error) { res.status(500).json({ error: 'خطأ في الحذف' }); }
};