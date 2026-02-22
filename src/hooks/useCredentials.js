import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../utils/api.js";
import { API_BASE } from "../utils/api.js";

const OFFLINE_QUEUE_KEY = "vault_offline_ops_v053";

export function useCredentials(security) {
  const isUnlocked = Boolean(security?.isUnlocked);
  const saveEncryptedVault = security?.saveEncryptedVault;
  const loadEncryptedVault = security?.loadEncryptedVault;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offlineMode, setOfflineMode] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);
  const [pendingOps, setPendingOps] = useState(() => readPendingOps());
  const syncInFlightRef = useRef(false);
  const seenSyncIds = useRef(new Set());
  const clientId = useMemo(() => {
    const key = "vault_sync_client_id_v033";
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(key, created);
    return created;
  }, []);
  const counterRef = useRef(Number(localStorage.getItem(`vault_sync_counter_${clientId}`) || "0"));

  useEffect(() => {
    writePendingOps(pendingOps);
  }, [pendingOps]);

  const refresh = useCallback(async () => {
    if (!isUnlocked) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.listCredentials();
      setItems(data.items);
      await saveEncryptedVault?.(data.items);
      setOfflineMode(false);
    } catch (e) {
      setOfflineMode(true);
      const cached = (await loadEncryptedVault?.()) || [];
      if (cached.length > 0) {
        setItems(cached);
        setError(`API no disponible. Mostrando cache local cifrada: ${e.message}`);
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }, [isUnlocked, loadEncryptedVault, saveEncryptedVault]);

  useEffect(() => {
    if (!isUnlocked) return;
    refresh();
  }, [isUnlocked, refresh]);

  useEffect(() => {
    const onOnline = () => setOfflineMode(false);
    const onOffline = () => setOfflineMode(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!isUnlocked) return undefined;

    const onEvent = (raw) => {
      let event;
      try {
        event = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
        return;
      }
      if (!event?.id) return;
      if (seenSyncIds.current.has(event.id)) return;
      seenSyncIds.current.add(event.id);
      if (seenSyncIds.current.size > 400) {
        const first = seenSyncIds.current.values().next().value;
        if (first) seenSyncIds.current.delete(first);
      }

      if (event.type === "credential.upsert" && event.item) {
        setItems((prev) => {
          const idx = prev.findIndex((item) => item.id === event.item.id);
          const next = idx === -1 ? [event.item, ...prev] : prev.map((item) => (item.id === event.item.id ? event.item : item));
          saveEncryptedVault?.(next);
          return next;
        });
        return;
      }

      if (event.type === "credential.batch_upsert" && Array.isArray(event.items)) {
        setItems((prev) => {
          const map = new Map(prev.map((item) => [item.id, item]));
          for (const incoming of event.items) {
            if (!incoming?.id) continue;
            map.set(incoming.id, incoming);
          }
          const next = Array.from(map.values()).sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
          saveEncryptedVault?.(next);
          return next;
        });
        return;
      }

      if (event.type === "credential.delete" && event.id) {
        setItems((prev) => {
          const next = prev.filter((item) => item.id !== event.id);
          saveEncryptedVault?.(next);
          return next;
        });
        return;
      }

      if (event.type === "credential.clear") {
        setItems([]);
        saveEncryptedVault?.([]);
      }
    };

    if (offlineMode) return undefined;

    const sse = new EventSource(`${API_BASE}/sync/events`);
    sse.addEventListener("sync", (evt) => onEvent(evt.data));

    const wsUrl = buildWebSocketUrl();
    const ws = wsUrl ? new WebSocket(wsUrl) : null;
    if (ws) {
      ws.onmessage = (evt) => onEvent(evt.data);
    }

    return () => {
      sse.close();
      ws?.close();
    };
  }, [isUnlocked, saveEncryptedVault, offlineMode]);

  const syncNow = useCallback(async () => {
    if (!isUnlocked || syncInFlightRef.current) return;
    if (!navigator.onLine) {
      setOfflineMode(true);
      return;
    }
    if (pendingOps.length === 0) {
      await refresh();
      return;
    }
    syncInFlightRef.current = true;
    const idMap = new Map();
    try {
      let remaining = [...pendingOps];
      for (let idx = 0; idx < remaining.length; idx += 1) {
        const op = remaining[idx];
        if (op.type === "clear") {
          await api.clearCredentials();
          continue;
        }
        if (op.type === "create") {
          const data = await api.createCredential(op.payload);
          idMap.set(op.localId, data.item.id);
          setItems((prev) => {
            const next = prev.map((item) => (item.id === op.localId ? data.item : item));
            saveEncryptedVault?.(next);
            return next;
          });
          continue;
        }
        if (op.type === "delete") {
          const mappedId = idMap.get(op.targetId) || op.targetId;
          if (String(mappedId).startsWith("local-")) continue;
          await api.deleteCredential(mappedId);
        }
      }
      setPendingOps([]);
      await refresh();
      setOfflineMode(false);
    } catch {
      setOfflineMode(true);
    } finally {
      syncInFlightRef.current = false;
    }
  }, [isUnlocked, pendingOps, refresh, saveEncryptedVault]);

  useEffect(() => {
    if (!isUnlocked || pendingOps.length === 0 || offlineMode) return;
    syncNow();
  }, [isUnlocked, pendingOps.length, offlineMode, syncNow]);

  const addItem = useCallback(async (payload) => {
    const requestPayload = {
      ...payload,
      _crdt: nextCrdt(clientId, counterRef)
    };
    const localId = `local-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const optimistic = {
      id: localId,
      service: payload.service,
      username: payload.username || "",
      password: payload.password,
      category: payload.category || "General",
      notes: payload.notes || "",
      isSensitive: Boolean(payload.isSensitive),
      isHoney: false,
      createdAt: now,
      updatedAt: now,
      integrity: "offline_pending"
    };
    setItems((prev) => {
      const next = [optimistic, ...prev];
      saveEncryptedVault?.(next);
      return next;
    });
    try {
      if (offlineMode) throw new Error("offline");
      const data = await api.createCredential(requestPayload);
      setItems((prev) => {
        const next = prev.map((item) => (item.id === localId ? data.item : item));
        saveEncryptedVault?.(next);
        return next;
      });
      return data.item;
    } catch {
      setOfflineMode(true);
      setPendingOps((prev) => [...prev, { id: crypto.randomUUID(), type: "create", localId, payload: requestPayload }]);
      return optimistic;
    }
  }, [saveEncryptedVault, offlineMode]);

  const removeItem = useCallback(async (id) => {
    const isLocal = String(id).startsWith("local-");
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      saveEncryptedVault?.(next);
      return next;
    });
    if (isLocal) {
      setPendingOps((prev) => prev.filter((op) => !(op.type === "create" && op.localId === id)));
      return;
    }
    try {
      if (offlineMode) throw new Error("offline");
      await api.deleteCredential(id);
    } catch {
      setOfflineMode(true);
      setPendingOps((prev) => [
        ...prev,
        { opId: crypto.randomUUID(), type: "delete", targetId: String(id) }
      ]);
    }
  }, [saveEncryptedVault, offlineMode]);

  const clearAll = useCallback(async () => {
    setItems([]);
    saveEncryptedVault?.([]);
    try {
      if (offlineMode) throw new Error("offline");
      await api.clearCredentials();
      setPendingOps([]);
    } catch {
      setOfflineMode(true);
      setPendingOps([{ opId: crypto.randomUUID(), type: "clear" }]);
    }
  }, [saveEncryptedVault, offlineMode]);

  const generateHoneyPasswords = useCallback(async (count = 3) => {
    const data = await api.generateHoneyPasswords({ count });
    setItems((prev) => {
      const next = [...(data.items || []), ...prev];
      saveEncryptedVault?.(next);
      return next;
    });
    return data.items || [];
  }, [saveEncryptedVault]);

  const triggerHoneyAccess = useCallback(async (credentialId, action) => {
    const data = await api.triggerHoneyAccess({ credentialId, action });
    if (data?.item) {
      setItems((prev) => {
        const next = prev.map((item) => (item.id === data.item.id ? data.item : item));
        saveEncryptedVault?.(next);
        return next;
      });
    }
    return data;
  }, [saveEncryptedVault]);

  const checkCredentialBreach = useCallback(async (id) => {
    const data = await api.checkCredentialBreach(id);
    if (data?.item) {
      setItems((prev) => {
        const next = prev.map((item) => (item.id === data.item.id ? data.item : item));
        saveEncryptedVault?.(next);
        return next;
      });
    }
    return data?.item || null;
  }, [saveEncryptedVault]);

  const scanCredentialBreaches = useCallback(async () => {
    const data = await api.scanCredentialBreaches();
    if (Array.isArray(data?.items)) {
      setItems(data.items);
      saveEncryptedVault?.(data.items);
    }
    return data;
  }, [saveEncryptedVault]);

  const getCredentialHistory = useCallback(async (id) => {
    return api.getCredentialHistory(id);
  }, []);

  const updateRotationPolicy = useCallback(async (id, payload) => {
    const data = await api.updateCredentialRotationPolicy(id, payload);
    if (data?.item) {
      setItems((prev) => {
        const next = prev.map((item) => (item.id === data.item.id ? data.item : item));
        saveEncryptedVault?.(next);
        return next;
      });
    }
    return data?.item || null;
  }, [saveEncryptedVault]);

  const rotateCredentialNow = useCallback(async (id, reason = "manual") => {
    const data = await api.rotateCredential(id, { reason });
    if (data?.item) {
      setItems((prev) => {
        const next = prev.map((item) => (item.id === data.item.id ? data.item : item));
        saveEncryptedVault?.(next);
        return next;
      });
    }
    return data;
  }, [saveEncryptedVault]);

  const rotateDueNow = useCallback(async (limit = 25) => {
    const data = await api.rotateDueCredentials({ limit });
    if (Array.isArray(data?.items) && data.items.length > 0) {
      setItems((prev) => {
        const map = new Map(prev.map((item) => [item.id, item]));
        for (const rotated of data.items) {
          map.set(rotated.id, rotated);
        }
        const next = Array.from(map.values()).sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
        saveEncryptedVault?.(next);
        return next;
      });
    }
    return data;
  }, [saveEncryptedVault]);

  const listRotationDue = useCallback(async () => {
    return api.listRotationDue();
  }, []);

  return {
    items,
    loading,
    error,
    refresh,
    addItem,
    removeItem,
    clearAll,
    generateHoneyPasswords,
    triggerHoneyAccess,
    checkCredentialBreach,
    scanCredentialBreaches,
    getCredentialHistory,
    updateRotationPolicy,
    rotateCredentialNow,
    rotateDueNow,
    listRotationDue,
    offlineMode,
    pendingSyncCount: pendingOps.length,
    syncNow
  };
}

function nextCrdt(clientId, counterRef) {
  const next = Number(counterRef.current || 0) + 1;
  counterRef.current = next;
  localStorage.setItem(`vault_sync_counter_${clientId}`, String(next));
  return {
    clientId,
    counter: next,
    ts: new Date().toISOString()
  };
}

function buildWebSocketUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const hostname = window.location.hostname || "localhost";
  const defaultPort = "4000";
  return `${protocol}//${hostname}:${defaultPort}${API_BASE}/sync/ws`;
}

function readPendingOps() {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePendingOps(pendingOps) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(Array.isArray(pendingOps) ? pendingOps : []));
  } catch {
    // Ignore storage write failures.
  }
}
