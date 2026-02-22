export function getStrengthScore(password) {
  let score = 0;
  if (!password) return score;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

export function getStrengthLabel(password) {
  const score = getStrengthScore(password);
  if (score <= 2) return "Weak";
  if (score <= 4) return "Medium";
  return "Strong";
}

export function detectPasswordRequirements({ siteUrl = "", policyText = "", fallbackLength = 16 } = {}) {
  const text = `${String(siteUrl || "")} ${String(policyText || "")}`.toLowerCase();
  const minLength = detectMinLength(text, fallbackLength);

  const allowed = {
    lowercase: true,
    uppercase: true,
    numbers: true,
    symbols: true
  };

  if (/(alphanumeric|alfanumer|letters and numbers|letras y numeros|sin simbol|no special|without special)/i.test(text)) {
    allowed.symbols = false;
  }
  if (/(numbers only|numeric only|solo numeros|pin)/i.test(text)) {
    allowed.lowercase = false;
    allowed.uppercase = false;
    allowed.numbers = true;
    allowed.symbols = false;
  }
  if (/(letters only|alpha only|solo letras)/i.test(text)) {
    allowed.lowercase = true;
    allowed.uppercase = true;
    allowed.numbers = false;
    allowed.symbols = false;
  }
  if (/(lowercase only|solo minusculas)/i.test(text)) {
    allowed.lowercase = true;
    allowed.uppercase = false;
    allowed.symbols = false;
  }
  if (/(uppercase only|solo mayusculas)/i.test(text)) {
    allowed.lowercase = false;
    allowed.uppercase = true;
    allowed.symbols = false;
  }

  if (/(at least one uppercase|una mayuscula|one upper|1 upper)/i.test(text)) allowed.uppercase = true;
  if (/(at least one lowercase|una minuscula|one lower|1 lower)/i.test(text)) allowed.lowercase = true;
  if (/(at least one number|un numero|one digit|1 digit)/i.test(text)) allowed.numbers = true;
  if (/(at least one special|un simbolo|one special|1 special)/i.test(text)) allowed.symbols = true;

  if (!allowed.lowercase && !allowed.uppercase && !allowed.numbers && !allowed.symbols) {
    allowed.lowercase = true;
    allowed.uppercase = true;
    allowed.numbers = true;
  }

  return {
    minLength,
    allowed,
    allowedSummary: buildAllowedSummary(allowed)
  };
}

function detectMinLength(text, fallbackLength) {
  const patterns = [
    /(\d{1,3})\s*[-–]\s*\d{1,3}\s*(?:caracter|character|char)/i,
    /(?:min(?:imo|imum)?|at least|al menos)\D{0,16}(\d{1,3})/i,
    /(\d{1,3})\s*\+\s*(?:caracter|character|char)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value) && value >= 4 && value <= 128) return value;
  }
  return Math.max(8, Number(fallbackLength) || 16);
}

function buildAllowedSummary(allowed) {
  const parts = [];
  if (allowed.lowercase) parts.push("minusculas");
  if (allowed.uppercase) parts.push("mayusculas");
  if (allowed.numbers) parts.push("numeros");
  if (allowed.symbols) parts.push("simbolos");
  return parts.join(", ");
}
