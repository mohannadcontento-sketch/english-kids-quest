/*
  Professional pronunciation assessment engine (المحرك الاحترافي).
  Built on Microsoft Azure AI Speech "Pronunciation Assessment" — the same
  cloud technology used by professional language-learning products —
  loaded from the official browser bundle on the CDN (no npm bloat, no model
  downloads, ~300KB gzipped, fetched once and cached by the browser).

  What the child gets:
  - Phoneme/word-level accuracy scoring (0-100) that actually understands
    whether "ball" was said correctly — far beyond generic speech-to-text.
  - Zero model downloads; works instantly on phones.

  Credentials are resolved in this order (fail → next):
    1. Parent-supplied subscription key (stored in this browser only):
         localStorage["ekq-azure-key"] + localStorage["ekq-azure-region"]
    2. Same-origin token endpoint /api/speech-token (Vercel serverless
       function — the real key stays in server environment variables).
  If neither exists the app keeps using the free browser engines.
*/

const SDK_VERSION = "1.45.0";
const SDK_URL = `https://cdn.jsdelivr.net/npm/microsoft-cognitiveservices-speech-sdk@${SDK_VERSION}/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle-min.js`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechSDK = any;

export type AzureCredentials =
  | { kind: "subscription"; key: string; region: string }
  | { kind: "token"; token: string; region: string };

export type PronunciationScores = {
  /** Average word accuracy 0-100 — the main score we grade the child on. */
  accuracy: number;
  completeness: number;
  fluency: number;
  /** What the recognizer heard, e.g. "Apple." (for the «سمعنا» line). */
  recognized: string;
  /** Per-word detail, e.g. [{ word: "ball", accuracy: 82 }] */
  words: Array<{ word: string; accuracy: number }>;
};

let sdkPromise: Promise<SpeechSDK> | null = null;
let cachedToken: { token: string; region: string; expiresAt: number } | null = null;

/** Load the official browser bundle once (script tag → window.SpeechSDK). */
function loadSpeechSdk(): Promise<SpeechSDK> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const existing = (window as unknown as { SpeechSDK?: SpeechSDK }).SpeechSDK;
    if (existing) {
      resolve(existing);
      return;
    }
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => {
      const sdk = (window as unknown as { SpeechSDK?: SpeechSDK }).SpeechSDK;
      if (sdk) resolve(sdk);
      else reject(new Error("speech-sdk-missing"));
    };
    script.onerror = () => {
      sdkPromise = null;
      script.remove();
      reject(new Error("speech-sdk-load-failed"));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export function getParentAzureConfig(): { key: string; region: string } | null {
  try {
    const key = (localStorage.getItem("ekq-azure-key") ?? "").trim();
    const region = (localStorage.getItem("ekq-azure-region") ?? "").trim();
    if (key && region) return { key, region };
  } catch { /* private mode */ }
  return null;
}

export function saveParentAzureConfig(key: string, region: string) {
  localStorage.setItem("ekq-azure-key", key.trim());
  localStorage.setItem("ekq-azure-region", region.trim().toLowerCase());
  cachedToken = null;
}

export function clearParentAzureConfig() {
  try {
    localStorage.removeItem("ekq-azure-key");
    localStorage.removeItem("ekq-azure-region");
  } catch { /* private mode */ }
  cachedToken = null;
}

/** Probe the same-origin token endpoint (Vercel serverless, if deployed there). */
async function fetchServerToken(): Promise<AzureCredentials | null> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return { kind: "token", token: cachedToken.token, region: cachedToken.region };
  }
  try {
    const url = new URL("api/speech-token", window.location.href).toString();
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as { token?: string; region?: string };
    if (!data.token || !data.region) return null;
    cachedToken = { token: data.token, region: data.region, expiresAt: Date.now() + 8 * 60 * 1000 };
    return { kind: "token", token: data.token, region: data.region };
  } catch {
    return null;
  }
}

/**
 * Resolve Azure credentials: parent-pasted key first, then the server endpoint.
 * Resolves null when the professional engine is simply not configured.
 */
export async function resolveAzureCredentials(): Promise<AzureCredentials | null> {
  const parent = getParentAzureConfig();
  if (parent) return { kind: "subscription", key: parent.key, region: parent.region };
  return fetchServerToken();
}

/** Sentences may contain "..." placeholders — Azure expects real words only. */
export function cleanReferenceText(text: string): string {
  return text
    .replace(/\.{2,}|…/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Decode any browser recording into mono 16 kHz Int16 PCM (what the SDK pushes). */
function floatToPcm16(samples: Float32Array): Int16Array {
  const pcm = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index]));
    pcm[index] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return pcm;
}

/**
 * Assess a recording against a reference text (word or sentence).
 * Throws on any failure — the caller falls back to the free browser engines.
 */
export async function assessRecording(blob: Blob, referenceText: string): Promise<PronunciationScores> {
  if (!blob.size) throw new Error("empty-recording");
  const [sdk, credentials, mono] = await Promise.all([
    loadSpeechSdk(),
    resolveAzureCredentials(),
    import("@/lib/whisperEngine").then((engine) => engine.decodeRecordingToMono16k(blob)),
  ]);
  if (!credentials) throw new Error("no-credentials");
  if (!mono.length) throw new Error("empty-audio");

  const pcm = floatToPcm16(mono);
  const streamFormat = sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
  const pushStream = sdk.AudioInputStream.createPushStream(streamFormat);
  pushStream.write(pcm.buffer);
  pushStream.close();
  const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);

  const speechConfig = credentials.kind === "token"
    ? sdk.SpeechConfig.fromAuthorizationToken(credentials.token, credentials.region)
    : sdk.SpeechConfig.fromSubscription(credentials.key, credentials.region);
  speechConfig.speechRecognitionLanguage = "en-US";

  const pronConfig = new sdk.PronunciationAssessmentConfig(
    cleanReferenceText(referenceText),
    sdk.PronunciationAssessmentGradingSystem.HundredMark,
    sdk.PronunciationAssessmentGranularity.Phoneme,
    true,
  );

  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
  pronConfig.applyTo(recognizer);

  try {
    const result: Record<string, unknown> = await new Promise((resolve, reject) => {
      recognizer.recognizeOnceAsync(
        (outcome: unknown) => resolve(outcome as Record<string, unknown>),
        (error: unknown) => reject(error),
      );
    });
    // Reason 3 = RecognizedSpeech; 4 = NoMatch (the child said something else entirely).
    if (result?.reason !== 3) {
      const detail = result?.errorDetails ? `: ${String(result.errorDetails)}` : "";
      throw new Error(`assessment-failed${detail}`);
    }
    const pron = sdk.PronunciationAssessmentResult.fromResult(result);
    const rawWords: unknown[] = Array.isArray(pron?.detailWords) ? pron.detailWords : [];
    const words = rawWords
      .map((item) => {
        const entry = item as { word?: string; accuracyScore?: number };
        return { word: String(entry?.word ?? ""), accuracy: Number(entry?.accuracyScore ?? 0) };
      })
      .filter((item) => item.word);
    return {
      accuracy: Number(pron.accuracyScore ?? 0),
      completeness: Number(pron.completenessScore ?? 0),
      fluency: Number(pron.fluencyScore ?? 0),
      recognized: String(result.text ?? "").trim(),
      words,
    };
  } finally {
    try { recognizer.close(); } catch { /* already closed */ }
    try { speechConfig.close(); } catch { /* already closed */ }
  }
}

/*
  ---------------------------------------------------------------------------
  Free server engine — Groq-hosted Whisper (المحرك الاحترافي المجاني).
  ---------------------------------------------------------------------------
  Whisper is an open-source (MIT) speech model, and Groq's API free tier
  requires NO credit card — just a key from console.groq.com/keys.
  The recording is sent to the same-origin endpoint /api/assess (a tiny
  Vercel serverless function) which holds the real key server-side and
  returns { transcript, score }. The child downloads nothing at all.
*/

export type ServerAssessment = {
  transcript: string;
  /** Best similarity (0-1) between the transcript and the expected text. */
  score: number;
};

const GROQ_KEY_STORAGE = "ekq-groq-key";

export function getParentGroqKey(): string | null {
  try {
    const key = (localStorage.getItem(GROQ_KEY_STORAGE) ?? "").trim();
    return key || null;
  } catch { /* private mode */ }
  return null;
}

export function saveParentGroqKey(key: string) {
  localStorage.setItem(GROQ_KEY_STORAGE, key.trim());
}

export function clearParentGroqKey() {
  try {
    localStorage.removeItem(GROQ_KEY_STORAGE);
  } catch { /* private mode */ }
}

/**
 * Zero-cost probe: is the free professional engine usable in this deployment?
 * True when the parent saved a key here OR the server endpoint reports a
 * configured GROQ_API_KEY (works for every visitor on Vercel).
 */
export async function probeServerAssessment(): Promise<boolean> {
  if (getParentGroqKey()) return true;
  try {
    const url = new URL("api/assess", window.location.href).toString();
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return false;
    const data = (await response.json()) as { configured?: boolean };
    return Boolean(data?.configured);
  } catch {
    return false;
  }
}

/** Blob → base64 (recordings are small: a 13s opus clip is ~40KB). */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result);
    };
    reader.onerror = () => reject(new Error("blob-read-failed"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Assess a recording through the free server endpoint.
 * Throws on any failure — the caller falls back to the free browser engines.
 */
export async function serverAssessRecording(blob: Blob, expected: string): Promise<ServerAssessment> {
  if (!blob.size) throw new Error("empty-recording");
  if (!expected.trim()) throw new Error("empty-expected");
  const audioBase64 = await blobToBase64(blob);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const parentKey = getParentGroqKey();
  if (parentKey) headers["x-groq-key"] = parentKey;
  const url = new URL("api/assess", window.location.href).toString();
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ expected, mime: blob.type || "audio/webm", audioBase64 }),
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(`server-assess-failed:${response.status}:${detail?.error ?? "unknown"}`);
  }
  const data = (await response.json()) as { transcript?: string; score?: number };
  return { transcript: String(data?.transcript ?? "").trim(), score: Number(data?.score ?? 0) };
}
