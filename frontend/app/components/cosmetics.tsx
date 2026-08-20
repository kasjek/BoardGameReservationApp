"use client";

import { useId, type ReactNode } from "react";

import type { AvatarEquipped } from "../lib/cosmetics";

function Svg({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden={title ? undefined : true}>
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function CosmeticAsset({
  id,
  className = "h-full w-full",
}: {
  id: string;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  switch (id) {
    case "bg-lilac":
      return (
        <Svg className={className}>
          <defs>
            <radialGradient id={`bgLilac${uid}`} cx="50%" cy="40%" r="70%">
              <stop offset="0%" stopColor="#f5d0fe" />
              <stop offset="100%" stopColor="#7c3aed" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="50" fill={`url(#bgLilac${uid})`} />
        </Svg>
      );
    case "bg-wood":
      return (
        <Svg className={className}>
          <circle cx="50" cy="50" r="50" fill="#b45309" />
          <path d="M0 28h100M0 48h100M0 68h100" stroke="#7c2d12" strokeWidth="6" opacity="0.35" />
          <circle cx="50" cy="50" r="18" fill="#fbbf24" opacity="0.35" />
        </Svg>
      );
    case "hat-party":
      return (
        <Svg className={className}>
          <polygon points="50,4 78,42 22,42" fill="#ec4899" />
          <polygon points="50,4 64,42 50,42" fill="#f472b6" />
          <rect x="20" y="40" width="60" height="7" rx="3" fill="#7c3aed" />
          <circle cx="50" cy="6" r="5" fill="#facc15" />
        </Svg>
      );
    case "hat-wizard":
      return (
        <Svg className={className}>
          <polygon points="52,2 78,48 24,46" fill="#312e81" />
          <polygon points="52,2 62,47 50,46" fill="#4338ca" />
          <ellipse cx="50" cy="48" rx="32" ry="8" fill="#1e1b4b" />
          <circle cx="44" cy="22" r="3" fill="#fde68a" />
          <circle cx="58" cy="30" r="2" fill="#fde68a" />
        </Svg>
      );
    case "glasses-round":
      return (
        <Svg className={className}>
          <circle cx="34" cy="52" r="14" fill="none" stroke="#111827" strokeWidth="4" />
          <circle cx="66" cy="52" r="14" fill="none" stroke="#111827" strokeWidth="4" />
          <path d="M48 52h4" stroke="#111827" strokeWidth="4" />
          <path d="M20 50h-8M80 50h8" stroke="#111827" strokeWidth="3" />
        </Svg>
      );
    case "glasses-star":
      return (
        <Svg className={className}>
          <polygon
            points="34,36 38,48 50,50 38,54 34,66 30,54 18,50 30,48"
            fill="#facc15"
            stroke="#b45309"
            strokeWidth="2"
          />
          <polygon
            points="66,36 70,48 82,50 70,54 66,66 62,54 50,50 62,48"
            fill="#facc15"
            stroke="#b45309"
            strokeWidth="2"
          />
        </Svg>
      );
    case "frame-gold":
      return (
        <Svg className={className}>
          <circle cx="50" cy="50" r="46" fill="none" stroke="#f59e0b" strokeWidth="8" />
          <circle cx="50" cy="50" r="40" fill="none" stroke="#fde68a" strokeWidth="3" />
        </Svg>
      );
    case "frame-dice":
      return (
        <Svg className={className}>
          <circle cx="50" cy="50" r="46" fill="none" stroke="#0f172a" strokeWidth="7" />
          {[
            [50, 8],
            [88, 28],
            [88, 72],
            [50, 92],
            [12, 72],
            [12, 28],
          ].map(([x, y], i) => (
            <rect key={i} x={x - 6} y={y - 6} width="12" height="12" rx="2" fill="#fff" stroke="#0f172a" />
          ))}
        </Svg>
      );
    case "companion-meeple":
      return (
        <Svg className={className}>
          <circle cx="78" cy="62" r="8" fill="#2563eb" />
          <path d="M66 92c0-12 6-18 12-18s12 6 12 18" fill="#2563eb" />
          <path d="M64 78h28v6H64z" fill="#1d4ed8" />
        </Svg>
      );
    case "companion-cat":
      return (
        <Svg className={className}>
          <circle cx="78" cy="78" r="14" fill="#f97316" />
          <polygon points="66,70 70,54 78,68" fill="#f97316" />
          <polygon points="90,70 86,54 78,68" fill="#f97316" />
          <circle cx="73" cy="78" r="2" fill="#111827" />
          <circle cx="83" cy="78" r="2" fill="#111827" />
          <path d="M74 84h8" stroke="#111827" strokeWidth="2" />
        </Svg>
      );
    default:
      return null;
  }
}

const LAYER_CLASS: Record<string, string> = {
  background: "absolute inset-0 z-0 overflow-hidden rounded-full",
  frame: "pointer-events-none absolute inset-0 z-[3]",
  glasses: "pointer-events-none absolute inset-0 z-[4]",
  hat: "pointer-events-none absolute -top-[28%] left-[8%] z-[5] h-[70%] w-[84%]",
  companion: "pointer-events-none absolute -bottom-[6%] -right-[10%] z-[6] h-[55%] w-[55%]",
};

export function CosmeticLayers({ equipped }: { equipped?: AvatarEquipped | null }) {
  if (!equipped) return null;
  return (
    <>
      {(["background", "frame", "glasses", "hat", "companion"] as const).map((slot) => {
        const id = equipped[slot];
        if (!id) return null;
        return (
          <div key={slot} className={LAYER_CLASS[slot]}>
            <CosmeticAsset id={id} />
          </div>
        );
      })}
    </>
  );
}
