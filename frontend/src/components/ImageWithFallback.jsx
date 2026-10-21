import { useState } from "react";

function resolveSeedAsset(src) {
  if (typeof src !== "string") return src;
  if (src.startsWith("/seed/")) return src;

  // The API currently runs stored paths through Cloudinary's URL helper.
  // Recover our local seed path so the frontend can serve the checked-in file.
  try {
    const url = new URL(src);
    if (url.hostname.endsWith("res.cloudinary.com")) {
      const seedPathIndex = url.pathname.indexOf("/seed/");
      if (seedPathIndex >= 0) return url.pathname.slice(seedPathIndex);
    }
  } catch {
    return src;
  }
  return src;
}

export default function ImageWithFallback({
  src,
  alt = "",
  fallbackSrc = "",
  fallback = null,
  className = "",
  ...props
}) {
  const displaySrc = resolveSeedAsset(src);
  const [failure, setFailure] = useState(null);
  const matchesCurrentSource =
    failure?.src === src && failure?.fallbackSrc === fallbackSrc;
  const failed = matchesCurrentSource && failure.failed;
  const fallbackFailed = matchesCurrentSource && failure.fallbackFailed;

  if (!src || fallbackFailed || (failed && !fallbackSrc)) {
    if (fallback) return fallback;
    return (
      <span
        role="img"
        aria-label={alt ? `${alt} unavailable` : "Image unavailable"}
        className={`inline-flex items-center justify-center bg-surface-container text-on-surface-variant ${className}`}
      >
        <span aria-hidden="true" className="material-symbols-outlined">
          image
        </span>
      </span>
    );
  }

  return (
    <img
      src={failed ? fallbackSrc : displaySrc}
      alt={alt}
      className={className}
      onError={() => {
        setFailure({
          src,
          fallbackSrc,
          failed: true,
          fallbackFailed: failed,
        });
      }}
      {...props}
    />
  );
}
