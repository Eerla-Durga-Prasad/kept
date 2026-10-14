import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Check, Move } from 'lucide-react';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onApply: (croppedDataUrl: string) => void;
}

const CROP_DIAMETER = 200; // Diameter of circular crop area in pixels
const CONTAINER_SIZE = 240; // Viewport container dimension in pixels
const OUTPUT_SIZE = 400; // Final exported avatar canvas resolution

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onApply,
}) => {
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [minScale, setMinScale] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1); // 1.0 to 3.0
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; initialPanX: number; initialPanY: number }>({
    x: 0,
    y: 0,
    initialPanX: 0,
    initialPanY: 0,
  });
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Compute scale based on minScale and zoom level
  const currentScale = minScale * zoomLevel;

  // Clamp pan so image always fully covers the circular area
  const clampPan = useCallback(
    (x: number, y: number, scale: number) => {
      if (!naturalSize.width || !naturalSize.height) return { x: 0, y: 0 };
      const renderedW = naturalSize.width * scale;
      const renderedH = naturalSize.height * scale;

      const maxPanX = Math.max(0, (renderedW - CROP_DIAMETER) / 2);
      const maxPanY = Math.max(0, (renderedH - CROP_DIAMETER) / 2);

      return {
        x: Math.min(maxPanX, Math.max(-maxPanX, x)),
        y: Math.min(maxPanY, Math.max(-maxPanY, y)),
      };
    },
    [naturalSize]
  );

  // Load natural image dimensions when imageSrc changes
  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    const img = new Image();
    img.onload = () => {
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      setNaturalSize({ width: nw, height: nh });

      // Scale so image at least covers circular crop diameter
      const initialMinScale = Math.max(CROP_DIAMETER / nw, CROP_DIAMETER / nh);
      setMinScale(initialMinScale);
      setZoomLevel(1);
      setPan({ x: 0, y: 0 });
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc]);

  // Update live preview avatar canvas
  useEffect(() => {
    if (!previewCanvasRef.current || !imageRef.current || !naturalSize.width || !naturalSize.height) return;

    const canvas = previewCanvasRef.current;
    canvas.width = 96;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 96, 96);
    const factor = 96 / CROP_DIAMETER;
    const renderedW = naturalSize.width * currentScale * factor;
    const renderedH = naturalSize.height * currentScale * factor;
    const drawX = 48 - renderedW / 2 + pan.x * factor;
    const drawY = 48 - renderedH / 2 + pan.y * factor;

    ctx.save();
    ctx.beginPath();
    ctx.arc(48, 48, 48, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(imageRef.current, drawX, drawY, renderedW, renderedH);
    ctx.restore();
  }, [naturalSize, currentScale, pan]);

  if (!isOpen || !imageSrc) return null;

  // Pointer drag handlers (works seamlessly for mouse and touch)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      initialPanX: pan.x,
      initialPanY: pan.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const newX = dragStartRef.current.initialPanX + dx;
    const newY = dragStartRef.current.initialPanY + dy;
    setPan(clampPan(newX, newY, currentScale));
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    const nextZoom = Math.min(3, Math.max(1, zoomLevel + delta));
    setZoomLevel(nextZoom);
    setPan((prev) => clampPan(prev.x, prev.y, minScale * nextZoom));
  };

  const handleZoomChange = (newZoom: number) => {
    const clamped = Math.min(3, Math.max(1, newZoom));
    setZoomLevel(clamped);
    setPan((prev) => clampPan(prev.x, prev.y, minScale * clamped));
  };

  const handleReset = () => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  const handleApplyCrop = () => {
    if (!imageRef.current || !naturalSize.width || !naturalSize.height) return;

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const factor = OUTPUT_SIZE / CROP_DIAMETER;
    const renderedW = naturalSize.width * currentScale * factor;
    const renderedH = naturalSize.height * currentScale * factor;
    const cx = OUTPUT_SIZE / 2;
    const cy = OUTPUT_SIZE / 2;
    const drawX = cx - renderedW / 2 + pan.x * factor;
    const drawY = cy - renderedH / 2 + pan.y * factor;

    ctx.drawImage(imageRef.current, drawX, drawY, renderedW, renderedH);
    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    onApply(croppedDataUrl);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
      {/* Dark backdrop */}
      <div
        className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Crop Dialog Card */}
      <div className="relative w-full max-w-sm bg-cream-50 rounded-2xl border border-borderWarm shadow-float overflow-hidden z-10 flex flex-col max-h-[92vh] animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-borderWarm bg-white/70">
          <div>
            <h3 className="font-serif text-lg sm:text-xl font-medium tracking-tight text-ink-900">
              Crop Profile Photo
            </h3>
            <p className="text-[11px] sm:text-xs text-ink-500">
              Drag to position • Zoom to frame
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-ink-400 hover:text-ink-700 hover:bg-cream-200 rounded-full transition-colors cursor-pointer"
            aria-label="Close crop dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Crop Canvas Frame */}
          <div className="flex flex-col items-center justify-center">
            <div
              className="relative overflow-hidden rounded-2xl bg-ink-900 select-none touch-none cursor-grab active:cursor-grabbing border border-borderWarm shadow-subtle"
              style={{ width: `${CONTAINER_SIZE}px`, height: `${CONTAINER_SIZE}px` }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
            >
              {/* Actual Image under circular mask */}
              <img
                ref={imageRef}
                src={imageSrc}
                alt="Crop subject"
                draggable={false}
                style={{
                  width: `${naturalSize.width * currentScale}px`,
                  height: `${naturalSize.height * currentScale}px`,
                  transform: `translate(${pan.x}px, ${pan.y}px)`,
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  marginLeft: `${-(naturalSize.width * currentScale) / 2}px`,
                  marginTop: `${-(naturalSize.height * currentScale) / 2}px`,
                  maxWidth: 'none',
                  pointerEvents: 'none',
                }}
              />

              {/* Dark overlay with circular cutout */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                  className="rounded-full border-2 border-white/95 shadow-[0_0_0_9999px_rgba(28,25,23,0.55)]"
                  style={{ width: `${CROP_DIAMETER}px`, height: `${CROP_DIAMETER}px` }}
                />
              </div>

              {/* Drag indicator hint */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] pointer-events-none flex items-center gap-1">
                <Move className="w-3 h-3" />
                <span>Drag to move</span>
              </div>
            </div>
          </div>

          {/* Zoom Slider & Controls */}
          <div className="space-y-2 bg-white p-3 rounded-xl border border-borderWarm">
            <div className="flex items-center justify-between text-xs text-ink-700">
              <span className="font-medium flex items-center gap-1">
                <ZoomIn className="w-3.5 h-3.5 text-terracotta-500" />
                Zoom
              </span>
              <span className="font-mono text-[11px] text-ink-500">
                {Math.round(zoomLevel * 100)}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleZoomChange(zoomLevel - 0.2)}
                disabled={zoomLevel <= 1}
                className="p-1 rounded-lg hover:bg-cream-100 disabled:opacity-40 text-ink-600 transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoomLevel}
                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                className="flex-1 accent-terracotta-500 h-1.5 bg-cream-200 rounded-lg appearance-none cursor-pointer"
              />

              <button
                type="button"
                onClick={() => handleZoomChange(zoomLevel + 0.2)}
                disabled={zoomLevel >= 3}
                className="p-1 rounded-lg hover:bg-cream-100 disabled:opacity-40 text-ink-600 transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="p-1 rounded-lg hover:bg-cream-100 text-ink-500 hover:text-ink-800 transition-colors ml-1"
                title="Reset zoom and position"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Live Avatar Preview */}
          <div className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-borderWarm">
            <div className="w-11 h-11 rounded-full overflow-hidden relative border-2 border-borderWarm shrink-0 bg-cream-200 shadow-subtle">
              <canvas ref={previewCanvasRef} className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-ink-900 block truncate">
                Preview
              </span>
              <span className="text-[11px] text-ink-500 block truncate">
                How this will appear on your profile
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-borderWarm">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-cream-200 hover:bg-cream-300 text-ink-800 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyCrop}
              className="px-5 py-2.5 bg-terracotta-500 hover:bg-terracotta-600 active:bg-terracotta-700 text-white rounded-xl text-xs sm:text-sm font-medium flex items-center justify-center gap-1.5 shadow-subtle transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Apply Crop</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
