export function FlagIcon({ country }: { country: "us" | "ar" | "ch" }) {
  if (country === "ar") {
    return (
      <svg className="languageFlag" viewBox="0 0 28 20" aria-hidden="true">
        <rect width="28" height="20" fill="#75aadb" />
        <rect y="6.67" width="28" height="6.66" fill="#ffffff" />
        <circle cx="14" cy="10" r="2.1" fill="#f6b40e" />
        <circle cx="14" cy="10" r="1.1" fill="#d98f00" />
      </svg>
    );
  }

  if (country === "ch") {
    return (
      <svg className="languageFlag" viewBox="0 0 28 20" aria-hidden="true">
        <rect width="28" height="20" fill="#da291c" />
        <path d="M12 4h4v4h4v4h-4v4h-4v-4H8V8h4z" fill="#ffffff" />
      </svg>
    );
  }

  return (
    <svg className="languageFlag" viewBox="0 0 28 20" aria-hidden="true">
      <rect width="28" height="20" fill="#b22234" />
      {Array.from({ length: 6 }, (_, index) => (
        <rect key={index} y={1.54 + index * 3.08} width="28" height="1.54" fill="#ffffff" />
      ))}
      <rect width="11.8" height="10.77" fill="#3c3b6e" />
      {Array.from({ length: 12 }, (_, index) => (
        <circle
          key={index}
          cx={2 + (index % 4) * 2.5}
          cy={2 + Math.floor(index / 4) * 2.5}
          r="0.38"
          fill="#ffffff"
        />
      ))}
    </svg>
  );
}
