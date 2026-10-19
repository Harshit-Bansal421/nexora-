const configuredOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin && origin !== "*");

if (process.env.CORS_ORIGIN?.split(",").some((origin) => origin.trim() === "*")) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("CORS_ORIGIN must list exact origins; wildcard origins are not allowed");
  }
  console.warn("Ignoring wildcard CORS_ORIGIN outside production; allowing local development origins only.");
}

if (process.env.NODE_ENV === "production" && configuredOrigins.length === 0) {
  throw new Error("CORS_ORIGIN must contain exact allowed frontend origins in production");
}

const isLocalDevelopmentOrigin = (origin) => {
  if (process.env.NODE_ENV === "production") return false;

  try {
    const { protocol, hostname } = new URL(origin);
    return (
      protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(hostname)
    );
  } catch {
    return false;
  }
};

export const isOriginAllowed = (origin) =>
  !origin || configuredOrigins.includes(origin) || isLocalDevelopmentOrigin(origin);
