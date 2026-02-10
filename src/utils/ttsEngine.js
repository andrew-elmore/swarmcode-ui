// ttsEngine.js — Web Speech API TTS engine with text preprocessing pipeline

const AGENT_NAMES = {
  "pm-1": "p m 1",
  "qa-1": "q a 1",
  "senior-dev-1": "senior dev 1",
  "developer-1": "developer 1",
  "devops-1": "dev ops 1",
};

// Convert a number 0-99 to words
function twoDigitWords(n) {
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  if (n < 20) return ones[n];
  const t = tens[Math.floor(n / 10)];
  const o = ones[n % 10];
  return o ? `${t} ${o}` : t;
}

// Custom number reading per spec:
// 100-999: "X YY" (e.g. 123 -> "one twenty three")
// 1000-9999: "XX YY" (e.g. 2345 -> "twenty three forty five")
function readNumber(numStr) {
  const n = parseInt(numStr, 10);
  if (isNaN(n) || n < 100 || n >= 10000) return numStr;

  if (n < 1000) {
    const hundreds = Math.floor(n / 100);
    const remainder = n % 100;
    if (remainder === 0) return `${twoDigitWords(hundreds)} hundred`;
    if (remainder < 10) return `${twoDigitWords(hundreds)} oh ${twoDigitWords(remainder)}`;
    return `${twoDigitWords(hundreds)} ${twoDigitWords(remainder)}`;
  }

  // 1000-9999: split into two 2-digit groups
  const top = Math.floor(n / 100);
  const bottom = n % 100;
  if (bottom === 0) return `${twoDigitWords(top)} hundred`;
  if (bottom < 10) return `${twoDigitWords(top)} oh ${twoDigitWords(bottom)}`;
  return `${twoDigitWords(top)} ${twoDigitWords(bottom)}`;
}

export function preprocessText(text) {
  let t = text;

  // 1. Strip code blocks
  t = t.replace(/```[\s\S]*?```/g, "code block");
  t = t.replace(/`[^`]+`/g, "");

  // 2. URLs -> "link"
  t = t.replace(/https?:\/\/\S+/g, "link");

  // 3. File paths -> skip
  t = t.replace(/(?:[\w./\\-]+\/)+[\w.-]+\.\w+/g, "");

  // 4. Card ID normalization: CARD-024 -> "card 24"
  t = t.replace(/CARD-0*(\d+)/gi, (_, num) => `card ${parseInt(num, 10)}`);

  // 5. Agent name cleanup
  for (const [name, spoken] of Object.entries(AGENT_NAMES)) {
    t = t.replaceAll(name, spoken);
  }

  // 6. Strip special characters (keep speech-cadence punctuation)
  t = t.replace(/---+|===+/g, ".");
  t = t.replace(/[|~`*_#>[\]{}<>=]/g, "");

  // 7. Custom number reading for 3-4 digit numbers
  t = t.replace(/\b(\d{3,4})\b/g, (match) => readNumber(match));

  // 8. Final cleanup
  t = t.replace(/\s+/g, " ").trim();

  return t;
}

// Max utterance length to avoid browser limits (~32KB)
const MAX_UTTERANCE_LENGTH = 4000;

function chunkText(text) {
  if (text.length <= MAX_UTTERANCE_LENGTH) return [text];
  const chunks = [];
  const paragraphs = text.split(/\n\n+/);
  let current = "";
  for (const para of paragraphs) {
    if (current.length + para.length + 2 > MAX_UTTERANCE_LENGTH && current) {
      chunks.push(current.trim());
      current = para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length ? chunks : [text.slice(0, MAX_UTTERANCE_LENGTH)];
}

export default class TtsEngine {
  constructor() {
    this._synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    this._enabled = false;
    this._rate = 1.0;
    this._volume = 1.0;
    this._voice = null;
    this._queue = [];
    this._speaking = false;

    // Voices load async in some browsers
    if (this._synth && this._synth.onvoiceschanged !== undefined) {
      this._synth.onvoiceschanged = () => this._pickDefaultVoice();
    }
    this._pickDefaultVoice();

    // Pause/resume on visibility change to avoid browser throttling
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (!this._synth) return;
        if (document.hidden) {
          this._synth.pause();
        } else {
          this._synth.resume();
        }
      });
    }
  }

  _pickDefaultVoice() {
    if (!this._synth || this._voice) return;
    const voices = this._synth.getVoices();
    // Prefer an English voice
    this._voice = voices.find((v) => v.lang.startsWith("en") && v.default)
      || voices.find((v) => v.lang.startsWith("en"))
      || voices[0] || null;
  }

  get enabled() { return this._enabled; }
  get speaking() { return this._speaking; }
  get rate() { return this._rate; }
  get volume() { return this._volume; }
  get voice() { return this._voice; }

  getVoices() {
    return this._synth ? this._synth.getVoices() : [];
  }

  setEnabled(val) {
    this._enabled = val;
    if (!val) this.stop();
  }

  setRate(rate) { this._rate = Math.max(0.5, Math.min(2.0, rate)); }
  setVolume(vol) { this._volume = Math.max(0, Math.min(1, vol)); }

  setVoice(voice) {
    this._voice = voice;
  }

  speak(text) {
    if (!this._enabled || !this._synth || !text) return;
    const processed = preprocessText(text);
    if (!processed) return;
    const chunks = chunkText(processed);
    this._queue.push(...chunks);
    if (!this._speaking) this._processQueue();
  }

  stop() {
    this._queue = [];
    this._speaking = false;
    if (this._synth) this._synth.cancel();
  }

  pause() { if (this._synth) this._synth.pause(); }
  resume() { if (this._synth) this._synth.resume(); }

  _processQueue() {
    if (this._queue.length === 0) {
      this._speaking = false;
      return;
    }
    this._speaking = true;
    const text = this._queue.shift();
    const utterance = new SpeechSynthesisUtterance(text);
    if (this._voice) utterance.voice = this._voice;
    utterance.rate = this._rate;
    utterance.volume = this._volume;
    utterance.onend = () => this._processQueue();
    utterance.onerror = () => this._processQueue();
    this._synth.speak(utterance);
  }
}
