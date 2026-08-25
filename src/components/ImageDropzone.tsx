"use client";

/**
 * Area unggah gambar dengan DRAG & DROP + klik untuk memilih berkas.
 *
 * Taxa berkas divalidasi dua lapis: instan di klien (mime + ukuran) lalu
 * ditegakkan lagi di server (/api/upload). Setiap berkas diunggah seketika —
 * URL hasilnya dikembalikan lewat `onUploaded`; penyimpanan ke form adalah
 * urusan pemanggil (logo = ganti field, screenshot = tambah baris).
 */
import React, { useRef, useState } from "react";
import { LIMITS, VALID_IMAGE_MIME } from "@/lib/validate";

interface ImageDropzoneProps {
  /** Dipanggil dengan URL publik setiap berkas yang berhasil diunggah. */
  onUploaded: (urls: string[]) => void;
  /** Terima banyak berkas sekaligus (untuk screenshot). */
  multiple?: boolean;
  disabled?: boolean;
  /** Varian kecil untuk logo di kolom form sempit. */
  compact?: boolean;
  hint?: string;
  ariaLabel: string;
}

const MAX_MB = Math.round(LIMITS.uploadMaxBytes / (1024 * 1024));

export default function ImageDropzone({
  onUploaded,
  multiple = false,
  disabled = false,
  compact = false,
  hint,
  ariaLabel,
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const accept = Object.keys(VALID_IMAGE_MIME).join(",");

  async function handleFiles(fileList: FileList | File[]) {
    if (disabled || busy) return;
    setError(null);
    setDoneCount(0);

    const all = Array.from(fileList);
    if (all.length === 0) return;

    // Validasi instan di klien — server memvalidasi ulang nanti.
    for (const f of all) {
      if (!(f.type in VALID_IMAGE_MIME)) {
        setError(`"${f.name}": jenis berkas tidak didukung (gunakan PNG, JPG, WebP, atau GIF).`);
        return;
      }
      if (f.size > LIMITS.uploadMaxBytes) {
        setError(`"${f.name}" melebihi ${MAX_MB} MB.`);
        return;
      }
    }

    // Varian tunggal hanya ambil berkas pertama; sisanya diabaikan diam-diam
    // (drop satu file adalah kasus normalnya).
    const chosen = multiple ? all : all.slice(0, 1);

    setBusy(true);
    const urls: string[] = [];
    try {
      for (const f of chosen) {
        const fd = new FormData();
        fd.append("file", f);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || `Gagal mengunggah "${f.name}".`);
        urls.push(data.url as string);
        setDoneCount(urls.length);
      }
      onUploaded(urls);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const openPicker = () => inputRef.current?.click();

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        onClick={openPicker}
        onKeyDown={onKeyDown}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled && !busy && e.dataTransfer.files.length > 0) {
            handleFiles(e.dataTransfer.files);
          }
        }}
        className={`flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-center cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          compact ? "px-2 py-2 min-h-[64px]" : "px-3 py-5"
        } ${
          dragOver
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-slate-300/70 dark:border-slate-600/60 bg-slate-50/60 dark:bg-slate-700/30 hover:border-blue-400 dark:hover:border-blue-600"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <i
          className={`fas ${
            busy ? "fa-spinner fa-spin" : dragOver ? "fa-file-arrow-down" : "fa-cloud-arrow-up"
          } text-sm ${dragOver ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`}
        ></i>
        <span className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {busy ? (
            <>Mengunggah{multiple && doneCount > 0 ? ` (${doneCount})…` : "…"}</>
          ) : (
            <>
              Tarik &amp; lepas gambar di sini,{" "}
              <span className="font-medium text-blue-600 dark:text-blue-400">atau klik pilih</span>
            </>
          )}
        </span>
        {!busy && hint && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500">{hint}</span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
          // Reset agar memilih berkas yang sama lagi tetap memicu onChange.
          e.target.value = "";
        }}
      />

      {error && (
        <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-[11px] text-red-600 dark:text-red-400">
          <i className="fas fa-circle-exclamation mt-0.5"></i>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
