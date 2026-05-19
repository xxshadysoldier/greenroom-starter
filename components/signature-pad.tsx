"use client";

import {
  useRef,
  useState,
  useEffect,
  useCallback,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cn } from "@/lib/utils";

export type SignatureMode = "drawn" | "typed";

export type SignatureValue =
  | { kind: "empty" }
  | { kind: "drawn"; dataUrl: string }
  | { kind: "typed"; text: string; dataUrl: string };

type Props = {
  /** Pre-fill the typed-mode field with the recipient's name. */
  defaultTypedName?: string;
  onChange: (value: SignatureValue) => void;
};

/**
 * Two-tab signature capture:
 *   - Draw: HTML5 canvas, pointer events (works for mouse + touch + pen).
 *   - Type: text input with a script-font preview, rendered to a canvas
 *     when the user submits.
 *
 * Emits a SignatureValue on every meaningful change so the parent can
 * gate the Sign button. Drawn signatures emit a PNG dataURL; typed
 * signatures emit both the raw text and a rendered PNG.
 */
export function SignaturePad({ defaultTypedName = "", onChange }: Props) {
  const [mode, setMode] = useState<SignatureMode>("drawn");
  const [typedName, setTypedName] = useState(defaultTypedName);
  const [hasInk, setHasInk] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  // Initialize canvas with DPI-aware sizing
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w === 0 || h === 0) return;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1a1814";
    ctx.lineWidth = 2;
    ctxRef.current = ctx;
  }, []);

  useEffect(() => {
    if (mode !== "drawn") return;
    setupCanvas();
    const onResize = () => setupCanvas();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mode, setupCanvas]);

  // Typed mode → render to canvas + emit on every change
  useEffect(() => {
    if (mode !== "typed") return;
    if (!typedName.trim()) {
      onChange({ kind: "empty" });
      return;
    }
    const dataUrl = renderTextSignature(typedName);
    onChange({ kind: "typed", text: typedName, dataUrl });
  }, [mode, typedName, onChange]);

  // ───── pointer handlers
  const getPos = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = ctxRef.current;
    if (!ctx) return;
    const p = getPos(e);
    lastPoint.current = p;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    // tiny dot for a single tap
    ctx.lineTo(p.x + 0.1, p.y + 0.1);
    ctx.stroke();
    setHasInk(true);
  };

  const move = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    const p = getPos(e);
    if (lastPoint.current) {
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    lastPoint.current = p;
  };

  const end = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    canvasRef.current?.releasePointerCapture(e.pointerId);
    lastPoint.current = null;
    const canvas = canvasRef.current!;
    onChange({ kind: "drawn", dataUrl: canvas.toDataURL("image/png") });
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    // Reset transform-applied scale by calling setupCanvas again
    setupCanvas();
    setHasInk(false);
    onChange({ kind: "empty" });
  };

  return (
    <div>
      {/* Tabs */}
      <div className="inline-flex gap-[2px] p-[3px] bg-white border border-ink-200/80 rounded-lg mb-2.5">
        <TabButton
          on={mode === "drawn"}
          onClick={() => {
            setMode("drawn");
            // Clear any typed-mode emission when switching back
            if (!hasInk) onChange({ kind: "empty" });
          }}
        >
          Draw
        </TabButton>
        <TabButton
          on={mode === "typed"}
          onClick={() => setMode("typed")}
        >
          Type
        </TabButton>
      </div>

      {mode === "drawn" ? (
        <div className="relative">
          <canvas
            ref={canvasRef}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            className={cn(
              "block w-full h-32 sm:h-36 rounded-lg bg-white border border-dashed touch-none",
              hasInk ? "border-ink-300" : "border-ink-300/80 cursor-crosshair",
            )}
            style={{ touchAction: "none" }}
            aria-label="Signature canvas"
          />
          {!hasInk && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-ink-300 text-[12px]">
              <span className="inline-flex items-center gap-1.5">
                <span className="text-[16px] font-mono leading-none">×</span>
                Sign here
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={clear}
            disabled={!hasInk}
            className="absolute top-2 right-3 text-[10.5px] text-ink-400 hover:text-ink-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Clear
          </button>
        </div>
      ) : (
        <div>
          <input
            type="text"
            value={typedName}
            placeholder="Type your full name"
            onChange={(e) => setTypedName(e.target.value)}
            className="w-full rounded-lg border border-ink-300/70 bg-white px-3 py-2 text-[13.5px] text-ink-900 focus:outline-2 focus:outline-brand-700"
          />
          <div className="mt-2 h-24 rounded-lg bg-white border border-ink-200/70 flex items-center justify-center overflow-hidden">
            {typedName.trim() ? (
              <span
                className="text-[34px] text-ink-900 leading-none"
                style={{ fontFamily: "var(--font-caveat), 'Caveat', cursive" }}
              >
                {typedName}
              </span>
            ) : (
              <span className="text-[12px] text-ink-300">Preview will appear here</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-md text-[12px] font-medium transition-colors",
        on
          ? "bg-ink-900 text-white"
          : "bg-transparent text-ink-500 hover:text-ink-800",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Render a typed signature to an offscreen canvas → PNG dataURL.
 * Best-effort: uses the Caveat web font if loaded, falls back to cursive.
 */
function renderTextSignature(text: string): string {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  const dpr = window.devicePixelRatio || 1;
  const w = 480;
  const h = 120;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#1a1814";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  // Try the loaded font; fall back if not yet ready.
  ctx.font = `500 60px Caveat, 'Dancing Script', cursive`;
  const measured = ctx.measureText(text);
  const drawW = Math.min(measured.width, w - 32);
  ctx.fillText(text, 16, h / 2, drawW);
  return canvas.toDataURL("image/png");
}
