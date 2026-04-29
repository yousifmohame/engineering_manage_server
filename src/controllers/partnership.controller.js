const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 1. جلب المصروفات
exports.getExpenses = async (req, res) => {
  try {
    const expenses = await prisma.transaction.findMany({ 
      where: { 
        type: 'EXPENSE',
        paidBy: { not: null } // لجلب المصروفات الخاصة بالشراكات (التي تحتوي على حقل "من دفع")
      },
      orderBy: { date: 'desc' } 
    });

    // ✨ حيلة بسيطة: الواجهة الأمامية تتوقع أن حقل (type) يحتوي على "أرض أو بناء"
    // لذا سنقوم بتحويل (category) الموجود في الداتا بيز إلى (type) قبل إرساله للواجهة
    const formattedExpenses = expenses.map(exp => ({
      ...exp,
      type: exp.category 
    }));

    res.json(formattedExpenses);
  } catch (error) { 
    console.error("Fetch Expenses Error:", error);
    res.status(500).json({ error: 'خطأ في جلب المصروفات' }); 
  }
};

// 2. إضافة مصروف جديد
exports.addExpense = async (req, res) => {
  try {
    const data = req.body;
    
    const expense = await prisma.transaction.create({
      data: { 
        type: 'EXPENSE',             // نثبت النوع الرئيسي في قاعدة البيانات كمصروف
        category: data.type,         // الواجهة الأمامية ترسل "أرض أو بناء" في حقل type، فنحفظه في category
        amount: parseFloat(data.amount), 
        currency: data.currency,
        paidBy: data.paidBy,         // "أنا" أو "أخي"
        date: new Date(data.date),
        description: data.description
        // لم نضع accountId هنا لأنه اختياري الآن
      }
    });

    res.status(201).json({
        ...expense,
        type: expense.category // نرجعها للواجهة الأمامية كما تحب
    });
  } catch (error) { 
    console.error("Add Expense Error:", error);
    res.status(500).json({ error: 'خطأ في الإضافة' }); 
  }
};

// 3. تعديل مصروف
exports.updateExpense = async (req, res) => {
  try {
    const data = req.body;
    const expense = await prisma.transaction.update({
      where: { id: req.params.id },
      data: { 
        category: data.type, 
        amount: parseFloat(data.amount), 
        currency: data.currency,
        paidBy: data.paidBy,
        date: new Date(data.date),
        description: data.description
      }
    });
    
    res.json({
        ...expense,
        type: expense.category
    });
  } catch (error) { 
    console.error("Update Expense Error:", error);
    res.status(500).json({ error: 'خطأ في التعديل' }); 
  }
};

// 4. حذف مصروف
exports.deleteExpense = async (req, res) => {
  try {
    await prisma.transaction.delete({ where: { id: req.params.id } });
    res.json({ message: 'تم الحذف' });
  } catch (error) { 
    console.error("Delete Expense Error:", error);
    res.status(500).json({ error: 'خطأ في الحذف' }); 
  }
};