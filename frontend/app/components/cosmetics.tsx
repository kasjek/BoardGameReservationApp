"use client";

import { useId, type ReactNode } from "react";

import type { AvatarEquipped } from "../lib/cosmetics";

/**
 * Face-fit drawings use the same 0–100 viewBox as the avatar square.
 * DiceBear adventurer eyes sit near 55% down; hair/crown is the top third.
 * (The original overlay used top/height offsets that put glasses on the
 * forehead and hats above the circle.)
 */
const EYE_Y = 54.6;
const EYE_LEFT_X = 35.2;
const EYE_RIGHT_X = 54.1;
const EYE_R = 7.6;
const HAT_BRIM_Y = 30;
const HAT_TIP_Y = 9.5;

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
    <svg
      viewBox="0 0 100 100"
      className={className}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

function starPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI / 4) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.42;
    pts.push(`${cx + Math.cos(angle) * rad},${cy + Math.sin(angle) * rad}`);
  }
  return pts.join(" ");
}

const FACE_SVG = "pointer-events-none absolute inset-0 h-full w-full";

export function CosmeticAsset({
  id,
  className = "h-full w-full",
  fit = "icon",
}: {
  id: string;
  className?: string;
  fit?: "icon" | "face";
}) {
  const uid = useId().replace(/:/g, "");
  const svgClass = fit === "face" ? FACE_SVG : className;

  switch (id) {
    case "bg-lilac":
      return (
        <Svg className={svgClass}>
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
        <Svg className={svgClass}>
          <circle cx="50" cy="50" r="50" fill="#b45309" />
          <path d="M0 28h100M0 48h100M0 68h100" stroke="#7c2d12" strokeWidth="6" opacity="0.35" />
          <circle cx="50" cy="50" r="18" fill="#fbbf24" opacity="0.35" />
        </Svg>
      );
    case "hat-party":
      if (fit === "face") {
        return (
          <Svg className={svgClass}>
            <polygon
              points={`${50},${HAT_TIP_Y} ${71},${HAT_BRIM_Y} ${29},${HAT_BRIM_Y}`}
              fill="#ec4899"
            />
            <polygon
              points={`${50},${HAT_TIP_Y} ${61.5},${HAT_BRIM_Y} ${50},${HAT_BRIM_Y}`}
              fill="#f472b6"
            />
            <rect x="26" y={HAT_BRIM_Y - 1.2} width="48" height="3.4" rx="1.4" fill="#7c3aed" />
            <circle cx="50" cy={HAT_TIP_Y + 0.8} r="2.2" fill="#facc15" />
          </Svg>
        );
      }
      return (
        <Svg className={svgClass}>
          <polygon points="50,8 84,76 16,76" fill="#ec4899" />
          <polygon points="50,8 66,76 50,76" fill="#f472b6" />
          <rect x="14" y="74" width="72" height="10" rx="4" fill="#7c3aed" />
          <circle cx="50" cy="10" r="6" fill="#facc15" />
        </Svg>
      );
    case "hat-wizard":
      if (fit === "face") {
        return (
          <Svg className={svgClass}>
            <polygon
              points={`${51},${HAT_TIP_Y - 2.4} ${72},${HAT_BRIM_Y} ${28},${HAT_BRIM_Y}`}
              fill="#312e81"
            />
            <polygon
              points={`${51},${HAT_TIP_Y - 2.4} ${61.5},${HAT_BRIM_Y} ${49.5},${HAT_BRIM_Y}`}
              fill="#4338ca"
            />
            <ellipse cx="50" cy={HAT_BRIM_Y + 0.8} rx="23" ry="2.6" fill="#1e1b4b" />
            <circle cx="44.5" cy={HAT_TIP_Y + 2.9} r="1.1" fill="#fde68a" />
            <circle cx="55.1" cy={HAT_TIP_Y + 6.3} r="0.7" fill="#fde68a" />
          </Svg>
        );
      }
      return (
        <Svg className={svgClass}>
          <polygon points="50,4 82,78 18,78" fill="#312e81" />
          <polygon points="50,4 64,78 48,78" fill="#4338ca" />
          <ellipse cx="50" cy="80" rx="36" ry="9" fill="#1e1b4b" />
          <circle cx="42" cy="28" r="3" fill="#fde68a" />
          <circle cx="58" cy="40" r="2" fill="#fde68a" />
        </Svg>
      );
    case "glasses-round":
      if (fit === "face") {
        return (
          <Svg className={svgClass}>
            <circle
              cx={EYE_LEFT_X}
              cy={EYE_Y}
              r={EYE_R}
              fill="rgba(255,255,255,0.28)"
              stroke="#111827"
              strokeWidth="2.1"
            />
            <circle
              cx={EYE_RIGHT_X}
              cy={EYE_Y}
              r={EYE_R}
              fill="rgba(255,255,255,0.28)"
              stroke="#111827"
              strokeWidth="2.1"
            />
            <path
              d={`M${EYE_LEFT_X + EYE_R} ${EYE_Y}h${EYE_RIGHT_X - EYE_LEFT_X - EYE_R * 2}`}
              stroke="#111827"
              strokeWidth="2.1"
            />
            <path
              d={`M${EYE_LEFT_X - EYE_R} ${EYE_Y}h-3.6M${EYE_RIGHT_X + EYE_R} ${EYE_Y}h3.6`}
              stroke="#111827"
              strokeWidth="1.8"
            />
          </Svg>
        );
      }
      return (
        <Svg className={svgClass}>
          <circle cx="32" cy="50" r="18" fill="rgba(255,255,255,0.35)" stroke="#111827" strokeWidth="5" />
          <circle cx="68" cy="50" r="18" fill="rgba(255,255,255,0.35)" stroke="#111827" strokeWidth="5" />
          <path d="M46 50h8" stroke="#111827" strokeWidth="5" />
          <path d="M14 50h-8M86 50h8" stroke="#111827" strokeWidth="4" />
        </Svg>
      );
    case "glasses-star":
      if (fit === "face") {
        return (
          <Svg className={svgClass}>
            <polygon
              points={starPoints(EYE_LEFT_X, EYE_Y, 9.2)}
              fill="#facc15"
              stroke="#b45309"
              strokeWidth="0.8"
            />
            <polygon
              points={starPoints(EYE_RIGHT_X, EYE_Y, 9.2)}
              fill="#facc15"
              stroke="#b45309"
              strokeWidth="0.8"
            />
          </Svg>
        );
      }
      return (
        <Svg className={svgClass}>
          <polygon
            points="32,34 37,48 52,50 37,52 32,66 27,52 12,50 27,48"
            fill="#facc15"
            stroke="#b45309"
            strokeWidth="2"
          />
          <polygon
            points="68,34 73,48 88,50 73,52 68,66 63,52 48,50 63,48"
            fill="#facc15"
            stroke="#b45309"
            strokeWidth="2"
          />
        </Svg>
      );
    case "frame-gold":
      return (
        <Svg className={svgClass}>
          <circle cx="50" cy="50" r="46" fill="none" stroke="#f59e0b" strokeWidth="8" />
          <circle cx="50" cy="50" r="40" fill="none" stroke="#fde68a" strokeWidth="3" />
        </Svg>
      );
    case "frame-dice":
      return (
        <Svg className={svgClass}>
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
        <Svg className={svgClass}>
          <circle cx="78" cy="62" r="8" fill="#2563eb" />
          <path d="M66 92c0-12 6-18 12-18s12 6 12 18" fill="#2563eb" />
          <path d="M64 78h28v6H64z" fill="#1d4ed8" />
        </Svg>
      );
    case "companion-cat":
      return (
        <Svg className={svgClass}>
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
  background: "absolute inset-0 z-0 h-full w-full overflow-hidden rounded-full",
  frame: "pointer-events-none absolute -inset-[6%] z-[3] h-[112%] w-[112%]",
  glasses: "pointer-events-none absolute inset-0 z-[4] h-full w-full",
  hat: "pointer-events-none absolute inset-0 z-[5] h-full w-full overflow-visible",
  companion: "pointer-events-none absolute -bottom-[10%] -right-[16%] z-[6] h-[62%] w-[62%]",
};

export function CosmeticLayers({ equipped }: { equipped?: AvatarEquipped | null }) {
  if (!equipped) return null;
  return (
    <>
      {(["background", "frame", "glasses", "hat", "companion"] as const).map((slot) => {
        const id = equipped[slot];
        if (!id) return null;
        const faceFit = slot === "glasses" || slot === "hat";
        return (
          <div key={slot} className={LAYER_CLASS[slot]}>
            <CosmeticAsset id={id} fit={faceFit ? "face" : "icon"} />
          </div>
        );
      })}
    </>
  );
}
