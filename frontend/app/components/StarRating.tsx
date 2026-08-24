"use client";

/** Clickable 1–5 star rating. */
export function StarRating({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n}`}
            disabled={disabled}
            onClick={() => onChange(n)}
            className={`px-0.5 text-2xl leading-none disabled:opacity-50 ${
              on ? "text-yellow-500" : "text-slate-300"
            }`}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

export const REVIEW_COMMENT_MAX = 50;
