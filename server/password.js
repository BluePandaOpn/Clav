import { randomInt } from "node:crypto";

const GROUPS = {
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/|~"
};

export function generatePassword(options = {}) {
  const {
    length = 16,
    lowercase = true,
    uppercase = true,
    numbers = true,
    symbols = true
  } = options;

  const selected = [
    lowercase && GROUPS.lowercase,
    uppercase && GROUPS.uppercase,
    numbers && GROUPS.numbers,
    symbols && GROUPS.symbols
  ].filter(Boolean);

  if (selected.length === 0) {
    throw new Error("At least one charset must be enabled.");
  }

  const pool = selected.join("");
  const output = [];
  for (let i = 0; i < length; i += 1) {
    output.push(pool[randomInt(0, pool.length)]);
  }
  return output.join("");
}

export function getStrength(password) {
  let score = 0;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return "weak";
  if (score <= 4) return "medium";
  return "strong";
}
