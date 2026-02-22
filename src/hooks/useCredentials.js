import { useCallback, useEffect, useState } from "react";
import { api } from "../utils/api.js";

export function useCredentials(security) {
  const isUnlocked = Boolean(security?.isUnlocked);
  const saveEncryptedVault = security?.saveEncryptedVault;
  const loadEncryptedVault = security?.loadEncryptedVault;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const addItem = useCallback(async (payload) => {
    const data = await api.createCredential(payload);
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

  return { items, loading, error, refresh, addItem, removeItem, clearAll, generateHoneyPasswords, triggerHoneyAccess };
}
