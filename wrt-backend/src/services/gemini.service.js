// ============================================
// WRT Garage — Ultra-Low Latency Google Gemini AI Service
// Layer 3: High-Speed AI Reasoning via Gemini
// ============================================
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Retrieve GoogleGenerativeAI instance dynamically using GEMINI_API_KEY from .env
 */
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi di file .env');
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Retrieve list of models configured strictly in .env
 */
function getConfiguredModels() {
  const models = [
    process.env.GEMINI_MODEL,
    process.env.GEMINI_FALLBACK_MODEL,
  ].filter(Boolean);

  if (models.length === 0) {
    throw new Error('GEMINI_MODEL belum dikonfigurasi di file .env');
  }
  return Array.from(new Set(models));
}

function getAiTimeout() {
  return parseInt(process.env.AI_TIMEOUT_MS, 10) || 15000;
}

/**
 * Minify payload by stripping empty, null, or undefined fields to save token bandwidth
 */
function minifyPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) {
    return payload.map(minifyPayload).filter((v) => v !== null && v !== undefined && v !== '');
  }
  const cleaned = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === null || value === undefined || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) cleaned[key] = value;
    } else if (typeof value === 'object') {
      const nested = minifyPayload(value);
      if (Object.keys(nested).length > 0) cleaned[key] = nested;
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

// In-Memory Fast Cache for Diagnosis (TTL: 1 hour)
const diagnosisCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

// Helper for ultra-strict latency capping
function timeoutPromise(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout API Gemini (${ms}ms)`)), ms);
  });
}

function getCacheKey(payload) {
  const dtcKey = [...(payload.dtc?.active || []), ...(payload.dtc?.pending || [])].sort().join(',');
  const motorKey = payload.motor?.model || payload.motor || 'all';
  // Round live values to prevent cache misses on minor telemetry decimal noise
  const iat = Math.round(payload.live_data?.iat_celsius ?? 0);
  const ect = Math.round(payload.live_data?.ect_celsius ?? 0);
  const vbat = Math.round((payload.live_data?.battery_volt ?? 0) * 10) / 10;
  return `${motorKey}_${dtcKey}_${iat}_${ect}_${vbat}`;
}

// Master System Prompt (Optimized for Deep Master Technician Analysis)
const SYSTEM_PROMPT = `Anda adalah Honda Master Technician (20 tahun pengalaman PGM-FI).
TUGAS: Analisis data ECU Honda PGM-FI secara mendalam, presisi, dan lengkap.

ATURAN:
1. Korelasikan DTC + data live sensor + keluhan mekanik secara presisi teknis bengkel resmi Honda.
2. Berikan urutan langkah pemeriksaan mekanik secara sistematis dari yang termudah ke tersulit.
3. Format output WAJIB JSON murni tanpa markdown/teks pengantar:

{
  "summary": "Ringkasan analisis kondisi motor secara komprehensif",
  "risk_level": "low|medium|high|critical",
  "primary_cause": {
    "description": "Penyebab utama yang paling mungkin beserta penjelasan teknis",
    "confidence": "95%",
    "evidence": ["Bukti data sensor", "Kode DTC aktif", "Gejala keluhan"]
  },
  "alternative_causes": [
    {"description": "Penyebab alternatif 1", "confidence": "15%"},
    {"description": "Penyebab alternatif 2", "confidence": "5%"}
  ],
  "check_steps": [
    "Langkah 1: ...",
    "Langkah 2: ...",
    "Langkah 3: ...",
    "Langkah 4: ...",
    "Langkah 5: ..."
  ],
  "additional_data_needed": ["Data atau pengukuran tambahan yang diperlukan"],
  "safety_warning": "Peringatan keselamatan teknis jika ada, atau null jika aman"
}`;

// Chat System Prompt (Optimized for Fast Mechanic Responses)
const CHAT_SYSTEM_PROMPT = `Anda adalah "WRT AI Master Technician", asisten mekanik spesialis Honda PGM-FI.
Jawab pertanyaan seputar kode DTC, kedipan MIL, data sensor, keluhan mesin (brebet, boros, mati mendadak), dan prosedur reset ECM/TP secara ringkas, akurat, dan langsung ke solusi teknis dalam Bahasa Indonesia.`;

/**
 * Send ultra-low latency diagnosis request to Google Gemini AI
 * @param {Object} payload - Structured diagnosis payload
 * @param {string} enrichedContext - Pre-processed context from Layer 1 & 2
 * @returns {Object} AI diagnosis response
 */
async function diagnose(payload, enrichedContext) {
  const startTime = Date.now();
  const cacheKey = getCacheKey(payload);

  // Check In-Memory Cache (< 5ms response)
  const tCacheStart = performance.now();
  const cached = diagnosisCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    const tCacheDuration = performance.now() - tCacheStart;
    console.log(`[Gemini:Cache] ⚡ Cache HIT dalam ${tCacheDuration.toFixed(2)}ms (Key: ${cacheKey})`);
    return {
      success: true,
      diagnosis: cached.data,
      metadata: {
        provider: 'Google Gemini (High-Speed Cache)',
        model_used: `${cached.model} [Cached]`,
        tokens_used: cached.tokens,
        latency_ms: Date.now() - startTime,
      },
    };
  }
  console.log(`[Gemini:Cache] 💨 Cache MISS dalam ${(performance.now() - tCacheStart).toFixed(2)}ms (Key: ${cacheKey})`);

  const cleanPayload = minifyPayload(payload);
  const userPrompt = `DATA ECU HONDA PGM-FI:
${JSON.stringify(cleanPayload)}

DATABASE CONTEXT (Layer 1 & 2):
${enrichedContext}

Hasilkan output diagnosis JSON:`;

  // Candidate models: Primary model from .env followed by fallback
  const genAI = getGenAI();
  const modelsToTry = getConfiguredModels();
  const aiTimeout = getAiTimeout();
  const perModelTimeout = Math.min(aiTimeout, 15000); // Fast failover max 15s per model trial
  let lastError = null;

  for (const mName of modelsToTry) {
    try {
      console.log(`[Gemini:API] 🌐 Memanggil API Gemini (Model: "${mName}", Timeout: ${perModelTimeout}ms)...`);
      const tModelStart = performance.now();

      const model = genAI.getGenerativeModel({
        model: mName,
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
      });

      const result = await Promise.race([
        model.generateContent(userPrompt),
        timeoutPromise(perModelTimeout),
      ]);
      const tModelDuration = performance.now() - tModelStart;
      const latencyMs = Date.now() - startTime;
      const tokensUsed = result.response.usageMetadata?.totalTokenCount || 0;
      console.log(`[Gemini:API] ⚡ Model "${mName}" selesai merespons dalam ${tModelDuration.toFixed(2)}ms (Tokens: ${tokensUsed})`);

      const tParseStart = performance.now();
      let responseText = (result.response.text() || '{}').trim();
      responseText = responseText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(responseText);
      } catch {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsedResponse = JSON.parse(jsonMatch[0]);
          } catch {
            parsedResponse = null;
          }
        }
        if (!parsedResponse) {
          parsedResponse = {
            summary: 'Diagnosis sistem PGM-FI selesai.',
            risk_level: 'medium',
            primary_cause: { description: responseText.slice(0, 200), confidence: '80%', evidence: [] },
            alternative_causes: [],
            check_steps: ['Periksa sambungan kabel dan sensor'],
            additional_data_needed: [],
            safety_warning: null,
          };
        }
      }
      console.log(`[Gemini:Parser] 🧩 Parsing & verifikasi JSON selesai dalam ${(performance.now() - tParseStart).toFixed(2)}ms`);

      // Store in high-speed cache
      diagnosisCache.set(cacheKey, {
        data: parsedResponse,
        model: mName,
        tokens: result.response.usageMetadata?.totalTokenCount || 0,
        timestamp: Date.now(),
      });

      return {
        success: true,
        diagnosis: parsedResponse,
        metadata: {
          provider: 'Google Gemini',
          model_used: mName,
          tokens_used: result.response.usageMetadata?.totalTokenCount || 0,
          latency_ms: latencyMs,
        },
      };
    } catch (err) {
      lastError = err;
      const is403 = err.status === 403 || String(err.message).includes('403');
      if (is403) {
        console.error(`[Gemini AI] ❌ Error 403 Forbidden pada model "${mName}": ${err.message}`);
        console.error(`[Gemini AI] 💡 Tips: Pastikan model "${mName}" tersedia untuk key ini (periksa konfigurasi GEMINI_MODEL / GEMINI_FALLBACK_MODEL di .env) dan Generative Language API aktif di project Google Anda.`);
      } else {
        console.warn(`[Gemini Fast] Model ${mName} error: ${err.message}. Mencoba kandidat berikutnya...`);
      }
    }
  }

  // All cloud models failed
  const errMsg = lastError ? lastError.message : 'Semua kandidat model AI gagal merespons';
  console.error(`[Gemini AI] ❌ Seluruh kandidat model AI gagal: ${errMsg}`);

  return {
    success: false,
    error: `Diagnosis AI tidak dapat diselesaikan: ${errMsg}`,
    diagnosis: null,
    metadata: {
      provider: 'Google Gemini',
      model_used: 'None',
      tokens_used: 0,
      latency_ms: Date.now() - startTime,
    },
  };
}

function cleanChatHistory(rawHistory) {
  if (!Array.isArray(rawHistory) || rawHistory.length === 0) return [];
  const formatted = rawHistory.map((h) => ({
    role: (h.role === 'user' || h.role === 'human') ? 'user' : 'model',
    parts: [{ text: h.content || h.text || '' }],
  })).filter((h) => h.parts[0].text.trim() !== '');

  while (formatted.length > 0 && formatted[0].role !== 'user') {
    formatted.shift();
  }

  const cleaned = [];
  for (const item of formatted) {
    if (cleaned.length === 0 || cleaned[cleaned.length - 1].role !== item.role) {
      cleaned.push(item);
    } else {
      cleaned[cleaned.length - 1].parts[0].text += '\n' + item.parts[0].text;
    }
  }

  const result = cleaned.slice(-6);
  while (result.length > 0 && result[0].role !== 'user') {
    result.shift();
  }
  return result;
}

/**
 * Ultra-Fast AI Chat
 * @param {string} message - User query
 * @param {Array} history - Previous messages
 * @returns {Object} Chat reply
 */
async function chat(message, history = []) {
  const startTime = Date.now();
  const genAI = getGenAI();
  const modelsToTry = getConfiguredModels();
  const aiTimeout = getAiTimeout();
  const perModelTimeout = Math.min(aiTimeout, 15000);
  let lastError = null;

  const tCleanStart = performance.now();
  const formattedHistory = cleanChatHistory(history);
  console.log(`[Gemini:Chat] 🧹 History dibersihkan dalam ${(performance.now() - tCleanStart).toFixed(2)}ms (${formattedHistory.length} pesan)`);

  for (const mName of modelsToTry) {
    try {
      console.log(`[Gemini:Chat] 💬 Mengirim pesan chat ke model "${mName}"...`);
      const tChatModelStart = performance.now();

      const model = genAI.getGenerativeModel({
        model: mName,
        systemInstruction: CHAT_SYSTEM_PROMPT,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
        },
      });

      const chatSession = model.startChat({
        history: formattedHistory,
      });

      const result = await Promise.race([
        chatSession.sendMessage(message),
        timeoutPromise(perModelTimeout),
      ]);
      const reply = result.response.text();
      const latencyMs = Date.now() - startTime;
      const tChatModelDuration = performance.now() - tChatModelStart;
      console.log(`[Gemini:Chat] ✅ Chat model "${mName}" selesai merespons dalam ${tChatModelDuration.toFixed(2)}ms`);

      return {
        success: true,
        reply,
        metadata: {
          provider: 'Google Gemini',
          model_used: mName,
          tokens_used: result.response.usageMetadata?.totalTokenCount || 0,
          latency_ms: latencyMs,
        },
      };
    } catch (err) {
      lastError = err;
      const is403 = err.status === 403 || String(err.message).includes('403');
      if (is403) {
        console.error(`[Gemini Chat] ❌ Error 403 Forbidden pada model "${mName}": ${err.message}`);
        console.error(`[Gemini Chat] 💡 Tips: Pastikan model "${mName}" aktif di project Google Anda dan kuota/izin API masih berlaku.`);
      } else {
        console.warn(`[Gemini Chat Fast] Model ${mName} error: ${err.message}`);
      }
    }
  }

  // All chat models failed
  const errMsg = lastError ? lastError.message : 'Semua model AI gagal merespons';
  console.error(`[Gemini Chat] ❌ Seluruh kandidat chat gagal: ${errMsg}`);
  return {
    success: false,
    reply: `Maaf, layanan AI saat ini tidak dapat dihubungi (${errMsg}). Silakan periksa koneksi internet atau kuota API key Anda.`,
    metadata: {
      provider: 'Google Gemini',
      model_used: 'None',
      tokens_used: 0,
      latency_ms: Date.now() - startTime,
    },
  };
}

module.exports = {
  diagnose,
  chat,
};
