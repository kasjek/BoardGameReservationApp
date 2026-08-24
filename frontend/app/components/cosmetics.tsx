"use client";

import { useId, type ReactNode } from "react";

import type { AvatarEquipped } from "../lib/cosmetics";

/**
 * Face-fit drawings use the same 0–100 viewBox as the avatar square.
 * DiceBear adventurer eyes sit near 55% down; hair/crown is the top third.
 */
const EYE_Y = 54.6;
const EYE_LEFT_X = 35.2;
const EYE_RIGHT_X = 54.1;
const EYE_R = 7.6;

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

/** Map a 0–100 icon hat onto the avatar crown without changing its silhouette. */
function FittedHat({ fit, children }: { fit: "icon" | "face"; children: ReactNode }) {
  if (fit !== "face") return <>{children}</>;
  return <g transform="translate(29 6) scale(0.42)">{children}</g>;
}

function ClipCircle({ uid, children }: { uid: string; children: ReactNode }) {
  return (
    <>
      <defs>
        <clipPath id={`c${uid}`}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>
      <g clipPath={`url(#c${uid})`}>{children}</g>
    </>
  );
}

const FACE_SVG = "pointer-events-none absolute inset-0 h-full w-full";

function HatParty() {
  return (
    <>
      <polygon points="50,8 84,76 16,76" fill="#ec4899" />
      <polygon points="50,8 66,76 50,76" fill="#f472b6" />
      <rect x="14" y="74" width="72" height="10" rx="4" fill="#7c3aed" />
      <circle cx="50" cy="10" r="6" fill="#facc15" />
    </>
  );
}

function HatWizard() {
  return (
    <>
      <polygon points="50,4 82,78 18,78" fill="#312e81" />
      <polygon points="50,4 64,78 48,78" fill="#4338ca" />
      <ellipse cx="50" cy="80" rx="36" ry="9" fill="#1e1b4b" />
      <circle cx="42" cy="28" r="3" fill="#fde68a" />
      <circle cx="58" cy="40" r="2" fill="#fde68a" />
      <circle cx="48" cy="52" r="2.2" fill="#fde68a" />
    </>
  );
}

function HatBeanie() {
  return (
    <>
      <path d="M20 78c0-28 13-62 30-62s30 34 30 62" fill="#0f766e" />
      <path d="M26 78c2-24 12-52 24-52 12 0 22 28 24 52" fill="#14b8a6" opacity="0.55" />
      {[32, 40, 50, 60, 68].map((x) => (
        <path key={x} d={`M${x} 22c0 18-1 40-1 56`} stroke="#115e59" strokeWidth="1.6" fill="none" />
      ))}
      <rect x="16" y="70" width="68" height="16" rx="6" fill="#134e4a" />
      <rect x="16" y="70" width="68" height="7" rx="4" fill="#2dd4bf" />
      <circle cx="50" cy="16" r="7" fill="#f43f5e" />
    </>
  );
}

function HatCap() {
  return (
    <>
      <ellipse cx="50" cy="82" rx="40" ry="8" fill="#9f1239" />
      <path d="M18 78c4-36 16-58 32-58s28 22 32 58" fill="#e11d48" />
      <path d="M28 78c4-28 12-46 22-46 10 0 18 18 22 46" fill="#fb7185" opacity="0.4" />
      <path d="M12 78c18 10 58 10 76 0-16 8-60 8-76 0z" fill="#be123c" />
      <circle cx="50" cy="22" r="4" fill="#fecdd3" />
    </>
  );
}

function HatCrown() {
  return (
    <>
      <polygon points="14,78 26,28 38,62 50,18 62,62 74,28 86,78" fill="#f59e0b" />
      <polygon points="26,28 38,62 50,18 50,78 14,78" fill="#fbbf24" opacity="0.55" />
      <rect x="12" y="74" width="76" height="12" rx="3" fill="#b45309" />
      <circle cx="26" cy="30" r="4" fill="#ef4444" />
      <circle cx="50" cy="20" r="5" fill="#38bdf8" />
      <circle cx="74" cy="30" r="4" fill="#a855f7" />
    </>
  );
}

function HatTopper() {
  return (
    <>
      <ellipse cx="50" cy="82" rx="42" ry="10" fill="#111827" />
      <rect x="28" y="18" width="44" height="64" rx="4" fill="#1f2937" />
      <rect x="32" y="22" width="12" height="56" rx="2" fill="#374151" opacity="0.55" />
      <rect x="26" y="62" width="48" height="10" fill="#e11d48" />
      <ellipse cx="50" cy="18" rx="22" ry="6" fill="#111827" />
    </>
  );
}

function HatBeret() {
  return (
    <>
      <ellipse cx="48" cy="58" rx="40" ry="28" fill="#b91c1c" transform="rotate(-18 48 58)" />
      <ellipse cx="42" cy="50" rx="22" ry="14" fill="#ef4444" transform="rotate(-18 42 50)" opacity="0.5" />
      <ellipse cx="50" cy="78" rx="24" ry="8" fill="#7f1d1d" />
      <rect x="70" y="22" width="5" height="12" rx="2" fill="#7f1d1d" transform="rotate(18 72 28)" />
    </>
  );
}

function HatCowboy() {
  return (
    <>
      <ellipse cx="50" cy="78" rx="46" ry="12" fill="#a16207" />
      <ellipse cx="50" cy="76" rx="38" ry="8" fill="#ca8a04" />
      <path d="M30 76c2-36 10-54 20-54s18 18 20 54" fill="#b45309" />
      <path d="M38 76c2-26 6-40 12-40s10 14 12 40" fill="#d97706" />
      <path d="M30 52h40" stroke="#78350f" strokeWidth="4" />
    </>
  );
}

function HatFlower() {
  const petals = [
    [50, 22],
    [70, 32],
    [78, 52],
    [70, 72],
    [50, 80],
    [30, 72],
    [22, 52],
    [30, 32],
  ];
  return (
    <>
      {petals.map(([x, y], i) => (
        <ellipse
          key={i}
          cx={x}
          cy={y}
          rx="14"
          ry="20"
          fill={i % 2 === 0 ? "#f9a8d4" : "#c4b5fd"}
          transform={`rotate(${i * 45} ${x} ${y})`}
        />
      ))}
      <circle cx="50" cy="52" r="16" fill="#fde047" />
      <circle cx="50" cy="52" r="8" fill="#f59e0b" />
    </>
  );
}

function HatPropeller() {
  return (
    <>
      <path d="M22 78c0-26 12-56 28-56s28 30 28 56" fill="#2563eb" />
      <path d="M30 78c2-20 10-44 20-44s18 24 20 44" fill="#60a5fa" opacity="0.5" />
      <rect x="18" y="70" width="64" height="14" rx="6" fill="#1e3a8a" />
      <ellipse cx="28" cy="28" rx="22" ry="6" fill="#facc15" transform="rotate(-25 28 28)" />
      <ellipse cx="72" cy="28" rx="22" ry="6" fill="#facc15" transform="rotate(25 72 28)" />
      <circle cx="50" cy="22" r="8" fill="#ef4444" />
      <circle cx="50" cy="22" r="3" fill="#fee2e2" />
    </>
  );
}

function CompanionMeeple() {
  return (
    <>
      <path
        d="M50 6c12 0 22 10 22 22 0 7-4 13-10 16l18 10v11l-16-7v15l14 18h-15L50 76 37 91H22l14-18V58l-16 7V54l18-10C28 41 24 35 24 28 24 16 34 6 50 6z"
        fill="#1d4ed8"
      />
      <path
        d="M50 6c12 0 22 10 22 22 0 7-4 13-10 16l18 10v11l-16-7v15l14 18h-15L50 76V6z"
        fill="#3b82f6"
      />
      <path
        d="M50 10c9 0 16 8 16 18 0 5-2 9-7 12"
        fill="none"
        stroke="#93c5fd"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="44" cy="26" r="2.2" fill="#1e3a8a" />
      <circle cx="56" cy="26" r="2.2" fill="#1e3a8a" />
      <path d="M44 34c4 4 8 4 12 0" fill="none" stroke="#1e3a8a" strokeWidth="2" strokeLinecap="round" />
    </>
  );
}

function CompanionCat() {
  return (
    <>
      <path d="M78 70c4 8 6 16 2 22" fill="none" stroke="#ea580c" strokeWidth="7" strokeLinecap="round" />
      <ellipse cx="50" cy="72" rx="28" ry="22" fill="#fb923c" />
      <ellipse cx="42" cy="76" rx="12" ry="10" fill="#fdba74" />
      <circle cx="54" cy="42" r="22" fill="#fb923c" />
      <polygon points="36,28 32,8 48,24" fill="#fb923c" />
      <polygon points="72,28 76,8 60,24" fill="#fb923c" />
      <polygon points="38,24 34,12 46,24" fill="#fed7aa" />
      <polygon points="70,24 74,12 58,24" fill="#fed7aa" />
      <path d="M40 38c6-6 12-4 14 2" fill="none" stroke="#c2410c" strokeWidth="3" />
      <path d="M58 38c6-6 10-2 10 4" fill="none" stroke="#c2410c" strokeWidth="3" />
      <ellipse cx="46" cy="42" rx="4.5" ry="5.5" fill="#111827" />
      <ellipse cx="62" cy="42" rx="4.5" ry="5.5" fill="#111827" />
      <circle cx="47.5" cy="40.5" r="1.4" fill="#fff" />
      <circle cx="63.5" cy="40.5" r="1.4" fill="#fff" />
      <polygon points="54,48 50,54 58,54" fill="#fb7185" />
      <path d="M54 54v6" stroke="#9a3412" strokeWidth="1.6" />
      <path d="M42 52h-14M42 56h-12M66 52h14M66 56h12" stroke="#9a3412" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M48 62c4 4 8 4 12 0" fill="none" stroke="#9a3412" strokeWidth="1.8" strokeLinecap="round" />
    </>
  );
}

function CompanionDog() {
  return (
    <>
      <path d="M78 64c8 4 12 14 8 24" fill="none" stroke="#b45309" strokeWidth="7" strokeLinecap="round" />
      <ellipse cx="48" cy="74" rx="26" ry="20" fill="#d97706" />
      <ellipse cx="38" cy="80" rx="10" ry="9" fill="#fbbf24" />
      <circle cx="56" cy="44" r="22" fill="#f59e0b" />
      <ellipse cx="34" cy="48" rx="10" ry="16" fill="#b45309" transform="rotate(-18 34 48)" />
      <ellipse cx="78" cy="46" rx="9" ry="15" fill="#b45309" transform="rotate(22 78 46)" />
      <ellipse cx="60" cy="52" rx="12" ry="9" fill="#fde68a" />
      <ellipse cx="64" cy="54" rx="6" ry="4" fill="#1f2937" />
      <circle cx="48" cy="40" r="3.4" fill="#111827" />
      <circle cx="66" cy="40" r="3.4" fill="#111827" />
      <circle cx="49" cy="39" r="1.1" fill="#fff" />
      <circle cx="67" cy="39" r="1.1" fill="#fff" />
      <path d="M52 58c4 3 8 3 12 0" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" />
      <rect x="36" y="64" width="28" height="7" rx="3" fill="#dc2626" />
      <circle cx="64" cy="68" r="3.5" fill="#fbbf24" />
    </>
  );
}

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
          <ClipCircle uid={uid}>
            <circle cx="50" cy="50" r="50" fill="#b45309" />
            <path d="M0 28h100M0 48h100M0 68h100" stroke="#7c2d12" strokeWidth="6" opacity="0.35" />
            <circle cx="50" cy="50" r="18" fill="#fbbf24" opacity="0.35" />
          </ClipCircle>
        </Svg>
      );
    case "bg-sunset":
      return (
        <Svg className={svgClass}>
          <defs>
            <linearGradient id={`bgSunset${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fda4af" />
              <stop offset="45%" stopColor="#fb923c" />
              <stop offset="100%" stopColor="#7c2d12" />
            </linearGradient>
          </defs>
          <ClipCircle uid={uid}>
            <circle cx="50" cy="50" r="50" fill={`url(#bgSunset${uid})`} />
            <circle cx="72" cy="32" r="16" fill="#fde047" />
          </ClipCircle>
        </Svg>
      );
    case "bg-ocean":
      return (
        <Svg className={svgClass}>
          <defs>
            <linearGradient id={`bgOcean${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7dd3fc" />
              <stop offset="100%" stopColor="#0369a1" />
            </linearGradient>
          </defs>
          <ClipCircle uid={uid}>
            <circle cx="50" cy="50" r="50" fill={`url(#bgOcean${uid})`} />
            <path d="M-4 58c12-10 20 6 32 0s20 10 32 0 20 10 32 0 12-8 20 0v50H-4z" fill="#0ea5e9" opacity="0.55" />
            <path d="M-4 72c14-8 22 6 34 0s18 8 30 0 22 8 32 0 14-6 22 0v40H-4z" fill="#0369a1" opacity="0.5" />
          </ClipCircle>
        </Svg>
      );
    case "bg-night":
      return (
        <Svg className={svgClass}>
          <ClipCircle uid={uid}>
            <circle cx="50" cy="50" r="50" fill="#0f172a" />
            <circle cx="68" cy="28" r="14" fill="#e2e8f0" />
            <circle cx="62" cy="26" r="10" fill="#0f172a" />
            {[
              [18, 22],
              [30, 40],
              [42, 16],
              [58, 48],
              [78, 18],
              [84, 58],
              [22, 68],
              [48, 78],
            ].map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={i % 2 ? 1.4 : 2} fill="#fde68a" />
            ))}
          </ClipCircle>
        </Svg>
      );
    case "bg-meadow":
      return (
        <Svg className={svgClass}>
          <ClipCircle uid={uid}>
            <circle cx="50" cy="50" r="50" fill="#86efac" />
            <circle cx="50" cy="50" r="50" fill="#4ade80" opacity="0.35" />
            <circle cx="78" cy="22" r="12" fill="#fde047" />
            <path d="M-8 70c18-16 28 4 40-6s24 12 36-4 22 10 40-4v50H-8z" fill="#16a34a" />
            <circle cx="28" cy="62" r="4" fill="#f472b6" />
            <circle cx="58" cy="58" r="3" fill="#facc15" />
            <circle cx="76" cy="66" r="3.5" fill="#c084fc" />
          </ClipCircle>
        </Svg>
      );
    case "bg-candy":
      return (
        <Svg className={svgClass}>
          <ClipCircle uid={uid}>
            <circle cx="50" cy="50" r="50" fill="#fda4af" />
            {[12, 32, 52, 72, 92].map((y, i) => (
              <rect key={y} y={y} width="100" height="12" fill={i % 2 ? "#f9a8d4" : "#fef3c7"} />
            ))}
          </ClipCircle>
        </Svg>
      );
    case "bg-cosmos":
      return (
        <Svg className={svgClass}>
          <defs>
            <radialGradient id={`bgCosmos${uid}`} cx="35%" cy="30%" r="80%">
              <stop offset="0%" stopColor="#e879f9" />
              <stop offset="45%" stopColor="#6d28d9" />
              <stop offset="100%" stopColor="#1e1b4b" />
            </radialGradient>
          </defs>
          <ClipCircle uid={uid}>
            <circle cx="50" cy="50" r="50" fill={`url(#bgCosmos${uid})`} />
            <circle cx="70" cy="62" r="18" fill="#22d3ee" opacity="0.35" />
            <circle cx="28" cy="40" r="8" fill="#f5d0fe" opacity="0.7" />
          </ClipCircle>
        </Svg>
      );
    case "bg-felt":
      return (
        <Svg className={svgClass}>
          <ClipCircle uid={uid}>
            <circle cx="50" cy="50" r="50" fill="#15803d" />
            <circle cx="50" cy="50" r="36" fill="none" stroke="#166534" strokeWidth="4" />
            <circle cx="50" cy="50" r="14" fill="#14532d" />
            <circle cx="50" cy="50" r="4" fill="#fde68a" />
          </ClipCircle>
        </Svg>
      );
    case "bg-confetti":
      return (
        <Svg className={svgClass}>
          <ClipCircle uid={uid}>
            <circle cx="50" cy="50" r="50" fill="#1d4ed8" />
            {[
              [18, 22, "#facc15", 0],
              [40, 18, "#fb7185", 20],
              [70, 24, "#4ade80", -15],
              [84, 48, "#f472b6", 40],
              [22, 58, "#22d3ee", 10],
              [48, 64, "#fde047", -25],
              [72, 72, "#c084fc", 30],
              [36, 82, "#fb923c", 5],
            ].map(([x, y, color, rot], i) => (
              <rect
                key={i}
                x={Number(x) - 5}
                y={Number(y) - 3}
                width="10"
                height="6"
                rx="1"
                fill={String(color)}
                transform={`rotate(${rot} ${x} ${y})`}
              />
            ))}
          </ClipCircle>
        </Svg>
      );
    case "hat-party":
      return (
        <Svg className={svgClass}>
          <FittedHat fit={fit}>
            <HatParty />
          </FittedHat>
        </Svg>
      );
    case "hat-wizard":
      return (
        <Svg className={svgClass}>
          <FittedHat fit={fit}>
            <HatWizard />
          </FittedHat>
        </Svg>
      );
    case "hat-beanie":
      return (
        <Svg className={svgClass}>
          <FittedHat fit={fit}>
            <HatBeanie />
          </FittedHat>
        </Svg>
      );
    case "hat-cap":
      return (
        <Svg className={svgClass}>
          <FittedHat fit={fit}>
            <HatCap />
          </FittedHat>
        </Svg>
      );
    case "hat-crown":
      return (
        <Svg className={svgClass}>
          <FittedHat fit={fit}>
            <HatCrown />
          </FittedHat>
        </Svg>
      );
    case "hat-topper":
      return (
        <Svg className={svgClass}>
          <FittedHat fit={fit}>
            <HatTopper />
          </FittedHat>
        </Svg>
      );
    case "hat-beret":
      return (
        <Svg className={svgClass}>
          <FittedHat fit={fit}>
            <HatBeret />
          </FittedHat>
        </Svg>
      );
    case "hat-cowboy":
      return (
        <Svg className={svgClass}>
          <FittedHat fit={fit}>
            <HatCowboy />
          </FittedHat>
        </Svg>
      );
    case "hat-flower":
      return (
        <Svg className={svgClass}>
          <FittedHat fit={fit}>
            <HatFlower />
          </FittedHat>
        </Svg>
      );
    case "hat-propeller":
      return (
        <Svg className={svgClass}>
          <FittedHat fit={fit}>
            <HatPropeller />
          </FittedHat>
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
    case "companion-meeple":
      return (
        <Svg className={svgClass}>
          <CompanionMeeple />
        </Svg>
      );
    case "companion-cat":
      return (
        <Svg className={svgClass}>
          <CompanionCat />
        </Svg>
      );
    case "companion-dog":
      return (
        <Svg className={svgClass}>
          <CompanionDog />
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
  companion: "pointer-events-none absolute -bottom-[8%] -right-[12%] z-[6] h-[70%] w-[70%]",
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
