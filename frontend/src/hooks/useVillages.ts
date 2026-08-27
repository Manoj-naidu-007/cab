import { useCallback, useEffect, useState } from "react";
import { api } from "@/src/api";

export interface Village {
  id: string;
  name: string;
  district: string;
  type: "town" | "village";
  lat: number;
  lng: number;
  landmarks: string[];
}

let cache: Village[] | null = null;

export function useVillages() {
  const [villages, setVillages] = useState<Village[]>(cache || []);
  const [loading, setLoading] = useState(!cache);

  const load = useCallback(async () => {
    if (cache) {
      setVillages(cache);
      setLoading(false);
      return;
    }
    try {
      const data = await api.get<Village[]>("/villages", false);
      cache = data;
      setVillages(data);
    } catch {
      /* offline — keep whatever we have */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byId = (id?: string | null) => villages.find((v) => v.id === id);

  return { villages, loading, byId };
}
