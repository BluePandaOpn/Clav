import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../utils/api.js";
import { API_BASE } from "../utils/api.js";

export function useCredentials(security) {
  const isUnlocked = Boolean(security?.isUnlocked);
  const saveEncryptedVault = security?.saveEncryptedVault;
  const loadEncryptedVault = security?.loadEncryptedVault;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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

  const refresh = useCallback(async () => {
    if (!isUnlocked) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.listCredentials();
      setItems(data.items);
      await saveEncryptedVault?.(data.items);
    } catch (e) {
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
  }, [isUnlocked, saveEncryptedVault]);

  const addItem = useCallback(async (payload) => {
    const data = await api.createCredential({
      ...payload,
      _crdt: nextCrdt(clientId, counterRef)
    });
    setItems((prev) => {
      const next = [data.item, ...prev];
      saveEncryptedVault?.(next);
      return next;
    });
    return data.item;
  }, [saveEncryptedVault]);

  const removeItem = useCallback(async (id) => {
    await api.deleteCredential(id);
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      saveEncryptedVault?.(next);
      return next;
    });
  }, [saveEncryptedVault]);

  const clearAll = useCallback(async () => {
    await api.clearCredentials();
    setItems([]);
    saveEncryptedVault?.([]);
  }, [saveEncryptedVault]);

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
    getCredentialHistory
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
