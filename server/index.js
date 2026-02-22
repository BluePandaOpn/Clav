import express from "express";
import cors from "cors";
import {
  clearCredentials,
  createCredential,
  deleteCredential,
  listCredentials,
  readStore,
  updateCredential
} from "./store.js";
import { generatePassword, getStrength } from "./password.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "password-manager-api" });
});

app.get("/api/credentials", async (req, res) => {
  const q = req.query.q || "";
  const data = await listCredentials(String(q));
  res.json({ items: data });
});

app.post("/api/credentials", async (req, res) => {
  const { service, username, password, category, notes } = req.body || {};
  if (!service || !password) {
    return res.status(400).json({ error: "service and password are required" });
  }
  const item = await createCredential({ service, username, password, category, notes });
  return res.status(201).json({ item });
});

app.put("/api/credentials/:id", async (req, res) => {
  const updated = await updateCredential(req.params.id, req.body || {});
  if (!updated) {
    return res.status(404).json({ error: "credential not found" });
  }
  return res.json({ item: updated });
});

app.delete("/api/credentials/:id", async (req, res) => {
  const deleted = await deleteCredential(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "credential not found" });
  }
  return res.status(204).send();
});

app.delete("/api/credentials", async (_req, res) => {
  await clearCredentials();
  res.status(204).send();
});

app.get("/api/stats", async (_req, res) => {
  const db = await readStore();
  const total = db.credentials.length;
  const byCategory = db.credentials.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});
  res.json({ total, byCategory });
});

app.get("/api/export", async (_req, res) => {
  const db = await readStore();
  res.setHeader("Content-Disposition", "attachment; filename=vault-export.json");
  res.json(db);
});

app.post("/api/generate", (req, res) => {
  try {
    const {
      length = 16,
      lowercase = true,
      uppercase = true,
      numbers = true,
      symbols = true
    } = req.body || {};
    const password = generatePassword({
      length: Number(length),
      lowercase: Boolean(lowercase),
      uppercase: Boolean(uppercase),
      numbers: Boolean(numbers),
      symbols: Boolean(symbols)
    });
    res.json({ password, strength: getStrength(password) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
