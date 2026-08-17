"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  Circle,
  Maximize,
  MousePointer2,
  Move,
  Ruler,
  Sun,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { getDicomVolumeShape, getStudySliceUrl } from "@/api/clients";
import { SeriesFilmstrip } from "@/components/features/patients/SeriesFilmstrip";

type ViewerTool = "cursor" | "pan" | "window" | "contrast" | "measure";
type Point = { x: number; y: number };
type Measurement = { start: Point; end: Point };
type DragState = {
  start: Point;
  offset: Point;
  windowCenter: number;
  windowWidth: number;
  brightness: number;
  contrast: number;
};

type MRISeriesViewerProps = {
  studyId: string;
  modality: string;
};

const DEFAULT_WINDOW_CENTER = 128;
const DEFAULT_WINDOW_WIDTH = 180;

const tools: Array<{
  id: ViewerTool;
  label: string;
  icon: typeof MousePointer2;
}> = [
  { id: "cursor", label: "Cursor tool", icon: MousePointer2 },
  { id: "pan", label: "Pan image", icon: Move },
  { id: "window", label: "Adjust window level by dragging", icon: Sun },
  { id: "contrast", label: "Adjust brightness and contrast by dragging", icon: Circle },
  { id: "measure", label: "Measure distance on image", icon: Ruler },
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function MRISeriesViewer({ studyId, modality }: MRISeriesViewerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [depth, setDepth] = useState(0);
  const [slice, setSlice] = useState(0);
  const [activeTool, setActiveTool] = useState<ViewerTool>("cursor");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [windowCenter, setWindowCenter] = useState(DEFAULT_WINDOW_CENTER);
  const [windowWidth, setWindowWidth] = useState(DEFAULT_WINDOW_WIDTH);
  const [brightness, setBrightness] = useState(0.82);
  const [contrast, setContrast] = useState(1.08);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getDicomVolumeShape(studyId)
      .then((shape) => {
        if (cancelled || !shape) return;
        setDepth(shape.depth);
        setSlice(Math.max(0, Math.floor(shape.depth / 2)));
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [studyId]);

  const sliceUrl = useMemo(
    () =>
      depth > 0
        ? getStudySliceUrl(studyId, slice, {
            windowCenter,
            windowWidth,
            orientation: "axial",
            includeOverlay: true,
            overlayOpacity: 0.55,
          })
        : null,
    [depth, slice, studyId, windowCenter, windowWidth],
  );

  function viewportPoint(event: PointerEvent<HTMLDivElement>): Point {
    const bounds = viewportRef.current?.getBoundingClientRect();
    return {
      x: event.clientX - (bounds?.left ?? 0),
      y: event.clientY - (bounds?.top ?? 0),
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (activeTool === "cursor") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = viewportPoint(event);
    dragRef.current = {
      start: point,
      offset,
      windowCenter,
      windowWidth,
      brightness,
      contrast,
    };
    if (activeTool === "measure") {
      setMeasurement({ start: point, end: point });
    }
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const point = viewportPoint(event);
    const deltaX = point.x - drag.start.x;
    const deltaY = point.y - drag.start.y;

    if (activeTool === "pan") {
      setOffset({ x: drag.offset.x + deltaX, y: drag.offset.y + deltaY });
    } else if (activeTool === "window") {
      setWindowCenter(Math.round(clamp(drag.windowCenter - deltaY, 0, 255)));
      setWindowWidth(Math.round(clamp(drag.windowWidth + deltaX, 20, 512)));
      setLoadError(false);
    } else if (activeTool === "contrast") {
      setBrightness(clamp(drag.brightness - deltaY / 350, 0.35, 1.5));
      setContrast(clamp(drag.contrast + deltaX / 350, 0.5, 2.2));
    } else if (activeTool === "measure") {
      setMeasurement({ start: drag.start, end: point });
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  }

  function resetView() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setMeasurement(null);
  }

  const measurementLength = measurement
    ? Math.hypot(
        measurement.end.x - measurement.start.x,
        measurement.end.y - measurement.start.y,
      )
    : 0;

  const cursorClass =
    activeTool === "pan"
      ? "cursor-grab active:cursor-grabbing"
      : activeTool === "window" || activeTool === "contrast"
        ? "cursor-ew-resize"
        : activeTool === "measure"
          ? "cursor-crosshair"
          : "cursor-default";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <section className="flex h-[clamp(380px,52vh,560px)] min-h-0 flex-none overflow-hidden rounded-lg border border-[var(--border)] bg-black">
        <div className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-white/15 bg-black py-2">
          {tools.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={activeTool === id}
              onClick={() => setActiveTool(id)}
              className={`flex h-8 w-8 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-white/10 ${
                activeTool === id ? "bg-[var(--registry-primary)] text-white" : ""
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </button>
          ))}
          <div className="my-1 h-px w-6 bg-white/15" />
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoom((value) => Math.min(4, value + 0.2))}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-white/10"
          >
            <ZoomIn className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoom((value) => Math.max(0.5, value - 0.2))}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-white/10"
          >
            <ZoomOut className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Fit image to viewport"
            onClick={resetView}
            className="mt-auto flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-white/10"
          >
            <Maximize className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between px-3 py-2 text-[10px] text-slate-300">
            <div className="space-y-0.5">
              <p>Sequence: T1w MPRAGE</p>
              <p>Plane: Axial</p>
            </div>
            <p className="text-right text-slate-400">
              {depth > 0 ? `Slice ${slice + 1} of ${depth}` : "Loading series..."}
            </p>
          </div>

          <div
            ref={viewportRef}
            className={`relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden ${cursorClass}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={(event) => {
              event.preventDefault();
              setZoom((value) => clamp(value - event.deltaY * 0.001, 0.5, 4));
            }}
          >
            {sliceUrl && !loadError ? (
              <img
                src={sliceUrl}
                alt={`MRI slice ${slice + 1} of ${depth}`}
                draggable={false}
                onError={() => setLoadError(true)}
                className="pointer-events-none h-full w-full select-none object-contain"
                style={{
                  filter: `brightness(${brightness}) contrast(${contrast})`,
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  transformOrigin: "center",
                }}
              />
            ) : (
              <p className="text-xs text-slate-400">
                {loadError ? "MRI preview is unavailable for this study." : "Loading MRI series..."}
              </p>
            )}

            {measurement && measurementLength > 2 ? (
              <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
                <line
                  x1={measurement.start.x}
                  y1={measurement.start.y}
                  x2={measurement.end.x}
                  y2={measurement.end.y}
                  stroke="var(--registry-primary)"
                  strokeWidth="2"
                />
                <circle
                  cx={measurement.start.x}
                  cy={measurement.start.y}
                  r="3"
                  fill="var(--registry-primary)"
                />
                <circle
                  cx={measurement.end.x}
                  cy={measurement.end.y}
                  r="3"
                  fill="var(--registry-primary)"
                />
                <text
                  x={(measurement.start.x + measurement.end.x) / 2}
                  y={(measurement.start.y + measurement.end.y) / 2 - 7}
                  fill="white"
                  fontSize="11"
                  textAnchor="middle"
                >
                  {Math.round(measurementLength)} px
                </text>
              </svg>
            ) : null}

            <span className="pointer-events-none absolute bottom-3 left-3 text-[9px] text-slate-400">
              WL: {windowCenter}&nbsp;&nbsp;WW: {windowWidth}
            </span>
            <span className="pointer-events-none absolute bottom-3 right-3 text-[9px] text-slate-400">
              {modality.toUpperCase()} · Axial
            </span>
          </div>

          {depth > 1 ? (
            <div className="border-t border-white/10 px-4 py-3">
              <input
                type="range"
                min={0}
                max={depth - 1}
                value={slice}
                onChange={(event) => {
                  setLoadError(false);
                  setSlice(Number(event.target.value));
                }}
                aria-label="MRI slice"
                className="h-1.5 w-full cursor-pointer accent-[var(--registry-primary)]"
              />
            </div>
          ) : null}
        </div>
      </section>

      {depth > 0 ? (
        <SeriesFilmstrip
          studyId={studyId}
          depth={depth}
          selectedSlice={slice}
          windowCenter={windowCenter}
          windowWidth={windowWidth}
          brightness={brightness}
          contrast={contrast}
          onSelect={(nextSlice) => {
            setLoadError(false);
            setSlice(nextSlice);
          }}
        />
      ) : null}
    </div>
  );
}
