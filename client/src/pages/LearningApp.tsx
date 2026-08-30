/*
  Design reminder — “حكاية الورق الملوّن”: a warm editorial children's workbook.
  Keep every interaction simple, tactile, encouraging, and anchored by Emerald Leaf #147D6D.
*/
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Flame,
  Gamepad2,
  Headphones,
  Leaf,
  ListChecks,
  Menu,
  Mic,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Trophy,
  Volume2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { withBase, withAssetV } from "@/lib/base";
import { getEmbeddedAudioCue, type AudioCue } from "@/lib/embeddedAudio";
import { isSmartEngineReady, loadSmartEngine, transcribeRecording } from "@/lib/whisperEngine";
import { assessRecording, clearParentAzureConfig, clearParentGroqKey, getParentAzureConfig, getParentGroqKey, probeServerAssessment, resolveAzureCredentials, saveParentAzureConfig, saveParentGroqKey, serverAssessRecording } from "@/lib/pronEngine";
import { Link, useLocation } from "wouter";

type Mode = "letters" | "sentences";
type SentenceCategory = "الكل" | "التحية" | "اللباقة" | "البيت" | "المشاعر" | "اللعب" | "التعلّم";
type GameMode = "listen" | "match" | "sentence";
type PronunciationPhase = "ready" | "listening" | "review" | "retry" | "success" | "unavailable";
type ProEngineStatus = "checking" | "ready" | "unavailable";
type CelebrationTheme = "quiz" | "speech" | GameMode;
type LearningPage = "letters" | "sentences" | "games" | "progress";
type SpeechRecognitionResultLike = { transcript: string; confidence?: number };
type SpeechRecognitionResultListLike = ArrayLike<SpeechRecognitionResultLike> & { isFinal?: boolean };
type SpeechRecognitionEventLike = { results: ArrayLike<SpeechRecognitionResultListLike> };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type VoiceSessionDecision = { match: number; transcript: string };
type ProAssessmentOutcome = { match: number; transcript: string };
type VoiceSessionFailReason = "quiet" | "mismatch";
type VoiceSessionConfig = {
  minMs: number;
  maxMs: number;
  successThreshold: number;
  evaluate: (candidates: string[]) => VoiceSessionDecision;
  onStartListening: () => void;
  onTick: (secondsLeft: number, progressPercent: number) => void;
  onInterim: (decision: VoiceSessionDecision) => void;
  onSuccess: (decision: VoiceSessionDecision) => void;
  onFail: (decision: VoiceSessionDecision, reason: VoiceSessionFailReason) => void;
  onDenied: () => void;
  /** Called before a Whisper double-check of the recorded audio (may take a moment). */
  onRescueStart?: () => void;
  /** Called when no Web Speech API exists and the smart engine could not be prepared. */
  onEngineMissing?: () => void;
};

type LetterLesson = {
  letter: string;
  lower: string;
  sound: string;
  ipa: string;
  word: string;
  wordAr: string;
  hint: string;
};

type SentenceLesson = {
  id: number;
  english: string;
  arabic: string;
  category: Exclude<SentenceCategory, "الكل">;
};

const letters: LetterLesson[] = [
  { letter: "A", lower: "a", sound: "aah", ipa: "/æ/", word: "apple", wordAr: "تفاحة", hint: "آه" },
  { letter: "B", lower: "b", sound: "buh", ipa: "/b/", word: "ball", wordAr: "كرة", hint: "بُه" },
  { letter: "C", lower: "c", sound: "kuh", ipa: "/k/", word: "cat", wordAr: "قطة", hint: "كُه" },
  { letter: "D", lower: "d", sound: "duh", ipa: "/d/", word: "dog", wordAr: "كلب", hint: "دُه" },
  { letter: "E", lower: "e", sound: "eh", ipa: "/e/", word: "egg", wordAr: "بيضة", hint: "إِه" },
  { letter: "F", lower: "f", sound: "fuh", ipa: "/f/", word: "fish", wordAr: "سمكة", hint: "فُه" },
  { letter: "G", lower: "g", sound: "guh", ipa: "/ɡ/", word: "goat", wordAr: "ماعز", hint: "گُه" },
  { letter: "H", lower: "h", sound: "huh", ipa: "/h/", word: "hat", wordAr: "قبعة", hint: "هُه" },
  { letter: "I", lower: "i", sound: "ih", ipa: "/ɪ/", word: "ice", wordAr: "ثلج", hint: "إِيه قصيرة" },
  { letter: "J", lower: "j", sound: "juh", ipa: "/dʒ/", word: "juice", wordAr: "عصير", hint: "جُه" },
  { letter: "K", lower: "k", sound: "kuh", ipa: "/k/", word: "kite", wordAr: "طائرة ورقية", hint: "كُه" },
  { letter: "L", lower: "l", sound: "luh", ipa: "/l/", word: "lion", wordAr: "أسد", hint: "لُه" },
  { letter: "M", lower: "m", sound: "muh", ipa: "/m/", word: "moon", wordAr: "قمر", hint: "مُه" },
  { letter: "N", lower: "n", sound: "nuh", ipa: "/n/", word: "nose", wordAr: "أنف", hint: "نُه" },
  { letter: "O", lower: "o", sound: "awe", ipa: "/ɒ/", word: "orange", wordAr: "برتقالة", hint: "أُه" },
  { letter: "P", lower: "p", sound: "puh", ipa: "/p/", word: "pig", wordAr: "خنزير", hint: "پُه" },
  { letter: "Q", lower: "q", sound: "kwuh", ipa: "/kw/", word: "queen", wordAr: "ملكة", hint: "كْوُه" },
  { letter: "R", lower: "r", sound: "ruh", ipa: "/r/", word: "rabbit", wordAr: "أرنب", hint: "رُه" },
  { letter: "S", lower: "s", sound: "suh", ipa: "/s/", word: "sun", wordAr: "شمس", hint: "سُه" },
  { letter: "T", lower: "t", sound: "tuh", ipa: "/t/", word: "tree", wordAr: "شجرة", hint: "تُه" },
  { letter: "U", lower: "u", sound: "uh", ipa: "/ʌ/", word: "umbrella", wordAr: "مظلة", hint: "أَه" },
  { letter: "V", lower: "v", sound: "vuh", ipa: "/v/", word: "van", wordAr: "شاحنة", hint: "ڤُه" },
  { letter: "W", lower: "w", sound: "wuh", ipa: "/w/", word: "water", wordAr: "ماء", hint: "وُه" },
  { letter: "X", lower: "x", sound: "ks", ipa: "/ks/", word: "box", wordAr: "صندوق", hint: "كْس" },
  { letter: "Y", lower: "y", sound: "yuh", ipa: "/j/", word: "yellow", wordAr: "أصفر", hint: "يُه" },
  { letter: "Z", lower: "z", sound: "zuh", ipa: "/z/", word: "zebra", wordAr: "حمار وحشي", hint: "زُه" },
];

const sentences: SentenceLesson[] = [
  { id: 1, english: "Hello!", arabic: "مرحبًا!", category: "التحية" },
  { id: 2, english: "Good morning.", arabic: "صباح الخير.", category: "التحية" },
  { id: 3, english: "Good night.", arabic: "تصبح على خير.", category: "التحية" },
  { id: 4, english: "How are you?", arabic: "كيف حالك؟", category: "التحية" },
  { id: 5, english: "I'm fine, thank you.", arabic: "أنا بخير، شكرًا لك.", category: "التحية" },
  { id: 6, english: "What's your name?", arabic: "ما اسمك؟", category: "التحية" },
  { id: 7, english: "My name is ...", arabic: "اسمي ...", category: "التحية" },
  { id: 8, english: "Nice to meet you.", arabic: "سعيد بلقائك.", category: "التحية" },
  { id: 9, english: "Please.", arabic: "من فضلك.", category: "اللباقة" },
  { id: 10, english: "Thank you.", arabic: "شكرًا لك.", category: "اللباقة" },
  { id: 11, english: "You're welcome.", arabic: "على الرحب والسعة.", category: "اللباقة" },
  { id: 12, english: "Excuse me.", arabic: "عذرًا.", category: "اللباقة" },
  { id: 13, english: "I'm sorry.", arabic: "أنا آسف.", category: "اللباقة" },
  { id: 14, english: "Yes, please.", arabic: "نعم، من فضلك.", category: "اللباقة" },
  { id: 15, english: "No, thank you.", arabic: "لا، شكرًا.", category: "اللباقة" },
  { id: 16, english: "Can you help me?", arabic: "هل يمكنك مساعدتي؟", category: "التعلّم" },
  { id: 17, english: "I don't understand.", arabic: "أنا لا أفهم.", category: "التعلّم" },
  { id: 18, english: "Please say it again.", arabic: "من فضلك قلها مرة أخرى.", category: "التعلّم" },
  { id: 19, english: "Speak slowly, please.", arabic: "تكلّم ببطء، من فضلك.", category: "التعلّم" },
  { id: 20, english: "What is this?", arabic: "ما هذا؟", category: "التعلّم" },
  { id: 21, english: "This is my book.", arabic: "هذا كتابي.", category: "التعلّم" },
  { id: 22, english: "I like apples.", arabic: "أنا أحب التفاح.", category: "المشاعر" },
  { id: 23, english: "I don't like milk.", arabic: "أنا لا أحب الحليب.", category: "المشاعر" },
  { id: 24, english: "I am hungry.", arabic: "أنا جائع.", category: "المشاعر" },
  { id: 25, english: "I am thirsty.", arabic: "أنا عطشان.", category: "المشاعر" },
  { id: 26, english: "Let's play!", arabic: "هيا نلعب!", category: "اللعب" },
  { id: 27, english: "Come with me.", arabic: "تعال معي.", category: "اللعب" },
  { id: 28, english: "Wait a minute.", arabic: "انتظر دقيقة.", category: "اللعب" },
  { id: 29, english: "Look at this!", arabic: "انظر إلى هذا!", category: "اللعب" },
  { id: 30, english: "Listen carefully.", arabic: "استمع بعناية.", category: "التعلّم" },
  { id: 31, english: "Open the door.", arabic: "افتح الباب.", category: "البيت" },
  { id: 32, english: "Close the window.", arabic: "أغلق النافذة.", category: "البيت" },
  { id: 33, english: "Sit down, please.", arabic: "اجلس، من فضلك.", category: "التعلّم" },
  { id: 34, english: "Stand up, please.", arabic: "قف، من فضلك.", category: "التعلّم" },
  { id: 35, english: "Wash your hands.", arabic: "اغسل يديك.", category: "البيت" },
  { id: 36, english: "Brush your teeth.", arabic: "نظّف أسنانك.", category: "البيت" },
  { id: 37, english: "I am ready.", arabic: "أنا مستعد.", category: "المشاعر" },
  { id: 38, english: "Let's go!", arabic: "هيا بنا!", category: "اللعب" },
  { id: 39, english: "See you soon.", arabic: "أراك قريبًا.", category: "التحية" },
  { id: 40, english: "See you tomorrow.", arabic: "أراك غدًا.", category: "التحية" },
  { id: 41, english: "Have a nice day.", arabic: "أتمنى لك يومًا سعيدًا.", category: "التحية" },
  { id: 42, english: "What time is it?", arabic: "كم الساعة؟", category: "التعلّم" },
  { id: 43, english: "It's my turn.", arabic: "حان دوري.", category: "اللعب" },
  { id: 44, english: "Your turn!", arabic: "دورك!", category: "اللعب" },
  { id: 45, english: "I can do it.", arabic: "أستطيع فعلها.", category: "المشاعر" },
  { id: 46, english: "Try again.", arabic: "حاول مرة أخرى.", category: "التعلّم" },
  { id: 47, english: "Great job!", arabic: "عمل رائع!", category: "التعلّم" },
  { id: 48, english: "Well done!", arabic: "أحسنت!", category: "التعلّم" },
  { id: 49, english: "I love learning English.", arabic: "أحب تعلّم الإنجليزية.", category: "التعلّم" },
  { id: 50, english: "English is fun!", arabic: "الإنجليزية ممتعة!", category: "التعلّم" },
];

const categories: SentenceCategory[] = ["الكل", "التحية", "اللباقة", "البيت", "المشاعر", "اللعب", "التعلّم"];
const heroImage = withBase(withAssetV("/img/hero-paper.jpg"));
const lettersImage = withBase(withAssetV("/img/letters-paper.jpg"));
const sentencesImage = withBase(withAssetV("/img/sentences-paper.jpg"));
const mascotImage = withBase(withAssetV("/img/mascot-logo.png"));
const logoImage = withBase(withAssetV("/img/mascot-logo.png"));
const sentencePuzzles = [
  { arabic: "صباح الخير.", words: ["Good", "morning."], sentenceIndex: 1 },
  { arabic: "كيف حالك؟", words: ["How", "are", "you?"], sentenceIndex: 3 },
  { arabic: "شكرًا لك.", words: ["Thank", "you."], sentenceIndex: 9 },
  { arabic: "هيا نلعب!", words: ["Let's", "play!"], sentenceIndex: 25 },
  { arabic: "أنا مستعد.", words: ["I", "am", "ready."], sentenceIndex: 36 },
];

// Listening session timings: kids need enough time to breathe, start speaking, and repeat once.
const WORD_LISTEN = { minMs: 2000, maxMs: 9000, threshold: 0.8 };
const SENTENCE_LISTEN = { minMs: 3000, maxMs: 13000, threshold: 0.76 };
// Cloud-engine pass thresholds mapped to 0-1. Kids' apps grade generously —
// a clear attempt passes, mumbling does not. (Groq Whisper transcripts are
// accurate; sentences allow partial word coverage.)
const SERVER_WORD = { threshold: 0.78 };
const SERVER_SENTENCE = { threshold: 0.62 };
const LISTEN_GRACE_MS = 3200;
const LISTEN_MAX_RESTARTS = 4;

function shuffleChoices<T>(choices: T[]): T[] {
  const shuffled = [...choices];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

const CONTRACTION_MAP: Record<string, string> = {
  "i'm": "i am", "don't": "do not", "can't": "can not", "won't": "will not",
  "it's": "it is", "what's": "what is", "that's": "that is", "there's": "there is",
  "let's": "let us", "you're": "you are", "we're": "we are", "they're": "they are",
  "he's": "he is", "she's": "she is", "i'll": "i will", "you'll": "you will",
  "we'll": "we will", "isn't": "is not", "aren't": "are not", "doesn't": "does not",
  "didn't": "did not", "i'd": "i would", "you'd": "you would", "he'll": "he will",
};
const ARTICLE_WORDS = new Set(["a", "an", "the", "uh", "um", "eh"]);

function normalizeSpokenEnglish(value: string) {
  const cleaned = value.toLowerCase().replace(/[^a-z\s']/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.split(" ").map((word) => CONTRACTION_MAP[word] ?? word).join(" ").replace(/\s+/g, " ").trim();
}

function levenshteinSimilarity(source: string, target: string) {
  if (!source || !target) return 0;
  if (source === target) return 1;
  const rows = target.length + 1;
  const columns = source.length + 1;
  const matrix = Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => row === 0 ? column : column === 0 ? row : 0));
  for (let row = 1; row < rows; row += 1) for (let column = 1; column < columns; column += 1) matrix[row][column] = Math.min(matrix[row - 1][column] + 1, matrix[row][column - 1] + 1, matrix[row - 1][column - 1] + (target[row - 1] === source[column - 1] ? 0 : 1));
  return 1 - matrix[rows - 1][columns - 1] / Math.max(target.length, source.length);
}

function singularize(word: string) {
  return word.length > 3 ? word.replace(/'s$/, "").replace(/s$/, "") : word;
}

function wordSimilarity(spoken: string, expected: string) {
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
  // Noisy kid transcripts add filler words; credit the best single spoken word too.
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

function sentenceSimilarity(spoken: string, expected: string) {
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

function listenSecondsLabel(seconds: number) {
  if (seconds <= 1) return "عندك ثانية واحدة";
  if (seconds === 2) return "عندك ثانيتين";
  return `عندك ${seconds} ثوانٍ`;
}

export default function LearningApp({ page }: { page: LearningPage }) {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<Mode>("letters");
  const [activeLetterIndex, setActiveLetterIndex] = useState(0);
  const [completedLetters, setCompletedLetters] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("ekq-letters") ?? "[]"));
    } catch {
      return new Set();
    }
  });
  const [completedSentences, setCompletedSentences] = useState<Set<number>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("ekq-sentences") ?? "[]"));
    } catch {
      return new Set();
    }
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechNotice, setSpeechNotice] = useState("");
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);
  const [quizRound, setQuizRound] = useState(0);
  const [sentenceCategory, setSentenceCategory] = useState<SentenceCategory>("الكل");
  const [sentenceSearch, setSentenceSearch] = useState("");
  const [sentencePage, setSentencePage] = useState(1);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeGame, setActiveGame] = useState<GameMode>("listen");
  const [gameStars, setGameStars] = useState(() => {
    try {
      return Number(localStorage.getItem("ekq-game-stars") ?? "0");
    } catch {
      return 0;
    }
  });
  const [gameWins, setGameWins] = useState(() => {
    try {
      return Number(localStorage.getItem("ekq-game-wins") ?? "0");
    } catch {
      return 0;
    }
  });
  const [listenTargetIndex, setListenTargetIndex] = useState(0);
  const [listenSelected, setListenSelected] = useState<number | null>(null);
  const [listenSolved, setListenSolved] = useState(false);
  const [listenRound, setListenRound] = useState(0);
  const [matchTargetIndex, setMatchTargetIndex] = useState(3);
  const [matchSelected, setMatchSelected] = useState<number | null>(null);
  const [matchSolved, setMatchSolved] = useState(false);
  const [matchRound, setMatchRound] = useState(0);
  const [sentencePuzzleIndex, setSentencePuzzleIndex] = useState(0);
  const [placedSentenceWords, setPlacedSentenceWords] = useState<string[]>([]);
  const [sentenceSolved, setSentenceSolved] = useState(false);
  const [sentenceRound, setSentenceRound] = useState(0);
  const [gameFeedback, setGameFeedback] = useState("");
  const [celebrationKey, setCelebrationKey] = useState(0);
  const [celebrationAmount, setCelebrationAmount] = useState(0);
  const [celebrationTheme, setCelebrationTheme] = useState<CelebrationTheme>("quiz");
  const [wrongPulse, setWrongPulse] = useState(0);
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState<boolean | null>(null);
  const [isChildSpeaking, setIsChildSpeaking] = useState(false);
  const [pronunciationFeedback, setPronunciationFeedback] = useState("");
  const [pronunciationHeard, setPronunciationHeard] = useState("");
  const [pronunciationMatch, setPronunciationMatch] = useState<number | null>(null);
  const [pronunciationPhase, setPronunciationPhase] = useState<PronunciationPhase>("ready");
  const [pronunciationAttempts, setPronunciationAttempts] = useState(0);
  const [hasHeardModel, setHasHeardModel] = useState(false);
  const [sentencePractice, setSentencePractice] = useState({ id: null as number | null, phase: "ready" as PronunciationPhase, heard: "", match: null as number | null, feedback: "", attempts: 0, hasHeardModel: false });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingUrlRef = useRef<string | null>(null);
  const recordingBlobRef = useRef<Blob | null>(null);
  const recordingStopResolveRef = useRef<((blob: Blob | null) => void) | null>(null);
  const smartEngineLoadRef = useRef<Promise<boolean> | null>(null);
  const sessionCleanupRef = useRef<(() => void) | null>(null);
  const [lastRecordingUrl, setLastRecordingUrl] = useState<string | null>(null);
  const [listenSecondsLeft, setListenSecondsLeft] = useState<number | null>(null);
  const [listenProgress, setListenProgress] = useState(0);
  const [smartEngineStatus, setSmartEngineStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [smartEngineProgress, setSmartEngineProgress] = useState(0);
  const [proEngineStatus, setProEngineStatus] = useState<ProEngineStatus>("checking");
  const [serverEngineReady, setServerEngineReady] = useState(false);
  const [azureEngineReady, setAzureEngineReady] = useState(false);
  const [groqKeyInput, setGroqKeyInput] = useState("");
  const [engineSettingsOpen, setEngineSettingsOpen] = useState(false);
  const [azureKeyInput, setAzureKeyInput] = useState("");
  const [azureRegionInput, setAzureRegionInput] = useState("");
  const [engineSettingsNotice, setEngineSettingsNotice] = useState("");

  const activeLetter = letters[activeLetterIndex];
  const filteredSentences = useMemo(() => {
    const query = sentenceSearch.trim().toLowerCase();
    return sentences.filter((sentence) => {
      const matchesCategory = sentenceCategory === "الكل" || sentence.category === sentenceCategory;
      const matchesQuery = !query || `${sentence.english} ${sentence.arabic}`.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [sentenceCategory, sentenceSearch]);
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filteredSentences.length / pageSize));
  const visibleSentences = filteredSentences.slice((sentencePage - 1) * pageSize, sentencePage * pageSize);
  const progressCount = completedLetters.size + completedSentences.size;
  const progress = Math.round((progressCount / (letters.length + sentences.length)) * 100);
  const stars = Math.min(99, completedLetters.size + completedSentences.size * 2 + gameStars);
  const nextLetter = letters.find((letter) => !completedLetters.has(letter.letter));
  const nextSentence = sentences.find((sentence) => !completedSentences.has(sentence.id));
  const nextStep = nextLetter
    ? { href: "/letters", label: "حرف جديد", title: `${nextLetter.letter} مثل ${nextLetter.word}`, detail: "استمع للحرف، ثم قل كلمة المثال." }
    : nextSentence
      ? { href: "/sentences", label: "جملة جديدة", title: nextSentence.english, detail: nextSentence.arabic }
      : { href: "/games", label: "تحدٍّ جديد", title: "أكملت الدروس كلها!", detail: "اختر لعبة قصيرة واجمع نجومًا إضافية." };
  const quizOptions = useMemo(() => {
    const options = [activeLetter.word, letters[(activeLetterIndex + 3) % letters.length].word, letters[(activeLetterIndex + 8) % letters.length].word];
    return shuffleChoices(options);
  }, [activeLetter, activeLetterIndex, quizRound]);
  const listenOptions = useMemo(() => shuffleChoices([listenTargetIndex, (listenTargetIndex + 5) % letters.length, (listenTargetIndex + 11) % letters.length]), [listenTargetIndex, listenRound]);
  const matchOptions = useMemo(() => shuffleChoices([matchTargetIndex, (matchTargetIndex + 7) % letters.length, (matchTargetIndex + 14) % letters.length]), [matchTargetIndex, matchRound]);
  const activeSentencePuzzle = sentencePuzzles[sentencePuzzleIndex];
  const sentenceWordBank = useMemo(() => shuffleChoices(activeSentencePuzzle.words), [activeSentencePuzzle, sentenceRound]);
  const currentGameRound = activeGame === "listen" ? listenRound : activeGame === "match" ? matchRound : sentenceRound;

  useEffect(() => {
    if (page === "letters") setMode("letters");
    if (page === "sentences") setMode("sentences");
  }, [page]);

  useEffect(() => {
    localStorage.setItem("ekq-letters", JSON.stringify(Array.from(completedLetters)));
  }, [completedLetters]);

  useEffect(() => {
    localStorage.setItem("ekq-sentences", JSON.stringify(Array.from(completedSentences)));
  }, [completedSentences]);

  useEffect(() => {
    localStorage.setItem("ekq-game-stars", String(gameStars));
    localStorage.setItem("ekq-game-wins", String(gameWins));
  }, [gameStars, gameWins]);

  useEffect(() => {
    if (sentencePage > totalPages) setSentencePage(totalPages);
  }, [sentencePage, totalPages]);

  useEffect(() => () => {
    sessionCleanupRef.current?.();
    audioRef.current?.pause();
    recognitionRef.current?.abort();
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") recorder.stop();
    recorderRef.current = null;
  }, []);

  useEffect(() => {
    const browserWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    setSpeechRecognitionSupported(Boolean(browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition));
  }, []);

  // Probe the professional engines once on open: the free Groq Whisper server
  // endpoint and/or an Azure parent key. Pure credentials checks — zero downloads.
  useEffect(() => {
    let cancelled = false;
    void Promise.all([probeServerAssessment(), resolveAzureCredentials()]).then(([serverOk, azure]) => {
      if (cancelled) return;
      setServerEngineReady(serverOk);
      setAzureEngineReady(Boolean(azure));
      setProEngineStatus(serverOk || azure ? "ready" : "unavailable");
    });
    return () => { cancelled = true; };
  }, []);

  // If the on-device engine was enabled on a previous visit, restore it from the
  // browser cache (no new download). Fresh visitors are never auto-downloaded.
  useEffect(() => {
    try {
      if (localStorage.getItem("ekq-smart-engine") !== "ready") return;
    } catch {
      return;
    }
    if (isSmartEngineReady()) {
      setSmartEngineStatus("ready");
      return;
    }
    void Promise.all([probeServerAssessment(), resolveAzureCredentials()]).then(([serverOk, azure]) => {
      if (serverOk || azure) return; // a professional engine covers evaluation
      void ensureSmartEngine();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playEmbeddedAudio = (cue: AudioCue | null) => {
    setSpeechNotice("");
    audioRef.current?.pause();
    if (navigator.vibrate) navigator.vibrate(8);
    if (!cue) {
      setSpeechNotice("ملف الصوت لهذا الدرس غير متاح حاليًا.");
      return;
    }

    const audio = new Audio(cue.src);
    audio.preload = "auto";
    audio.volume = 1;
    audioRef.current = audio;
    const stop = () => {
      audio.pause();
      setIsSpeaking(false);
      setSpeechNotice("");
    };
    audio.onplay = () => {
      setIsSpeaking(true);
      setSpeechNotice("جاري النطق بالإنجليزية...");
    };
    audio.onended = stop;
    audio.onerror = () => {
      setIsSpeaking(false);
      setSpeechNotice("تعذر تشغيل ملف الصوت. أعد تحميل الصفحة ثم حاول مرة أخرى.");
    };
    audio.play().catch(() => {
      setIsSpeaking(false);
      setSpeechNotice("تعذر بدء الصوت. اضغط زر الاستماع مرة أخرى.");
    });
  };

  const toggleLetterComplete = (letter: string) => {
    setCompletedLetters((current) => {
      const next = new Set(current);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });
  };

  const toggleSentenceComplete = (id: number) => {
    setCompletedSentences((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectCategory = (category: SentenceCategory) => {
    setSentenceCategory(category);
    setSentencePage(1);
  };

  const updateSentencePractice = (id: number, patch: Partial<typeof sentencePractice>) => {
    setSentencePractice((current) => current.id === id ? { ...current, ...patch } : { id, phase: "ready", heard: "", match: null, feedback: "", attempts: 0, hasHeardModel: false, ...patch });
  };

  const selectLetter = (index: number) => {
    setActiveLetterIndex(index);
    setQuizAnswer(null);
    setQuizRound((current) => current + 1);
    setPronunciationFeedback("");
    setPronunciationHeard("");
    setPronunciationMatch(null);
    setPronunciationPhase("ready");
    setPronunciationAttempts(0);
    setHasHeardModel(false);
  };

  const playSuccessChime = () => {
    try {
      const context = new window.AudioContext();
      const now = context.currentTime;
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, now + index * 0.1);
        gain.gain.setValueAtTime(0.0001, now + index * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.13, now + index * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.1 + 0.34);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(now + index * 0.1);
        oscillator.stop(now + index * 0.1 + 0.36);
      });
      window.setTimeout(() => context.close(), 720);
    } catch {
      // Audio is an optional enhancement; rewards remain fully usable if a browser blocks it.
    }
  };

  const launchCelebration = (amount = 0, theme: CelebrationTheme = "quiz") => {
    setCelebrationAmount(amount);
    setCelebrationTheme(theme);
    setCelebrationKey(Date.now());
    playSuccessChime();
    if (navigator.vibrate) navigator.vibrate([18, 24, 42]);
  };

  const giveReward = (amount: number, message: string, theme: CelebrationTheme) => {
    setGameStars((current) => current + amount);
    setGameWins((current) => current + 1);
    setGameFeedback(message);
    launchCelebration(amount, theme);
  };

  const awardPracticeStar = (message: string, theme: CelebrationTheme = "quiz") => {
    setGameStars((current) => current + 1);
    setGameFeedback(message);
    launchCelebration(1, theme);
  };

  const chooseQuizAnswer = (option: string) => {
    const wasCorrect = quizAnswer === activeLetter.word;
    setQuizAnswer(option);
    if (option === activeLetter.word && !wasCorrect) awardPracticeStar("أحسنت! حصلت على نجمة لأنك اخترت الكلمة الصحيحة.");
    if (option !== activeLetter.word) setWrongPulse(Date.now());
  };

  const playPracticeModel = () => {
    setHasHeardModel(true);
    if (pronunciationPhase === "retry") setPronunciationFeedback("اسمع الكلمة مرة أخرى، ثم جرّبها ببطء.");
    playEmbeddedAudio(getEmbeddedAudioCue("word", activeLetterIndex));
  };

  const ensureSmartEngine = () => {
    if (isSmartEngineReady()) {
      setSmartEngineStatus("ready");
      return Promise.resolve(true);
    }
    if (smartEngineLoadRef.current) return smartEngineLoadRef.current;
    setSmartEngineStatus("loading");
    setSmartEngineProgress(0);
    const promise = loadSmartEngine((percent) => setSmartEngineProgress(percent))
      .then((ready) => {
        if (ready) {
          setSmartEngineStatus("ready");
          setSmartEngineProgress(100);
          try { localStorage.setItem("ekq-smart-engine", "ready"); } catch { /* private mode */ }
        } else {
          setSmartEngineStatus("error");
          smartEngineLoadRef.current = null;
        }
        return ready;
      })
      .catch(() => {
        setSmartEngineStatus("error");
        smartEngineLoadRef.current = null;
        return false;
      });
    smartEngineLoadRef.current = promise;
    return promise;
  };

  const enableSmartEngine = () => {
    void ensureSmartEngine();
  };

  const openEngineSettings = () => {
    const parent = getParentAzureConfig();
    setAzureKeyInput(parent?.key ?? "");
    setAzureRegionInput(parent?.region ?? "");
    setGroqKeyInput(getParentGroqKey() ?? "");
    setEngineSettingsNotice("");
    setEngineSettingsOpen(true);
  };

  // Engine banner: which judging engine is active, with one-tap enablement.
  // The free professional engine (Groq Whisper) is promoted first — zero downloads.
  const engineBanner = proEngineStatus === "ready" ? (
    <div className="engine-banner ready"><Sparkles size={13} /> المحرك الاحترافي يعمل — تقييم دقيق لكل صوت وكلمة بدون أي تنزيل<button className="engine-link" onClick={openEngineSettings}>الإعدادات</button></div>
  ) : smartEngineStatus === "ready" ? (
    <div className="engine-banner ready"><Sparkles size={13} /> المحرك الذكي داخل الجهاز جاهز — يقيّم نطق الطفل حتى بدون إنترنت</div>
  ) : smartEngineStatus === "loading" ? (
    <div className="engine-banner"><span>جاري تنزيل المحرك الذكي… {Math.round(smartEngineProgress)}٪</span><div className="engine-progress"><span style={{ width: `${smartEngineProgress}%` }} /></div><small>اختياري — مرة واحدة فقط (~45 م.ب) — بعد ذلك يعمل بدون إنترنت</small></div>
  ) : (
    <div className="engine-banner enable"><Sparkles size={13} /><button className="engine-link" onClick={openEngineSettings}>{smartEngineStatus === "error" ? "تعذر المحرك الذكي — فعّل المحرك الاحترافي المجاني بدون أي تنزيل" : "فعّل المحرك الاحترافي مجانًا بدون بطاقة: تقييم أدق لكل صوت — بدون تنزيل أي ملفات"}</button><button className="engine-link subtle" onClick={enableSmartEngine}>أو فعّل المحرك الذكي داخل الجهاز (~45 م.ب)</button></div>
  );

  const startVoiceRecording = () => new Promise<boolean>((resolve) => {
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        resolve(false);
        return;
      }
      // Browser audio processing ON: kids practice in real homes, not studios.
      navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      }).then((stream) => {
        try {
          const chunks: Blob[] = [];
          const recorder = new MediaRecorder(stream);
          recorder.ondataavailable = (event) => { if (event.data.size > 0) chunks.push(event.data); };
          recordingBlobRef.current = null;
          recorder.onstop = () => {
            stream.getTracks().forEach((track) => track.stop());
            let blob: Blob | null = null;
            if (chunks.length > 0) {
              const built = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
              if (built.size) {
                blob = built;
                recordingBlobRef.current = built;
                if (recordingUrlRef.current) URL.revokeObjectURL(recordingUrlRef.current);
                const url = URL.createObjectURL(built);
                recordingUrlRef.current = url;
                setLastRecordingUrl(url);
              }
            }
            recordingStopResolveRef.current?.(blob);
            recordingStopResolveRef.current = null;
          };
          recorderRef.current = recorder;
          recorder.start();
          resolve(true);
        } catch {
          stream.getTracks().forEach((track) => track.stop());
          resolve(false);
        }
      }).catch(() => resolve(false));
    } catch {
      // Recording is optional; evaluation via speech recognition still works without it.
      resolve(false);
    }
  });

  /** Stop the recorder and resolve with the complete recording blob (null if none). */
  const stopVoiceRecording = () => new Promise<Blob | null>((resolve) => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (!recorder || recorder.state !== "recording") {
      resolve(recordingBlobRef.current);
      return;
    }
    recordingStopResolveRef.current = resolve;
    try {
      recorder.stop();
    } catch {
      recordingStopResolveRef.current = null;
      resolve(recordingBlobRef.current);
    }
  });

  const playChildRecording = () => {
    if (!lastRecordingUrl) return;
    audioRef.current?.pause();
    const audio = new Audio(lastRecordingUrl);
    audioRef.current = audio;
    audio.play().catch(() => undefined);
  };

  /**
   * Recording-only session for browsers without the Web Speech API
   * (Firefox, iOS Safari): capture the child's voice for the full window,
   * then let the smart engine (Whisper, on-device) judge it.
   */
  const runRecordingOnlySession = async (config: VoiceSessionConfig) => {
    const engineReady = await ensureSmartEngine();
    if (!engineReady) {
      config.onEngineMissing?.();
      return;
    }
    audioRef.current?.pause();
    recognitionRef.current?.abort();
    setIsChildSpeaking(true);
    const startedAt = Date.now();
    const stopAt = startedAt + config.maxMs;
    let disposed = false;
    sessionCleanupRef.current = () => { disposed = true; };
    const started = await startVoiceRecording();
    if (disposed) {
      await stopVoiceRecording();
      return;
    }
    if (!started) {
      config.onDenied();
      return;
    }
    config.onStartListening();
    await new Promise<void>((resolve) => {
      const intervalId = window.setInterval(() => {
        if (disposed) {
          window.clearInterval(intervalId);
          resolve();
          return;
        }
        const secondsLeft = Math.max(0, Math.ceil((stopAt - Date.now()) / 1000));
        config.onTick(secondsLeft, Math.min(100, ((Date.now() - startedAt) / config.maxMs) * 100));
        if (Date.now() >= stopAt) {
          window.clearInterval(intervalId);
          resolve();
        }
      }, 200);
    });
    if (disposed) {
      await stopVoiceRecording();
      setIsChildSpeaking(false);
      setListenSecondsLeft(null);
      return;
    }
    sessionCleanupRef.current = null;
    setIsChildSpeaking(false);
    setListenSecondsLeft(null);
    config.onRescueStart?.();
    const blob = await stopVoiceRecording();
    let decision: VoiceSessionDecision = { match: 0, transcript: "" };
    if (blob && blob.size) {
      const transcript = await transcribeRecording(blob);
      if (transcript) decision = config.evaluate([transcript]);
    }
    if (decision.match >= config.successThreshold) config.onSuccess(decision);
    else config.onFail(decision, decision.transcript ? "mismatch" : "quiet");
  };

  /**
   * One robust listening session shared by word and sentence practice.
   * Fixes the old behavior that stopped at the first (often noisy) final result:
   * - continuous listening for the whole window, with a guaranteed minimum time
   * - accumulates EVERY final result + alternative across engine restarts
   * - stops early only on a strong match; otherwise gives the child the full window
   * - live countdown + progress so kids know how long they have
   */
  const runVoiceSession = async (config: VoiceSessionConfig) => {
    const browserWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const Recognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      await runRecordingOnlySession(config);
      return;
    }
    audioRef.current?.pause();
    recognitionRef.current?.abort();
    setIsChildSpeaking(true);
    let disposed = false;
    sessionCleanupRef.current = () => { disposed = true; };
    await startVoiceRecording();
    if (disposed) {
      stopVoiceRecording();
      return;
    }

    const startedAt = Date.now();
    const minAt = startedAt + config.minMs;
    const stopAt = startedAt + config.maxMs;
    let evaluated = false;
    let restarts = 0;
    let lastError = "";
    let lastResultCount = 0;
    let resultOffset = 0;
    let intervalId: number | null = null;
    let graceTimer: number | null = null;
    const finalMap = new Map<number, string[]>();
    let interimCandidates: string[] = [];

    const candidatesNow = () => [...Array.from(finalMap.values()).flat(), ...interimCandidates].filter(Boolean);
    const bestNow = (): VoiceSessionDecision => {
      const candidates = candidatesNow();
      if (!candidates.length) return { match: 0, transcript: "" };
      return config.evaluate(candidates);
    };
    const cleanupTimers = () => {
      if (intervalId !== null) window.clearInterval(intervalId);
      if (graceTimer !== null) window.clearTimeout(graceTimer);
      intervalId = null;
      graceTimer = null;
    };

    const finish = async (reason: "success" | "quiet" | "mismatch" | "denied") => {
      if (evaluated) return;
      evaluated = true;
      sessionCleanupRef.current = null;
      cleanupTimers();
      try { recognition.stop(); } catch { /* already stopped */ }
      const decision = bestNow();
      if (reason === "success" || reason === "denied") {
        await stopVoiceRecording();
        setIsChildSpeaking(false);
        setListenSecondsLeft(null);
        if (reason === "success") config.onSuccess(decision);
        else config.onDenied();
        return;
      }
      // Weak transcript: give the recorded audio a second opinion from the
      // smart engine (Whisper runs on-device) before disappointing the child.
      const blob = await stopVoiceRecording();
      setIsChildSpeaking(false);
      setListenSecondsLeft(null);
      let finalDecision = decision;
      if (isSmartEngineReady() && blob && blob.size > 0) {
        config.onRescueStart?.();
        const transcript = await transcribeRecording(blob);
        if (transcript) {
          const rescued = config.evaluate([transcript]);
          if (rescued.match > finalDecision.match) finalDecision = rescued;
        }
      }
      if (finalDecision.match >= config.successThreshold) config.onSuccess(finalDecision);
      else config.onFail(finalDecision, reason);
    };

    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 5;
    recognitionRef.current = recognition;

    recognition.onstart = () => config.onStartListening();

    recognition.onresult = (event) => {
      if (evaluated || disposed) return;
      lastResultCount = event.results.length;
      interimCandidates = [];
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const alternatives = Array.from({ length: result?.length ?? 0 }, (_, alternative) => result[alternative]?.transcript ?? "").filter(Boolean);
        if (!alternatives.length) continue;
        if (result?.isFinal) finalMap.set(resultOffset + index, alternatives);
        else interimCandidates = alternatives;
      }
      const decision = bestNow();
      config.onInterim(decision);
      if (decision.match >= config.successThreshold && Date.now() >= minAt) {
        finish("success");
        return;
      }
      // A final result arrived but was weak: give the child a grace window to repeat,
      // then evaluate whatever we have. New speech keeps extending the grace.
      if (finalMap.size && Date.now() >= minAt) {
        if (graceTimer !== null) window.clearTimeout(graceTimer);
        graceTimer = window.setTimeout(() => finish(bestNow().match >= config.successThreshold ? "success" : "mismatch"), LISTEN_GRACE_MS);
      }
    };

    recognition.onerror = (event) => {
      if (evaluated || disposed) return;
      lastError = event.error;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") finish("denied");
    };

    recognition.onend = () => {
      if (evaluated) {
        setIsChildSpeaking(false);
        return;
      }
      if (disposed) {
        evaluated = true;
        stopVoiceRecording();
        return;
      }
      // Android Chrome ends the session after the first final; keep the window alive.
      if (Date.now() < stopAt - 400 && restarts < LISTEN_MAX_RESTARTS) {
        restarts += 1;
        resultOffset += lastResultCount;
        lastResultCount = 0;
        interimCandidates = [];
        try {
          recognition.start();
          return;
        } catch { /* fall through and finish */ }
      }
      const decision = bestNow();
      const quiet = !candidatesNow().length && (lastError === "no-speech" || lastError === "audio-capture" || lastError === "");
      finish(decision.match >= config.successThreshold ? "success" : quiet ? "quiet" : "mismatch");
    };

    intervalId = window.setInterval(() => {
      if (evaluated || disposed) return;
      const secondsLeft = Math.max(0, Math.ceil((stopAt - Date.now()) / 1000));
      config.onTick(secondsLeft, Math.min(100, ((Date.now() - startedAt) / config.maxMs) * 100));
      if (Date.now() >= stopAt) {
        const decision = bestNow();
        finish(decision.match >= config.successThreshold ? "success" : candidatesNow().length ? "mismatch" : "quiet");
      }
    }, 200);

    sessionCleanupRef.current = () => {
      disposed = true;
      cleanupTimers();
    };

    try {
      recognition.start();
    } catch {
      finish("mismatch");
    }
  };

  /**
   * Professional assessment session: records for the full listening window,
   * then lets a cloud judge score the audio via a pluggable assess function —
   * the free Groq Whisper engine or Azure Pronunciation Assessment.
   * Falls back to the free browser engine on any failure, so the
   * child is never blocked.
   */
  const runProAssessmentSession = async (
    config: VoiceSessionConfig,
    referenceText: string,
    assessFn: (blob: Blob, reference: string) => Promise<ProAssessmentOutcome>,
  ) => {
    audioRef.current?.pause();
    setIsChildSpeaking(true);
    let disposed = false;
    sessionCleanupRef.current = () => { disposed = true; };
    const started = await startVoiceRecording();
    if (disposed) {
      await stopVoiceRecording();
      return;
    }
    if (!started) {
      config.onDenied();
      return;
    }
    config.onStartListening();
    const startedAt = Date.now();
    const stopAt = startedAt + config.maxMs;
    await new Promise<void>((resolve) => {
      const intervalId = window.setInterval(() => {
        if (disposed) {
          window.clearInterval(intervalId);
          resolve();
          return;
        }
        const secondsLeft = Math.max(0, Math.ceil((stopAt - Date.now()) / 1000));
        config.onTick(secondsLeft, Math.min(100, ((Date.now() - startedAt) / config.maxMs) * 100));
        if (Date.now() >= stopAt) {
          window.clearInterval(intervalId);
          resolve();
        }
      }, 200);
    });
    sessionCleanupRef.current = null;
    setIsChildSpeaking(false);
    setListenSecondsLeft(null);
    const blob = await stopVoiceRecording();
    if (disposed) return;
    if (!blob || !blob.size) {
      config.onFail({ match: 0, transcript: "" }, "quiet");
      return;
    }
    config.onRescueStart?.();
    try {
      const outcome = await assessFn(blob, referenceText);
      const decision: VoiceSessionDecision = { match: outcome.match, transcript: outcome.transcript };
      if (decision.match >= config.successThreshold) config.onSuccess(decision);
      else config.onFail(decision, "mismatch");
    } catch {
      // Cloud engine hiccup (offline, quota, key) — never block the child.
      await runVoiceSession(config);
    }
  };

  /** Azure Pronunciation Assessment: phoneme-level accuracy score (0-100 → 0-1). */
  const azureAssess = (blob: Blob, reference: string): Promise<ProAssessmentOutcome> =>
    assessRecording(blob, reference).then((scores) => ({
      match: scores.accuracy / 100,
      transcript: scores.recognized || scores.words.map((word) => word.word).join(" "),
    }));

  /** Free Groq Whisper server engine: accurate transcript + fuzzy-match score. */
  const serverAssess = (blob: Blob, reference: string): Promise<ProAssessmentOutcome> =>
    serverAssessRecording(blob, reference).then((assessment) => ({
      match: assessment.score,
      transcript: assessment.transcript,
    }));

  /**
   * Dispatch the best available professional engine for this attempt:
   * free Groq Whisper (no card, no download) first, Azure second, and when
   * neither is configured return false so the caller uses the browser engine.
   */
  const startProAssessment = (config: VoiceSessionConfig, referenceText: string, thresholds: { threshold: number }) => {
    if (serverEngineReady) {
      runProAssessmentSession({ ...config, successThreshold: thresholds.threshold }, referenceText, serverAssess);
      return true;
    }
    if (azureEngineReady) {
      runProAssessmentSession({ ...config, successThreshold: thresholds.threshold }, referenceText, azureAssess);
      return true;
    }
    return false;
  };

  const showPronunciationRetry = (message: string) => {
    const nextAttempt = pronunciationAttempts + 1;
    setPronunciationAttempts(nextAttempt);
    setPronunciationPhase("retry");
    setPronunciationFeedback(nextAttempt >= 2 ? `${message} لا بأس. اسمع الكلمة مرة أخرى ثم قلها بهدوء.` : `${message} اضغط «اسمع الكلمة» ثم حاول مرة أخرى.`);
  };

  const startPronunciationCheck = () => {
    setPronunciationPhase("listening");
    setPronunciationHeard("");
    setPronunciationMatch(null);
    setListenProgress(0);
    setListenSecondsLeft(Math.ceil(WORD_LISTEN.maxMs / 1000));
    const sessionConfig: VoiceSessionConfig = {
      minMs: WORD_LISTEN.minMs,
      maxMs: WORD_LISTEN.maxMs,
      successThreshold: WORD_LISTEN.threshold,
      evaluate: (candidates) => {
        let best: VoiceSessionDecision = { match: 0, transcript: "" };
        candidates.forEach((candidate) => {
          const match = wordSimilarity(candidate, activeLetter.word);
          if (match > best.match) best = { match, transcript: candidate };
        });
        return best;
      },
      onStartListening: () => {
        setIsChildSpeaking(true);
        setPronunciationPhase("listening");
      },
      onTick: (secondsLeft, progressPercent) => {
        setListenSecondsLeft(secondsLeft);
        setListenProgress(progressPercent);
      },
      onInterim: (decision) => {
        if (decision.transcript) setPronunciationHeard(decision.transcript);
      },
      onSuccess: (decision) => {
        setPronunciationHeard(decision.transcript || activeLetter.word);
        setPronunciationMatch(decision.match);
        setPronunciationPhase("success");
        setPronunciationFeedback(`صح! أحسنت، قلت كلمة ${activeLetter.word} بشكل صحيح.`);
        giveReward(1, `أحسنت! سمعنا كلمة ${activeLetter.word} بوضوح.`, "speech");
      },
      onFail: (decision, reason) => {
        setPronunciationHeard(decision.transcript);
        setPronunciationMatch(decision.match > 0 ? decision.match : null);
        setWrongPulse(Date.now());
        if (reason === "quiet") showPronunciationRetry("لم نسمع صوتك. قرّب من الميكروفون وقُل الكلمة ببطء.");
        else showPronunciationRetry(decision.match >= 0.55 ? "قريب جدًا! جرّب أن تقول الكلمة ببطء أكثر." : "لم تطابق الكلمة بعد.");
      },
      onDenied: () => {
        setPronunciationPhase("unavailable");
        setPronunciationFeedback("اسمح للميكروفون من إعدادات المتصفح ثم جرّب.");
      },
      onRescueStart: () => {
        setPronunciationPhase("review");
        setPronunciationFeedback("جاري مراجعة تسجيلك بدقة أعلى… لحظة.");
      },
      onEngineMissing: () => {
        setPronunciationPhase("unavailable");
        setPronunciationFeedback("محتاجين تنزيل «محرك التعرف الذكي» أول مرة فقط (يحتاج إنترنت). فعّله من زر المحرك بالأعلى ثم جرّب مرة أخرى.");
      },
    };
    // Professional engine first (accurate cloud judging, zero downloads);
    // free browser engine as the default path for everyone else.
    if (!startProAssessment(sessionConfig, activeLetter.word, SERVER_WORD)) {
      runVoiceSession(sessionConfig);
    }
  };

  const playSentencePracticeModel = (sentence: SentenceLesson) => {
    updateSentencePractice(sentence.id, { phase: "ready", feedback: "اسمع الجملة كاملة، ثم اضغط «قل الآن». ", hasHeardModel: true, heard: "", match: null });
    playEmbeddedAudio(getEmbeddedAudioCue("sentence", sentence.id - 1));
  };

  const startSentencePronunciationCheck = (sentence: SentenceLesson) => {
    updateSentencePractice(sentence.id, { phase: "listening", feedback: "جهّز نفسك… نفتح الميكروفون.", heard: "", match: null });
    setListenProgress(0);
    setListenSecondsLeft(Math.ceil(SENTENCE_LISTEN.maxMs / 1000));
    const sessionConfig: VoiceSessionConfig = {
      minMs: SENTENCE_LISTEN.minMs,
      maxMs: SENTENCE_LISTEN.maxMs,
      successThreshold: SENTENCE_LISTEN.threshold,
      evaluate: (candidates) => {
        let best: VoiceSessionDecision = { match: 0, transcript: "" };
        candidates.forEach((candidate) => {
          const match = sentenceSimilarity(candidate, sentence.english);
          if (match > best.match) best = { match, transcript: candidate };
        });
        return best;
      },
      onStartListening: () => {
        setIsChildSpeaking(true);
        updateSentencePractice(sentence.id, { phase: "listening", feedback: "قل الجملة بهدوء… خذ وقتك، نستمع حتى النهاية.", heard: "", match: null });
      },
      onTick: (secondsLeft, progressPercent) => {
        setListenSecondsLeft(secondsLeft);
        setListenProgress(progressPercent);
      },
      onInterim: (decision) => {
        if (decision.transcript) updateSentencePractice(sentence.id, { heard: decision.transcript });
      },
      onSuccess: (decision) => {
        setCompletedSentences((current) => new Set(current).add(sentence.id));
        giveReward(2, `أحسنت! قلت جملة ${sentence.english} بوضوح.`, "speech");
        updateSentencePractice(sentence.id, { phase: "success", heard: decision.transcript || sentence.english, match: decision.match, feedback: "صح! قلت الجملة بشكل رائع." });
      },
      onFail: (decision, reason) => {
        setWrongPulse(Date.now());
        const attempts = (sentencePractice.id === sentence.id ? sentencePractice.attempts : 0) + 1;
        const message = reason === "quiet"
          ? "لم نسمع جملة. قرّب من الميكروفون وجرّب مرة أخرى."
          : decision.match >= 0.45 ? "قريب جدًا! اسمعها مرة أخرى وقل الكلمات ببطء." : "حاول مرة أخرى بعد سماع الجملة كاملة.";
        updateSentencePractice(sentence.id, { phase: "retry", heard: decision.transcript, match: decision.match > 0 ? decision.match : null, attempts, feedback: message });
      },
      onDenied: () => {
        updateSentencePractice(sentence.id, { phase: "unavailable", feedback: "اسمح للميكروفون من إعدادات المتصفح ثم جرّب." });
      },
      onRescueStart: () => {
        updateSentencePractice(sentence.id, { phase: "review", feedback: "جاري مراجعة تسجيلك بدقة أعلى… لحظة.", heard: "", match: null });
      },
      onEngineMissing: () => {
        updateSentencePractice(sentence.id, { phase: "unavailable", feedback: "محتاجين تنزيل «محرك التعرف الذكي» أول مرة فقط (يحتاج إنترنت). فعّله من زر المحرك أعلى قائمة الجمل ثم جرّب." });
      },
    };
    if (!startProAssessment(sessionConfig, sentence.english, SERVER_SENTENCE)) {
      runVoiceSession(sessionConfig);
    }
  };

  const chooseListenLetter = (index: number) => {
    if (listenSolved) return;
    setListenSelected(index);
    if (index === listenTargetIndex) {
      setListenSolved(true);
      giveReward(2, "أحسنت! اصطدت الصوت الصحيح. حصلت على نجمتين.", "listen");
    } else {
      setWrongPulse(Date.now());
      setGameFeedback("قريب جدًا. اسمع الصوت مرة أخرى ثم جرّب.");
    }
  };

  const nextListenRound = () => {
    setListenTargetIndex((current) => (current + 3) % letters.length);
    setListenRound((current) => current + 1);
    setListenSelected(null);
    setListenSolved(false);
    setGameFeedback("");
  };

  const chooseMatchLetter = (index: number) => {
    if (matchSolved) return;
    setMatchSelected(index);
    if (index === matchTargetIndex) {
      setMatchSolved(true);
      giveReward(2, "ممتاز! وصلت الكلمة إلى بيت حرفها. نجمتان جديدتان لك.", "match");
    } else {
      setWrongPulse(Date.now());
      setGameFeedback("هذه الكلمة لا تبدأ بهذا الحرف. انظر للكلمة مرة أخرى.");
    }
  };

  const nextMatchRound = () => {
    setMatchTargetIndex((current) => (current + 4) % letters.length);
    setMatchRound((current) => current + 1);
    setMatchSelected(null);
    setMatchSolved(false);
    setGameFeedback("");
  };

  const chooseSentenceWord = (word: string) => {
    if (sentenceSolved || placedSentenceWords.includes(word)) return;
    const next = [...placedSentenceWords, word];
    setPlacedSentenceWords(next);
    if (next.length === activeSentencePuzzle.words.length) {
      if (next.join(" ") === activeSentencePuzzle.words.join(" ")) {
        setSentenceSolved(true);
        giveReward(3, "ترتيب رائع! كوّنت الجملة الصحيحة وحصلت على 3 نجوم.", "sentence");
      } else {
        setWrongPulse(Date.now());
        setGameFeedback("ترتيب لطيف، لكن لنبدّل أماكن الكلمات ونجرّب مجددًا.");
      }
    }
  };

  const resetSentenceRound = () => {
    setPlacedSentenceWords([]);
    setGameFeedback("");
  };

  const nextSentenceRound = () => {
    setSentencePuzzleIndex((current) => (current + 1) % sentencePuzzles.length);
    setSentenceRound((current) => current + 1);
    setPlacedSentenceWords([]);
    setSentenceSolved(false);
    setGameFeedback("");
  };

  return (
    <div className={cn("quest-app", `page-${page}`)} dir="rtl">
      <div className="paper-speckle" aria-hidden="true" />
      {celebrationKey > 0 && <div className={cn("celebration-burst", `theme-${celebrationTheme}`)} key={celebrationKey} aria-hidden="true"><span className="celebration-halo" /><span className="reward-pop"><small>{celebrationAmount > 0 ? "نجوم جديدة" : "إجابة صحيحة"}</small>{celebrationAmount > 0 ? `+${celebrationAmount} ★` : "أحسنت!"}</span><span className="celebration-cheer">برافو!</span>{celebrationTheme === "listen" && <><span className="listen-wave wave-one" /><span className="listen-wave wave-two" /><span className="listen-comet-icon">✦</span></>}{celebrationTheme === "match" && <><span className="match-door left" /><span className="match-door right" /><span className="match-ticket-fly">{letters[matchTargetIndex].word}</span></>}{celebrationTheme === "sentence" && <span className="sentence-ribbon-fly">Great sentence!</span>}{Array.from({ length: 3 }).map((_, index) => <b className="star-flight" key={`flight-${index}`}>★</b>)}{Array.from({ length: 24 }).map((_, index) => <i key={index} />)}</div>}
      <header className="topbar container">
        <Link className="brand" href="/" aria-label="English Kids Quest">
          <span className="brand-mark"><img src={logoImage} alt="" /><span className="brand-soundlines" aria-hidden="true"><i /><i /><i /></span></span>
          <span className="brand-copy">
            <strong>English Kids Quest</strong>
            <small>نتعلّمها باللعب</small>
          </span>
        </Link>

        <nav className={cn("topnav", mobileMenuOpen && "is-open")} aria-label="التنقل الرئيسي">
          <button className={cn(page === "letters" && "active")} onClick={() => { setMobileMenuOpen(false); setLocation("/letters"); }}>
            <BookOpen size={16} /> الحروف
          </button>
          <button className={cn(page === "sentences" && "active")} onClick={() => { setMobileMenuOpen(false); setLocation("/sentences"); }}>
            <ListChecks size={16} /> الجمل الأساسية
          </button>
          <button className={cn(page === "games" && "active")} onClick={() => { setMobileMenuOpen(false); setLocation("/games"); }}>
            <Gamepad2 size={16} /> الألعاب
          </button>
        </nav>

        <div className="topbar-actions">
          <div className="mini-stat streak" title="أيام التعلّم المتتالية">
            <Flame size={17} />
            <span><b>3</b><small>أيام</small></span>
          </div>
          <div key={`stars-${celebrationKey}`} className={cn("mini-stat stars", celebrationKey > 0 && "rewarding")} title="النجوم المكتسبة">
            <Star size={17} fill="currentColor" />
            <span><b key={celebrationKey}>{stars}</b><small>نجمة</small></span>
          </div>
          <button className="mobile-menu" onClick={() => setMobileMenuOpen((open) => !open)} aria-label="فتح القائمة">
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <main id="top">
        <section className="app-page-intro container">
          <div><span className="section-number">مغامرة اليوم</span><h1>{page === "letters" ? "حديقة الحروف" : page === "sentences" ? "دفتر الجمل" : page === "games" ? "ساحة علوز للعب" : "تقدمي اليوم"}</h1><p>{page === "letters" ? "اسمع حرفًا واحدًا، قله، ثم العب به." : page === "sentences" ? "تدرّب على جمل صغيرة تستخدمها كل يوم." : page === "games" ? "اختر لعبة واحدة واستمتع بالمكافآت." : "انظر إلى النجوم وما أكملته في رحلتك."}</p></div>
          <button className="back-home" onClick={() => setLocation("/")}><ArrowRight size={16} /> الرئيسية</button>
        </section>

        <section className="workspace container" id="lesson">
          <aside className="journey-rail">
            <div className="rail-heading">
              <span className="rail-kicker">مساري اليوم</span>
              <h2>خريطة الرحلة</h2>
            </div>
            <div className="journey-steps">
              <div className={cn("journey-step", mode === "letters" && "current", completedLetters.size > 0 && "done")}>
                <span className="step-icon"><span>01</span></span>
                <div><b>صوت الحرف</b><small>اسمع وكرّر</small></div>
                {completedLetters.size > 0 && <Check size={16} className="step-check" />}
              </div>
              <div className="journey-connector" />
              <div className={cn("journey-step", mode === "sentences" && "current", completedSentences.size > 0 && "done")}>
                <span className="step-icon"><span>02</span></span>
                <div><b>جملة اليوم</b><small>استخدمها بثقة</small></div>
                {completedSentences.size > 0 && <Check size={16} className="step-check" />}
              </div>
              <div className="journey-connector" />
              <button className="journey-step game-ready" onClick={() => setLocation("/games")}>
                <span className="step-icon"><Gamepad2 size={15} /></span>
                <span className="journey-step-copy"><b>ألعاب المكافآت</b><small>{gameWins} جولات مكتملة</small></span>
                <Star size={15} className="step-check" fill="currentColor" />
              </button>
            </div>
            <div className="progress-card">
              <div className="progress-card-top"><span>تقدّمك الكلّي</span><b>{progress}%</b></div>
              <div className="progress-track"><span style={{ width: `${Math.max(progress, 3)}%` }} /></div>
              <p>{progressCount} من {letters.length + sentences.length} درسًا مكتملًا</p>
            </div>
            <div className="rail-tip">
              <img src={mascotImage} alt="" />
              <div><b>نصيحة علوز</b><p>اسمع الكلمة مرتين، ثم قلها بصوتك.</p></div>
            </div>
          </aside>

          <div className="lesson-space">
            {page !== "games" && page !== "progress" && <div className="lesson-heading">
              <div>
                <span className="section-number">01 / 02</span>
                <h2>{mode === "letters" ? "حديقة الحروف" : "دفتر الجمل"}</h2>
                <p>{mode === "letters" ? "اختَر حرفًا، استمع لاسمه، ثم جرّب كلمة تبدأ به." : "50 جملة صغيرة تساعدك على الكلام في البيت واللعب والمدرسة."}</p>
              </div>
              <div className="mode-switcher" role="tablist" aria-label="اختيار نوع الدرس">
                <button className={cn(page === "letters" && "selected")} onClick={() => setLocation("/letters")} role="tab" aria-selected={page === "letters"}><BookOpen size={16} /> الحروف <span>26</span></button>
                <button className={cn(page === "sentences" && "selected")} onClick={() => setLocation("/sentences")} role="tab" aria-selected={page === "sentences"}><ListChecks size={16} /> الجمل <span>50</span></button>
              </div>
            </div>}

            <div className="speech-status" aria-live="polite">{speechNotice}</div>

            {page === "progress" && <section className="progress-dashboard" aria-label="لوحة التقدم">
              <div className="progress-dashboard-head"><div><span className="section-number">لوحتي</span><h2>تقدّمي في الرحلة</h2><p>لوحة بسيطة تخبرك بما أنجزته وما المهمة الصغيرة التالية.</p></div><div className="progress-star-total"><Star size={19} fill="currentColor" /><span><b>{stars}</b><small>نجمة جمعتها</small></span></div></div>
              <div className="progress-spotlight">
                <div className="progress-ring" style={{ background: `conic-gradient(var(--emerald) ${Math.max(progress, 2) * 3.6}deg, #e7dfcf 0deg)` }}><div><b>{progress}%</b><span>مكتمل</span></div></div>
                <div className="progress-spotlight-copy"><span className="progress-kicker">رحلتك حتى الآن</span><h3>{progressCount === 0 ? "أول نجمة بانتظارك" : progress < 50 ? "تقدّم جميل، استمر" : progress < 100 ? "اقتربت من نهاية الرحلة" : "أكملت الرحلة!"}</h3><p>{progressCount} من {letters.length + sentences.length} درسًا مكتملًا. {progressCount === 0 ? "ابدأ بحرف واحد فقط اليوم." : "كل محاولة صغيرة تصنع فرقًا."}</p></div>
              </div>
              <div className="progress-stat-grid">
                <article><span className="progress-stat-icon letters"><BookOpen size={19} /></span><div><b>{completedLetters.size}<small>/ {letters.length}</small></b><span>حروف راجعتها</span></div></article>
                <article><span className="progress-stat-icon sentences"><ListChecks size={19} /></span><div><b>{completedSentences.size}<small>/ {sentences.length}</small></b><span>جمل تدربت عليها</span></div></article>
                <article><span className="progress-stat-icon games"><Trophy size={19} /></span><div><b>{gameWins}</b><span>جولات أنهيتها</span></div></article>
              </div>
              <Link className="progress-next-step" href={nextStep.href}><span className="progress-next-icon"><Sparkles size={18} /></span><span><small>{nextStep.label}</small><b lang={nextStep.href === "/sentences" ? "en" : undefined}>{nextStep.title}</b><em>{nextStep.detail}</em></span><ArrowLeft size={19} /></Link>
            </section>}

            {(page === "letters" || page === "sentences") && (mode === "letters" ? (
              <>
                <div className="letter-map" aria-label="اختيار حرف للتعلّم">
                  {letters.map((item, index) => (
                    <button key={item.letter} className={cn("letter-tile", `tile-${(index % 6) + 1}`, activeLetterIndex === index && "selected", completedLetters.has(item.letter) && "completed")} onClick={() => selectLetter(index)} aria-label={`حرف ${item.letter}`}>
                      <span className="tile-letter">{item.letter}</span>
                      <span className="tile-lower">{item.lower}</span>
                      {completedLetters.has(item.letter) && <span className="tile-check"><Check size={11} /></span>}
                    </button>
                  ))}
                </div>

                <div className="letter-lesson-card">
                  <div className="letter-visual">
                    <div className="letter-cutout"><span>{activeLetter.letter}</span><small>{activeLetter.lower}</small></div>
                    <div className="letter-scribble">{activeLetter.ipa}</div>
                    <div className="paper-star star-a"><Star size={16} fill="currentColor" /></div>
                    <div className="paper-star star-b"><Star size={11} fill="currentColor" /></div>
                  </div>
                  <div className="letter-detail">
                    <div className="detail-label"><span>صوت الحرف (فونيكس)</span><span className="ipa-chip">{activeLetter.ipa}</span></div>
                    <h3>{activeLetter.letter} <span>مثل</span> <strong>{activeLetter.word}</strong></h3>
                    <p className="word-translation">{activeLetter.wordAr} <span>·</span> النطق التقريبي: <b>{activeLetter.hint}</b></p>
                    <div className="sound-actions">
                      <button className={cn("sound-button", isSpeaking && "speaking")} onClick={() => playEmbeddedAudio(getEmbeddedAudioCue("letter", activeLetterIndex))}><Volume2 size={19} /> اسمع صوت الحرف <span>{activeLetter.sound}</span></button>
                      <button className="word-sound" onClick={() => playEmbeddedAudio(getEmbeddedAudioCue("word", activeLetterIndex))}><Headphones size={17} /> اسمع الكلمة</button>
                    </div>
                    <div className="repeat-line"><span className="repeat-dots"><i /><i /><i /></span><span>جرّب أن تقولها: <b>{activeLetter.letter} — {activeLetter.word}</b></span></div>
                    <div className={cn("pronunciation-card", `phase-${pronunciationPhase}`)}>
                      <div className="pronunciation-copy"><span className="mic-sticker"><Mic size={15} /></span><div><b>قلها وخلّيني أصحح لك</b><small>اسمع كلمة <em lang="en">{activeLetter.word}</em>، ثم قلها في الميكروفون</small></div></div>
                      <div className="direct-pronunciation-flow"><span className={cn(hasHeardModel && "done")}><i>1</i><Volume2 size={13} /> اسمع الكلمة</span><span className={cn(isChildSpeaking && "current")}><i>2</i><Mic size={13} /> قلها</span></div>
                      <div className="pronunciation-actions"><button className="hear-model-button" onClick={playPracticeModel}><Volume2 size={15} /> اسمع الكلمة</button><button className={cn("pronunciation-button", isChildSpeaking && "listening")} onClick={startPronunciationCheck} disabled={isChildSpeaking}><Mic size={16} /> {isChildSpeaking ? "نستمع…" : "قلها الآن"}</button></div>
                      {engineBanner}
                      {!speechRecognitionSupported && <span className="speech-support-note">{speechRecognitionSupported === null ? "تجهيز الميكروفون…" : "نستخدم التعرف الذكي داخل جهازك في هذا المتصفح"}</span>}
                      {pronunciationPhase === "listening" && <div className="listen-meter" aria-hidden="true"><span className="listen-meter-fill" style={{ width: `${listenProgress}%` }} /><small>{listenSecondsLeft !== null ? listenSecondsLabel(listenSecondsLeft) : "نفتح الميكروفون…"}</small></div>}
                      {pronunciationPhase === "review" && <div className="review-meter"><Sparkles size={13} /> بنراجع تسجيلك بدقة أعلى…</div>}
                      {pronunciationPhase === "success" && <div className="pronunciation-result correct"><Check size={18} /><div><b>صح! أحسنت</b><span>نطقت <em lang="en">{activeLetter.word}</em> بشكل صحيح</span></div></div>}
                      {pronunciationPhase === "retry" && <div className="pronunciation-result retry"><X size={18} /><div><b>حاول مرة أخرى</b><span>اسمع الكلمة ثم قلها ببطء</span></div></div>}
                      {pronunciationHeard && <div className={cn("speech-heard", pronunciationPhase === "success" && "clear")}><span>سمعنا:</span><b lang="en">{pronunciationHeard}</b>{pronunciationMatch !== null && <small className="score-chip">{Math.round(pronunciationMatch * 100)}٪ · {pronunciationMatch >= .8 ? "واضحة جدًا" : pronunciationMatch >= .55 ? "قريبة من الكلمة" : "جرّب ببطء أكثر"}</small>}</div>}
                      {lastRecordingUrl && pronunciationPhase !== "listening" && pronunciationPhase !== "review" && <div className="recording-review"><button className="playback-button" onClick={playChildRecording}><Volume2 size={14} /> اسمع صوتك</button><small>التسجيل في الذاكرة فقط ولا يُحفظ</small></div>}
                      {pronunciationPhase === "retry" && <div className="pronunciation-hint"><span className="hint-letter" lang="en">{activeLetter.letter}</span><div><b>تلميح</b><p>الكلمة هي: <strong lang="en">{activeLetter.word}</strong></p><small>ابدأ بصوت <em>{activeLetter.hint}</em>.</small></div></div>}
                      {pronunciationFeedback && (pronunciationPhase === "unavailable" || pronunciationPhase === "retry") && <p className="pronunciation-feedback">{pronunciationFeedback}</p>}
                      {pronunciationAttempts > 0 && pronunciationPhase === "retry" && <span className="attempt-badge">محاولة {pronunciationAttempts} · أنت تتعلم بشكل ممتاز</span>}
                      <p className="mic-privacy">اطلب مساعدة ولي الأمر. {proEngineStatus === "ready" ? "عند تفعيل المحرك الاحترافي يُرسل الصوت لخدمة تقييم سحابية لتحليله لحظيًا فقط ولا يُخزَّن." : "صوتك يُقيَّم لحظيًا ولا يُرسل أو يُخزَّن في أي مكان."}</p>
                    </div>
                    <button className={cn("complete-button", completedLetters.has(activeLetter.letter) && "is-done")} onClick={() => toggleLetterComplete(activeLetter.letter)}>
                      {completedLetters.has(activeLetter.letter) ? <><Check size={17} /> تمّت المراجعة</> : <>حفظت هذا الحرف <Bookmark size={17} /></>}
                    </button>
                  </div>
                </div>

                <div className="practice-row">
                  <div className="practice-card quiz-card">
                    <div className="card-heading"><span className="tiny-icon coral"><CircleHelp size={17} /></span><div><span className="card-eyebrow">اختبر أذنك</span><h3>أي كلمة تبدأ بحرف {activeLetter.letter}؟</h3></div></div>
                    <p className="quiz-prompt">استمع للحرف أولًا، ثم اختر الإجابة.</p>
                    <button className="small-listen" onClick={() => playEmbeddedAudio(getEmbeddedAudioCue("letter", activeLetterIndex))}><Play size={13} fill="currentColor" /> استمع</button>
                    <div className="quiz-options">
                      {quizOptions.map((option) => {
                        const isSelected = quizAnswer === option;
                        const isCorrect = isSelected && option === activeLetter.word;
                        const isWrong = isSelected && option !== activeLetter.word;
                        return <button key={option} className={cn("quiz-option", isCorrect && "correct", isWrong && "wrong")} onClick={() => chooseQuizAnswer(option)}>{option}<span>{isCorrect ? <Check size={14} /> : isWrong ? <X size={14} /> : <ArrowLeft size={13} />}</span></button>;
                      })}
                    </div>
                    <div className="quiz-feedback" aria-live="polite">{quizAnswer === activeLetter.word ? "أحسنت! أذنك التقطت الصوت." : quizAnswer ? "قريب جدًا، اسمع مرة أخرى وجرّب." : ""}</div>
                  </div>
                  <div className="practice-card scene-card">
                    <img src={lettersImage} alt="قصاصات ورقية ملوّنة للحروف" />
                    <div className="scene-overlay"><span>مشهد الحرف</span><b>{activeLetter.word}</b></div>
                  </div>
                </div>
              </>
            ) : (
              <div className="sentences-section">
                <div className="sentences-intro">
                  <div className="sentences-art"><img src={sentencesImage} alt="شخصيات ورقية تتحدث" /><span className="art-label">اسمع، افهم، تكلّم</span></div>
                  <div className="sentences-copy"><span className="paper-label">50 جملة في جيبك</span><h3>جملة صغيرة، <em>محادثة أكبر.</em></h3><p>اضغط على السماعة لسماع النطق، ثم اضغط على الإشارة المرجعية لتتذكر أنك تدربت عليها.</p></div>
                  <div className="sentence-counter"><b>{completedSentences.size}</b><span>من 50<br />مكتملة</span></div>
                </div>
                <div className="sentence-toolbar">
                  <div className="category-tabs" role="tablist" aria-label="تصنيف الجمل">
                    {categories.map((category) => <button key={category} className={cn(sentenceCategory === category && "active")} onClick={() => selectCategory(category)}>{category}</button>)}
                  </div>
                  <label className="sentence-search"><Search size={16} /><input value={sentenceSearch} onChange={(event) => { setSentenceSearch(event.target.value); setSentencePage(1); }} placeholder="ابحث عن جملة..." aria-label="البحث في الجمل" /></label>
                </div>
                {engineBanner}
                <div className="sentences-grid">
                  {visibleSentences.map((sentence) => {
                    const isDone = completedSentences.has(sentence.id);
                    return <article className={cn("sentence-card", isDone && "is-done")} key={sentence.id}>
                      <div className="sentence-top"><span className="sentence-number">{String(sentence.id).padStart(2, "0")}</span><span className="sentence-category">{sentence.category}</span></div>
                      <p className="sentence-english" lang="en">{sentence.english}</p>
                      <p className="sentence-arabic">{sentence.arabic}</p>
                      <div className="sentence-actions"><button className={cn("sentence-play", isSpeaking && "speaking")} onClick={() => playSentencePracticeModel(sentence)} aria-label={`استمع إلى ${sentence.english}`}><Volume2 size={17} /> اسمع</button><button className={cn("sentence-mic", sentencePractice.id === sentence.id && (sentencePractice.phase === "listening" || sentencePractice.phase === "review") && "listening")} onClick={() => startSentencePronunciationCheck(sentence)} disabled={isChildSpeaking} aria-label={`قل الجملة ${sentence.english}`}><Mic size={16} /> {sentencePractice.id === sentence.id && (sentencePractice.phase === "listening" || sentencePractice.phase === "review") ? "نسمع" : "قلها"}</button><button className={cn("bookmark-button", isDone && "saved")} onClick={() => toggleSentenceComplete(sentence.id)} aria-label={isDone ? "إلغاء حفظ الجملة" : "حفظ الجملة"}>{isDone ? <Check size={17} /> : <Bookmark size={17} />}</button></div>
                      {sentencePractice.id === sentence.id && sentencePractice.feedback && <div className={cn("sentence-practice-feedback", `phase-${sentencePractice.phase}`)} aria-live="polite"><span>{sentencePractice.phase === "success" ? <Check size={13} /> : sentencePractice.phase === "retry" ? <X size={13} /> : <Mic size={13} />}</span><div><b>{sentencePractice.phase === "success" ? "صح! أحسنت" : sentencePractice.phase === "retry" ? "حاول مرة أخرى" : sentencePractice.phase === "listening" ? "نستمع إليك" : sentencePractice.phase === "review" ? "لحظة… بنراجع تسجيلك" : "تدريب الجملة"}</b><p>{sentencePractice.feedback}</p>{sentencePractice.phase === "listening" && <div className="listen-meter" aria-hidden="true"><span className="listen-meter-fill" style={{ width: `${listenProgress}%` }} /><small>{listenSecondsLeft !== null ? listenSecondsLabel(listenSecondsLeft) : "نفتح الميكروفون…"}</small></div>}{sentencePractice.phase === "review" && <div className="review-meter"><Sparkles size={12} /> بنراجع تسجيلك بدقة أعلى…</div>}{sentencePractice.heard && <small>سمعنا: <em lang="en">{sentencePractice.heard}</em>{sentencePractice.match !== null && ` · ${Math.round(sentencePractice.match * 100)}٪ · ${sentencePractice.match >= .76 ? "واضحة جدًا" : sentencePractice.match >= .45 ? "قريبة من الجملة" : "قلها ببطء أكثر"}`}</small>}</div></div>}
                      {sentencePractice.id === sentence.id && lastRecordingUrl && sentencePractice.phase !== "listening" && sentencePractice.phase !== "review" && <div className="recording-review"><button className="playback-button" onClick={playChildRecording}><Volume2 size={14} /> اسمع صوتك</button><small>التسجيل في الذاكرة فقط ولا يُحفظ</small></div>}
                    </article>;
                  })}
                </div>
                {visibleSentences.length === 0 && <div className="empty-state"><Leaf size={26} /><h3>لم نجد هذه الجملة</h3><p>جرّب كلمة أخرى، أو اختر تصنيف «الكل».</p></div>}
                <div className="pagination">
                  <span>صفحة {sentencePage} من {totalPages}</span>
                  <div><button onClick={() => setSentencePage((page) => Math.max(1, page - 1))} disabled={sentencePage === 1} aria-label="الصفحة السابقة"><ChevronRight size={17} /></button><button onClick={() => setSentencePage((page) => Math.min(totalPages, page + 1))} disabled={sentencePage === totalPages} aria-label="الصفحة التالية"><ChevronLeft size={17} /></button></div>
                </div>
              </div>
            ))}

            {page === "games" && <section className="game-zone" id="games">
              <div className="game-zone-heading">
                <div><span className="section-number">03 / ألعاب قصيرة</span><h2>ساحة علوز للعب</h2><p>3 ألعاب صغيرة تجعل الحرف والكلمة والجملة جزءًا من مغامرة سريعة.</p></div>
                <div className={cn("game-score", celebrationKey > 0 && "rewarding")}><Trophy size={18} /><span><b key={celebrationKey}>{gameStars}</b><small>نجمة من الألعاب</small></span></div>
              </div>
              <div className="game-tabs" role="tablist" aria-label="اختيار لعبة">
                <button className={cn(activeGame === "listen" && "active")} onClick={() => { setActiveGame("listen"); setGameFeedback(""); }}><span className="game-tab-number">01</span><span><b>اسمع واصطد</b><small>التقط الحرف الصحيح</small></span></button>
                <button className={cn(activeGame === "match" && "active")} onClick={() => { setActiveGame("match"); setGameFeedback(""); }}><span className="game-tab-number">02</span><span><b>بيت الكلمة</b><small>طابقها مع حرفها</small></span></button>
                <button className={cn(activeGame === "sentence" && "active")} onClick={() => { setActiveGame("sentence"); setGameFeedback(""); }}><span className="game-tab-number">03</span><span><b>رتّب الحكاية</b><small>كوّن جملة إنجليزية</small></span></button>
              </div>

              <div className={cn("game-board", wrongPulse > 0 && "wrong-answer")} key={`game-board-${activeGame}-${currentGameRound}-${wrongPulse}`}>
                <div className="game-board-copy">
                  <span className="game-round-label">جولة سريعة <i /> + نجوم</span>
                  {activeGame === "listen" && <>
                    <h3>اسمع الصوت ثم <em>اصطد الحرف.</em></h3>
                    <p>اضغط السماعة، ثم اختر الفقاعة التي تحمل الحرف الذي سمعته.</p>
                    <button className={cn("game-listen-button", isSpeaking && "speaking")} onClick={() => playEmbeddedAudio(getEmbeddedAudioCue("letter", listenTargetIndex))}><Volume2 size={20} /> اسمع الصوت</button>
                  </>}
                  {activeGame === "match" && <>
                    <h3>خذ الكلمة إلى <em>بيت حرفها.</em></h3>
                    <p>انظر إلى الكلمة، أو استمع إليها، ثم اختر الحرف الأول الصحيح.</p>
                    <button className="game-listen-button" onClick={() => playEmbeddedAudio(getEmbeddedAudioCue("word", matchTargetIndex))}><Headphones size={20} /> اسمع الكلمة</button>
                  </>}
                  {activeGame === "sentence" && <>
                    <h3>رتّب الكلمات لتصنع <em>جملة صغيرة.</em></h3>
                    <p>ابدأ من اليمين، واضغط الكلمات بالترتيب الذي يجعل المعنى صحيحًا.</p>
                    <button className="game-listen-button" onClick={() => playEmbeddedAudio(getEmbeddedAudioCue("sentence", activeSentencePuzzle.sentenceIndex))}><Volume2 size={20} /> اسمع الجملة</button>
                  </>}
                </div>
                <div className={cn("game-play-area", `game-${activeGame}`, listenSolved && "solved-listen", matchSolved && "solved-match", sentenceSolved && "solved-sentence")}>
                  {activeGame === "listen" && <>
                    <div className="catch-cloud"><span>مستعد؟</span><b>أي حرف سمعت؟</b></div>
                    <div className="catch-options">{listenOptions.map((index, optionIndex) => <button key={letters[index].letter} className={cn("catch-bubble", `bubble-${optionIndex + 1}`, listenSelected === index && index === listenTargetIndex && "correct", listenSelected === index && index !== listenTargetIndex && "wrong")} onClick={() => chooseListenLetter(index)}>{letters[index].letter}<small>{letters[index].lower}</small></button>)}</div>
                    {listenSolved && <div className="listen-success-streak" aria-hidden="true"><span>✦</span><i /><span>★</span><i /><span>✦</span></div>}
                    {listenSolved && <button type="button" className="next-game-button" onClick={nextListenRound}>الجولة التالية <ArrowLeft size={16} /></button>}
                  </>}
                  {activeGame === "match" && <>
                    <div className="word-ticket"><span>الكلمة الضائعة</span><b>{letters[matchTargetIndex].word}</b><small>{letters[matchTargetIndex].wordAr}</small></div>
                    <div className="home-options">{matchOptions.map((index) => <button key={letters[index].letter} className={cn("letter-home", matchSelected === index && index === matchTargetIndex && "correct", matchSelected === index && index !== matchTargetIndex && "wrong")} onClick={() => chooseMatchLetter(index)}><span>بيت</span><b>{letters[index].letter}</b></button>)}</div>
                    {matchSolved && <div className="match-success-note" aria-hidden="true"><span>{letters[matchTargetIndex].word}</span><b>وصلت إلى بيتها!</b><i>♥</i></div>}
                    {matchSolved && <button type="button" className="next-game-button" onClick={nextMatchRound}>الجولة التالية <ArrowLeft size={16} /></button>}
                  </>}
                  {activeGame === "sentence" && <>
                    <div className="sentence-clue"><span>المعنى بالعربية</span><b>{activeSentencePuzzle.arabic}</b></div>
                    <div className={cn("sentence-build-zone", sentenceSolved && "sentence-complete")}>{placedSentenceWords.length ? placedSentenceWords.map((word, index) => <span key={`${word}-${index}`} className="built-word">{word}</span>) : <span className="build-placeholder">اضغط الكلمات بالترتيب هنا</span>}</div>
                    <div className="word-bank">{sentenceWordBank.map((word) => <button key={word} className={cn(placedSentenceWords.includes(word) && "used")} onClick={() => chooseSentenceWord(word)}>{word}</button>)}</div>
                    {sentenceSolved && <div className="sentence-success-strip" aria-hidden="true"><span>قرأتها صح!</span><i>✦</i><span>Great job!</span><i>★</i></div>}
                    {!sentenceSolved && placedSentenceWords.length > 0 && <button className="reset-words" onClick={resetSentenceRound}><RotateCcw size={14} /> أفرغ السطر</button>}
                    {sentenceSolved && <button type="button" className="next-game-button" onClick={nextSentenceRound}>الجولة التالية <ArrowLeft size={16} /></button>}
                  </>}
                </div>
                <div className={cn("game-feedback", gameFeedback && "show")} aria-live="polite"><Sparkles size={15} /> {gameFeedback}</div>
              </div>
            </section>}

            {page !== "progress" && <div className="lesson-footer"><span><Sparkles size={15} /> التعلّم بالتكرار يصنع الفرق</span><button onClick={() => { setActiveLetterIndex(0); setQuizAnswer(null); setSentenceCategory("الكل"); setSentenceSearch(""); setSentencePage(1); }}>ابدأ من البداية <RotateCcw size={14} /></button></div>}
          </div>
        </section>
      </main>
      {engineSettingsOpen && <div className="engine-settings-overlay" onClick={() => setEngineSettingsOpen(false)}>
        <div className="engine-settings" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="إعدادات محرك تقييم النطق">
          <div className="engine-settings-head"><b>محرك تقييم النطق</b><button onClick={() => setEngineSettingsOpen(false)} aria-label="إغلاق"><X size={16} /></button></div>
          <p className="engine-settings-intro">التطبيق يقيّم نطق الطفل بأفضل محرك متاح، بالترتيب التالي:</p>
          <ol className="engine-list">
            <li className={serverEngineReady ? "on" : undefined}><b>المحرك الاحترافي المجاني — Whisper عبر Groq (مفتوح المصدر)</b><span>دقة عالية لكل كلمة وجملة بدون أي تنزيل على جهاز الطفل. مجاني 100% بدون بطاقة — مفتاح مجاني من console.groq.com يعطي 2000 تقييم يوميًا.</span></li>
            <li><b>محرك المتصفح المجاني</b><span>يعمل فورًا في كروم وإيدج وسفاري بدون أي إعداد.</span></li>
            <li className={smartEngineStatus === "ready" ? "on" : undefined}><b>المحرك الذكي داخل الجهاز</b><span>اختياري — تنزيل مرة واحدة (~45 م.ب) ثم يعمل بدون إنترنت.</span></li>
          </ol>
          <div className="engine-status-line">
            {serverEngineReady ? <><Check size={14} /> المحرك الاحترافي المجاني (Groq) مفعّل حاليًا</> : proEngineStatus === "checking" ? "جاري فحص المحرك الاحترافي…" : azureEngineReady ? <><Check size={14} /> مفعّل بمفتاح Azure — لإضافة المحرك المجاني اتبع الخطوات بالأسفل</> : "المحرك الاحترافي المجاني غير مفعّل — يعمل التطبيق بالمحرك المجاني"}
          </div>
          <div className="engine-fields">
            <label>مفتاح Groq المجاني (هذا الجهاز فقط)<input dir="ltr" value={groqKeyInput} onChange={(event) => setGroqKeyInput(event.target.value)} placeholder="gsk_... من console.groq.com/keys" autoComplete="off" /></label>
          </div>
          <div className="engine-settings-actions">
            <button className="engine-save" onClick={() => {
              if (!groqKeyInput.trim()) {
                setEngineSettingsNotice("اكتب مفتاح Groq — أو استخدم طريقة Vercel بالأسفل ليعمل لكل الزوار.");
                return;
              }
              saveParentGroqKey(groqKeyInput);
              setServerEngineReady(true);
              setProEngineStatus("ready");
              setEngineSettingsNotice("تم التفعيل! التقييم الاحترافي المجاني يعمل من المحاولة القادمة.");
            }}>حفظ وتفعيل</button>
            <button className="engine-clear" onClick={() => {
              clearParentGroqKey();
              setGroqKeyInput("");
              void probeServerAssessment().then((serverOk) => {
                setServerEngineReady(serverOk);
                setProEngineStatus(serverOk || azureEngineReady ? "ready" : "unavailable");
              });
              setEngineSettingsNotice("تم مسح مفتاح هذا الجهاز — لو المفتاح مضاف على Vercel سيظل يعمل لكل الزوار.");
            }}>مسح مفتاح الجهاز</button>
          </div>
          {engineSettingsNotice && <p className="engine-settings-notice" aria-live="polite">{engineSettingsNotice}</p>}
          <p className="engine-settings-help">الأفضل لكل الزوار: أنشئ مفتاحًا مجانيًا في console.groq.com/keys (بدون بطاقة)، ثم في Vercel ← Settings ← Environment Variables أضف GROQ_API_KEY والصق المفتاح واعمل Redeploy — فيعمل المحرك الاحترافي لكل الزوار تلقائيًا بدون هذه النافذة.</p>
          <details className="engine-advanced">
            <summary>بديل متقدم: Microsoft Azure (يحتاج بطاقة عند التسجيل)</summary>
            <div className="engine-fields">
              <label>مفتاح Azure Speech<input dir="ltr" value={azureKeyInput} onChange={(event) => setAzureKeyInput(event.target.value)} placeholder="Key من بوابة Azure" autoComplete="off" /></label>
              <label>المنطقة Region<input dir="ltr" value={azureRegionInput} onChange={(event) => setAzureRegionInput(event.target.value)} placeholder="eastus" autoComplete="off" /></label>
            </div>
            <div className="engine-settings-actions">
              <button className="engine-save" onClick={() => {
                if (!azureKeyInput.trim() || !azureRegionInput.trim()) {
                  setEngineSettingsNotice("اكتب مفتاح Azure والمنطقة معًا — أو امسح الحقول.");
                  return;
                }
                saveParentAzureConfig(azureKeyInput, azureRegionInput);
                setAzureEngineReady(true);
                setProEngineStatus("ready");
                setEngineSettingsNotice("تم حفظ مفتاح Azure — يعمل من المحاولة القادمة.");
              }}>حفظ مفتاح Azure</button>
              <button className="engine-clear" onClick={() => {
                clearParentAzureConfig();
                setAzureKeyInput("");
                setAzureRegionInput("");
                void resolveAzureCredentials().then((credentials) => {
                  setAzureEngineReady(Boolean(credentials));
                  setProEngineStatus(serverEngineReady || credentials ? "ready" : "unavailable");
                });
                setEngineSettingsNotice("تم مسح مفتاح Azure.");
              }}>مسح مفتاح Azure</button>
            </div>
          </details>
        </div>
      </div>}
      <footer className="footer container"><span>صُمّم بحبّ للعقول الصغيرة.</span><span>English Kids Quest <span className="footer-dot">·</span> رحلة اليوم تبدأ بحرف</span></footer>
    </div>
  );
}
