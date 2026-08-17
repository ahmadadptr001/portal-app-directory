import { useState, useMemo, useRef, useEffect } from "react";
import { Pencil, Check, ShieldCheck, Move } from "lucide-react";

// ── Design tokens ──────────────────────────────────────────────
// Frame   : graphite / gunmetal (#1c1d20 → #0c0d0f)
// Screen  : soft slate mist in light mode (#eef1f5 → #dfe4ec),
//           deep charcoal mist in dark mode (#1a1c22 → #0f1115)
// Card    : porcelain white (light) / graphite surface (dark), hairline border
// Accent  : deep teal (#0d9488) — signals "verified / active", not the usual
//           terracotta/indigo defaults
// Type    : system sans, tight tracking on labels, mono for the role tag
//
// NOTE: dark-mode variants below assume the host app toggles Tailwind's
// class-based dark mode (a `dark` class on <html> or an ancestor), which is
// already how the rest of the dashboard is themed. No new logic, state, or
// function names were introduced — only className additions/swaps so the
// screen content (menu bar + profile card) follows the same theme as the
// laptop body already does.

type ProfileFields = {
  id: string;
  username: string;
  role: string;
  createdAt: string;
};

export default function MacBookProfileMockup({
  onClose,
  user,
  onProfileUpdate,
}: {
  onClose?: () => void;
  user: { id: number; username: string; role: string; createdAt: string };
  onProfileUpdate?: (newUsername: string) => void;
}) {
  const [fields, setFields] = useState<ProfileFields>({
    ...user,
    id: user.id.toString(),
  });
  const [saved, setSaved] = useState<ProfileFields>({
    ...user,
    id: user.id.toString(),
  });
  const [justSaved, setJustSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isDirty = useMemo(
    () => fields.username !== saved.username,
    [fields, saved],
  );

  function handleChange(key: keyof ProfileFields, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
    setJustSaved(false);
  }

  async function handleSubmit() {
    if (!isDirty) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, username: fields.username }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan");
        return;
      }
      setSaved(fields);
      setJustSaved(true);
      if (onProfileUpdate) onProfileUpdate(fields.username);
      window.setTimeout(() => setJustSaved(false), 1800);
    } catch {
      setError("Tidak dapat terhubung ke server");
    } finally {
      setLoading(false);
    }
  }

  // ── Free drag logic ──────────────────────────────────────────
  // The laptop sits absolutely positioned inside a relative "canvas".
  // Dragging is only armed from the frame/body (lid edge, hinge,
  // keyboard deck, handle) — inputs, the camera button, and the
  // update button stop propagation so they stay clickable.
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // offset from centered start
  const dragState = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  function onDragStart(e: React.PointerEvent) {
    e.preventDefault();
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
    setDragging(true);
  }

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!dragState.current) return;
      const canvas = canvasRef.current;
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;
      let nx = dragState.current.origX + dx;
      let ny = dragState.current.origY + dy;

      // Keep a sliver of the laptop always reachable inside the canvas.
      if (canvas) {
        const bound = canvas.getBoundingClientRect();
        const margin = 60;
        const maxX = bound.width / 2 - margin;
        const maxY = bound.height / 2 - margin;
        nx = Math.max(-maxX, Math.min(maxX, nx));
        ny = Math.max(-maxY, Math.min(maxY, ny));
      }
      setPos({ x: nx, y: ny });
    }
    function onUp() {
      dragState.current = null;
      setDragging(false);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  return (
    <div
      ref={canvasRef}
      className="fixed inset-0 z-[60] overflow-hidden touch-none"
    >
      {/* ── MacBook body (freely draggable) ───────────────────── */}
      <div
        className="absolute top-1/2 left-1/2 w-full max-w-2xl select-none"
        style={{
          transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px)`,
          cursor: dragging ? "grabbing" : "grab",
          transition: dragging ? "none" : "transform 0.06s linear",
        }}
        onPointerDown={onDragStart}
      >
        {/* drag handle chip */}
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1c1d20]/90 text-[#c7cad0] text-[10px] font-mono uppercase tracking-[0.12em] shadow-lg">
          <Move className="h-3 w-3" strokeWidth={2} />
          Seret bebas
        </div>

        {/* Lid / screen */}
        <div
          className="relative rounded-t-[22px] p-[14px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.45)]"
          style={{
            background: "linear-gradient(180deg,#2a2b2f 0%,#161719 100%)",
          }}
        >
          {/* camera notch */}
          <div className="absolute left-1/2 top-[6px] -translate-x-1/2 flex items-center gap-1">
            <span className="h-[6px] w-[6px] rounded-full bg-[#0a0a0a] ring-1 ring-[#3a3b3f]" />
          </div>

          {/* Screen glass — pointer events stop here so the profile card stays interactive while dragging is armed on the frame */}
          <div className="relative overflow-hidden rounded-[10px] aspect-[16/10] bg-gradient-to-br from-[#eef1f5] via-[#e4e8ee] to-[#dbe0e8] dark:from-[#1a1c22] dark:via-[#15171b] dark:to-[#0f1115]">
            {/* macOS menu bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-black/5 dark:border-white/10 bg-white/40 dark:bg-white/[0.04] backdrop-blur-sm">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              </div>
              <span className="text-[11px] font-medium tracking-tight text-[#5b5f66] dark:text-[#c7cad0]">
                Pengaturan Akun
              </span>
              <span className="w-[52px]" />
            </div>

            {/* Desktop content */}
            <div className="flex items-center justify-center h-[calc(100%-37px)] px-6 py-4 overflow-y-auto">
              {/* ── Profile Card ───────────────────────────── */}
              <div
                className="w-full max-w-sm m-auto rounded-2xl bg-white dark:bg-[#17181c] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_20px_45px_-15px_rgba(15,23,42,0.25)] dark:shadow-[0_20px_45px_-15px_rgba(0,0,0,0.55)] overflow-hidden"
                onPointerDown={(e) => e.stopPropagation()}
              >
                {/* accent header strip */}
                <div
                  className="h-16 relative flex justify-between items-center p-3"
                  style={{
                    background:
                      "linear-gradient(120deg,#3b82f6 0%,#2563eb 100%)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-white font-semibold text-xs overflow-hidden">
                      <img src={`https://api.dicebear.com/9.x/bottts/svg?seed=${fields.username}`} alt={fields.username} className="w-[80%] h-[80%] object-cover" />
                    </div>
                    <span className="text-white text-xs font-medium">
                      {fields.username}
                    </span>
                  </div>
                  <button
                    onClick={onClose}
                    className="px-3 py-1 rounded-full bg-white/30 text-white text-xs font-medium hover:bg-white/30 transition-colors flex items-center gap-1.5"
                  >
                    <i className="fas fa-times"></i> Tutup
                  </button>
                </div>

                {/* body */}
                <div className="pt-5 pb-5 px-5">
                  <div className="flex items-center gap-1.5 mb-4">
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-indigo-400" />
                    <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-blue-600 dark:text-indigo-400">
                      Akun terverifikasi
                    </span>
                  </div>

                  <Field
                    label="Username"
                    value={fields.username}
                    onChange={(v) => handleChange("username", v)}
                  />
                  <Field
                    label="Role"
                    value={fields.role}
                    onChange={() => {}}
                    disabled
                  />
                  {error && (
                    <p className="text-[11px] text-red-500 dark:text-red-400 mb-2 mt-1">
                      {error}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={(!isDirty && !justSaved) || loading}
                    className={`mt-3 w-full h-10 rounded-lg text-[13px] font-semibold tracking-tight flex items-center justify-center gap-1.5 transition-all duration-200
                      ${
                        justSaved
                          ? "bg-blue-600 text-white"
                          : isDirty
                            ? "bg-[#111827] dark:bg-blue-600 text-white hover:bg-[#1f2937] dark:hover:bg-indigo-500 active:scale-[0.98]"
                            : "bg-[#f1f3f5] dark:bg-white/[0.06] text-[#9aa3ae] dark:text-[#7d838d] cursor-default"
                      }`}
                  >
                    {loading ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i> Menyimpan...
                      </>
                    ) : justSaved ? (
                      <>
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                        Tersimpan
                      </>
                    ) : isDirty ? (
                      <>
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                        Perbarui
                      </>
                    ) : (
                      <>
                        <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
                        Edit Profil
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hinge */}
        <div
          className="h-[10px] rounded-b-[2px]"
          style={{
            background: "linear-gradient(180deg,#3a3b3f 0%,#232427 100%)",
          }}
        />

        {/* ── Keyboard deck / base ─────────────────────────────── */}
        <div
          className="relative rounded-b-[16px] px-4 pt-3 pb-2 shadow-[0_30px_60px_-25px_rgba(0,0,0,0.5)]"
          style={{
            background:
              "linear-gradient(180deg,#d7dadf 0%,#c3c7cd 55%,#b4b8be 100%)",
          }}
        >
          {/* speaker grille slits, top edge */}
          <div className="flex justify-between px-2 mb-2 opacity-40">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={`sl-${i}`} className="flex gap-[3px]">
                {Array.from({ length: 8 }).map((__, j) => (
                  <span
                    key={j}
                    className="w-[2px] h-[10px] rounded-full bg-[#8b8f96]"
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Keyboard well */}
          <div className="rounded-md bg-[#b6bac0] p-2.5 shadow-inner">
            <Keyboard />
          </div>

          {/* Trackpad */}
          <div className="flex justify-center pt-2.5 pb-1">
            <div className="w-[38%] aspect-[16/10] rounded-[6px] bg-[#c9ccd1] ring-1 ring-black/[0.08] shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]" />
          </div>
        </div>

        {/* Front lip notch */}
        <div className="mx-auto h-[5px] w-20 rounded-b-lg bg-[#9297a0]" />
      </div>
    </div>
  );
}

// ── Keyboard: function row + full alpha layout, MacBook-style ──
function Keyboard() {
  const rows: string[][] = [
    [
      "esc",
      "F1",
      "F2",
      "F3",
      "F4",
      "F5",
      "F6",
      "F7",
      "F8",
      "F9",
      "F10",
      "F11",
      "F12",
      "⏻",
    ],
    ["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=", "delete"],
    ["tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\"],
    ["caps", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "return"],
    ["shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "shift"],
  ];

  const wideKeys = new Set([
    "esc",
    "delete",
    "tab",
    "caps",
    "return",
    "shift",
    "⏻",
  ]);

  return (
    <div className="flex flex-col gap-[3px]">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-[3px]">
          {row.map((key, ki) => (
            <div
              key={`${ri}-${ki}`}
              className={`h-4 sm:h-5 rounded-[3px] bg-[#2b2c2f] flex items-center justify-center text-[5px] sm:text-[6px] font-medium text-[#c7cad0] shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_1px_1px_rgba(0,0,0,0.3)] ${
                wideKeys.has(key) ? "flex-[1.8]" : "flex-1"
              } ${key === "⏻" ? "bg-[#3a3b3f] text-[#e5e7eb]" : ""}`}
            >
              {key.length > 3 ? "" : key}
            </div>
          ))}
        </div>
      ))}
      {/* space bar row */}
      <div className="flex gap-[3px]">
        <div className="flex-[1] h-4 sm:h-5 rounded-[3px] bg-[#2b2c2f]" />
        <div className="flex-[1] h-4 sm:h-5 rounded-[3px] bg-[#2b2c2f]" />
        <div className="flex-[6] h-4 sm:h-5 rounded-[3px] bg-[#2b2c2f]" />
        <div className="flex-[1] h-4 sm:h-5 rounded-[3px] bg-[#2b2c2f]" />
        <div className="flex-[1] h-4 sm:h-5 rounded-[3px] bg-[#2b2c2f]" />
        <div className="flex-[1] h-4 sm:h-5 rounded-[3px] bg-[#2b2c2f]" />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  icon,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="block mb-3 last:mb-0">
      <span className="block text-[10px] font-mono uppercase tracking-[0.12em] text-[#9aa3ae] dark:text-[#7d838d] mb-1">
        {label}
      </span>
      <div
        className={`flex items-center gap-2 rounded-lg border px-3 h-9 transition-colors ${disabled ? "bg-[#f1f3f5] dark:bg-white/[0.03] border-[#e5e8ec] dark:border-white/[0.06] text-[#9aa3ae] dark:text-[#6b7280] cursor-not-allowed" : "bg-[#fafbfc] dark:bg-white/[0.03] border-[#e5e8ec] dark:border-white/10 focus-within:border-blue-600 dark:focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-600/15 dark:focus-within:ring-blue-400/15"}`}
      >
        {icon}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full bg-transparent text-[13px] font-medium outline-none placeholder:text-[#c2c8ce] dark:placeholder:text-[#4b5058] ${disabled ? "text-[#9aa3ae] dark:text-[#6b7280] cursor-not-allowed" : "text-slate-900 dark:text-slate-100"}`}
        />
      </div>
    </label>
  );
}
