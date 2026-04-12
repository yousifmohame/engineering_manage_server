const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// --- مسارات الـ API (Routes) ---
// استدعاء مسار الخزنة
const safeRoutes = require("./src/routes/safe.routes");

// إخبار الخادم بأن أي طلب يبدأ بـ /api/safe يجب توجيهه إلى safeRoutes
app.use("/api/safe", safeRoutes);
app.use('/api/expenses', require('./src/routes/expense.routes'));
app.use('/api/gold', require('./src/routes/gold.routes'));
app.use('/api/banks', require('./src/routes/bank.routes'));
// مسار تجريبي للتأكد من عمل الخادم
app.get("/", (req, res) => {
  res.send("خادم مديرتي المالية يعمل بنجاح!");
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
