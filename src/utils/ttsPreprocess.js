// CARD-090: Client-side text preprocessing for browser speechSynthesis
// Ported from swarmcode-api/cloud/ttsPreprocess.js

const AGENT_NAMES = {
  "pm-1": "p m 1",
  "qa-1": "q a 1",
  "senior-dev-1": "senior dev 1",
  "developer-1": "developer 1",
  "devops-1": "dev ops 1",
};

function twoDigitWords(n) {
  const ones = [
    "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
    "seventeen", "eighteen", "nineteen",
  ];
  const tens = [
    "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
  ];
  if (n < 20) return ones[n];
  const t = tens[Math.floor(n / 10)];
  const o = ones[n % 10];
  return o ? `${t} ${o}` : t;
}

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

  const top = Math.floor(n / 100);
  const bottom = n % 100;
  if (bottom === 0) return `${twoDigitWords(top)} hundred`;
  if (bottom < 10) return `${twoDigitWords(top)} oh ${twoDigitWords(bottom)}`;
  return `${twoDigitWords(top)} ${twoDigitWords(bottom)}`;
}

export function ttsPreprocess(text) {
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
