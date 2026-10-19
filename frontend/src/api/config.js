const productionApiOrigin = "https://nexora-2-6ymt.onrender.com";
const configuredApiUrl = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

// VITE_API_URL is the backend origin, with or without a trailing /api/v1.
export const API_ORIGIN = (
  configuredApiUrl || (import.meta.env.PROD ? productionApiOrigin : "")
).replace(/\/api\/v1$/, "");

// Keep cookie-authenticated API traffic on the frontend origin. Vercel's
// /api/:path* rewrite forwards it to the backend while retaining a same-site
// cookie request from the browser.
export const API_BASE_URL = "/api/v1";
export const SOCKET_URL = API_ORIGIN || "/";
