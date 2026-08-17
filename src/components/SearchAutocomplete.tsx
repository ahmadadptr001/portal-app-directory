"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";

interface SearchAutocompleteProps<T> {
  /** Daftar item yang dicari (sumber saran). */
  items: T[];
  /** Mengambil label tampilan dari sebuah item. */
  getLabel: (item: T) => string;
  /** Nilai input (controlled). */
  value: string;
  /** Dipanggil setiap kali teks input berubah. */
  onChange: (value: string) => void;
  /** Dipanggil saat sebuah saran dipilih. */
  onSelect?: (item: T) => void;
  placeholder?: string;
  /** Jumlah maksimal saran yang tampil (default 8). */
  maxSuggestions?: number;
  /** Minimal karakter sebelum saran muncul (default 0 = langsung muncul saat fokus). */
  minChars?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Ref input eksternal (mis. untuk pintasan ⌘K). */
  inputRef?: React.RefObject<HTMLInputElement | null>;
  /** Konten di sisi kanan saat input kosong (mis. badge pintasan ⌘K). */
  hint?: React.ReactNode;
  /** Untuk wrapper (sizing flex). */
  className?: string;
  ariaLabel?: string;
}

const inputClass =
  "w-full h-10 bg-paper-2 border border-line rounded-lg pl-10 pr-9 text-sm text-ink placeholder:text-ink-3 outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent focus:ring-2 focus:ring-accent/20";

// Tandai bagian teks yang cocok dengan kata kunci (biar saran mudah dipindai).
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-accent">{text.slice(idx, idx + q.length)}</span>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function SearchAutocomplete<T>({
  items,
  getLabel,
  value,
  onChange,
  onSelect,
  placeholder,
  maxSuggestions = 8,
  minChars = 0,
  disabled,
  autoFocus,
  inputRef,
  hint,
  className,
  ariaLabel,
}: SearchAutocompleteProps<T>) {
  const id = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const internalRef = useRef<HTMLInputElement>(null);
  const inputEl = inputRef ?? internalRef;

  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);

  const normalized = value.trim().toLowerCase();

  const suggestions = useMemo(() => {
    if (normalized.length < minChars) return [];
    const filtered = normalized
      ? items.filter((it) => getLabel(it).toLowerCase().includes(normalized))
      : items;
    return filtered.slice(0, maxSuggestions);
  }, [items, getLabel, normalized, maxSuggestions, minChars]);

  // Jaga indeks sorotan tetap valid saat daftar saran menyusut.
  useEffect(() => {
    if (highlighted >= suggestions.length) setHighlighted(-1);
  }, [highlighted, suggestions.length]);

  // Tutup dropdown saat klik di luar komponen.
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const selectItem = (item: T) => {
    onChange(getLabel(item));
    onSelect?.(item);
    setHighlighted(-1);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (suggestions.length > 0) {
        setIsOpen(true);
        setHighlighted((h) => (h + 1) % suggestions.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (suggestions.length > 0) {
        setHighlighted((h) => (h - 1 + suggestions.length) % suggestions.length);
      }
    } else if (e.key === "Enter") {
      if (isOpen && suggestions.length > 0) {
        e.preventDefault();
        selectItem(suggestions[highlighted >= 0 ? highlighted : 0]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const showNoResults = isOpen && normalized.length >= minChars && normalized.length > 0 && suggestions.length === 0;

  return (
    <div ref={wrapperRef} className={`relative ${className ?? ""}`}>
      <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-3 pointer-events-none"></i>
      <input
        ref={inputEl}
        type="text"
        role="combobox"
        aria-expanded={isOpen && suggestions.length > 0}
        aria-controls={isOpen && suggestions.length > 0 ? `${id}-listbox` : undefined}
        aria-activedescendant={highlighted >= 0 ? `${id}-option-${highlighted}` : undefined}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        className={inputClass}
      />
      {value ? (
        <button
          onClick={() => {
            onChange("");
            inputEl.current?.focus();
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-md text-ink-3 hover:text-ink transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          aria-label="Hapus pencarian"
          tabIndex={-1}
        >
          <i className="fas fa-xmark"></i>
        </button>
      ) : hint ? (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">{hint}</div>
      ) : null}

      {isOpen && suggestions.length > 0 && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          className="absolute z-50 mt-1.5 w-full rounded-xl bg-paper-2 border border-line/70 shadow-xl overflow-hidden"
        >
          <div className="max-h-72 overflow-y-auto py-1">
            {suggestions.map((item, i) => (
              <li
                key={i}
                role="option"
                id={`${id}-option-${i}`}
                aria-selected={i === highlighted}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectItem(item)}
                onMouseEnter={() => setHighlighted(i)}
                className={`px-3 py-2 text-sm cursor-pointer truncate transition-colors ${
                  i === highlighted
                    ? "bg-accent-soft text-accent"
                    : "text-ink-2"
                }`}
              >
                <Highlight text={getLabel(item)} query={value} />
              </li>
            ))}
          </div>
        </ul>
      )}

      {showNoResults && (
        <div className="absolute z-50 mt-1.5 w-full rounded-xl bg-paper-2 border border-line/70 shadow-xl px-3 py-3 text-xs text-ink-3 text-center">
          Tidak ada hasil untuk &quot;{value.trim()}&quot;
        </div>
      )}
    </div>
  );
}
