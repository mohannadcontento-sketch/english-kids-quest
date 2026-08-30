/*
  Smart offline recognition engine (المحرك الذكي).
  Built on Hugging Face Transformers.js (https://github.com/huggingface/transformers.js, MIT)
  running OpenAI Whisper (tiny.en, ONNX quantized) fully INSIDE the browser —
  the same proven approach as xenova/whisper-web.

  - No server, no API keys: audio never leaves the child's device.
  - Model (~45MB) downloads ONCE from the Hugging Face CDN and is cached
    by the browser, then works completely offline.
  - Works in every modern browser, including Firefox and iOS Safari
    where the Web Speech API is unavailable.
*/

type WhisperProgressInfo = {
  status: string;
  file?: string;
  progress?: number;
};

type WhisperOutput = { text: string } | Array<{ text: string }>;

type Transcriber = (audio: Float32Array, options?: Record<string, unknown>) => Promise<WhisperOutput>;

const MODEL_ID = "onnx-community/whisper-tiny.en";

let pipelinePromise: Promise<Transcriber> | null = null;

/** True once the model has been fully downloaded and is ready to transcribe. */
export function isSmartEngineReady() {
  return pipelinePromise !== null;
}

/**
 * Download (once) and prepare the Whisper pipeline.
 * Resolves true when ready, false on any failure (caller can retry).
 * `onProgress` reports 0-100 across all downloaded files.
 */
export async function loadSmartEngine(onProgress: (percent: number) => void): Promise<boolean> {
  if (pipelinePromise) return true;
  try {
    const transformers = await import("@huggingface/transformers");
    transformers.env.allowLocalModels = false;
    // WASM backends load from the official CDN (pinned version) — keeps our bundle small.
    const onnxWasm = (transformers.env.backends as { onnx?: { wasm?: { wasmPaths?: string } } } | undefined)?.onnx?.wasm;
    if (onnxWasm) onnxWasm.wasmPaths = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/";
    const fileProgress = new Map<string, number>();
    const reportOverall = () => {
      const values = Array.from(fileProgress.values());
      const average = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
      onProgress(Math.max(1, Math.min(99, Math.round(average))));
    };
    const build = transformers.pipeline("automatic-speech-recognition", MODEL_ID, {
      dtype: "q8",
      progress_callback: (info: WhisperProgressInfo) => {
        if (info.status === "progress" && info.file) {
          fileProgress.set(info.file, Math.min(100, info.progress ?? 0));
          reportOverall();
        }
      },
    }) as unknown as Promise<Transcriber>;
    pipelinePromise = build;
    await build;
    onProgress(100);
    return true;
  } catch (error) {
    pipelinePromise = null;
    console.warn("Smart engine failed to load:", error);
    return false;
  }
}

function mixToMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const mixed = new Float32Array(left.length);
  for (let index = 0; index < left.length; index += 1) mixed[index] = (left[index] + right[index]) / 2;
  return mixed;
}

function resampleTo16k(samples: Float32Array, sourceRate: number): Float32Array {
  if (sourceRate === 16000) return samples;
  const targetLength = Math.max(1, Math.round((samples.length * 16000) / sourceRate));
  const result = new Float32Array(targetLength);
  const ratio = samples.length / targetLength;
  for (let index = 0; index < targetLength; index += 1) {
    const position = index * ratio;
    const base = Math.floor(position);
    const fraction = position - base;
    const next = Math.min(samples.length - 1, base + 1);
    result[index] = samples[base] * (1 - fraction) + samples[next] * fraction;
  }
  return result;
}

/** Decode any browser-recorded blob to mono 16 kHz Float32 PCM (what Whisper expects). */
async function decodeToMono16k(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) throw new Error("audio-context-unavailable");
  try {
    // Preferred: let Web Audio resample straight to 16 kHz.
    const context = new AudioContextCtor({ sampleRate: 16000 });
    const buffer = await context.decodeAudioData(arrayBuffer);
    const samples = mixToMono(buffer);
    await context.close();
    return resampleTo16k(samples, buffer.sampleRate);
  } catch {
    // Some browsers refuse a custom sample rate: decode natively, resample manually.
    const context = new AudioContextCtor();
    const buffer = await context.decodeAudioData(arrayBuffer);
    const samples = mixToMono(buffer);
    await context.close();
    return resampleTo16k(samples, buffer.sampleRate);
  }
}

/** Transcribe a recording; returns "" when the engine is missing or anything fails. */
export async function transcribeRecording(blob: Blob): Promise<string> {
  if (!pipelinePromise || !blob.size) return "";
  try {
    const transcriber = await pipelinePromise;
    const audio = await decodeToMono16k(blob);
    if (!audio.length) return "";
    const output = await transcriber(audio, { chunk_length_s: 30, stride_length_s: 5 });
    const text = Array.isArray(output) ? output[0]?.text : output?.text;
    return (text ?? "").trim();
  } catch (error) {
    console.warn("Transcription failed:", error);
    return "";
  }
}
