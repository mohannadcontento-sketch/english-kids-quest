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
import { getEmbeddedAudioCue, type AudioCue } from "@/lib/embeddedAudio";
import { useLocation } from "wouter";

type Mode = "letters" | "sentences";
type SentenceCategory = "الكل" | "التحية" | "اللباقة" | "البيت" | "المشاعر" | "اللعب" | "التعلّم";
type GameMode = "listen" | "match" | "sentence";
type PronunciationPhase = "ready" | "listening" | "retry" | "success" | "unavailable";
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
  abort: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

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
  { letter: "A", lower: "a", sound: "ay", ipa: "/eɪ/", word: "apple", wordAr: "تفاحة", hint: "إي" },
  { letter: "B", lower: "b", sound: "bee", ipa: "/biː/", word: "ball", wordAr: "كرة", hint: "بي" },
  { letter: "C", lower: "c", sound: "see", ipa: "/siː/", word: "cat", wordAr: "قطة", hint: "سي" },
  { letter: "D", lower: "d", sound: "dee", ipa: "/diː/", word: "dog", wordAr: "كلب", hint: "دي" },
  { letter: "E", lower: "e", sound: "ee", ipa: "/iː/", word: "egg", wordAr: "بيضة", hint: "إي طويلة" },
  { letter: "F", lower: "f", sound: "ef", ipa: "/ɛf/", word: "fish", wordAr: "سمكة", hint: "إف" },
  { letter: "G", lower: "g", sound: "gee", ipa: "/dʒiː/", word: "goat", wordAr: "ماعز", hint: "جي" },
  { letter: "H", lower: "h", sound: "aitch", ipa: "/eɪtʃ/", word: "hat", wordAr: "قبعة", hint: "إيتش" },
  { letter: "I", lower: "i", sound: "eye", ipa: "/aɪ/", word: "ice", wordAr: "ثلج", hint: "آي" },
  { letter: "J", lower: "j", sound: "jay", ipa: "/dʒeɪ/", word: "juice", wordAr: "عصير", hint: "جاي" },
  { letter: "K", lower: "k", sound: "kay", ipa: "/keɪ/", word: "kite", wordAr: "طائرة ورقية", hint: "كاي" },
  { letter: "L", lower: "l", sound: "el", ipa: "/ɛl/", word: "lion", wordAr: "أسد", hint: "إل" },
  { letter: "M", lower: "m", sound: "em", ipa: "/ɛm/", word: "moon", wordAr: "قمر", hint: "إم" },
  { letter: "N", lower: "n", sound: "en", ipa: "/ɛn/", word: "nose", wordAr: "أنف", hint: "إن" },
  { letter: "O", lower: "o", sound: "oh", ipa: "/oʊ/", word: "orange", wordAr: "برتقالة", hint: "أو" },
  { letter: "P", lower: "p", sound: "pee", ipa: "/piː/", word: "pig", wordAr: "خنزير", hint: "بي" },
  { letter: "Q", lower: "q", sound: "cue", ipa: "/kjuː/", word: "queen", wordAr: "ملكة", hint: "كيو" },
  { letter: "R", lower: "r", sound: "ar", ipa: "/ɑːr/", word: "rabbit", wordAr: "أرنب", hint: "آر" },
  { letter: "S", lower: "s", sound: "ess", ipa: "/ɛs/", word: "sun", wordAr: "شمس", hint: "إس" },
  { letter: "T", lower: "t", sound: "tee", ipa: "/tiː/", word: "tree", wordAr: "شجرة", hint: "تي" },
  { letter: "U", lower: "u", sound: "you", ipa: "/juː/", word: "umbrella", wordAr: "مظلة", hint: "يو" },
  { letter: "V", lower: "v", sound: "vee", ipa: "/viː/", word: "van", wordAr: "شاحنة", hint: "في" },
  { letter: "W", lower: "w", sound: "double-u", ipa: "/ˈdʌbəljuː/", word: "water", wordAr: "ماء", hint: "دَبْل يو" },
  { letter: "X", lower: "x", sound: "ex", ipa: "/ɛks/", word: "box", wordAr: "صندوق", hint: "إكس" },
  { letter: "Y", lower: "y", sound: "why", ipa: "/waɪ/", word: "yellow", wordAr: "أصفر", hint: "واي" },
  { letter: "Z", lower: "z", sound: "zee", ipa: "/ziː/", word: "zebra", wordAr: "حمار وحشي", hint: "زي" },
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
const heroImage = "/manus-storage/ekq-hero-paper_4e4c8bc5.jpg";
const lettersImage = "/manus-storage/ekq-letters-paper_058e5971.jpg";
const sentencesImage = "/manus-storage/ekq-sentences-paper_b1734710.jpg";
const mascotImage = "/manus-storage/ekq-logo-paper_aa515140.png";
const logoImage = "/manus-storage/ekq-logo-paper_aa515140.png";
const sentencePuzzles = [
  { arabic: "صباح الخير.", words: ["Good", "morning."], sentenceIndex: 1 },
  { arabic: "كيف حالك؟", words: ["How", "are", "you?"], sentenceIndex: 3 },
  { arabic: "شكرًا لك.", words: ["Thank", "you."], sentenceIndex: 9 },
  { arabic: "هيا نلعب!", words: ["Let's", "play!"], sentenceIndex: 25 },
  { arabic: "أنا مستعد.", words: ["I", "am", "ready."], sentenceIndex: 36 },
];

function shuffleChoices<T>(choices: T[]): T[] {
  const shuffled = [...choices];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function normalizeSpokenEnglish(value: string) {
  return value.toLowerCase().replace(/[^a-z\s']/g, "").replace(/\s+/g, " ").trim();
}

function wordSimilarity(spoken: string, expected: string) {
  const source = normalizeSpokenEnglish(spoken).replace(/'s$/, "").replace(/s$/, "");
  const target = normalizeSpokenEnglish(expected);
  if (!source || !target) return 0;
  if (source === target || source.split(" ").includes(target)) return 1;
  const rows = target.length + 1;
  const columns = source.length + 1;
  const matrix = Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => row === 0 ? column : column === 0 ? row : 0));
  for (let row = 1; row < rows; row += 1) for (let column = 1; column < columns; column += 1) matrix[row][column] = Math.min(matrix[row - 1][column] + 1, matrix[row][column - 1] + 1, matrix[row - 1][column - 1] + (target[row - 1] === source[column - 1] ? 0 : 1));
  return 1 - matrix[rows - 1][columns - 1] / Math.max(target.length, source.length);
}

function sentenceSimilarity(spoken: string, expected: string) {
  const source = normalizeSpokenEnglish(spoken);
  const target = normalizeSpokenEnglish(expected);
  if (!source || !target) return 0;
  const targetWords = target.split(" ");
  const spokenWords = source.split(" ");
  const matchedWords = targetWords.filter((word) => spokenWords.some((candidate) => wordSimilarity(candidate, word) >= 0.78)).length;
  const coverage = matchedWords / targetWords.length;
  return Math.max(wordSimilarity(source, target), coverage);
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
  const audioFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

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
    audioRef.current?.pause();
    recognitionRef.current?.abort();
    if (audioFrameRef.current !== null) window.cancelAnimationFrame(audioFrameRef.current);
  }, []);

  useEffect(() => {
    const browserWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    setSpeechRecognitionSupported(Boolean(browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition));
  }, []);

  const playEmbeddedAudio = (cue: AudioCue | null) => {
    setSpeechNotice("");
    audioRef.current?.pause();
    if (audioFrameRef.current !== null) window.cancelAnimationFrame(audioFrameRef.current);
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
      if (audioFrameRef.current !== null) window.cancelAnimationFrame(audioFrameRef.current);
      audio.pause();
      setIsSpeaking(false);
      setSpeechNotice("");
    };
    const monitor = () => {
      if (audio.currentTime >= cue.end || audio.ended) {
        stop();
        return;
      }
      audioFrameRef.current = window.requestAnimationFrame(monitor);
    };
    audio.onplay = () => {
      setIsSpeaking(true);
      setSpeechNotice("جاري النطق بالإنجليزية...");
      audioFrameRef.current = window.requestAnimationFrame(monitor);
    };
    audio.onended = stop;
    audio.onerror = () => {
      setIsSpeaking(false);
      setSpeechNotice("تعذر تشغيل ملف الصوت. أعد تحميل الصفحة ثم حاول مرة أخرى.");
    };
    audio.currentTime = cue.start;
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

  const showPronunciationRetry = (message: string) => {
    const nextAttempt = pronunciationAttempts + 1;
    setPronunciationAttempts(nextAttempt);
    setPronunciationPhase("retry");
    setPronunciationFeedback(nextAttempt >= 2 ? `${message} لا بأس. اسمع الكلمة مرة أخرى ثم قلها بهدوء.` : `${message} اضغط «اسمع الكلمة» ثم حاول مرة أخرى.`);
  };

  const startPronunciationCheck = () => {
    const browserWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const Recognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setPronunciationPhase("unavailable");
      setPronunciationFeedback("هذا التدريب يعمل في Chrome أو Edge على جهاز يدعم الميكروفون.");
      return;
    }
    audioRef.current?.pause();
    recognitionRef.current?.abort();
    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 5;
    recognitionRef.current = recognition;
    recognition.onstart = () => {
      setIsChildSpeaking(true);
      setPronunciationPhase("listening");
      setPronunciationFeedback("قل الكلمة الآن بهدوء… نحن نستمع.");
      setPronunciationHeard("");
    };
    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const candidates = Array.from({ length: result?.length ?? 0 }, (_, index) => result[index]?.transcript ?? "").filter(Boolean);
      const transcript = candidates[0] ?? "";
      if (result && result.isFinal === false) {
        setPronunciationHeard(transcript);
        setPronunciationFeedback("نسمعك… أكمل الكلمة بهدوء.");
        return;
      }
      const expected = activeLetter.word;
      const match = Math.max(...candidates.map((candidate) => wordSimilarity(candidate, expected)), 0);
      setPronunciationHeard(transcript);
      setPronunciationMatch(match);
      if (match >= 0.82) {
        giveReward(1, `أحسنت! سمعنا كلمة ${activeLetter.word} بوضوح.`, "speech");
        setPronunciationPhase("success");
        setPronunciationFeedback(`صح! أحسنت، قلت كلمة ${activeLetter.word} بشكل صحيح.`);
      } else {
        setWrongPulse(Date.now());
        showPronunciationRetry(match >= 0.55 ? "قريب جدًا! جرّب أن تقول الكلمة ببطء أكثر." : "لم تطابق الكلمة بعد.");
      }
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setPronunciationPhase("unavailable");
        setPronunciationFeedback("اسمح للميكروفون من إعدادات المتصفح ثم جرّب.");
      } else if (event.error === "no-speech") {
        showPronunciationRetry("لم نسمع كلمة.");
      } else {
        showPronunciationRetry("تعذر التقاط الكلمة الآن.");
      }
    };
    recognition.onend = () => setIsChildSpeaking(false);
    try {
      recognition.start();
    } catch {
      setIsChildSpeaking(false);
      setPronunciationFeedback("أغلق التدريب السابق ثم حاول مرة أخرى.");
    }
  };

  const playSentencePracticeModel = (sentence: SentenceLesson) => {
    updateSentencePractice(sentence.id, { phase: "ready", feedback: "اسمع الجملة كاملة، ثم اضغط «قل الآن». ", hasHeardModel: true, heard: "", match: null });
    playEmbeddedAudio(getEmbeddedAudioCue("sentence", sentence.id - 1));
  };

  const startSentencePronunciationCheck = (sentence: SentenceLesson) => {
    const browserWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const Recognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      updateSentencePractice(sentence.id, { phase: "unavailable", feedback: "هذا التدريب يعمل في Chrome أو Edge على جهاز يدعم الميكروفون." });
      return;
    }
    audioRef.current?.pause();
    recognitionRef.current?.abort();
    const recognition = new Recognition();
    let finished = false;
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 5;
    recognitionRef.current = recognition;
    recognition.onstart = () => {
      setIsChildSpeaking(true);
      updateSentencePractice(sentence.id, { phase: "listening", feedback: "قل الجملة بهدوء… نحن نستمع.", heard: "", match: null });
    };
    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const candidates = Array.from({ length: result?.length ?? 0 }, (_, index) => result[index]?.transcript ?? "").filter(Boolean);
      const transcript = candidates[0] ?? "";
      if (result && result.isFinal === false) {
        updateSentencePractice(sentence.id, { phase: "listening", heard: transcript, feedback: "نسمعك… أكمل الجملة." });
        return;
      }
      finished = true;
      const match = Math.max(...candidates.map((candidate) => sentenceSimilarity(candidate, sentence.english)), 0);
      if (match >= 0.76) {
        setCompletedSentences((current) => new Set(current).add(sentence.id));
        giveReward(2, `أحسنت! قلت جملة ${sentence.english} بوضوح.`, "speech");
        updateSentencePractice(sentence.id, { phase: "success", heard: transcript, match, feedback: "صح! قلت الجملة بشكل رائع." });
      } else {
        setWrongPulse(Date.now());
        const attempts = (sentencePractice.id === sentence.id ? sentencePractice.attempts : 0) + 1;
        updateSentencePractice(sentence.id, { phase: "retry", heard: transcript, match, attempts, feedback: match >= 0.45 ? "قريب جدًا! اسمعها مرة أخرى وقل الكلمات ببطء." : "حاول مرة أخرى بعد سماع الجملة كاملة." });
      }
    };
    recognition.onerror = (event) => {
      finished = true;
      const message = event.error === "not-allowed" ? "اسمح للميكروفون من إعدادات المتصفح ثم جرّب." : event.error === "no-speech" ? "لم نسمع جملة. جرّب في مكان أهدأ." : "تعذر التقاط الجملة الآن. حاول مرة أخرى.";
      updateSentencePractice(sentence.id, { phase: event.error === "not-allowed" ? "unavailable" : "retry", feedback: message });
    };
    recognition.onend = () => {
      setIsChildSpeaking(false);
      if (!finished) updateSentencePractice(sentence.id, { phase: "retry", feedback: "لم تكتمل الجملة. جرّب مرة أخرى ببطء." });
    };
    try {
      recognition.start();
    } catch {
      setIsChildSpeaking(false);
      updateSentencePractice(sentence.id, { phase: "retry", feedback: "أغلق التسجيل السابق ثم حاول مرة أخرى." });
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
        <a className="brand" href="/" aria-label="English Kids Quest">
          <span className="brand-mark"><img src={logoImage} alt="" /><span className="brand-soundlines" aria-hidden="true"><i /><i /><i /></span></span>
          <span className="brand-copy">
            <strong>English Kids Quest</strong>
            <small>نتعلّمها باللعب</small>
          </span>
        </a>

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
              <a className="progress-next-step" href={nextStep.href}><span className="progress-next-icon"><Sparkles size={18} /></span><span><small>{nextStep.label}</small><b lang={nextStep.href === "/sentences" ? "en" : undefined}>{nextStep.title}</b><em>{nextStep.detail}</em></span><ArrowLeft size={19} /></a>
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
                    <div className="detail-label"><span>اسم الحرف</span><span className="ipa-chip">{activeLetter.ipa}</span></div>
                    <h3>{activeLetter.letter} <span>مثل</span> <strong>{activeLetter.word}</strong></h3>
                    <p className="word-translation">{activeLetter.wordAr} <span>·</span> النطق التقريبي: <b>{activeLetter.hint}</b></p>
                    <div className="sound-actions">
                      <button className={cn("sound-button", isSpeaking && "speaking")} onClick={() => playEmbeddedAudio(getEmbeddedAudioCue("letter", activeLetterIndex))}><Volume2 size={19} /> اسمع الحرف <span>{activeLetter.sound}</span></button>
                      <button className="word-sound" onClick={() => playEmbeddedAudio(getEmbeddedAudioCue("word", activeLetterIndex))}><Headphones size={17} /> اسمع الكلمة</button>
                    </div>
                    <div className="repeat-line"><span className="repeat-dots"><i /><i /><i /></span><span>جرّب أن تقولها: <b>{activeLetter.letter} — {activeLetter.word}</b></span></div>
                    <div className={cn("pronunciation-card", `phase-${pronunciationPhase}`)}>
                      <div className="pronunciation-copy"><span className="mic-sticker"><Mic size={15} /></span><div><b>قلها وخلّيني أصحح لك</b><small>اسمع كلمة <em lang="en">{activeLetter.word}</em>، ثم قلها في الميكروفون</small></div></div>
                      <div className="direct-pronunciation-flow"><span className={cn(hasHeardModel && "done")}><i>1</i><Volume2 size={13} /> اسمع الكلمة</span><span className={cn(isChildSpeaking && "current")}><i>2</i><Mic size={13} /> قلها</span></div>
                      {speechRecognitionSupported ? <div className="pronunciation-actions"><button className="hear-model-button" onClick={playPracticeModel}><Volume2 size={15} /> اسمع الكلمة</button><button className={cn("pronunciation-button", isChildSpeaking && "listening")} onClick={startPronunciationCheck} disabled={isChildSpeaking}><Mic size={16} /> {isChildSpeaking ? "نستمع…" : "قلها الآن"}</button></div> : <span className="speech-support-note">{speechRecognitionSupported === null ? "تجهيز الميكروفون…" : "متاح في Chrome وEdge"}</span>}
                      {pronunciationPhase === "success" && <div className="pronunciation-result correct"><Check size={18} /><div><b>صح! أحسنت</b><span>نطقت <em lang="en">{activeLetter.word}</em> بشكل صحيح</span></div></div>}
                      {pronunciationPhase === "retry" && <div className="pronunciation-result retry"><X size={18} /><div><b>حاول مرة أخرى</b><span>اسمع الكلمة ثم قلها ببطء</span></div></div>}
                      {pronunciationHeard && pronunciationPhase !== "listening" && <div className={cn("speech-heard", pronunciationPhase === "success" && "clear")}><span>سمعنا:</span><b lang="en">{pronunciationHeard}</b>{pronunciationMatch !== null && <small>{pronunciationMatch >= .82 ? "واضحة جدًا" : pronunciationMatch >= .55 ? "قريبة من الكلمة" : "جرّب ببطء أكثر"}</small>}</div>}
                      {pronunciationPhase === "retry" && <div className="pronunciation-hint"><span className="hint-letter" lang="en">{activeLetter.letter}</span><div><b>تلميح</b><p>الكلمة هي: <strong lang="en">{activeLetter.word}</strong></p><small>ابدأ بصوت <em>{activeLetter.hint}</em>.</small></div></div>}
                      {pronunciationFeedback && pronunciationPhase === "unavailable" && <p className="pronunciation-feedback">{pronunciationFeedback}</p>}
                      {pronunciationAttempts > 0 && pronunciationPhase === "retry" && <span className="attempt-badge">محاولة {pronunciationAttempts} · أنت تتعلم بشكل ممتاز</span>}
                      <p className="mic-privacy">اطلب مساعدة ولي الأمر. اللعبة لا تحفظ تسجيلًا صوتيًا.</p>
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
                <div className="sentences-grid">
                  {visibleSentences.map((sentence) => {
                    const isDone = completedSentences.has(sentence.id);
                    return <article className={cn("sentence-card", isDone && "is-done")} key={sentence.id}>
                      <div className="sentence-top"><span className="sentence-number">{String(sentence.id).padStart(2, "0")}</span><span className="sentence-category">{sentence.category}</span></div>
                      <p className="sentence-english" lang="en">{sentence.english}</p>
                      <p className="sentence-arabic">{sentence.arabic}</p>
                      <div className="sentence-actions"><button className={cn("sentence-play", isSpeaking && "speaking")} onClick={() => playSentencePracticeModel(sentence)} aria-label={`استمع إلى ${sentence.english}`}><Volume2 size={17} /> اسمع</button>{speechRecognitionSupported && <button className={cn("sentence-mic", sentencePractice.id === sentence.id && sentencePractice.phase === "listening" && "listening")} onClick={() => startSentencePronunciationCheck(sentence)} disabled={isChildSpeaking} aria-label={`قل الجملة ${sentence.english}`}><Mic size={16} /> {sentencePractice.id === sentence.id && sentencePractice.phase === "listening" ? "نسمع" : "قلها"}</button>}<button className={cn("bookmark-button", isDone && "saved")} onClick={() => toggleSentenceComplete(sentence.id)} aria-label={isDone ? "إلغاء حفظ الجملة" : "حفظ الجملة"}>{isDone ? <Check size={17} /> : <Bookmark size={17} />}</button></div>
                      {sentencePractice.id === sentence.id && sentencePractice.feedback && <div className={cn("sentence-practice-feedback", `phase-${sentencePractice.phase}`)} aria-live="polite"><span>{sentencePractice.phase === "success" ? <Check size={13} /> : sentencePractice.phase === "retry" ? <X size={13} /> : <Mic size={13} />}</span><div><b>{sentencePractice.phase === "success" ? "صح! أحسنت" : sentencePractice.phase === "retry" ? "حاول مرة أخرى" : sentencePractice.phase === "listening" ? "نستمع إليك" : "تدريب الجملة"}</b><p>{sentencePractice.feedback}</p>{sentencePractice.heard && sentencePractice.phase !== "listening" && <small>سمعنا: <em lang="en">{sentencePractice.heard}</em>{sentencePractice.match !== null && ` · ${sentencePractice.match >= .76 ? "واضحة جدًا" : sentencePractice.match >= .45 ? "قريبة من الجملة" : "قلها ببطء أكثر"}`}</small>}</div></div>}
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
      <footer className="footer container"><span>صُمّم بحبّ للعقول الصغيرة.</span><span>English Kids Quest <span className="footer-dot">·</span> رحلة اليوم تبدأ بحرف</span></footer>
    </div>
  );
}
