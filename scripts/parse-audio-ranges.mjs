import { readFile, writeFile } from "node:fs/promises";

const sources = {
  letters: "/tmp/ekq-letters-silence.log",
  words: "/tmp/ekq-words-silence.log",
  sentencesOne: "/tmp/ekq-sentences1-silence.log",
  sentencesTwo: "/tmp/ekq-sentences2-silence.log",
};

function rangesFromLog(log, duration) {
  const silences = [];
  let silenceStart = null;
  for (const line of log.split("\n")) {
    const start = line.match(/silence_start: ([\d.]+)\s*$/);
    if (start) {
      silenceStart = Number(start[1]);
      continue;
    }
    const end = line.match(/silence_end: ([\d.]+)/);
    if (end && silenceStart !== null) {
      silences.push({ start: silenceStart, end: Number(end[1]) });
      silenceStart = null;
    }
  }

  const ranges = [];
  let cursor = 0;
  for (const silence of silences) {
    if (silence.end - silence.start >= 1) {
      ranges.push({ start: Number(cursor.toFixed(3)), end: Number(silence.start.toFixed(3)) });
      cursor = silence.end;
    }
  }
  ranges.push({ start: Number(cursor.toFixed(3)), end: Number(duration.toFixed(3)) });
  return ranges;
}

const durations = { letters: 110.36, words: 77.12, sentencesOne: 101.28, sentencesTwo: 82.12 };
const result = {};
for (const [name, path] of Object.entries(sources)) {
  result[name] = rangesFromLog(await readFile(path, "utf8"), durations[name]);
}

await writeFile("/tmp/ekq-audio-ranges.json", `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(Object.fromEntries(Object.entries(result).map(([name, ranges]) => [name, ranges.length]))));
