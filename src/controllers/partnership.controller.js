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

exports.getExpenses = async (req, res) => {
  try {
    const expenses = await prisma.partnershipExpense.findMany({ orderBy: { date: 'desc' } });
    res.json(expenses);
  } catch (error) { res.status(500).json({ error: 'خطأ في جلب المصروفات' }); }
};

exports.addExpense = async (req, res) => {
  try {
    const data = req.body;
    const expense = await prisma.partnershipExpense.create({
      data: { ...data, amount: parseFloat(data.amount), date: new Date(data.date) }
    });
    res.status(201).json(expense);
  } catch (error) { res.status(500).json({ error: 'خطأ في الإضافة' }); }
};

exports.updateExpense = async (req, res) => {
  try {
    const data = req.body;
    const expense = await prisma.partnershipExpense.update({
      where: { id: req.params.id },
      data: { ...data, amount: parseFloat(data.amount), date: new Date(data.date) }
    });
    res.json(expense);
  } catch (error) { res.status(500).json({ error: 'خطأ في التعديل' }); }
};

exports.deleteExpense = async (req, res) => {
  try {
    await prisma.partnershipExpense.delete({ where: { id: req.params.id } });
    res.json({ message: 'تم الحذف' });
  } catch (error) { res.status(500).json({ error: 'خطأ في الحذف' }); }
};