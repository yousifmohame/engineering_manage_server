const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter,
});

// 1. جلب جميع الحركات وملخص الرصيد
exports.getTransactions = async (req, res) => {
  try {
    const transactions = await prisma.safeTransaction.findMany({
      orderBy: { date: 'desc' }
    });

    let totalBalance = 0;
    let totalDeposits = 0;
    let totalWithdrawals = 0;

    transactions.forEach(t => {
      if (t.type === 'إيداع') {
        totalDeposits += t.amount;
        totalBalance += t.amount;
      } else if (t.type === 'سحب') {
        totalWithdrawals += t.amount;
        totalBalance -= t.amount;
      }
    });

    res.status(200).json({
      transactions,
      summary: { totalBalance, totalDeposits, totalWithdrawals }
    });
  } catch (error) {
    console.error("Error fetching:", error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب البيانات' });
  }
};

// 2. إضافة حركة جديدة
exports.addTransaction = async (req, res) => {
  try {
    const { type, amount, currency, assetType, reason, date } = req.body;
    const newTransaction = await prisma.safeTransaction.create({
      data: {
        type,
        amount: parseFloat(amount),
        currency: currency || 'SAR',
        assetType: assetType || 'كاش',
        reason,
        date: new Date(date)
      }
    });
    res.status(201).json(newTransaction);
  } catch (error) {
    console.error("Error adding:", error);
    res.status(500).json({ error: 'حدث خطأ أثناء إضافة الحركة' });
  }
};

// 3. تعديل حركة موجودة (الجديد ✨)
exports.updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, currency, assetType, reason, date } = req.body;

    const updated = await prisma.safeTransaction.update({
      where: { id: id },
      data: {
        type,
        amount: parseFloat(amount),
        currency,
        assetType,
        reason,
        date: new Date(date)
      }
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error("Error updating:", error);
    res.status(500).json({ error: 'حدث خطأ أثناء التعديل' });
  }
};

// 4. حذف حركة (الجديد ✨)
exports.deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.safeTransaction.delete({
      where: { id: id }
    });
    res.status(200).json({ message: 'تم حذف الحركة بنجاح' });
  } catch (error) {
    console.error("Error deleting:", error);
    res.status(500).json({ error: 'حدث خطأ أثناء الحذف' });
  }
};