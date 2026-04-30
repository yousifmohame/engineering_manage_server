const express = require("express");
const cors = require("cors");
const path = require("path"); // 🌟 خطوة 1: استدعاء مكتبة path للتعامل مع مسارات الملفات بأمان
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// 🌟 خطوة 2: تعديل المسار ليتطابق مع الواجهة الأمامية (/api/uploads) واستخدام path.join
// الدالة __dirname تجلب مسار المجلد الحالي الذي يعمل فيه الخادم
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// --- مسارات الـ API (Routes) ---
// استدعاء مسار الخزنة
const safeRoutes = require("./src/routes/safe.routes");

// إخبار الخادم بأن أي طلب يبدأ بـ /api/... يجب توجيهه إلى المسار المناسب
app.use("/api/dashboard", require("./src/routes/dashboard.routes"));
app.use("/api/safe", safeRoutes);
app.use('/api/expenses', require('./src/routes/expense.routes'));
app.use('/api/gold', require('./src/routes/gold.routes'));
app.use('/api/banks', require('./src/routes/bank.routes'));
app.use('/api/partnership', require('./src/routes/partnership.routes'));
app.use('/api/nazmi', require('./src/routes/nazmi.routes'));
app.use('/api/youssef', require('./src/routes/youssef.routes'));
app.use('/api/files', require('./src/routes/file.routes'));
app.use('/api/ai', require('./src/routes/ai.routes'));
app.use('/api/real-estate', require('./src/routes/realEstate.routes'));
app.use('/api/partners', require('./src/routes/partner.routes'));

// مسار تجريبي للتأكد من عمل الخادم
app.get("/", (req, res) => {
  res.send("خادم مديرتي المالية يعمل بنجاح!");
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});