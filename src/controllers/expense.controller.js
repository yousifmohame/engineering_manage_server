const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 1. جلب المصروفات (العامة للمكتب)
exports.getExpenses = async (req, res) => {
  try {
    // نجلب المصروفات العامة (التي لا ترتبط بشراكات أو عقارات)
    const expenses = await prisma.transaction.findMany({
      where: { 
          type: "EXPENSE",
          partnershipId: null, // استبعاد مصروفات نظمي ويوسف
          propertyId: null,    // استبعاد مصروفات العقارات
          paidBy: null         // استبعاد مصروفات عمارة طيبة
      },
      orderBy: { date: "desc" },
    });

    // ترجمة حقل المرفقات لكي تعمل أيقونة المرفق في الواجهة الأمامية
    const formattedExpenses = expenses.map(exp => ({
        ...exp,
        attachment: exp.attachmentUrl
    }));

    const totalExpenses = formattedExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const statsByCategory = formattedExpenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
      return acc;
    }, {});

    res.status(200).json({
      expenses: formattedExpenses,
      summary: {
        total: totalExpenses,
        count: formattedExpenses.length,
        statsByCategory,
      },
    });
  } catch (error) {
    console.error("Error fetching office expenses:", error);
    res.status(500).json({ error: "خطأ في جلب المصروفات" });
  }
};

// 2. إضافة مصروف
exports.addExpense = async (req, res) => {
  try {
    const { amount, category, description, date } = req.body;
    
    // دعم المرفقات
    let attachmentUrl = null;
    if (req.file) {
        attachmentUrl = `/uploads/${req.file.filename}`;
    }

    const newExpense = await prisma.transaction.create({
      data: {
        type: "EXPENSE",
        amount: parseFloat(amount),
        category,
        description,
        date: new Date(date),
        attachmentUrl: attachmentUrl
      },
    });
    
    res.status(201).json({
        ...newExpense,
        attachment: newExpense.attachmentUrl
    });
  } catch (error) {
    console.error("Error adding office expense:", error);
    res.status(500).json({ error: "خطأ في إضافة المصروف" });
  }
};

// 3. تعديل مصروف
exports.updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, category, description, date } = req.body;
    
    const updateData = {
        amount: parseFloat(amount),
        category,
        description,
        date: new Date(date),
    };

    // تحديث المرفق فقط إذا تم رفع ملف جديد
    if (req.file) {
        updateData.attachmentUrl = `/uploads/${req.file.filename}`;
    }

    const updatedExpense = await prisma.transaction.update({
      where: { id: id },
      data: updateData,
    });
    
    res.status(200).json({
        ...updatedExpense,
        attachment: updatedExpense.attachmentUrl
    });
  } catch (error) {
    console.error("Error updating office expense:", error);
    res.status(500).json({ error: "خطأ في تعديل المصروف" });
  }
};

// 4. حذف مصروف
exports.deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.transaction.delete({
      where: { id: id },
    });
    res.status(200).json({ message: "تم الحذف بنجاح" });
  } catch (error) {
    console.error("Error deleting office expense:", error);
    res.status(500).json({ error: "خطأ في حذف المصروف" });
  }
};