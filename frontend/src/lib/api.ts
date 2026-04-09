import axios from "axios";
import { createClient } from "./supabase";

// Force HTTPS — env var may be http:// on some Vercel environments; CSP blocks non-https
export const baseURL = (process.env.NEXT_PUBLIC_API_URL ?? "")
  .trim()
  .replace(/\/$/, "")
  .replace(/^http:\/\//, "https://");

export const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor — force HTTPS + attach Supabase JWT
api.interceptors.request.use(async (config) => {
  // Belt-and-suspenders: fix http:// regardless of how baseURL was resolved
  if (config.baseURL?.startsWith("http://")) {
    config.baseURL = config.baseURL.replace(/^http:\/\//, "https://");
  }
  if (typeof config.url === "string" && config.url.startsWith("http://")) {
    config.url = config.url.replace(/^http:\/\//, "https://");
  }

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }

  return config;
});

// Response interceptor — handle token expiry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        await supabase.auth.signOut();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);
