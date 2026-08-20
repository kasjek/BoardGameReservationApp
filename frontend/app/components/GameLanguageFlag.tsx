"use client";

import { useI18n } from "../lib/i18n";

const CODE_FLAGS: Record<"en" | "de", string> = {
  en: "🇬🇧",
  de: "🇩🇪",
};

const OTHER_FLAGS: Record<string, string> = {
  French: "🇫🇷",
  Spanish: "🇪🇸",
  Italian: "🇮🇹",
  Portuguese: "🇵🇹",
  Dutch: "🇳🇱",
  Polish: "🇵🇱",
  Czech: "🇨🇿",
  Hungarian: "🇭🇺",
  Romanian: "🇷🇴",
  Swedish: "🇸🇪",
  Norwegian: "🇳🇴",
  Danish: "🇩🇰",
  Finnish: "🇫🇮",
  Greek: "🇬🇷",
  Turkish: "🇹🇷",
  Russian: "🇷🇺",
  Ukrainian: "🇺🇦",
  Chinese: "🇨🇳",
  Japanese: "🇯🇵",
  Korean: "🇰🇷",
  Arabic: "🇸🇦",
  Hebrew: "🇮🇱",
  Hindi: "🇮🇳",
};

export function GameLanguageFlag({
  language,
  other,
}: {
  language: "en" | "de" | "other" | string;
  other?: string;
}) {
  const { t } = useI18n();
  let flag = "🌐";
  let label = t("lang.other");

  if (language === "en") {
    flag = CODE_FLAGS.en;
    label = t("lang.en");
  } else if (language === "de") {
    flag = CODE_FLAGS.de;
    label = t("lang.de");
  } else if (language === "other") {
    const name = (other || "").trim();
    if (name) {
      flag = OTHER_FLAGS[name] || "🌐";
      const key = `lang.${name.toLowerCase()}`;
      const translated = t(key);
      label = translated === key ? name : translated;
    }
  }

  return (
    <span role="img" aria-label={label} title={label} className="text-[15px] leading-none">
      {flag}
    </span>
  );
}
