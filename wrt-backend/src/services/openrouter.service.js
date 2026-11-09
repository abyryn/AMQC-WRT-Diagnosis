// ============================================
// WRT Garage — OpenRouter AI Service
// Layer 3: AI Reasoning via OpenRouter API
// ============================================
const OpenAI = require('openai');

// OpenRouter uses OpenAI-compatible API
let client = null;
function getClient() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY belum dikonfigurasi di file .env');
  }
  if (!client) {
    client = new OpenAI({
      baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'https://wrt.garage',
        'X-Title': 'WRT Garage AI Diagnostic',
      },
    });
  }
  return client;
}

function getOpenRouterModel() {
  const model = process.env.OPENROUTER_MODEL || process.env.AI_MODEL;
  if (!model) {
    throw new Error('OPENROUTER_MODEL belum dikonfigurasi di file .env');
  }
  return model;
}

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

// Master System Prompt (from PRD Section 6.1)
const SYSTEM_PROMPT = `SYSTEM PROMPT — WRT Garage AI Diagnosis Engine

Anda adalah Honda Master Technician dengan pengalaman 20 tahun menangani 
sepeda motor Honda PGM-FI (Programmed Fuel Injection).

TUGAS ANDA:
Menganalisis data ECU Honda PGM-FI yang dikirimkan dalam format JSON
dan memberikan diagnosis yang akurat, terstruktur, dan mudah dipahami.

ATURAN DIAGNOSIS:
1. Analisis DTC bersama dengan data sensor live — jangan isolasi keduanya
2. Prioritaskan kemungkinan penyebab dari yang paling umum ke yang langka
3. Jangan menyimpulkan tanpa bukti dari data yang tersedia
4. Jika data tidak cukup untuk diagnosis definitif, sebutkan data apa yang dibutuhkan
5. Berikan langkah pengecekan secara berurutan (dari yang mudah ke sulit)
6. Gunakan bahasa Indonesia yang sederhana — sesuai level mekanik bengkel
7. Jika ada risiko keselamatan, WAJIB sebutkan di safety_warning

FORMAT RESPONS (wajib JSON):
{
  "summary": "Ringkasan 1-2 kalimat kondisi motor",
  "risk_level": "low|medium|high|critical",
  "primary_cause": {
    "description": "Penyebab utama yang paling mungkin",
    "confidence": "85%",
    "evidence": ["data sensor yang mendukung kesimpulan ini"]
  },
  "alternative_causes": [
    {"description": "Penyebab alternatif 1", "confidence": "10%"},
    {"description": "Penyebab alternatif 2", "confidence": "5%"}
  ],
  "check_steps": [
    "Langkah 1: ...",
    "Langkah 2: ...",
    "Langkah 3: ..."
  ],
  "additional_data_needed": ["jika ada data yang kurang"],
  "safety_warning": "jika ada risiko keselamatan, null jika aman"
}

PENTING: Respons HARUS berupa JSON valid. Jangan tambahkan teks di luar JSON.`;

// Chat System Prompt (for free-form AI chat)
const CHAT_SYSTEM_PROMPT = `Anda adalah asisten teknisi Honda PGM-FI bernama "WRT AI".
Anda membantu mekanik dan pemilik motor Honda dengan pertanyaan seputar:
- Diagnosis masalah mesin dan kelistrikan Honda PGM-FI
- Penjelasan kode error (DTC) Honda
- Tips perawatan dan servis rutin
- Spesifikasi sensor dan komponen Honda

ATURAN:
1. Jawab dalam Bahasa Indonesia yang sederhana dan mudah dipahami
2. Berikan jawaban yang akurat berdasarkan pengetahuan teknis Honda
3. Jika tidak yakin, katakan dengan jujur dan sarankan untuk konsultasi ke bengkel resmi
4. Berikan estimasi biaya dalam Rupiah jika relevan
5. Selalu utamakan keselamatan pengguna`;

/**
 * Send diagnosis request to OpenRouter AI
 * @param {Object} payload - Structured diagnosis payload (DTC + Live Data + Context)
 * @param {string} enrichedContext - Pre-processed context from Layer 1 & 2
 * @returns {Object} AI diagnosis response
 */
async function diagnose(payload, enrichedContext) {
  const model = getOpenRouterModel();
  const startTime = Date.now();

  console.log(`[OpenRouter:API] 🌐 Memanggil API OpenRouter (Model: "${model}")...`);
  const tApiStart = performance.now();

  const cleanPayload = minifyPayload(payload);
  const userMessage = `DATA ECU HONDA PGM-FI:
${JSON.stringify(cleanPayload)}

KONTEKS TAMBAHAN DARI DATABASE (Layer 1 & 2):
${enrichedContext}

Analisis data di atas dan berikan diagnosis dalam format JSON yang telah ditentukan.`;

  try {
    const completion = await getClient().chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const tApiDuration = performance.now() - tApiStart;
    const latencyMs = Date.now() - startTime;
    const responseText = completion.choices[0]?.message?.content || '{}';
    const tokensUsed = completion.usage?.total_tokens || 0;
    console.log(`[OpenRouter:API] ⚡ OpenRouter selesai merespons dalam ${tApiDuration.toFixed(2)}ms (Tokens: ${tokensUsed})`);

    const tParseStart = performance.now();
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch {
      parsedResponse = {
        summary: responseText,
        risk_level: 'medium',
        primary_cause: { description: 'AI response parsing error', confidence: '0%', evidence: [] },
        alternative_causes: [],
        check_steps: ['Coba ulangi diagnosis'],
        additional_data_needed: [],
        safety_warning: null,
      };
    }
    console.log(`[OpenRouter:Parser] 🧩 Parsing response selesai dalam ${(performance.now() - tParseStart).toFixed(2)}ms`);

    return {
      success: true,
      diagnosis: parsedResponse,
      metadata: {
        model_used: model,
        tokens_used: tokensUsed,
        latency_ms: latencyMs,
      },
    };
  } catch (error) {
    console.error('[OpenRouter] ❌ Remote AI error:', error.message);
    return {
      success: false,
      error: `Diagnosis OpenRouter gagal: ${error.message}`,
      diagnosis: null,
      metadata: {
        model_used: model,
        tokens_used: 0,
        latency_ms: Date.now() - startTime,
      },
    };
  }
}

/**
 * Send free-form chat message to AI
 * @param {string} message - User's question
 * @param {Array} history - Previous chat messages
 * @returns {Object} AI chat response
 */
async function chat(message, history = []) {
  const model = getOpenRouterModel();
  const startTime = Date.now();

  const messages = [
    { role: 'system', content: CHAT_SYSTEM_PROMPT },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  try {
    const completion = await getClient().chat.completions.create({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 1500,
    });

    return {
      success: true,
      message: completion.choices[0]?.message?.content || '',
      metadata: {
        model_used: model,
        tokens_used: completion.usage?.total_tokens || 0,
        latency_ms: Date.now() - startTime,
      },
    };
  } catch (error) {
    console.error('[OpenRouter] ❌ Chat API error:', error.message);
    return {
      success: false,
      message: `Maaf, layanan AI OpenRouter tidak dapat dihubungi (${error.message}).`,
      metadata: {
        model_used: model,
        tokens_used: 0,
        latency_ms: Date.now() - startTime,
      },
    };
  }
}

module.exports = { diagnose, chat };

