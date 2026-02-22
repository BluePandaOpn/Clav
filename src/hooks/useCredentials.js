import { useCallback, useEffect, useState } from "react";
import { api } from "../utils/api.js";

export function useCredentials() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.listCredentials();
      setItems(data.items);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(async (payload) => {
    const data = await api.createCredential(payload);
    setItems((prev) => [data.item, ...prev]);
    return data.item;
  }, []);

  const removeItem = useCallback(async (id) => {
    await api.deleteCredential(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearAll = useCallback(async () => {
    await api.clearCredentials();
    setItems([]);
  }, []);

  return { items, loading, error, refresh, addItem, removeItem, clearAll };
}
