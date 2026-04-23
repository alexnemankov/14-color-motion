import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { AnimationType, GradientParams } from '../types';
import { supportsLoopSafeExport } from '../utils/sceneUtils';
import type { RendererHandle } from '../components/rendererTypes';

export interface ExportStatusState {
  phase: "idle" | "preparing" | "capturing" | "recording" | "encoding" | "complete" | "error";
  label: string;
  detail?: string;
  progress: number;
  frameCount?: number;
  frameTotal?: number;
}

interface UseExportOptions {
  animationType: AnimationType;
  rendererRef: RefObject<RendererHandle | null>;
  params: GradientParams;
  onToast: (title: string, message?: string) => void;
}

const IDLE_STATUS: ExportStatusState = { phase: "idle", label: "Ready", progress: 0 };

export function useExport({ animationType, rendererRef, params, onToast }: UseExportOptions) {
  const [renderScale, setRenderScale] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [externalRenderTime, setExternalRenderTime] = useState<number | null>(null);
  const [exportStatus, setExportStatus] = useState<ExportStatusState>(IDLE_STATUS);
  const [loopSafePreview, setLoopSafePreview] = useState<{
    durationSeconds: number;
    startedAt: number;
  } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimeoutRef = useRef<number | null>(null);
  const loopPreviewFrameRef = useRef<number | null>(null);
  const exportProgressFrameRef = useRef<number | null>(null);
  const exportResetTimeoutRef = useRef<number | null>(null);
  const previousPhaseRef = useRef<ExportStatusState["phase"]>("idle");

  // Confetti on export complete
  useEffect(() => {
    if (exportStatus.phase === "complete" && previousPhaseRef.current !== "complete") {
      import('canvas-confetti').then(({ default: confetti }) => {
        void confetti({
          particleCount: 90,
          spread: 70,
          startVelocity: 28,
          origin: { x: 0.85, y: 0.18 },
          colors: ["#F2622F", "#FF9B5C", "#FFE3D2", "#FFFFFF"],
        });
      });
    }
    previousPhaseRef.current = exportStatus.phase;
  }, [exportStatus.phase]);

  // Loop-safe preview drives externalRenderTime
  useEffect(() => {
    if (!loopSafePreview) {
      setExternalRenderTime(null);
      if (loopPreviewFrameRef.current !== null) {
        cancelAnimationFrame(loopPreviewFrameRef.current);
        loopPreviewFrameRef.current = null;
      }
      return;
    }

    const durationMs = loopSafePreview.durationSeconds * 1000;
    const halfDurationMs = durationMs / 2;

    const tick = (now: number) => {
      const elapsed = Math.min(durationMs, now - loopSafePreview.startedAt);
      const mirrored = elapsed <= halfDurationMs ? elapsed : durationMs - elapsed;
      setExternalRenderTime((mirrored / 1000) * params.speed);

      if (elapsed < durationMs) {
        loopPreviewFrameRef.current = requestAnimationFrame(tick);
      } else {
        loopPreviewFrameRef.current = null;
      }
    };

    loopPreviewFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (loopPreviewFrameRef.current !== null) {
        cancelAnimationFrame(loopPreviewFrameRef.current);
        loopPreviewFrameRef.current = null;
      }
    };
  }, [loopSafePreview, params.speed]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimeoutRef.current !== null) window.clearTimeout(recordingTimeoutRef.current);
      if (loopPreviewFrameRef.current !== null) cancelAnimationFrame(loopPreviewFrameRef.current);
      if (exportProgressFrameRef.current !== null) cancelAnimationFrame(exportProgressFrameRef.current);
      if (exportResetTimeoutRef.current !== null) window.clearTimeout(exportResetTimeoutRef.current);
      if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
    };
  }, []);

  const scheduleReset = useCallback(() => {
    if (exportResetTimeoutRef.current !== null) window.clearTimeout(exportResetTimeoutRef.current);
    exportResetTimeoutRef.current = window.setTimeout(() => {
      setExportStatus(IDLE_STATUS);
      exportResetTimeoutRef.current = null;
    }, 2200);
  }, []);

  const waitForPaint = useCallback(async (frames = 2) => {
    for (let i = 0; i < frames; i += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }, []);

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportImage = useCallback(async (scale = 1) => {
    const canvas = rendererRef.current?.getCanvas();
    if (!canvas) {
      setExportStatus({ phase: "error", label: "Export failed", detail: "No active canvas found.", progress: 0 });
      scheduleReset();
      onToast("Export failed", "No active canvas found to export.");
      return;
    }

    try {
      setExportStatus({
        phase: "preparing",
        label: scale > 1 ? `Preparing ${scale}x PNG` : "Preparing PNG",
        detail: "Configuring canvas for capture.",
        progress: 15,
      });

      if (scale > 1) {
        setRenderScale(scale);
        await waitForPaint(3);
      }

      setExportStatus({
        phase: "capturing",
        label: scale > 1 ? `Capturing ${scale}x PNG` : "Capturing PNG",
        detail: "Rendering the current frame.",
        progress: 62,
        frameCount: 1,
        frameTotal: 1,
      });

      const exportCanvas = rendererRef.current?.getCanvas() ?? canvas;
      const blob = await new Promise<Blob | null>((resolve) => exportCanvas.toBlob(resolve));

      if (!blob) {
        setExportStatus({ phase: "error", label: "Export failed", detail: "The browser could not encode the image.", progress: 0 });
        scheduleReset();
        onToast("Export failed", "Image export failed.");
        return;
      }

      downloadBlob(blob, `color-motion-${animationType}-${scale}x-${Date.now()}.png`);
      setExportStatus({
        phase: "complete",
        label: scale > 1 ? `${scale}x PNG ready` : "PNG ready",
        detail: "Download started.",
        progress: 100,
      });
      scheduleReset();
      onToast(scale > 1 ? `${scale}x PNG exported` : "PNG exported");
    } finally {
      if (scale > 1) setRenderScale(1);
    }
  }, [animationType, rendererRef, scheduleReset, waitForPaint, downloadBlob, onToast]);

  const handleRecordVideo = useCallback(async (durationSeconds: number, loopSafe = false) => {
    if (isRecording) {
      onToast("Recording in progress");
      return;
    }

    if (loopSafe && !(rendererRef.current?.supportsLoopSafeExport ?? supportsLoopSafeExport(animationType))) {
      setExportStatus({ phase: "error", label: "Loop-safe export unavailable", detail: "Choose a deterministic renderer.", progress: 0 });
      scheduleReset();
      onToast("Loop-safe export unavailable", "Use liquid, waves, voronoi, or blobs for seamless loop export.");
      return;
    }

    const canvas = rendererRef.current?.getCanvas();
    if (!canvas || typeof canvas.captureStream !== "function" || typeof MediaRecorder === "undefined") {
      setExportStatus({ phase: "error", label: "Recording unavailable", detail: "This browser cannot record canvas output.", progress: 0 });
      scheduleReset();
      onToast("Recording unavailable", "This browser cannot record canvas output.");
      return;
    }

    const preferredTypes = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    const mimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";

    try {
      setIsRecording(true);
      setExportStatus({
        phase: "preparing",
        label: loopSafe ? "Preparing loop-safe WebM" : "Preparing WebM",
        detail: "Setting up recorder.",
        progress: 8,
      });

      if (loopSafe) setLoopSafePreview({ durationSeconds, startedAt: performance.now() });
      await waitForPaint(2);

      const stream = canvas.captureStream(60);
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      recorder.onerror = () => {
        setIsRecording(false);
        setLoopSafePreview(null);
        stream.getTracks().forEach((t) => t.stop());
        setExportStatus({ phase: "error", label: "Recording failed", detail: "The browser stopped the video export.", progress: 0 });
        scheduleReset();
        onToast("Recording failed", "The browser stopped the video export.");
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current = null;
        if (recordingTimeoutRef.current !== null) {
          window.clearTimeout(recordingTimeoutRef.current);
          recordingTimeoutRef.current = null;
        }

        if (chunks.length > 0) {
          setExportStatus({ phase: "encoding", label: "Encoding WebM", detail: "Finalizing video file.", progress: 96 });
          downloadBlob(
            new Blob(chunks, { type: mimeType || "video/webm" }),
            `color-motion-${animationType}-${loopSafe ? "loop-" : ""}${durationSeconds}s-${Date.now()}.webm`,
          );
          setExportStatus({
            phase: "complete",
            label: "WebM ready",
            detail: loopSafe ? "Loop-safe clip downloaded." : `${durationSeconds}s clip downloaded.`,
            progress: 100,
          });
          scheduleReset();
          onToast("WebM exported", loopSafe ? "Loop-safe clip ready" : `${durationSeconds}s clip ready`);
        } else {
          setExportStatus({ phase: "error", label: "Recording failed", detail: "No video frames were captured.", progress: 0 });
          scheduleReset();
          onToast("Recording failed", "No video frames were captured.");
        }

        setLoopSafePreview(null);
        setIsRecording(false);
      };

      recorder.start();
      const startedAt = performance.now();

      const updateProgress = (now: number) => {
        const elapsed = Math.min(durationSeconds * 1000, now - startedAt);
        const progress = 18 + Math.round((elapsed / (durationSeconds * 1000)) * 72);
        const frameCount = Math.min(Math.round((elapsed / 1000) * 60), durationSeconds * 60);
        setExportStatus({
          phase: "recording",
          label: loopSafe ? "Recording loop-safe WebM" : "Recording WebM",
          detail: `${Math.ceil((durationSeconds * 1000 - elapsed) / 1000)}s remaining`,
          progress,
          frameCount,
          frameTotal: durationSeconds * 60,
        });
        if (elapsed < durationSeconds * 1000) {
          exportProgressFrameRef.current = requestAnimationFrame(updateProgress);
        } else {
          exportProgressFrameRef.current = null;
        }
      };

      if (exportProgressFrameRef.current !== null) cancelAnimationFrame(exportProgressFrameRef.current);
      exportProgressFrameRef.current = requestAnimationFrame(updateProgress);

      recordingTimeoutRef.current = window.setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, durationSeconds * 1000);

      onToast("Recording started", loopSafe ? "Loop-safe WebM clip" : `${durationSeconds}s WebM clip`);
    } catch {
      setIsRecording(false);
      setLoopSafePreview(null);
      setExportStatus({ phase: "error", label: "Recording failed", detail: "Unable to start video export.", progress: 0 });
      scheduleReset();
      onToast("Recording failed", "Unable to start video export.");
    }
  }, [isRecording, animationType, rendererRef, scheduleReset, waitForPaint, downloadBlob, onToast]);

  const canLoopSafeExport =
    rendererRef.current?.supportsLoopSafeExport ?? supportsLoopSafeExport(animationType);

  return {
    renderScale,
    isRecording,
    exportStatus,
    externalRenderTime,
    canLoopSafeExport,
    handleExportImage,
    handleRecordVideo,
  };
}
