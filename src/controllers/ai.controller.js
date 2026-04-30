// استيراد المكتبات اللازمة للاتصال بقاعدة البيانات ومحرك الذكاء الاصطناعي
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { GoogleGenAI } = require("@google/genai");

// تهيئة الاتصال بقاعدة البيانات
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// تهيئة محرك الذكاء الاصطناعي باستخدام مفتاحك السري
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ---------------------------------------------------------
// 1. دالة جلب ملخص الأرصدة المالية الحقيقية
// ---------------------------------------------------------
exports.getFinancialSummary = async (req, res) => {
  try {
    // جلب وحساب إجمالي أرصدة البنوك
    const banks = await prisma.financialAccount.findMany({ where: { type: "BANK" } });
    const totalBanks = banks.reduce((sum, b) => sum + b.balance, 0);

    // جلب وحساب إجمالي رصيد الخزنة
    const safes = await prisma.financialAccount.findMany({ where: { type: "SAFE" } });
    const totalSafe = safes.reduce((sum, s) => sum + s.balance, 0);

    // جلب وحساب إجمالي استثمارات الذهب
    const golds = await prisma.asset.findMany({ where: { type: "GOLD" } });
    const totalGold = golds.reduce((sum, g) => sum + g.buyPrice, 0);

    // حساب إجمالي الأصول الكلي
    const totalAssets = totalBanks + totalSafe + totalGold;

    // إرسال البيانات للواجهة الأمامية
    res.json({ totalBanks, totalSafe, totalGold, totalAssets });
  } catch (error) {
    console.error("Error fetching financial summary:", error);
    res.status(500).json({ error: "خطأ في جلب البيانات المالية" });
  }
};

// ---------------------------------------------------------
// 2. دالة التحدث مع الذكاء الاصطناعي

exports.askAi = async (req, res) => {
  try {
    const { prompt, financialData } = req.body;

    // 1. بناء السياق للذكاء الاصطناعي
    const systemContext = `أنت مساعد مالي ذكي وخبير لمحفظة استثمارية خاصة.
    البيانات المالية الحالية لصاحب المحفظة (بالريال السعودي):
    - رصيد البنوك: ${financialData.totalBanks}
    - كاش الخزنة: ${financialData.totalSafe}
    - استثمارات الذهب: ${financialData.totalGold}
    - إجمالي الأصول: ${financialData.totalAssets}
    
    أجب على سؤال المستخدم باحترافية، وإيجاز، ولغة عربية سليمة وإدارية. قدم نصائح قابلة للتطبيق بناءً على أرقامه الحالية.
    
    سؤال المستخدم: ${prompt}`;

    // 2. تعريف قائمة النماذج البديلة (كما اقترحت تماماً)
    const fallbackModels = [
      "gemini-3-flash-preview",
      "gemini-2.5-flash",
      "gemini-1.5-flash",
    ];

    // 3. متغيرات لحفظ النتيجة وحالة النجاح
    let responseText = null;
    let successfulModel = null;
    let lastError = null;

    // 4. حلقة تكرارية لتجربة النماذج واحداً تلو الآخر
    for (const modelName of fallbackModels) {
      try {
        console.log(`جارٍ محاولة الاتصال بالنموذج: ${modelName}...`);
        
        // محاولة إرسال الطلب للنموذج الحالي
        const response = await ai.models.generateContent({
          model: modelName,
          contents: systemContext,
        });

        // إذا وصلنا إلى هذا السطر، يعني أن الاتصال نجح!
        responseText = response.text;
        successfulModel = modelName;
        
        console.log(`✅ نجح الاتصال باستخدام: ${successfulModel}`);
        
        // نوقف الحلقة التكرارية لأننا حصلنا على الإجابة
        break; 

      } catch (err) {
        // إذا فشل النموذج الحالي، نسجل الخطأ ونسمح للحلقة بتجربة النموذج التالي
        console.warn(`⚠️ فشل النموذج ${modelName} بسبب: ${err.message}`);
        lastError = err; // نحتفظ بآخر خطأ في حال فشلت كل النماذج
      }
    }

    // 5. التحقق مما إذا كانت كل النماذج قد فشلت
    if (!responseText) {
      // التحقق مما إذا كان سبب فشل آخر نموذج هو الضغط العالي
      if (lastError && lastError.status === 503) {
        return res.status(503).json({ 
          error: "جميع خوادم الذكاء الاصطناعي تواجه ضغطاً عالياً حالياً. يرجى المحاولة بعد قليل." 
        });
      }
      // في حالة وجود خطأ آخر غير متوقع
      return res.status(500).json({ 
        error: "تعذر الاتصال بأي من نماذج الذكاء الاصطناعي المتاحة." 
      });
    }

    // 🌟 الجديد: حفظ السؤال والإجابة في قاعدة البيانات
    await prisma.aiAnalysisHistory.create({
      data: {
        prompt: prompt,
        response: responseText,
      }
    });

    // 6. إرسال الإجابة الناجحة للواجهة الأمامية
    // قمنا بإرسال اسم النموذج الناجح أيضاً في حال أردت عرضه في الواجهة
    res.json({ reply: responseText, provider: successfulModel });

  } catch (error) {
    console.error("Error in askAi wrapper:", error);
    res.status(500).json({ error: "حدث خطأ داخلي في الخادم." });
  }
};

// ---------------------------------------------------------
// 3. دالة جلب سجل التحليلات السابقة
// ---------------------------------------------------------
exports.getAnalyticsHistory = async (req, res) => {
  try {
    // جلب السجل من الأحدث إلى الأقدم
    const history = await prisma.aiAnalysisHistory.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(history);
  } catch (error) {
    console.error("Error fetching AI history:", error);
    res.status(500).json({ error: "خطأ في جلب سجل التحليلات" });
  }
};