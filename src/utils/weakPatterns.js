export function analyzeWeakPatterns(items = []) {
  const cleanItems = Array.isArray(items) ? items.filter((item) => isUsablePassword(item?.password)) : [];
  const reasonById = new Map();

  const duplicateGroups = buildDuplicateGroups(cleanItems);
  for (const group of duplicateGroups) {
    for (const item of group.items) {
      addReason(reasonById, item.id, "reused");
    }
  }

  const similarPairs = buildSimilarPairs(cleanItems, reasonById);

  for (const item of cleanItems) {
    if (hasWeakSequence(item.password)) {
      addReason(reasonById, item.id, "sequence");
    }
  }

  const affectedEntries = cleanItems
    .map((item) => ({
      id: item.id,
      service: item.service,
      reasons: Array.from(reasonById.get(item.id) || [])
    }))
    .filter((entry) => entry.reasons.length > 0);

  const reusedCount = affectedEntries.filter((entry) => entry.reasons.includes("reused")).length;
  const similarCount = affectedEntries.filter((entry) => entry.reasons.includes("similar")).length;
  const sequenceCount = affectedEntries.filter((entry) => entry.reasons.includes("sequence")).length;

  return {
    affectedCount: affectedEntries.length,
    reusedCount,
    similarCount,
    sequenceCount,
    duplicateGroups,
    similarPairs,
    affectedEntries
  };
}

function buildDuplicateGroups(items) {
  const byPassword = new Map();
  for (const item of items) {
    const key = String(item.password || "");
    const group = byPassword.get(key) || [];
    group.push(item);
    byPassword.set(key, group);
  }
  return Array.from(byPassword.values())
    .filter((group) => group.length > 1)
    .map((group) => ({
      password: group[0]?.password || "",
      items: group
    }))
    .sort((a, b) => b.items.length - a.items.length);
}

function buildSimilarPairs(items, reasonById) {
  const pairs = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const left = items[i];
      const right = items[j];
      if (String(left.password) === String(right.password)) continue;
      const score = getSimilarityScore(left.password, right.password);
      if (score < 0.78) continue;
      addReason(reasonById, left.id, "similar");
      addReason(reasonById, right.id, "similar");
      pairs.push({
        leftId: left.id,
        leftService: left.service,
        rightId: right.id,
        rightService: right.service,
        score
      });
    }
  }
  return pairs.sort((a, b) => b.score - a.score);
}

function getSimilarityScore(a, b) {
  const left = normalizeForSimilarity(a);
  const right = normalizeForSimilarity(b);
  if (!left || !right) return 0;
  if (left === right) return 1;
  const leftBigrams = toBigrams(left);
  const rightBigrams = toBigrams(right);
  if (leftBigrams.length === 0 || rightBigrams.length === 0) return 0;

  let intersection = 0;
  const rightCount = new Map();
  for (const gram of rightBigrams) {
    rightCount.set(gram, (rightCount.get(gram) || 0) + 1);
  }
  for (const gram of leftBigrams) {
    const count = rightCount.get(gram) || 0;
    if (count > 0) {
      intersection += 1;
      rightCount.set(gram, count - 1);
    }
  }
  return (2 * intersection) / (leftBigrams.length + rightBigrams.length);
}

function toBigrams(value) {
  if (value.length < 2) return [];
  const grams = [];
  for (let i = 0; i < value.length - 1; i += 1) {
    grams.push(value.slice(i, i + 2));
  }
  return grams;
}

function normalizeForSimilarity(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function hasWeakSequence(password) {
  const raw = String(password || "");
  if (/(.)\1{3,}/.test(raw)) return true;

  const normalized = normalizeForSimilarity(raw);
  if (normalized.length < 4) return false;
  if (containsStraightSequence(normalized, 4)) return true;
  if (containsKnownKeyboardSequence(normalized)) return true;
  return false;
}

function containsStraightSequence(value, minLen) {
  const chars = value.split("").map((ch) => ch.charCodeAt(0));
  let asc = 1;
  let desc = 1;
  for (let i = 1; i < chars.length; i += 1) {
    const delta = chars[i] - chars[i - 1];
    asc = delta === 1 ? asc + 1 : 1;
    desc = delta === -1 ? desc + 1 : 1;
    if (asc >= minLen || desc >= minLen) return true;
  }
  return false;
}

function containsKnownKeyboardSequence(value) {
  const patterns = [
    "0123456789",
    "abcdefghijklmnopqrstuvwxyz",
    "qwertyuiop",
    "asdfghjkl",
    "zxcvbnm"
  ];
  for (const pattern of patterns) {
    const reverse = pattern.split("").reverse().join("");
    for (let len = 4; len <= pattern.length; len += 1) {
      for (let i = 0; i <= pattern.length - len; i += 1) {
        const piece = pattern.slice(i, i + len);
        const reversePiece = reverse.slice(i, i + len);
        if (value.includes(piece) || value.includes(reversePiece)) return true;
      }
    }
  }
  return false;
}

function addReason(reasonById, id, reason) {
  const key = String(id || "");
  if (!key) return;
  const current = reasonById.get(key) || new Set();
  current.add(reason);
  reasonById.set(key, current);
}

function isUsablePassword(password) {
  const value = String(password || "");
  if (!value) return false;
  if (value.startsWith("[")) return false;
  return true;
}
