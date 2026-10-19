const productionApiOrigin = "https://nexora-2-6ymt.onrender.com";
const configuredApiUrl = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

// VITE_API_URL is the backend origin, with or without a trailing /api/v1.
export const API_ORIGIN = (
  configuredApiUrl || (import.meta.env.PROD ? productionApiOrigin : "")
).replace(/\/api\/v1$/, "");

export const API_BASE_URL = `${API_ORIGIN}/api/v1`;
export const SOCKET_URL = API_ORIGIN || "/";
