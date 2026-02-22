const ENTRY_TYPES = {
  LOGIN: "LOGIN",
  CREDIT_CARD: "CREDIT_CARD",
  SECURE_NOTE: "SECURE_NOTE",
  API_KEY: "API_KEY"
};

export function classifyEntryType({ service = "", username = "", password = "", notes = "" } = {}) {
  const serviceText = String(service || "");
  const usernameText = String(username || "");
  const passwordText = String(password || "");
  const notesText = String(notes || "");
  const merged = `${serviceText} ${usernameText} ${notesText}`.toLowerCase();

  if (looksLikeApiKey(passwordText, merged)) {
    return ENTRY_TYPES.API_KEY;
  }
  if (looksLikeCreditCard(passwordText, notesText, merged)) {
    return ENTRY_TYPES.CREDIT_CARD;
  }
  if (looksLikeSecureNote(serviceText, usernameText, passwordText, notesText, merged)) {
    return ENTRY_TYPES.SECURE_NOTE;
  }
  return ENTRY_TYPES.LOGIN;
}

function looksLikeApiKey(password, mergedText) {
  const value = String(password || "").trim();
  if (!value) return false;
  if (/\s/.test(value)) return false;

  const knownPrefixes = [
    /^sk_(live|test)_[a-z0-9]{16,}$/i,
    /^pk_(live|test)_[a-z0-9]{16,}$/i,
    /^gh[pousr]_[a-z0-9]{20,}$/i,
    /^xox[baprs]-[a-z0-9-]{10,}$/i,
    /^AKIA[0-9A-Z]{16}$/i,
    /^ya29\.[a-z0-9_-]+$/i,
    /^eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+$/i
  ];
  if (knownPrefixes.some((pattern) => pattern.test(value))) return true;

  if (/(api|token|secret|bearer|access key|api key|pat|private key)/i.test(mergedText)) {
    if (/^[A-Za-z0-9_.=:+/-]{20,}$/.test(value)) return true;
  }
  return false;
}

function looksLikeCreditCard(password, notes, mergedText) {
  if (/(tarjeta|credit card|card number|cvv|expiry|expira)/i.test(mergedText)) return true;

  const candidates = extractDigitCandidates(`${password} ${notes}`);
  return candidates.some((candidate) => isLikelyCardNumber(candidate));
}

function extractDigitCandidates(text) {
  const matches = String(text || "").match(/\b(?:\d[ -]?){13,19}\b/g) || [];
  return matches.map((raw) => raw.replace(/\D/g, ""));
}

function isLikelyCardNumber(digits) {
  if (!/^\d{13,19}$/.test(digits)) return false;
  return luhnCheck(digits);
}

function luhnCheck(value) {
  let sum = 0;
  let shouldDouble = false;
  for (let i = value.length - 1; i >= 0; i -= 1) {
    let digit = Number(value[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function looksLikeSecureNote(service, username, password, notes, mergedText) {
  if (/(secure note|nota segura|memo|nota privada)/i.test(mergedText)) return true;
  const noUsername = !String(username || "").trim();
  const shortPassword = String(password || "").trim().length < 10;
  const longNotes = String(notes || "").trim().length >= 40;
  const genericService = /^(note|nota|memo|secure note)$/i.test(String(service || "").trim());
  return longNotes && (noUsername || shortPassword || genericService);
}
