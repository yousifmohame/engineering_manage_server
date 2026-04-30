const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

exports.getDashboardStats = async (req, res) => {
  try {
    // 1. حساب الالتزامات (العقارات)
    const realEstates = await prisma.realEstate.aggregate({ _sum: { remainingAmount: true } });
    const totalLiabilities = realEstates._sum.remainingAmount || 0;

    // 2. حساب السيولة (بنوك وخزنة)
    const banks = await prisma.financialAccount.aggregate({ _sum: { balance: true }, where: { type: "BANK" } });
    const safes = await prisma.financialAccount.aggregate({ _sum: { balance: true }, where: { type: "SAFE" } });
    const totalLiquidity = (banks._sum.balance || 0) + (safes._sum.balance || 0);

    // 3. حساب قيمة الذهب
    const gold = await prisma.asset.aggregate({ _sum: { buyPrice: true }, where: { type: "GOLD" } });
    const totalGold = gold._sum.buyPrice || 0;

    // 🌟 4. حساب الدخل والمصروفات من الجدول الجديد (FinancialMovement)
    const incomes = await prisma.financialMovement.aggregate({ _sum: { amount: true }, where: { type: "INCOME" } });
    const expenses = await prisma.financialMovement.aggregate({ _sum: { amount: true }, where: { type: "EXPENSE" } });
    
    const totalIncome = incomes._sum.amount || 0;
    const totalExpense = expenses._sum.amount || 0;
    const netProfit = totalIncome - totalExpense; // صافي الربح

    // 🌟 5. تجميع بيانات آخر 6 أشهر للرسم البياني من الجدول الجديد
    const allMovements = await prisma.financialMovement.findMany({
      where: { date: { gte: new Date(new Date().setMonth(new Date().getMonth() - 5)) } } // آخر 6 أشهر
    });

    const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    const trendMap = {};

    allMovements.forEach(movement => {
      const monthName = monthNames[movement.date.getMonth()];
      if (!trendMap[monthName]) trendMap[monthName] = { month: monthName, income: 0, expense: 0 };
      
      if (movement.type === "INCOME") trendMap[monthName].income += movement.amount;
      if (movement.type === "EXPENSE") trendMap[monthName].expense += movement.amount;
    });

    // تحويل الكائن إلى مصفوفة للرسم البياني
    const trendData = Object.values(trendMap);
    // إذا لم تكن هناك بيانات، نضع بيانات فارغة للحفاظ على شكل الرسم البياني
    if (trendData.length === 0) {
      trendData.push({ month: monthNames[new Date().getMonth()], income: 0, expense: 0 });
    }

    // 6. تجهيز الإحصائيات النهائية
    const stats = {
      liabilities: { sar: totalLiabilities, usd: totalLiabilities / 3.75, egp: totalLiabilities * 13 },
      liquidity: { sar: totalLiquidity, usd: totalLiquidity / 3.75, egp: totalLiquidity * 13 },
      gold: { sar: totalGold, usd: totalGold / 3.75, egp: totalGold * 13 },
      profits: { sar: netProfit, usd: netProfit / 3.75, egp: netProfit * 13 },
      budget: { current: totalExpense, total: 10000, usd: totalExpense / 3.75, egp: totalExpense * 13 }
    };

    const assetDistribution = [
      { name: 'الالتزامات', value: totalLiabilities, color: '#ef4444' },
      { name: 'السيولة', value: totalLiquidity, color: '#10b981' },
      { name: 'الذهب', value: totalGold, color: '#f59e0b' },
      { name: 'أرباح الشراكة', value: netProfit > 0 ? netProfit : 0, color: '#3b82f6' }
    ].filter(item => item.value > 0);

    // إرسال البيانات
    res.json({ stats, assetDistribution, trendData });
  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).json({ error: "فشل في جلب الإحصائيات" });
  }
};