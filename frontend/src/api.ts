import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
export const TOKEN_KEY = "rr_access_token";

async function authHeader(): Promise<Record<string, string>> {
  const token = await storage.secureGet<string | null>(TOKEN_KEY, null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T = any>(
  path: string,
  options: { method?: string; body?: any; auth?: boolean } = {},
): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) Object.assign(headers, await authHeader());

  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: any = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message =
      (data && (data.detail || data.message)) || `Request failed (${res.status})`;
    throw new Error(typeof message === "string" ? message : "Something went wrong");
  }
  return data as T;
}

export const api = {
  get: <T = any>(p: string, auth = true) => request<T>(p, { method: "GET", auth }),
  post: <T = any>(p: string, body?: any, auth = true) =>
    request<T>(p, { method: "POST", body, auth }),
  put: <T = any>(p: string, body?: any, auth = true) =>
    request<T>(p, { method: "PUT", body, auth }),
};
