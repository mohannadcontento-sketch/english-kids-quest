// Local TTS-generated audio clips, stored in client/public/audio/ (no external storage needed).
import { withBase, withAssetV } from "@/lib/base";

export type AudioCue = { src: string };

const letters = "abcdefghijklmnopqrstuvwxyz";
const SENTENCE_COUNT = 50;

export function getEmbeddedAudioCue(type: "letter" | "word" | "sentence", index: number): AudioCue | null {
  if (index < 0) return null;
  if (type === "letter" && index < 26) return { src: withBase(withAssetV(`/audio/letters/letter-${letters[index]}.mp3`)) };
  if (type === "word" && index < 26) return { src: withBase(withAssetV(`/audio/words/word-${letters[index]}.mp3`)) };
  if (type === "sentence" && index < SENTENCE_COUNT) return { src: withBase(withAssetV(`/audio/sentences/sentence-${index + 1}.mp3`)) };
  return null;
}
