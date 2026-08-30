/**
 * Vercel Serverless Function — pronunciation assessment via Groq-hosted Whisper.
 *
 * WHY GROQ: the Whisper model is fully open source (MIT) and Groq's free tier
 * requires NO credit card — just an API key created at console.groq.com/keys
 * (20 requests/minute, 2000 requests/day on the free plan, 25MB per file).
 * The child downloads nothing: the recording (~30KB) is sent to this endpoint,
 * transcribed by Whisper large-v3-turbo, and scored against the expected text.
 *
 * Key resolution (first wins):
 *   1. "x-groq-key" request header  → a parent-supplied key saved in this browser
 *   2. GROQ_API_KEY environment variable → works for every visitor automatically
 *      (Vercel → Project → Settings → Environment Variables → Redeploy)
 *
 * GET  → { ok, configured, engine } used by the client as a zero-cost probe.
 * POST → JSON body { expected, mime, audioBase64 }
 *      ← JSON   { transcript, score, expected, engine }  (score: 0..1)
 *
 * On GitHub Pages (static hosting) this endpoint does not exist and the app
 * silently falls back to the free browser engines — the child is never blocked.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_MODEL = "whisper-large-v3-turbo";
const MAX_BODY_BYTES = 5 * 1024 * 1024; // recordings are ~30-60KB; keep a generous cap

/* ---- Shared scoring logic (mirrors the client's fuzzy matching) ---- */

const CONTRACTION_MAP = {
  "i'm": "i am", "don't": "do not", "can't": "can not", "won't": "will not",
  "it's": "it is", "what's": "what is", "that's": "that is", "there's": "there is",
  "let's": "let us", "you're": "you are", "we're": "we are", "they're": "they are",
  "he's": "he is", "she's": "he is", "i'll": "i will", "you'll": "you will",
  "we'll": "we will", "isn't": "is not", "aren't": "are not", "doesn't": "does not",
  "didn't": "did not", "i'd": "i would", "you'd": "you would", "he'll": "he will",
};
const ARTICLE_WORDS = new Set(["a", "an", "the", "uh", "um", "eh", "oh"]);

function normalizeSpokenEnglish(value) {
  const cleaned = String(value || "").toLowerCase().replace(/[^a-z\s']/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.split(" ").map((word) => CONTRACTION_MAP[word] ?? word).join(" ").replace(/\s+/g, " ").trim();
}

function levenshteinSimilarity(source, target) {
  if (!source || !target) return 0;
  if (source === target) return 1;
  const rows = target.length + 1;
  const columns = source.length + 1;
  const matrix = Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => row === 0 ? column : column === 0 ? row : 0));
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + (target[row - 1] === source[column - 1] ? 0 : 1),
      );
    }
  }
  return 1 - matrix[rows - 1][columns - 1] / Math.max(target.length, source.length);
}

function singularize(word) {
  return word.length > 3 ? word.replace(/'s$/, "").replace(/s$/, "") : word;
}

function wordSimilarity(spoken, expected) {
  const target = normalizeSpokenEnglish(expected);
  const spokenWords = normalizeSpokenEnglish(spoken).split(" ").filter((word) => word && !ARTICLE_WORDS.has(word));
  if (!spokenWords.length || !target) return 0;
  if (spokenWords.includes(target)) return 1;
  const source = spokenWords.join(" ");
  let best = levenshteinSimilarity(source, target);
  const plainTarget = singularize(target);
  if (plainTarget && plainTarget !== target) {
    if (spokenWords.includes(plainTarget)) return 1;
    best = Math.max(best, levenshteinSimilarity(source, plainTarget) * 0.97);
  }
  spokenWords.forEach((word) => {
    const direct = levenshteinSimilarity(word, target);
    if (direct >= 0.8) best = Math.max(best, Math.min(0.95, direct));
    if (plainTarget && plainTarget !== target) {
      const relaxed = levenshteinSimilarity(word, plainTarget);
      if (relaxed >= 0.8) best = Math.max(best, Math.min(0.95, relaxed));
    }
  });
  return best;
}

function sentenceSimilarity(spoken, expected) {
  const source = normalizeSpokenEnglish(spoken);
  const target = normalizeSpokenEnglish(expected);
  if (!source || !target) return 0;
  // Articles carry no pronunciation signal for kids — drop them from the
  // target side so "the cat is black" scores 1.0, not 0.75.
  const targetWords = target.split(" ").filter((word) => !ARTICLE_WORDS.has(word));
  const spokenWords = source.split(" ");
  if (!targetWords.length) return 1;
  const matchedWords = targetWords.filter((word) => {
    const plain = singularize(word);
    return spokenWords.some((candidate) => wordSimilarity(candidate, word) >= 0.78 || (plain !== word && wordSimilarity(candidate, plain) >= 0.8));
  }).length;
  const coverage = matchedWords / targetWords.length;
  return Math.max(wordSimilarity(source, target), coverage);
}

/** Exported for tests: fuzzy similarity used to grade the transcript. */
export function scoreTranscript(transcript, expected) {
  const target = String(expected || "").trim();
  if (!target) return 0;
  return target.includes(" ") ? sentenceSimilarity(transcript, target) : wordSimilarity(transcript, target);
}

/* ---- Helpers ---- */

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body-too-large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("invalid-json"));
      }
    });
    req.on("error", () => reject(new Error("body-read-failed")));
  });
}

function applyCors(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin ?? "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-groq-key");
}

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const apiKey = String(req.headers["x-groq-key"] ?? "").trim() || process.env.GROQ_API_KEY || "";

  // Zero-cost probe: tells the client whether the professional engine is usable.
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, configured: Boolean(apiKey), engine: "groq-whisper" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method-not-allowed" });
  }

  if (!apiKey) {
    return res.status(501).json({ error: "not-configured", engine: "groq-whisper" });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return res.status(400).json({ error: "invalid-body" });
  }

  const expected = String(body?.expected ?? "").trim();
  const mime = String(body?.mime ?? "audio/webm").split(";")[0] || "audio/webm";
  const audioBase64 = String(body?.audioBase64 ?? "").replace(/^data:[^,]*,/, "");
  if (!expected || !audioBase64) {
    return res.status(400).json({ error: "missing-audio-or-expected" });
  }

  let audioBuffer;
  try {
    audioBuffer = Buffer.from(audioBase64, "base64");
  } catch {
    return res.status(400).json({ error: "invalid-audio" });
  }
  if (!audioBuffer.length) {
    return res.status(400).json({ error: "empty-audio" });
  }

  try {
    const upstreamForm = new FormData();
    upstreamForm.append("file", new Blob([audioBuffer], { type: mime }), "recording.webm");
    upstreamForm.append("model", GROQ_MODEL);
    upstreamForm.append("language", "en");
    upstreamForm.append("temperature", "0");
    upstreamForm.append("response_format", "json");
    // Neutral prompt: conditions Whisper on "a child speaking" WITHOUT leaking
    // the expected word — prevents echo-hallucination false positives.
    upstreamForm.append("prompt", "A young child speaking English clearly.");

    const upstream = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamForm,
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      const status = upstream.status === 401 ? 502 : upstream.status === 429 ? 429 : 502;
      return res.status(status).json({ error: "upstream-failed", status: upstream.status, detail: detail.slice(0, 300) });
    }

    const data = await upstream.json().catch(() => ({}));
    const transcript = String(data?.text ?? "").trim();
    return res.status(200).json({
      transcript,
      score: scoreTranscript(transcript, expected),
      expected,
      engine: GROQ_MODEL,
    });
  } catch {
    return res.status(502).json({ error: "network-error" });
  }
}
