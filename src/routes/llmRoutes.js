
import express from 'express';
import axios from 'axios';
import http from 'http';
import https from 'https';
import { authMiddleware } from '../middlewares/auth.js';

const router = express.Router();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://150.136.77.172:8080';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'signos-vitales-gemma';

const keepAliveHttp = new http.Agent({ keepAlive: true, maxSockets: Number(process.env.OLLAMA_AGENT_MAX_SOCKETS || 10) });
const keepAliveHttps = new https.Agent({ keepAlive: true, maxSockets: Number(process.env.OLLAMA_AGENT_MAX_SOCKETS || 10) });
const ollamaClient = axios.create({
  timeout: Number(process.env.OLLAMA_TIMEOUT_MS || 30000),
  httpAgent: keepAliveHttp,
  httpsAgent: keepAliveHttps
});

const RESPONSE_CACHE_TTL_MS = Number(process.env.LLM_CACHE_TTL_MS || 120000);
const responseCache = new Map();
// Bump this to invalidate old cached payloads when parsing/logic changes
const ENGINE_VERSION = process.env.LLM_ENGINE_VERSION || 'v2-2025-11-04b';
const pendingMap = new Map();
function cacheGet(key) {
  const item = responseCache.get(key);
  if (!item) return null;
  if (item.expires < Date.now()) { responseCache.delete(key); return null; }
  return item.value;
}
function cacheSet(key, value, ttl = RESPONSE_CACHE_TTL_MS) {
  responseCache.set(key, { value, expires: Date.now() + ttl });
}
function buildKey(prompt, modo, isFast) {
  const p = String(prompt || '').slice(0, 512);
  return `${ENGINE_VERSION}|${modo}|${isFast ? 'f' : 's'}|${p}`;
}

let inFlight = 0;
const MAX_INFLIGHT = Number(process.env.LLM_MAX_INFLIGHT || 1);

function stripDiacritics(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function parseLine(tipo, valor) {
  const t = stripDiacritics(String(tipo || '').toLowerCase());
  const v = stripDiacritics(String(valor || '').toLowerCase());
  const num = parseFloat(v.replace(/[^0-9.]/g, ''));
  if (t.includes('presion') || t.includes('presión') || t.includes('arterial')) {
    const m = v.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
    if (m) return { kind: 'presion_arterial', sys: +m[1], dia: +m[2] };
    if (!isNaN(num)) return { kind: 'presion_arterial', sys: num, dia: null };
  }
  if (t.includes('frecuencia_cardiaca') || t.includes('cardiaca') || t.includes('cardiaca') || t.includes('pulso')) {
    if (!isNaN(num)) return { kind: 'frecuencia_cardiaca', val: num };
  }
  if (t.includes('frecuencia_respiratoria') || t.includes('respiratoria')) {
    if (!isNaN(num)) return { kind: 'frecuencia_respiratoria', val: num };
  }
  if (t.includes('temperatura') || t.includes('temp')) {
    if (!isNaN(num)) return { kind: 'temperatura', val: num };
  }
  if (t.includes('saturacion') || t.includes('saturacion') || t.includes('oxigeno') || t.includes('oxigeno') || t.includes('spo2') || t.includes('o2')) {
    if (!isNaN(num)) return { kind: 'saturacion_oxigeno', val: num };
  }
  if (t.includes('glucosa')) {
    if (!isNaN(num)) return { kind: 'glucosa', val: num };
  }
  if (t.includes('peso')) {
    if (!isNaN(num)) return { kind: 'peso', val: num };
  }
  return null;
}

function extractStatsFromPrompt(prompt) {
  const stats = {};
  const addReading = (kind, reading) => {
    if (!stats[kind]) stats[kind] = { readings: [], latest: null };
    stats[kind].readings.push(reading);
    if (!stats[kind].latest) stats[kind].latest = reading;
  };
  const lines = String(prompt || '').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*[-•]?\s*([^:]+):\s*([^\n]+)/);
    if (!m) continue;
    const tipo = m[1].trim();
    let raw = m[2].trim();
    // Si el valor proviene del resumen compacto ("n=..., últ=..., min=..., ..."), tomar específicamente "últ="
    const rawNoAcc = stripDiacritics(raw.toLowerCase());
    const ultMatch = rawNoAcc.match(/\bul?t\s*=?\s*([^,]+)/); // ult=... (con o sin tilde)
    if (ultMatch && ultMatch[1]) {
      raw = ultMatch[1].trim();
    }
    // Quitar fechas como 16/10/2025 o 16-10-2025 con o sin paréntesis
    raw = raw.replace(/\(?\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\)?/g, '').trim();
    // Si hay paréntesis remanentes, cortar en el primero
    if (raw.includes('(')) raw = raw.split('(')[0].trim();
    // Normalizar separadores decimales y quitar unidades comunes
    raw = raw.replace(',', '.').replace(/\s*(mmhg|lpm|rpm|°c|%|kg)\b/gi, '').trim();
    const valor = raw;
    const parsed = parseLine(tipo, valor);
    if (!parsed) continue;
    const { kind, ...reading } = parsed;
    addReading(kind, reading);
  }
  return stats;
}

function computeAbnormalities(stats) {
  const out = [];
  const pickBest = (entry, evaluator) => {
    if (!entry || !Array.isArray(entry.readings) || entry.readings.length === 0) return null;
    let best = null;
    for (const reading of entry.readings) {
      const result = evaluator(reading);
      if (!result) continue;
      if (!best || result.score > best.score) best = result;
    }
    return best;
  };

  const bp = pickBest(stats.presion_arterial, (item) => {
    const sys = typeof item.sys === 'number' ? item.sys : null;
    const dia = typeof item.dia === 'number' ? item.dia : null;
    if (sys === null && dia === null) return null;
    // Descartar valores imposibles por mal parseo
    if ((sys !== null && (sys < 50 || sys > 250)) || (dia !== null && (dia < 30 || dia > 150))) return null;
    const highCrisis = (sys !== null && sys >= 160) || (dia !== null && dia >= 100);
    const high = (sys !== null && sys >= 140) || (dia !== null && dia >= 90);
    const lowCrisis = (sys !== null && sys < 80) || (dia !== null && dia < 50);
    const low = (sys !== null && sys < 90) || (dia !== null && dia < 60);
    let score = 0; let motivo = '';
    if (highCrisis) { score = 3; motivo = 'muy alta'; }
    else if (high) { score = 2; motivo = 'alta'; }
    else if (lowCrisis) { score = 3; motivo = 'muy baja'; }
    else if (low) { score = 2; motivo = 'baja'; }
    if (score === 0) return null;
    const valor = (sys !== null && dia !== null) ? `${sys}/${dia} mmHg` : `${sys ?? dia} mmHg`;
    return { param: 'presion_arterial', motivo, valor, score };
  });
  if (bp) out.push(bp);

  const fc = pickBest(stats.frecuencia_cardiaca, (item) => {
    const val = item.val;
    if (typeof val !== 'number') return null;
    if (val < 20 || val > 220) return null; // descartar outliers imposibles
    let score = 0; let motivo = '';
    if (val > 120) { score = 3; motivo = 'muy alta'; }
    else if (val > 100) { score = 2; motivo = 'alta'; }
    else if (val < 40) { score = 3; motivo = 'muy baja'; }
    else if (val < 50) { score = 2; motivo = 'baja'; }
    if (score === 0) return null;
    return { param: 'frecuencia_cardiaca', motivo, valor: `${val} lpm`, score };
  });
  if (fc) out.push(fc);

  const fr = pickBest(stats.frecuencia_respiratoria, (item) => {
    const val = item.val;
    if (typeof val !== 'number') return null;
    if (val < 5 || val > 60) return null; // descartar outliers imposibles
    let score = 0; let motivo = '';
    if (val > 28) { score = 3; motivo = 'muy alta'; }
    else if (val > 20) { score = 2; motivo = 'alta'; }
    else if (val < 10) { score = 3; motivo = 'muy baja'; }
    else if (val < 12) { score = 2; motivo = 'baja'; }
    if (score === 0) return null;
    return { param: 'frecuencia_respiratoria', motivo, valor: `${val} rpm`, score };
  });
  if (fr) out.push(fr);

  const temp = pickBest(stats.temperatura, (item) => {
    const val = item.val;
    if (typeof val !== 'number') return null;
    if (val < 30 || val > 43.5) return null; // descartar outliers imposibles
    let score = 0; let motivo = '';
    if (val >= 39) { score = 3; motivo = 'fiebre alta'; }
    else if (val >= 38) { score = 2; motivo = 'fiebre'; }
    else if (val < 35) { score = 3; motivo = 'hipotermia'; }
    else if (val < 36) { score = 2; motivo = 'temperatura baja'; }
    if (score === 0) return null;
    return { param: 'temperatura', motivo, valor: `${val} °C`, score };
  });
  if (temp) out.push(temp);

  const spo2 = pickBest(stats.saturacion_oxigeno, (item) => {
    const val = item.val;
    if (typeof val !== 'number') return null;
    if (val < 50 || val > 100) return null; // descartar outliers imposibles
    let score = 0; let motivo = '';
    if (val < 90) { score = 3; motivo = 'alarma'; }
    else if (val < 95) { score = 2; motivo = 'baja'; }
    if (score === 0) return null;
    return { param: 'saturacion_oxigeno', motivo, valor: `${val}%`, score };
  });
  if (spo2) out.push(spo2);

  const glucosa = pickBest(stats.glucosa, (item) => {
    const val = item.val;
    if (typeof val !== 'number') return null;
    if (val < 20 || val > 600) return null; // descartar outliers imposibles
    let score = 0; let motivo = '';
    if (val >= 250) { score = 3; motivo = 'muy alta'; }
    else if (val >= 180) { score = 2; motivo = 'alta'; }
    else if (val >= 126) { score = 2; motivo = 'alta'; }
    else if (val < 60) { score = 3; motivo = 'muy baja'; }
    else if (val < 70) { score = 2; motivo = 'baja'; }
    if (score === 0) return null;
    return { param: 'glucosa', motivo, valor: `${val} mg/dL`, score };
  });
  if (glucosa) out.push(glucosa);

  return out;
}

function cleanRangeLabel(raw) {
  if (!raw) return '';
  let label = String(raw).trim();
  const idx = label.indexOf('(');
  if (idx !== -1) label = label.slice(0, idx);
  label = label.replace(/\.+$/, '').trim();
  if (label.length > 60) label = label.slice(0, 60).trim();
  return label;
}
function extractRangeLabel(prompt) {
  const text = String(prompt || '');
  const m1 = text.match(/Ventana analizada:\s*([^\n]+)/i);
  if (m1) return cleanRangeLabel(m1[1]);
  const m2 = text.match(/Rango:\s*([^\n]+)/i);
  if (m2) return cleanRangeLabel(m2[1]);
  return '';
}

function buildQuickStableContent(modo, rangeLabel = '') {
  const labelMap = { general: 'Revisión general', preocupante: '¿Hay algo preocupante?', vigilar: 'Qué vigilar', habitos: 'Hábitos y cuidados' };
  const header = `🩺 Recomendación médica — ${labelMap[modo] || 'Revisión general'}\nPrioridad: 🟢 BAJA`;
  const needsPrep = rangeLabel && !/^(de|del|la|los|las)\b/i.test(rangeLabel);
  const labelConPrep = rangeLabel ? (needsPrep ? `de ${rangeLabel}` : rangeLabel) : '';
  const obs = rangeLabel
    ? `Signos vitales dentro de rangos normales para el periodo ${labelConPrep}.`
    : 'Signos vitales dentro de rangos normales.';
  return [
    header,
    '',
    obs,
    'No se identifican parámetros fuera de rango clínico en el periodo evaluado.',
    'Mantenga la monitorización según indicaciones de su médico.',
    'Si aparecen síntomas nuevos o malestar, contacte a su equipo de salud.'
  ].join('\n').trim();
}

function buildAbnormalContent(modo, abns = [], rangeLabel = '') {
  const labelMap = { general: 'Revisión general', preocupante: '¿Hay algo preocupante?', vigilar: 'Qué vigilar', habitos: 'Hábitos y cuidados' };
  const prioridadScore = Math.max(0, ...abns.map(a => a.score || 0));
  const prioridad = prioridadScore >= 3 ? '🔴 ALTA' : '🟠 MEDIA';
  const alerta = prioridadScore >= 3 ? '  ⚠️ ALERTA' : '';
  const encabezado = `🩺 Recomendación médica — ${labelMap[modo] || 'Revisión general'}\nPrioridad: ${prioridad}${alerta}`;
  const paramLabels = {
    presion_arterial: 'Presión arterial',
    frecuencia_cardiaca: 'Frecuencia cardíaca',
    frecuencia_respiratoria: 'Frecuencia respiratoria',
    temperatura: 'Temperatura',
    saturacion_oxigeno: 'Saturación O₂',
    glucosa: 'Glucosa',
    peso: 'Peso'
  };
  const seccionAlterados = (abns || []).slice(0, 3).map(a => {
    const nombre = paramLabels[a.param] || a.param;
    return `• ${nombre}: ${a.valor || ''} — ${a.motivo || ''}`.trim();
  }).join('\n');
  const accionesTitulo = modo === 'vigilar' ? 'Qué vigilar:' : (modo === 'habitos' ? 'Hábitos y cuidados:' : 'Acciones inmediatas:');
  const acciones = [
    'Control domiciliario de signos 2–3 veces/día',
    'Hidratación y reposo relativo',
    'Consultar si aparecen síntomas de alarma'
  ];
  const periodo = rangeLabel ? `Periodo evaluado: ${rangeLabel}` : '';
  return [
    encabezado,
    '',
    periodo,
    periodo ? '' : null,
    'Parámetros a corregir:',
    seccionAlterados,
    '',
    accionesTitulo,
    acciones.map(a => `• ${a}`).join('\n'),
    '',
    'Siguientes pasos: Revalorar en 24–48 h o antes si hay empeoramiento.',
    'Seguridad del paciente: Si presenta dificultad para respirar, dolor torácico, confusión o fiebre alta persistente, acuda a urgencias.'
  ].filter(Boolean).join('\n').trim();
}

async function verificarOllama() {
  try {
    const r = await ollamaClient.get(`${OLLAMA_BASE_URL}/api/tags`);
    const modelos = r.data?.models || [];
    const nombres = modelos.map(m => m.name);
    const modeloActivo = nombres.includes(OLLAMA_MODEL) ? OLLAMA_MODEL : (nombres[0] || null);
    return { disponible: true, modeloActivo, mensaje: modeloActivo ? 'Ollama conectado correctamente' : 'Ollama activo sin modelo cargado' };
  } catch (e) {
    return { disponible: false, modeloActivo: null, mensaje: 'Error al conectar con Ollama', error: e.message };
  }
}

router.get('/estado', async (_req, res) => {
  try {
    const estado = await verificarOllama();
    if (estado.disponible) {
      return res.json({ lm_studio_disponible: true, modelo_cargado: estado.modeloActivo, mensaje: estado.mensaje });
    }
    return res.status(200).json({ lm_studio_disponible: false, mensaje: estado.mensaje, error: estado.error });
  } catch (e) {
    return res.status(500).json({ lm_studio_disponible: false, mensaje: 'Error al verificar estado de Ollama', error: e.message });
  }
});

router.post('/recomendacion', authMiddleware, async (req, res) => {
  const { prompt } = req.body;
  const isFast = String(req.query.fast || '').toLowerCase() === '1';
  const tipo = String(req.query.tipo || 'general').toLowerCase();
  const wantDebug = String(req.query.debug || '') === '1';
  const forceOllama = String(req.query.forceOllama || '') === '1'; // Móvil puede forzar llamada a Ollama
  const TIPOS = new Set(['general', 'preocupante', 'vigilar', 'habitos']);
  const modo = TIPOS.has(tipo) ? tipo : 'general';

  if (!prompt) {
    return res.status(400).json({ mensaje: 'El prompt es requerido.', lm_studio_disponible: false });
  }

  const FAST_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_FAST_MS || 30000);
  const SLOW_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_SLOW_MS || 45000);
  const requestTimeout = isFast ? FAST_TIMEOUT_MS : SLOW_TIMEOUT_MS;
  const cacheKey = buildKey(prompt, modo, isFast);
  const rangeLabel = extractRangeLabel(prompt);

  // Primero: detección local para decidir si llamar (o no) al LLM
  let statsLocal = null; let abnsLocal = null;
  try {
    statsLocal = extractStatsFromPrompt(prompt);
    abnsLocal = computeAbnormalities(statsLocal);
    const todoNormal = Array.isArray(abnsLocal) && abnsLocal.length === 0 && Object.keys(statsLocal).length > 0;
    // Si forceOllama=1, saltar la respuesta predeterminada y llamar a Ollama directamente
    if (!forceOllama && (todoNormal || Object.keys(statsLocal).length === 0)) {
      const contenido = buildQuickStableContent(modo, rangeLabel);
      const payload = { recomendacion: contenido, modelo_usado: 'reglas-locales', lm_studio_disponible: true, cached: false, ...(wantDebug ? { _debug: { stats: statsLocal, abns: abnsLocal } } : {}) };
      cacheSet(cacheKey, payload);
      return res.json(payload);
    }
  } catch { }

  // Solo si hay anormalidades: revisar cache de la respuesta del LLM
  // Si forceOllama=1, saltar también el cache para obtener respuesta fresca
  if (!forceOllama) {
    const cached = cacheGet(cacheKey);
    if (cached) return res.json(cached);
  }

  const estadoLM = await verificarOllama();
  if (!estadoLM.disponible) {
    return res.status(503).json({ mensaje: estadoLM.mensaje, lm_studio_disponible: false, error: estadoLM.error });
  }
  if (!estadoLM.modeloActivo) {
    return res.status(404).json({ mensaje: 'Ollama está conectado pero no hay modelo cargado.', lm_studio_disponible: true, modelo_cargado: null });
  }

  try {
    if (pendingMap.has(cacheKey)) {
      const result = await pendingMap.get(cacheKey);
      return res.json(result);
    }

    const stats = statsLocal || extractStatsFromPrompt(prompt);
    const abns = abnsLocal || computeAbnormalities(stats);
    const work = (async () => {
      const limitePalabras = isFast ? '50' : '70';
      const systemInstruction = `Eres un asistente clínico que analiza signos vitales en adultos.
Usa rangos de referencia generales cuando no se especifiquen unidades:
  - Presión arterial: ~120/80 mmHg (alta >=140/90, baja <90/60)
  - Frecuencia cardíaca: 60–100 lpm
  - Frecuencia respiratoria: 12–20 rpm
  - Temperatura: 36.1–37.2 °C (fiebre >=38 °C)
  - Saturación O2: >=95% (alarma <90%)
  - Glucosa ayunas: 70–99 mg/dL (>=126 diabético)
Responde en español con UN JSON MUY CORTO y solo estas claves:
{
  "recomendacion": string (<= ${limitePalabras} palabras),
  "alterados": [{"param":"presion_arterial|frecuencia_cardiaca|frecuencia_respiratoria|temperatura|saturacion_oxigeno|peso|glucosa","valor":string,"motivo":string}] (0-3),
  "acciones": string[] (3 items cortos),
  "prioridad": "alta"|"media"|"baja",
  "alerta": true|false
}
Reglas:
- SOLO incluye en "alterados" lo fuera de rango; si todos normales, "alterados" vacío.
- Si no hay alteraciones: prioridad "baja" y alerta false.
No agregues ninguna otra clave ni texto fuera del JSON.`;

      const compactLines = String(prompt || '').split(/\r?\n/).filter(Boolean).slice(0, 200).join('\n');
      const payload = {
        model: estadoLM.modeloActivo,
        prompt: `MODO: ${modo}\n${compactLines}\n\nGenera la respuesta siguiendo estrictamente el formato solicitado.`,
        system: systemInstruction,
        stream: false,
        format: 'json',
        keep_alive: process.env.OLLAMA_KEEP_ALIVE || '2h',
        options: {
          num_predict: isFast ? Number(process.env.OLLAMA_NUM_PREDICT_FAST || 64) : Number(process.env.OLLAMA_NUM_PREDICT || 100),
          temperature: isFast ? Number(process.env.OLLAMA_TEMPERATURE_FAST || 0.12) : Number(process.env.OLLAMA_TEMPERATURE || 0.2),
          num_ctx: isFast ? Number(process.env.OLLAMA_NUM_CTX_FAST || 320) : Number(process.env.OLLAMA_NUM_CTX || 384),
          top_p: isFast ? Number(process.env.OLLAMA_TOP_P_FAST || 0.85) : Number(process.env.OLLAMA_TOP_P || 0.9),
          top_k: isFast ? Number(process.env.OLLAMA_TOP_K_FAST || 20) : Number(process.env.OLLAMA_TOP_K || 40),
          repeat_penalty: isFast ? Number(process.env.OLLAMA_REPEAT_PENALTY_FAST || 1.05) : Number(process.env.OLLAMA_REPEAT_PENALTY || 1.1),
          num_thread: Number(process.env.OLLAMA_THREADS || 4)
        }
      };

      if (inFlight >= MAX_INFLIGHT) {
        const contenidoOcupado = [
          '🩺 Recomendación médica',
          'Prioridad: 🟠 MEDIA',
          '',
          'Acciones inmediatas:',
          '• Controlar signos 1–2 veces/día',
          '• Hidratación y descanso relativo',
          '• Consultar si aparecen síntomas de alarma',
          '',
          'Siguientes pasos: Reintenta en 1–2 minutos.',
          'Seguridad del paciente: Si presenta dificultad respiratoria, dolor torácico o confusión, acuda a urgencias.'
        ].join('\n');
        const resultBody = { recomendacion: contenidoOcupado, lm_studio_disponible: true, modelo_usado: null, busy: true };
        cacheSet(cacheKey, resultBody, 15000);
        return resultBody;
      }

      inFlight++;
      const respuesta = await ollamaClient.post(`${OLLAMA_BASE_URL}/api/generate`, payload, { timeout: requestTimeout });
      let raw = respuesta.data?.response;
      if (raw) {
        const s = raw.indexOf('{');
        const e = raw.lastIndexOf('}');
        if (s !== -1 && e !== -1 && e > s) raw = raw.substring(s, e + 1);
      }

      let contenido = '';
      try {
        const parsed = JSON.parse(raw || '{}');
        let acciones = Array.isArray(parsed.acciones) ? parsed.acciones.slice(0, 3) : [];
        let alterados = Array.isArray(parsed.alterados) ? parsed.alterados.slice(0, 3) : [];
        let prioridad = (parsed.prioridad || 'media').toLowerCase();
        let alerta = !!parsed.alerta;

        if (!alterados || alterados.length === 0) {
          // Si forceOllama=1, usar la recomendación del LLM directamente (sin fallback a reglas locales)
          if (forceOllama && parsed.recomendacion) {
            const contenidoLLM = String(parsed.recomendacion);
            const prioridadLabel = prioridad === 'alta' ? '🔴 ALTA' : prioridad === 'media' ? '🟠 MEDIA' : '🟢 BAJA';
            const resultBody = {
              recomendacion: `🩺 Recomendación médica\nPrioridad: ${prioridadLabel}${alerta ? '  ⚠️ ALERTA' : ''}\n\n${contenidoLLM}`,
              modelo_usado: estadoLM.modeloActivo,
              lm_studio_disponible: true,
              source: 'ollama-direct',
              ...(wantDebug ? { _debug: { stats: stats, abns, llm_raw: parsed } } : {})
            };
            cacheSet(cacheKey, resultBody);
            return resultBody;
          }
          // Si el LLM no reporta alteraciones pero nuestras reglas sí, usamos las reglas como fallback seguro
          if (Array.isArray(abns) && abns.length > 0) {
            const contenidoReglas = buildAbnormalContent(modo, abns, rangeLabel);
            const resultBody = { recomendacion: contenidoReglas, modelo_usado: estadoLM.modeloActivo, lm_studio_disponible: true, fallback: 'reglas-locales', ...(wantDebug ? { _debug: { stats: stats, abns } } : {}) };
            cacheSet(cacheKey, resultBody);
            return resultBody;
          } else {
            const contenidoNormal = buildQuickStableContent(modo, rangeLabel);
            const resultBody = { recomendacion: contenidoNormal, modelo_usado: estadoLM.modeloActivo, lm_studio_disponible: true, ...(wantDebug ? { _debug: { stats: stats, abns } } : {}) };
            cacheSet(cacheKey, resultBody);
            return resultBody;
          }
        }

        const seccionAlterados = alterados.map(a => `• ${a.param}: ${a.valor} — ${a.motivo}`).join('\n');
        const labelMap = { general: 'Revisión general', preocupante: '¿Hay algo preocupante?', vigilar: 'Qué vigilar', habitos: 'Hábitos y cuidados' };
        const encabezado = `🩺 Recomendación médica — ${labelMap[modo] || 'Revisión general'}\nPrioridad: ${prioridad === 'alta' ? '🔴 ALTA' : prioridad === 'media' ? '🟠 MEDIA' : '🟢 BAJA'}${alerta ? '  ⚠️ ALERTA' : ''}`;
        const bullets = (arr) => arr.filter(Boolean).map(t => `• ${t}`).join('\n');
        const accionesTitulo = modo === 'vigilar' ? 'Qué vigilar:' : (modo === 'habitos' ? 'Hábitos y cuidados:' : 'Acciones inmediatas:');
        const seccionAcciones = bullets((acciones && acciones.length ? acciones : ['Continuar monitorización domiciliaria', 'Registrar signos 2 veces/día', 'Consultar si aparecen síntomas de alarma']).slice(0, 3));
        contenido = [
          encabezado,
          '',
          'Parámetros a corregir:',
          seccionAlterados,
          '',
          accionesTitulo,
          seccionAcciones,
          '',
          'Siguientes pasos: Revalorar en 24–48 h o antes si hay empeoramiento.',
          'Seguridad del paciente: Si presenta dificultad para respirar, dolor torácico, confusión o fiebre alta persistente, acuda a urgencias.'
        ].join('\n').trim();
      } catch {
        // Error parseando respuesta del LLM, usar fallback coherente según detección local
        if (Array.isArray(abns) && abns.length > 0) {
          contenido = buildAbnormalContent(modo, abns, rangeLabel);
        } else {
          contenido = buildQuickStableContent(modo, rangeLabel);
        }
      }

      const resultBody = { recomendacion: contenido, modelo_usado: estadoLM.modeloActivo, lm_studio_disponible: true, ...(wantDebug ? { _debug: { stats: stats, abns } } : {}) };
      cacheSet(cacheKey, resultBody);
      return resultBody;
    })().finally(() => { inFlight = Math.max(0, inFlight - 1); });

    pendingMap.set(cacheKey, work);
    const finalResult = await work;
    pendingMap.delete(cacheKey);
    return res.json(finalResult);
  } catch (error) {
    const msg = error?.message || '';
    const isTimeout = msg.includes('timeout') || error?.code === 'ECONNABORTED';
    if (isTimeout) {
      const contenido = [
        '🩺 Recomendación médica',
        'Prioridad: 🟠 MEDIA',
        '',
        'Acciones inmediatas:',
        '• Continuar monitorización domiciliaria',
        '• Registrar signos 2 veces/día',
        '• Consultar si aparecen síntomas de alarma',
        '',
        'Siguientes pasos: Reintenta cuando haya menos carga.'
      ].join('\n');
      const body = { recomendacion: contenido, lm_studio_disponible: true, modelo_usado: null, timed_out: true, timeout_ms: requestTimeout };
      cacheSet(cacheKey, body, 30000);
      return res.status(200).json(body);
    }
    console.error('❌ Error al consultar Ollama:', msg);
    return res.status(500).json({ mensaje: 'Error al consultar Ollama para obtener recomendación', lm_studio_disponible: false, error: msg });
  }
});

export const llmRoutes = router;
