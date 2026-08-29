// Local TTS-generated audio clips, stored in client/public/audio/ (no external storage needed).
export type AudioCue = { src: string };

const letters = "abcdefghijklmnopqrstuvwxyz";
const SENTENCE_COUNT = 50;

export function getEmbeddedAudioCue(type: "letter" | "word" | "sentence", index: number): AudioCue | null {
  if (index < 0) return null;
  if (type === "letter" && index < 26) return { src: `/audio/letters/letter-${letters[index]}.mp3` };
  if (type === "word" && index < 26) return { src: `/audio/words/word-${letters[index]}.mp3` };
  if (type === "sentence" && index < SENTENCE_COUNT) return { src: `/audio/sentences/sentence-${index + 1}.mp3` };
  return null;
}
