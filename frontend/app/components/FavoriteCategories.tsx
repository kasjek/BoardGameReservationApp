"use client";

import { useMemo, useState } from "react";

import { type BggCategory } from "../lib/api";
import { useI18n } from "../lib/i18n";

const MAX = 3;

export function FavoriteCategoryChips({
  categories,
}: {
  categories: BggCategory[] | undefined;
}) {
  if (!categories?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-1.5">
      {categories.map((c) => (
        <a
          key={c.id}
          href={c.url}
          target="_blank"
          rel="noreferrer noopener"
          className="chip bg-violet-100 px-3 py-1 text-brand"
        >
          {c.name}
        </a>
      ))}
    </div>
  );
}

export function FavoriteCategoryPicker({
  selected,
  options,
  saving,
  onChange,
}: {
  selected: BggCategory[];
  options: BggCategory[];
  saving: boolean;
  onChange: (ids: number[]) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selectedIds = selected.map((c) => c.id);
  const atMax = selectedIds.length >= MAX;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((c) => c.name.toLowerCase().includes(q));
  }, [options, query]);

  function toggle(id: number) {
    if (saving) return;
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
      return;
    }
    if (atMax) return;
    onChange([...selectedIds, id]);
  }

  function closeSuggestions() {
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="card mb-4 text-left">
      <div className="text-sm font-bold">{t("profile.favoriteCategories")}</div>
      <div className="mt-1 text-xs text-slate-500">{t("profile.favoriteHint")}</div>
      <div className="mt-1 text-xs font-semibold text-brand">
        {t("profile.favoriteCount", { n: selectedIds.length, max: MAX })}
      </div>
      {selected.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              className="chip bg-violet-100 text-brand"
              disabled={saving}
            >
              {c.name} ×
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-xs text-slate-400">{t("profile.favoriteNone")}</div>
      )}
      <div
        className="relative mt-3"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            closeSuggestions();
          }
        }}
      >
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              closeSuggestions();
              e.currentTarget.blur();
            }
          }}
          placeholder={t("profile.favoriteSearch")}
          aria-label={t("profile.favoriteSearch")}
          aria-expanded={open}
          aria-controls="favorite-category-suggestions"
          role="combobox"
          autoComplete="off"
        />
        {open ? (
          <div
            id="favorite-category-suggestions"
            role="listbox"
            className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-slate-100 bg-white"
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-400">{t("profile.favoriteNoMatch")}</div>
            ) : (
              filtered.map((c) => {
                const on = selectedIds.includes(c.id);
                const disabled = saving || (!on && atMax);
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => toggle(c.id)}
                    disabled={disabled}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                      on ? "bg-violet-50 font-bold text-brand" : "text-slate-700"
                    } ${disabled && !on ? "opacity-40" : "hover:bg-violet-50"}`}
                  >
                    <span>{c.name}</span>
                    <span aria-hidden>{on ? "✓" : ""}</span>
                  </button>
                );
              })
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
