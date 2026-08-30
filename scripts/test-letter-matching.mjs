/*
  اختبار مطابقة نطق الحروف — يستخرج الدوال الحقيقية من LearningApp.tsx
  (لا نسخة مكرّمة تتقادم). يتأكد أن كل مسارات التقييم حية فوق عتبة
  LETTER_LISTEN.threshold وأن الإيجابيات الكاذبة مرفوضة.
  تشغيل: node scripts/test-letter-matching.mjs
*/
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(repoRoot, "client/src/pages/LearningApp.tsx"), "utf-8");

// Slice the pure matching logic out of the component file (no React involved).
const startMarker = "const CONTRACTION_MAP";
const endMarker = "function listenSecondsLabel";
const timingStart = "const WORD_LISTEN";
const timingEnd = "function shuffleChoices";
const startIndex = source.indexOf(startMarker);
const endIndex = source.indexOf(endMarker);
const timingStartIndex = source.indexOf(timingStart);
const timingEndIndex = source.indexOf(timingEnd);
if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex || timingStartIndex < 0 || timingEndIndex < 0 || timingEndIndex <= timingStartIndex) {
  console.error("Could not locate the matching logic inside LearningApp.tsx");
  process.exit(2);
}
const slice = source.slice(timingStartIndex, timingEndIndex) + "\n" + source.slice(startIndex, endIndex);

// Build a temporary TypeScript module from the real source and import it.
const dir = mkdtempSync(join(tmpdir(), "ekq-letter-test-"));
const modulePath = join(dir, "letterMatching.ts");
writeFileSync(modulePath, slice + "\nexport { matchLetterUtterances, LETTER_LISTEN };\n");

const { matchLetterUtterances, LETTER_LISTEN } = await import(pathToFileURL(modulePath).href);
rmSync(dir, { recursive: true, force: true });

// The real matcher receives a LetterLesson object — only letter/word are used.
const L = (letter, word) => ({ letter, lower: letter.toLowerCase(), sound: "", ipa: "", word, wordAr: "", hint: "" });

// Gate 1: every scoring path must clear the threshold, or it is a dead path.
const gates = [
  ["exact sound", 1.0], ["exact name", 0.95], ["fuzzy sound", 0.72], ["fuzzy name", 0.7], ["word floor", 0.78],
];
for (const [label, score] of gates) {
  if (score < LETTER_LISTEN.threshold) {
    console.error(`DEAD PATH: ${label} scores ${score} < threshold ${LETTER_LISTEN.threshold} — it can never succeed`);
    process.exit(1);
  }
}
console.log(`GATE  threshold ${LETTER_LISTEN.threshold}: all scoring paths (${gates.map((g) => g[0]).join(", ")}) are live`);

// Gate 2: real-transcript behaviour cases.
const cases = [
  ["A", "apple", ["ah"], "sound"],            // kid says the phoneme → Chrome hears "ah"
  ["A", "apple", ["I"], "sound"],             // Chrome transcribes "aah" as "I"
  ["A", "apple", ["a"], "sound"],             // "a" must NOT be eaten by the article filter
  ["A", "apple", ["apple"], "word"],
  ["A", "apple", ["an apple"], "word"],       // article stripped by wordSimilarity
  ["A", "apple", ["Are our"], "sound"],       // Chrome multi-word garbage for "aah"
  ["A", "apple", ["Apple."], "word"],         // punctuation from Whisper-style transcripts
  ["B", "ball", ["buh"], "sound"],
  ["B", "ball", ["bee"], "name"],
  ["B", "ball", ["ball"], "word"],
  ["B", "ball", ["the ball"], "word"],
  ["M", "moon", ["mm"], "sound"],
  ["M", "moon", ["em"], "sound"],
  ["M", "moon", ["moon"], "word"],
  ["S", "sun", ["ss"], "sound"],
  ["S", "sun", ["yes"], null],                // noise must not pass
  ["U", "umbrella", ["uh"], "sound"],
  ["U", "umbrella", ["you"], "name"],
  ["U", "umbrella", ["a"], "sound"],
  ["W", "water", ["double you"], "name"],
  ["C", "cat", ["see"], "name"],
  ["C", "cat", ["cat"], "word"],
  ["A", "apple", ["banana"], null],           // wrong word → no false positive
  ["B", "ball", ["apple"], null],             // another letter's word → no match
  ["M", "moon", ["the"], null],               // article-only transcript
  ["A", "apple", ["my apple"], "word"],       // filler word + target word (single spoken word credit)
  ["R", "rabbit", ["are"], "name"],          // "are" is R's exact name token (any kind = success)
  ["Q", "queen", ["queue"], "name"],          // "queue" ~ "cue" via fuzzy name path
];

let pass = 0, fail = 0;
for (const [letter, word, candidates, expected] of cases) {
  const result = matchLetterUtterances(candidates, L(letter, word));
  const got = result ? result.kind : null;
  // A pass needs both the right kind AND a score that clears the live threshold.
  const clears = result ? result.score >= LETTER_LISTEN.threshold : false;
  const ok = got === expected && (expected === null ? true : clears);
  console.log(`${ok ? "PASS" : "FAIL"}  ${letter} <- [${candidates}] => ${got}${result ? ` (${result.score.toFixed(2)})` : ""}  expected=${expected}`);
  ok ? pass++ : fail++;
}
console.log(`\n${pass} passed, ${fail} failed (threshold ${LETTER_LISTEN.threshold})`);
process.exit(fail > 0 ? 1 : 0);
