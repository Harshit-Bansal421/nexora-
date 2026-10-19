import ImageWithFallback from "./ImageWithFallback";

export default function Avatar({ src, name = "User", className = "" }) {
  const initials =
    name
      .trim()
      .split(/\s+|[._-]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";

  return (
    <ImageWithFallback
      src={src}
      alt={name}
      className={className}
      fallback={
        <span
          role="img"
          aria-label={`${name} avatar`}
          className={`inline-flex shrink-0 items-center justify-center bg-primary-container text-sm font-bold text-on-primary-container ${className}`}
        >
          {initials}
        </span>
      }
    />
  );
}
