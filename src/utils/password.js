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
