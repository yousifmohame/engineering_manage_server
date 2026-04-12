const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

exports.getGold = async (req, res) => {
  try {
    const gold = await prisma.goldInvestment.findMany({ orderBy: { date: 'desc' } });
    
    const totalWeight = gold.reduce((sum, item) => sum + item.weight, 0);
    const totalInvestment = gold.reduce((sum, item) => sum + item.buyPrice, 0);
    const avgPrice = totalWeight > 0 ? (totalInvestment / totalWeight).toFixed(2) : 0;

    res.status(200).json({ gold, summary: { totalWeight, totalInvestment, avgPrice } });
  } catch (error) {
    res.status(500).json({ error: 'خطأ في جلب بيانات الذهب' });
  }
};

exports.addGold = async (req, res) => {
  try {
    const { type, karat, weight, buyPrice, date } = req.body;
    const newGold = await prisma.goldInvestment.create({
      data: { type, karat: parseInt(karat), weight: parseFloat(weight), buyPrice: parseFloat(buyPrice), date: new Date(date) }
    });
    res.status(201).json(newGold);
  } catch (error) {
    res.status(500).json({ error: 'خطأ في إضافة السجل' });
  }
};

exports.updateGold = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, karat, weight, buyPrice, date } = req.body;
    const updated = await prisma.goldInvestment.update({
      where: { id },
      data: { type, karat: parseInt(karat), weight: parseFloat(weight), buyPrice: parseFloat(buyPrice), date: new Date(date) }
    });
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ error: 'خطأ في التعديل' });
  }
};

exports.deleteGold = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.goldInvestment.delete({ where: { id } });
    res.status(200).json({ message: 'تم الحذف' });
  } catch (error) {
    res.status(500).json({ error: 'خطأ في الحذف' });
  }
};