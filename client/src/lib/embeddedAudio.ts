// Embedded audio map — generated learning audio, stored outside the project and served through stable webdev URLs.
export type AudioCue = { src: string; start: number; end: number };

const lettersSrc = "/manus-storage/ekq-letters-sprite_c90bc2ee.wav";
const wordsSrc = "/manus-storage/ekq-words-sprite_e6b7a056.wav";
const sentencesOneSrc = "/manus-storage/ekq-sentences-1_19d16188.wav";
const sentencesTwoSrc = "/manus-storage/ekq-sentences-2_7dad643e.wav";

const letterRanges: [number, number][] = [[0,0.971],[5.249,5.879],[9.791,10.621],[14.579,15.17],[19.257,19.892],[23.664,24.152],[27.708,28.372],[31.82,32.41],[36.445,37.083],[40.861,41.45],[44.919,45.525],[49.183,49.727],[53.255,53.731],[57.694,58.205],[61.815,62.386],[65.948,66.544],[70.073,70.747],[74.438,74.992],[78.896,79.394],[83.34,83.904],[87.742,88.488],[92.241,92.928],[96.312,97.08],[100.745,101.254],[105.08,105.826],[109.242,110.36]];
const wordRanges: [number, number][] = [[0,1.032],[3.658,4.344],[6.929,7.576],[10.026,10.702],[13.344,13.885],[16.284,17.043],[19.344,19.912],[22.175,22.796],[25.389,26.026],[28.366,29.034],[31.296,31.91],[34.229,35.06],[37.292,38.001],[40.331,41.229],[43.465,44.256],[46.449,47.012],[49.373,50.065],[52.267,53.068],[55.253,55.932],[58.229,58.858],[61.223,62.049],[64.27,65],[67.221,67.964],[70.164,70.832],[73.121,73.871],[76.063,77.12]];
const sentencesOneRanges: [number, number][] = [[0,1.094],[3.855,5.09],[7.794,8.788],[11.437,12.632],[15.309,17.422],[20.231,21.672],[24.432,26.213],[28.949,30.315],[33.018,33.876],[36.524,37.295],[40.002,41.156],[43.904,44.984],[47.657,48.856],[51.521,52.836],[55.542,56.796],[59.484,60.788],[63.48,65.23],[67.909,69.614],[72.244,74.516],[77.257,78.744],[81.424,83.309],[85.99,87.673],[90.364,92.255],[94.926,96.543],[99.217,101.28]];
const sentencesTwoRanges: [number, number][] = [[0,2.011],[3.885,5.513],[7.515,8.966],[10.895,12.854],[14.692,16.844],[18.679,20.23],[22.008,23.885],[25.488,27.389],[28.92,30.919],[32.697,34.957],[36.608,38.464],[40.053,41.708],[43.371,44.674],[46.186,47.705],[49.252,51.024],[52.574,54.684],[56.233,57.877],[59.533,61.173],[62.51,63.643],[65.095,66.603],[68.067,69.434],[70.898,72.402],[73.769,75.013],[76.23,78.865],[80.166,82.12]];

function cue(src: string, [start, end]: [number, number]): AudioCue {
  return { src, start, end };
}

export function getEmbeddedAudioCue(type: "letter" | "word" | "sentence", index: number): AudioCue | null {
  if (type === "letter") return letterRanges[index] ? cue(lettersSrc, letterRanges[index]) : null;
  if (type === "word") return wordRanges[index] ? cue(wordsSrc, wordRanges[index]) : null;
  if (index < 25) return sentencesOneRanges[index] ? cue(sentencesOneSrc, sentencesOneRanges[index]) : null;
  const secondIndex = index - 25;
  return sentencesTwoRanges[secondIndex] ? cue(sentencesTwoSrc, sentencesTwoRanges[secondIndex]) : null;
}
