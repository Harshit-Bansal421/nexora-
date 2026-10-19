import { useState } from "react";

export default function ImageWithFallback({
  src,
  alt = "",
  fallbackSrc = "",
  fallback = null,
  className = "",
  ...props
}) {
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
      src={failed ? fallbackSrc : src}
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
