const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 1. جلب المصروفات
exports.getExpenses = async (req, res) => {
  try {
    const expenses = await prisma.expense.findMany({
      orderBy: { date: "desc" },
    });
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const statsByCategory = expenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
      return acc;
    }, {});

    res
      .status(200)
      .json({
        expenses,
        summary: {
          total: totalExpenses,
          count: expenses.length,
          statsByCategory,
        },
      });
  } catch (error) {
    res.status(500).json({ error: "خطأ في جلب المصروفات" });
  }
};

// 2. إضافة مصروف
exports.addExpense = async (req, res) => {
  try {
    const { amount, category, description, date } = req.body;
    const newExpense = await prisma.expense.create({
      data: {
        amount: parseFloat(amount),
        category,
        description,
        date: new Date(date),
      },
    });
    res.status(201).json(newExpense);
  } catch (error) {
    res.status(500).json({ error: "خطأ في إضافة المصروف" });
  }
};

// 3. تعديل مصروف (الجديد)
exports.updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, category, description, date } = req.body;
    const updatedExpense = await prisma.expense.update({
      where: { id: id },
      data: {
        amount: parseFloat(amount),
        category,
        description,
        date: new Date(date),
      },
    });
    res.status(200).json(updatedExpense);
  } catch (error) {
    res.status(500).json({ error: "خطأ في تعديل المصروف" });
  }
};

// 4. حذف مصروف (الجديد)
exports.deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.expense.delete({
      where: { id: id },
    });
    res.status(200).json({ message: "تم الحذف بنجاح" });
  } catch (error) {
    res.status(500).json({ error: "خطأ في حذف المصروف" });
  }
};
