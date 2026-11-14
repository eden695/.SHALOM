import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Film,
  Upload,
  Music,
  ArrowUp,
  ArrowDown,
  Trash2,
  Download,
  Share2,
  Save,
  Loader2,
  CheckCircle2,
  Play,
  Square,
  Image as ImageIcon,
  Video as VideoIcon,
  Plus,
  Type,
  Shapes,
  Mic,
  Copy,
  Archive,
  Palette,
} from 'lucide-react';
import { useShalomDB } from '../../hooks/useShalomDB';
import { dbService, STORES } from '../../services/db';
import { useLanguage } from '../../contexts/LanguageContext';
import { RecordedParole, VaultDocument } from '../../types';
import { SocialShareModal } from '../common/SocialShareModal';
import { SharePayload } from '../../services/socialShare';

type AspectMode = '9:16' | '16:9' | '1:1' | '4:5';
type CustomShapeKind = 'none' | 'rect' | 'circle' | 'star' | 'cross' | 'heart';

interface VideoScene {
  id: string;
  kind: 'custom' | 'image' | 'video';
  name: string;
  durationSec: number;
  // Media fields
  objectUrl?: string;
  imageEl?: HTMLImageElement;
  videoEl?: HTMLVideoElement;
  trimStartSec: number;
  trimEndSec: number;
  fitMode: 'contain' | 'cover';
  kenBurns: boolean;
  volume: number;
  playbackRate: number;
  // Custom blank/color/shape/text slide fields
  bgType: 'solid' | 'gradient';
  bgColor: string;
  bgColor2: string;
  shape: CustomShapeKind;
  shapeColor: string;
  text: string;
  textColor: string;
  fontSize: number;
  fontFamily: string;
}

interface OverlayLayer {
  id: string;
  kind: 'text' | 'shape' | 'image';
  label: string;
  startSec: number;
  endSec: number;
  xPct: number;
  yPct: number;
  size: number;
  color: string;
  bgBadge: boolean;
  opacity: number;
  text?: string;
  fontFamily?: string;
  shape?: Exclude<CustomShapeKind, 'none'>;
  imageEl?: HTMLImageElement;
  objectUrl?: string;
}

interface VideoAudioTrack {
  id: string;
  name: string;
  objectUrl: string;
  startSec: number;
  volume: number;
}

function getDims(mode: AspectMode): { w: number; h: number } {
  switch (mode) {
    case '16:9':
      return { w: 1280, h: 720 };
    case '1:1':
      return { w: 960, h: 960 };
    case '4:5':
      return { w: 864, h: 1080 };
    case '9:16':
    default:
      return { w: 720, h: 1280 };
  }
}

function drawVectorShape(
  ctx: CanvasRenderingContext2D,
  shape: Exclude<CustomShapeKind, 'none'>,
  cx: number,
  cy: number,
  size: number,
  color: string,
  opacity = 1
) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  const r = size / 2;

  if (shape === 'rect') {
    ctx.fillRect(cx - r, cy - r, size, size);
  } else if (shape === 'circle') {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === 'cross') {
    const thick = size * 0.24;
    ctx.fillRect(cx - thick / 2, cy - r, thick, size);
    ctx.fillRect(cx - r * 0.72, cy - r * 0.35, r * 1.44, thick);
  } else if (shape === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.44;
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      const x = cx + Math.cos(angle) * rad;
      const y = cy + Math.sin(angle) * rad;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  } else if (shape === 'heart') {
    ctx.beginPath();
    const topCurve = r * 0.3;
    ctx.moveTo(cx, cy + r * 0.85);
    ctx.bezierCurveTo(cx - r * 1.2, cy + r * 0.1, cx - r * 0.9, cy - r * 0.9, cx, cy - topCurve);
    ctx.bezierCurveTo(cx + r * 0.9, cy - r * 0.9, cx + r * 1.2, cy + r * 0.1, cx, cy + r * 0.85);
    ctx.fill();
  }
  ctx.restore();
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(' ');
    let current = '';
    for (const w of words) {
      const test = current ? `${current} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = w;
      } else {
        current = test;
      }
    }
    lines.push(current);
  }
  return lines;
}

export const VideoStudioModule: React.FC = () => {
  const { lang } = useLanguage();
  const { userProfile, recordings, reloadData } = useShalomDB();
  const isEn = lang === 'en';

  const [aspectMode, setAspectMode] = useState<AspectMode>('9:16');
  const [canvasBgColor, setCanvasBgColor] = useState('#090d1a');
  const [projectTitle, setProjectTitle] = useState(
    isEn ? 'Untitled Video Project' : 'Nouvelle vidéo libre'
  );

  // Free scenes & overlays — starts 100% blank!
  const [scenes, setScenes] = useState<VideoScene[]>([]);
  const [overlays, setOverlays] = useState<OverlayLayer[]>([]);
  const [audioTracks, setAudioTracks] = useState<VideoAudioTrack[]>([]);

  // Voiceover mic capture inside Video Studio
  const [isRecordingVoiceover, setIsRecordingVoiceover] = useState(false);
  const [voSeconds, setVoSeconds] = useState(0);
  const voRecorderRef = useRef<MediaRecorder | null>(null);
  const voStreamRef = useRef<MediaStream | null>(null);
  const voChunksRef = useRef<Blob[]>([]);
  const voTimerRef = useRef<number | null>(null);

  // Preview & Export
  const [previewTimeSec, setPreviewTimeSec] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const previewRafRef = useRef<number | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedVideoUrl, setExportedVideoUrl] = useState<string | null>(null);
  const [exportedVideoBlob, setExportedVideoBlob] = useState<Blob | null>(null);
  const [exportedMimeType, setExportedMimeType] = useState('video/webm');
  const [notice, setNotice] = useState<string | null>(null);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cancelExportRef = useRef(false);

  const dims = getDims(aspectMode);

  const sceneTimingMap = useMemo(() => {
    let cursor = 0;
    return scenes.map((s) => {
      const dur =
        s.kind === 'video'
          ? Math.max(0.5, (s.trimEndSec - s.trimStartSec) / s.playbackRate)
          : Math.max(0.5, s.durationSec);
      const entry = { scene: s, start: cursor, end: cursor + dur, dur };
      cursor += dur;
      return entry;
    });
  }, [scenes]);

  const totalDurationSec = useMemo(
    () => (sceneTimingMap.length > 0 ? sceneTimingMap[sceneTimingMap.length - 1].end : 0),
    [sceneTimingMap]
  );

  useEffect(() => {
    return () => {
      if (voTimerRef.current) clearInterval(voTimerRef.current);
      if (previewRafRef.current) cancelAnimationFrame(previewRafRef.current);
      voStreamRef.current?.getTracks().forEach((t) => t.stop());
      scenes.forEach((s) => s.objectUrl && URL.revokeObjectURL(s.objectUrl));
      overlays.forEach((o) => o.objectUrl && URL.revokeObjectURL(o.objectUrl));
      audioTracks.forEach((a) => URL.revokeObjectURL(a.objectUrl));
      if (exportedVideoUrl) URL.revokeObjectURL(exportedVideoUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drawSceneFrame = (
    ctx: CanvasRenderingContext2D,
    scene: VideoScene,
    localElapsed: number,
    segDur: number,
    w: number,
    h: number
  ) => {
    ctx.fillStyle = canvasBgColor;
    ctx.fillRect(0, 0, w, h);

    if (scene.kind === 'custom') {
      if (scene.bgType === 'gradient') {
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, scene.bgColor);
        g.addColorStop(1, scene.bgColor2);
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = scene.bgColor;
      }
      ctx.fillRect(0, 0, w, h);

      if (scene.shape !== 'none') {
        drawVectorShape(ctx, scene.shape, w / 2, h * 0.34, Math.min(w, h) * 0.25, scene.shapeColor, 0.9);
      }

      if (scene.text.trim()) {
        ctx.save();
        ctx.fillStyle = scene.textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `700 ${scene.fontSize}px ${scene.fontFamily}`;
        const lines = wrapLines(ctx, scene.text, w - 100);
        const lineHeight = scene.fontSize * 1.25;
        const baseY = scene.shape === 'none' ? h * 0.5 : h * 0.65;
        const startY = baseY - ((lines.length - 1) * lineHeight) / 2;
        lines.forEach((line, idx) => {
          ctx.fillText(line, w / 2, startY + idx * lineHeight);
        });
        ctx.restore();
      }
      return;
    }

    const mediaEl = scene.kind === 'image' ? scene.imageEl : scene.videoEl;
    if (!mediaEl) return;
    const srcW = scene.kind === 'image' ? (mediaEl as HTMLImageElement).width : (mediaEl as HTMLVideoElement).videoWidth || w;
    const srcH = scene.kind === 'image' ? (mediaEl as HTMLImageElement).height : (mediaEl as HTMLVideoElement).videoHeight || h;
    const sRatio = srcW / Math.max(1, srcH);
    const cRatio = w / h;

    let dw = w;
    let dh = h;
    if (scene.fitMode === 'contain') {
      if (sRatio > cRatio) {
        dw = w;
        dh = w / sRatio;
      } else {
        dh = h;
        dw = h * sRatio;
      }
    } else {
      if (sRatio > cRatio) {
        dh = h;
        dw = h * sRatio;
      } else {
        dw = w;
        dh = w / sRatio;
      }
    }

    const zoom = scene.kenBurns ? 1 + (localElapsed / Math.max(0.5, segDur)) * 0.08 : 1;
    dw *= zoom;
    dh *= zoom;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;
    ctx.drawImage(mediaEl, dx, dy, dw, dh);
  };

  const drawOverlaysAtTime = (ctx: CanvasRenderingContext2D, timeSec: number, w: number, h: number) => {
    for (const ov of overlays) {
      if (timeSec < ov.startSec || timeSec > ov.endSec) continue;
      const cx = (ov.xPct / 100) * w;
      const cy = (ov.yPct / 100) * h;

      ctx.save();
      ctx.globalAlpha = ov.opacity;

      if (ov.kind === 'text' && ov.text) {
        ctx.font = `700 ${ov.size}px ${ov.fontFamily || '"Outfit", sans-serif'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const lines = wrapLines(ctx, ov.text, w - 80);
        const lh = ov.size * 1.25;
        if (ov.bgBadge) {
          const maxLineW = Math.max(...lines.map((l) => ctx.measureText(l).width), 40);
          const padX = 24;
          const padY = 14;
          const boxW = Math.min(w - 40, maxLineW + padX * 2);
          const boxH = lines.length * lh + padY * 2;
          ctx.fillStyle = 'rgba(8, 16, 36, 0.72)';
          ctx.beginPath();
          ctx.roundRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH, 16);
          ctx.fill();
        }
        ctx.fillStyle = ov.color;
        const startY = cy - ((lines.length - 1) * lh) / 2;
        lines.forEach((line, i) => ctx.fillText(line, cx, startY + i * lh));
      } else if (ov.kind === 'shape' && ov.shape) {
        drawVectorShape(ctx, ov.shape, cx, cy, ov.size, ov.color, ov.opacity);
      } else if (ov.kind === 'image' && ov.imageEl) {
        const ratio = ov.imageEl.width / Math.max(1, ov.imageEl.height);
        const drawW = ov.size;
        const drawH = ov.size / ratio;
        ctx.drawImage(ov.imageEl, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
      }

      ctx.restore();
    }
  };

  // Render live canvas preview frame whenever previewTimeSec, scenes, overlays, or aspect changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = dims.w;
    canvas.height = dims.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = canvasBgColor;
    ctx.fillRect(0, 0, dims.w, dims.h);

    if (sceneTimingMap.length === 0) {
      drawOverlaysAtTime(ctx, previewTimeSec, dims.w, dims.h);
      return;
    }

    const match =
      sceneTimingMap.find((m) => previewTimeSec >= m.start && previewTimeSec <= m.end) ||
      sceneTimingMap[sceneTimingMap.length - 1];

    if (match) {
      const localElapsed = Math.max(0, previewTimeSec - match.start);
      if (match.scene.kind === 'video' && match.scene.videoEl && !isPlayingPreview) {
        const targetT = match.scene.trimStartSec + localElapsed * match.scene.playbackRate;
        if (Math.abs(match.scene.videoEl.currentTime - targetT) > 0.15) {
          match.scene.videoEl.currentTime = Math.min(match.scene.trimEndSec, targetT);
        }
      }
      drawSceneFrame(ctx, match.scene, localElapsed, match.dur, dims.w, dims.h);
    }

    drawOverlaysAtTime(ctx, previewTimeSec, dims.w, dims.h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewTimeSec, scenes, overlays, aspectMode, canvasBgColor, isPlayingPreview]);

  const handleTogglePreviewPlay = () => {
    if (isPlayingPreview) {
      if (previewRafRef.current) cancelAnimationFrame(previewRafRef.current);
      setIsPlayingPreview(false);
      return;
    }
    if (totalDurationSec <= 0) return;
    const startOffset = previewTimeSec >= totalDurationSec - 0.1 ? 0 : previewTimeSec;
    const wallStart = performance.now();
    setIsPlayingPreview(true);

    const step = () => {
      const t = startOffset + (performance.now() - wallStart) / 1000;
      if (t >= totalDurationSec) {
        setPreviewTimeSec(0);
        setIsPlayingPreview(false);
        return;
      }
      setPreviewTimeSec(t);
      previewRafRef.current = requestAnimationFrame(step);
    };
    previewRafRef.current = requestAnimationFrame(step);
  };

  const addBlankCustomScene = () => {
    setScenes((prev) => [
      ...prev,
      {
        id: `scene_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        kind: 'custom',
        name: `${isEn ? 'Custom Scene' : 'Scène libre'} #${prev.length + 1}`,
        durationSec: 4,
        trimStartSec: 0,
        trimEndSec: 4,
        fitMode: 'cover',
        kenBurns: false,
        volume: 1,
        playbackRate: 1,
        bgType: 'gradient',
        bgColor: '#0f172a',
        bgColor2: '#1e3a8a',
        shape: 'none',
        shapeColor: '#fbbf24',
        text: isEn ? 'Your custom text here' : 'Votre texte ici',
        textColor: '#ffffff',
        fontSize: 42,
        fontFamily: '"Outfit", sans-serif',
      },
    ]);
  };

  const addMediaBlob = async (blob: Blob, name: string, kindHint?: 'image' | 'video') => {
    const kind: 'image' | 'video' =
      kindHint || (blob.type.startsWith('video/') ? 'video' : 'image');
    const url = URL.createObjectURL(blob);

    if (kind === 'image') {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = url;
      });
      setScenes((prev) => [
        ...prev,
        {
          id: `scene_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          kind: 'image',
          name,
          objectUrl: url,
          imageEl: img,
          durationSec: 4,
          trimStartSec: 0,
          trimEndSec: 4,
          fitMode: 'contain',
          kenBurns: true,
          volume: 1,
          playbackRate: 1,
          bgType: 'solid',
          bgColor: '#000000',
          bgColor2: '#000000',
          shape: 'none',
          shapeColor: '#ffffff',
          text: '',
          textColor: '#ffffff',
          fontSize: 36,
          fontFamily: '"Outfit", sans-serif',
        },
      ]);
    } else {
      const video = await new Promise<HTMLVideoElement>((resolve, reject) => {
        const el = document.createElement('video');
        el.playsInline = true;
        el.muted = true;
        el.preload = 'auto';
        el.onloadedmetadata = () => resolve(el);
        el.onerror = reject;
        el.src = url;
      });
      const dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 5;
      setScenes((prev) => [
        ...prev,
        {
          id: `scene_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          kind: 'video',
          name,
          objectUrl: url,
          videoEl: video,
          durationSec: Number(dur.toFixed(1)),
          trimStartSec: 0,
          trimEndSec: Number(dur.toFixed(1)),
          fitMode: 'contain',
          kenBurns: false,
          volume: 1,
          playbackRate: 1,
          bgType: 'solid',
          bgColor: '#000000',
          bgColor2: '#000000',
          shape: 'none',
          shapeColor: '#ffffff',
          text: '',
          textColor: '#ffffff',
          fontSize: 36,
          fontFamily: '"Outfit", sans-serif',
        },
      ]);
    }
  };

  const handleImportMediaFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      try {
        await addMediaBlob(files[i], files[i].name);
      } catch {
        setNotice(isEn ? `Unable to load ${files[i].name}` : `Impossible de charger ${files[i].name}`);
      }
    }
    e.target.value = '';
  };

  const handleImportFromParole = async (recId: string) => {
    const rec = recordings.find((r) => r.id === recId);
    if (!rec?.blobKey) return;
    const blob = await dbService.getMediaBlob(rec.blobKey);
    if (!blob) return;
    await addMediaBlob(blob, rec.title, rec.mediaType === 'video' ? 'video' : undefined);
  };

  const addTextOverlay = () => {
    const dur = Math.max(4, totalDurationSec || 4);
    setOverlays((prev) => [
      ...prev,
      {
        id: `ov_${Date.now()}`,
        kind: 'text',
        label: `${isEn ? 'Text' : 'Texte'} #${prev.length + 1}`,
        startSec: 0,
        endSec: Number(dur.toFixed(1)),
        xPct: 50,
        yPct: 82,
        size: 34,
        color: '#ffffff',
        bgBadge: true,
        opacity: 1,
        text: isEn ? 'Your overlay text' : 'Votre texte superposé',
        fontFamily: '"Outfit", sans-serif',
      },
    ]);
  };

  const addShapeOverlay = () => {
    const dur = Math.max(4, totalDurationSec || 4);
    setOverlays((prev) => [
      ...prev,
      {
        id: `ov_${Date.now()}`,
        kind: 'shape',
        label: `${isEn ? 'Shape' : 'Forme'} #${prev.length + 1}`,
        startSec: 0,
        endSec: Number(dur.toFixed(1)),
        xPct: 50,
        yPct: 20,
        size: 90,
        color: '#fbbf24',
        bgBadge: false,
        opacity: 0.9,
        shape: 'star',
      },
    ]);
  };

  const handleUploadImageOverlay = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dur = Math.max(4, totalDurationSec || 4);
      setOverlays((prev) => [
        ...prev,
        {
          id: `ov_${Date.now()}`,
          kind: 'image',
          label: file.name,
          startSec: 0,
          endSec: Number(dur.toFixed(1)),
          xPct: 85,
          yPct: 12,
          size: 110,
          color: '#ffffff',
          bgBadge: false,
          opacity: 1,
          imageEl: img,
          objectUrl: url,
        },
      ]);
    };
    img.src = url;
    e.target.value = '';
  };

  const handleImportAudioTrack = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setAudioTracks((prev) => [
        ...prev,
        {
          id: `vaud_${Date.now()}_${i}`,
          name: f.name,
          objectUrl: URL.createObjectURL(f),
          startSec: 0,
          volume: 0.55,
        },
      ]);
    }
    e.target.value = '';
  };

  const handleToggleVoiceoverRecord = async () => {
    if (isRecordingVoiceover) {
      voRecorderRef.current?.stop();
      setIsRecordingVoiceover(false);
      if (voTimerRef.current) clearInterval(voTimerRef.current);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voStreamRef.current = stream;
      voChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      voRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) voChunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(voChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioTracks((prev) => [
          ...prev,
          {
            id: `vaud_vo_${Date.now()}`,
            name: `${isEn ? 'Voiceover' : 'Voix-off'} #${prev.length + 1}`,
            objectUrl: url,
            startSec: Number(previewTimeSec.toFixed(1)),
            volume: 1.0,
          },
        ]);
      };

      recorder.start(250);
      setIsRecordingVoiceover(true);
      setVoSeconds(0);
      voTimerRef.current = window.setInterval(() => setVoSeconds((s) => s + 1), 1000);
    } catch {
      setNotice(
        isEn ? 'Microphone unavailable.' : 'Accès au microphone refusé ou indisponible.'
      );
    }
  };

  const moveScene = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= scenes.length) return;
    setScenes((prev) => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const updateScene = (id: string, patch: Partial<VideoScene>) => {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const duplicateScene = (scene: VideoScene) => {
    setScenes((prev) => [
      ...prev,
      {
        ...scene,
        id: `scene_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        name: `${scene.name} (copie)`,
        objectUrl: undefined, // avoid double revoke on unmount
      },
    ]);
  };

  const removeScene = (id: string) => {
    setScenes((prev) => prev.filter((s) => s.id !== id));
  };

  const updateOverlay = (id: string, patch: Partial<OverlayLayer>) => {
    setOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  const removeOverlay = (id: string) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
  };

  const updateAudioTrack = (id: string, patch: Partial<VideoAudioTrack>) => {
    setAudioTracks((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const removeAudioTrack = (id: string) => {
    setAudioTracks((prev) => prev.filter((a) => a.id !== id));
  };

  const handleExportVideo = async () => {
    if (scenes.length === 0) {
      setNotice(
        isEn
          ? 'Add at least one scene (blank custom scene, photo, or video) first.'
          : 'Ajoutez d’abord au moins une scène (scène libre, photo ou vidéo).'
      );
      return;
    }

    if (isPlayingPreview) handleTogglePreviewPlay();

    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = dims.w;
    canvas.height = dims.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    cancelExportRef.current = false;
    setIsExporting(true);
    setExportProgress(0);
    setNotice(null);

    try {
      const videoStream = canvas.captureStream(30);
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const destNode = audioCtx.createMediaStreamDestination();

      // Prepare scheduled external audio tracks (decoded for sample-accurate start offsets)
      const scheduledAudioNodes: AudioBufferSourceNode[] = [];
      for (const track of audioTracks) {
        try {
          const resp = await fetch(track.objectUrl);
          const buf = await audioCtx.decodeAudioData(await resp.arrayBuffer());
          const src = audioCtx.createBufferSource();
          src.buffer = buf;
          const gain = audioCtx.createGain();
          gain.gain.value = track.volume;
          src.connect(gain);
          gain.connect(destNode);
          src.start(audioCtx.currentTime + track.startSec);
          scheduledAudioNodes.push(src);
        } catch {
          // fallback if browser can't decode blob format via decodeAudioData
        }
      }

      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...destNode.stream.getAudioTracks(),
      ]);

      const preferredMime =
        ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) =>
          MediaRecorder.isTypeSupported(m)
        ) || 'video/webm';

      const recorder = new MediaRecorder(combinedStream, {
        mimeType: preferredMime,
        videoBitsPerSecond: 2_800_000,
      });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      const recordingDone = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: preferredMime }));
      });

      recorder.start(250);

      const waitFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
      let elapsedGlobal = 0;

      for (const item of sceneTimingMap) {
        if (cancelExportRef.current) break;
        const { scene, dur } = item;

        let vidSourceNode: MediaElementAudioSourceNode | null = null;
        let vidGainNode: GainNode | null = null;

        if (scene.kind === 'video' && scene.videoEl) {
          const vid = scene.videoEl;
          vid.currentTime = scene.trimStartSec;
          vid.playbackRate = scene.playbackRate;
          vid.muted = false;
          try {
            vidSourceNode = audioCtx.createMediaElementSource(vid);
            vidGainNode = audioCtx.createGain();
            vidGainNode.gain.value = scene.volume;
            vidSourceNode.connect(vidGainNode);
            vidGainNode.connect(destNode);
          } catch {
            vid.muted = true;
          }
          await vid.play().catch(() => {});
        }

        const segStart = performance.now();
        while (!cancelExportRef.current) {
          const localElapsed = (performance.now() - segStart) / 1000;
          if (localElapsed >= dur) break;
          const globalTime = elapsedGlobal + localElapsed;
          drawSceneFrame(ctx, scene, localElapsed, dur, dims.w, dims.h);
          drawOverlaysAtTime(ctx, globalTime, dims.w, dims.h);
          setExportProgress(Math.min(99, Math.round((globalTime / Math.max(0.5, totalDurationSec)) * 100)));
          await waitFrame();
        }

        if (scene.kind === 'video' && scene.videoEl) {
          scene.videoEl.pause();
          vidSourceNode?.disconnect();
          vidGainNode?.disconnect();
        }

        elapsedGlobal += dur;
      }

      scheduledAudioNodes.forEach((n) => {
        try {
          n.stop();
        } catch {
          // noop
        }
      });

      recorder.stop();
      const finalBlob = await recordingDone;
      await audioCtx.close().catch(() => {});

      if (!cancelExportRef.current && finalBlob.size > 0) {
        if (exportedVideoUrl) URL.revokeObjectURL(exportedVideoUrl);
        setExportedVideoUrl(URL.createObjectURL(finalBlob));
        setExportedVideoBlob(finalBlob);
        setExportedMimeType(preferredMime);
        setExportProgress(100);
        setNotice(
          isEn
            ? 'Video rendered cleanly! Save to phone, library, or share.'
            : 'Vidéo exportée avec succès ! Enregistrez-la ou partagez-la.'
        );
      }
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : 'Erreur export vidéo');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveToParole = async () => {
    if (!exportedVideoBlob) return;
    const blobKey = `parole_video_studio_${Date.now()}`;
    await dbService.saveMediaBlob(blobKey, exportedVideoBlob, exportedMimeType);
    const rec: RecordedParole = {
      id: `rec_vid_${Date.now()}`,
      title: projectTitle.trim() || 'Vidéo Studio',
      type: 'exhortation',
      speaker: userProfile?.fullName || 'Moi',
      activityGenre: 'autre',
      date: new Date().toISOString().split('T')[0],
      durationSeconds: Math.max(1, Math.round(totalDurationSec)),
      mediaType: 'video',
      mimeType: exportedMimeType,
      blobKey,
      fileSizeFormatted: `${(exportedVideoBlob.size / (1024 * 1024)).toFixed(2)} Mo`,
      createdAt: new Date().toISOString(),
    };
    await dbService.put(STORES.RECORDINGS, rec);
    setNotice(isEn ? 'Saved to Parole Divine!' : 'Vidéo enregistrée dans Parole Divine !');
    reloadData();
  };

  const handleSaveToVault = async () => {
    if (!exportedVideoBlob) return;
    const safeSlug = projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'shalom_video';
    const blobKey = `vault_video_${Date.now()}`;
    await dbService.saveMediaBlob(blobKey, exportedVideoBlob, exportedMimeType);
    const doc: VaultDocument = {
      id: `vault_${Date.now()}`,
      title: projectTitle.trim() || 'Création Vidéo',
      category: 'autre',
      author: userProfile?.fullName || 'Moi',
      description: 'Création vidéo réalisée dans SHALOM Studio Vidéo',
      fileName: `${safeSlug}.webm`,
      mimeType: exportedMimeType,
      sizeBytes: exportedVideoBlob.size,
      blobKey,
      createdAt: new Date().toISOString(),
    };
    await dbService.put(STORES.VAULT_DOCUMENTS, doc);
    setNotice(isEn ? 'Saved to Spiritual Vault!' : 'Vidéo ajoutée dans Mon Coffre Spirituel !');
    reloadData();
  };

  const handleDownloadVideo = () => {
    if (!exportedVideoUrl) return;
    const link = document.createElement('a');
    link.href = exportedVideoUrl;
    link.download = `${projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'shalom_video'}.webm`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShareVideo = () => {
    if (!exportedVideoBlob) return;
    const file = new File(
      [exportedVideoBlob],
      `${projectTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'shalom_video'}.webm`,
      { type: exportedMimeType }
    );
    setSharePayload({
      title: projectTitle,
      text: `🎬 ${projectTitle}\n\nPartagé depuis SHALOM Studio Vidéo`,
      file,
    });
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </span>
          <button type="button" onClick={() => setNotice(null)} className="underline ml-2">
            OK
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Controls */}
        <div className="lg:col-span-7 space-y-5 text-xs">
          {/* Blank Canvas Project Settings */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">
                  {isEn ? 'Video Project Title' : 'Titre du projet vidéo'}
                </label>
                <input
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  {isEn ? 'Canvas Background' : 'Couleur fond canevas'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={canvasBgColor}
                    onChange={(e) => setCanvasBgColor(e.target.value)}
                    className="w-9 h-9 rounded-lg cursor-pointer border border-slate-200 dark:border-slate-700"
                  />
                  <span className="font-mono text-[11px] uppercase">{canvasBgColor}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">
                {isEn ? 'Aspect Ratio' : 'Format du projet'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  { id: '9:16', label: '9:16 Vertical' },
                  { id: '16:9', label: '16:9 Paysage' },
                  { id: '1:1', label: '1:1 Carré' },
                  { id: '4:5', label: '4:5 Portrait' },
                ] as const).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setAspectMode(m.id)}
                    className={`py-2 px-2 rounded-xl font-bold border transition ${
                      aspectMode === m.id
                        ? 'bg-[#0b1f42] text-white border-[#0b1f42] dark:bg-blue-700'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Creation Actions */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={addBlankCustomScene}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold flex items-center gap-1.5"
              >
                <Palette className="w-4 h-4" />
                <span>{isEn ? '+ Blank Custom Scene' : '+ Scène vierge (Couleur / Forme / Texte)'}</span>
              </button>

              <label className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>{isEn ? '+ Videos / Photos' : '+ Importer Vidéos / Photos'}</span>
                <input
                  type="file"
                  accept="video/*,image/*"
                  multiple
                  onChange={handleImportMediaFiles}
                  className="hidden"
                />
              </label>

              {recordings.filter((r) => r.mediaType === 'video').length > 0 && (
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) handleImportFromParole(e.target.value);
                    e.target.value = '';
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold"
                >
                  <option value="">
                    {isEn ? '+ From Parole Divine' : '+ Depuis Parole Divine'}
                  </option>
                  {recordings
                    .filter((r) => r.mediaType === 'video')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                </select>
              )}
            </div>
          </div>

          {/* Overlays & Stickers Manager */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isEn ? `Timed Overlays (${overlays.length})` : `Calques superposés libres (${overlays.length})`}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={addTextOverlay}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 font-bold flex items-center gap-1"
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>+ {isEn ? 'Text' : 'Texte'}</span>
                </button>
                <button
                  type="button"
                  onClick={addShapeOverlay}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 font-bold flex items-center gap-1"
                >
                  <Shapes className="w-3.5 h-3.5" />
                  <span>+ {isEn ? 'Shape' : 'Forme'}</span>
                </button>
                <label className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 font-bold flex items-center gap-1 cursor-pointer">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>+ {isEn ? 'Image / Logo' : 'Image / Logo'}</span>
                  <input type="file" accept="image/*" onChange={handleUploadImageOverlay} className="hidden" />
                </label>
              </div>
            </div>

            {overlays.map((ov) => (
              <div
                key={ov.id}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 dark:text-white truncate">{ov.label}</span>
                  <button
                    type="button"
                    onClick={() => removeOverlay(ov.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {ov.kind === 'text' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={ov.text || ''}
                      onChange={(e) => updateOverlay(ov.id, { text: e.target.value })}
                      className="sm:col-span-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                    />
                    <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ov.bgBadge}
                        onChange={(e) => updateOverlay(ov.id, { bgBadge: e.target.checked })}
                        className="accent-blue-700"
                      />
                      <span>{isEn ? 'Backdrop' : 'Fond texte'}</span>
                    </label>
                  </div>
                )}

                {ov.kind === 'shape' && (
                  <select
                    value={ov.shape || 'star'}
                    onChange={(e) =>
                      updateOverlay(ov.id, { shape: e.target.value as OverlayLayer['shape'] })
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-semibold"
                  >
                    <option value="rect">Rectangle / Carré</option>
                    <option value="circle">Cercle</option>
                    <option value="star">Étoile</option>
                    <option value="cross">Croix chrétienne</option>
                    <option value="heart">Cœur</option>
                  </select>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-center">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500">Début (s)</label>
                    <input
                      type="number"
                      step={0.5}
                      min={0}
                      value={ov.startSec}
                      onChange={(e) =>
                        updateOverlay(ov.id, { startSec: Math.max(0, parseFloat(e.target.value) || 0) })
                      }
                      className="w-full px-2 py-1 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500">Fin (s)</label>
                    <input
                      type="number"
                      step={0.5}
                      min={ov.startSec + 0.5}
                      value={ov.endSec}
                      onChange={(e) =>
                        updateOverlay(ov.id, {
                          endSec: Math.max(ov.startSec + 0.5, parseFloat(e.target.value) || 4),
                        })
                      }
                      className="w-full px-2 py-1 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500">X ({ov.xPct}%)</label>
                    <input
                      type="range"
                      min={5}
                      max={95}
                      value={ov.xPct}
                      onChange={(e) => updateOverlay(ov.id, { xPct: parseInt(e.target.value, 10) })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500">Y ({ov.yPct}%)</label>
                    <input
                      type="range"
                      min={5}
                      max={95}
                      value={ov.yPct}
                      onChange={(e) => updateOverlay(ov.id, { yPct: parseInt(e.target.value, 10) })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500">
                      {isEn ? 'Size' : 'Taille'} ({ov.size})
                    </label>
                    <input
                      type="range"
                      min={18}
                      max={280}
                      value={ov.size}
                      onChange={(e) => updateOverlay(ov.id, { size: parseInt(e.target.value, 10) })}
                      className="w-full"
                    />
                  </div>
                  {ov.kind !== 'image' && (
                    <div className="flex items-center gap-2 pt-3">
                      <input
                        type="color"
                        value={ov.color}
                        onChange={(e) => updateOverlay(ov.id, { color: e.target.value })}
                        className="w-7 h-7 rounded cursor-pointer border border-slate-200 dark:border-slate-700"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Multi-Audio Tracks for Video */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isEn ? `Audio Tracks (${audioTracks.length})` : `Pistes audio & Voix-off (${audioTracks.length})`}
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleToggleVoiceoverRecord}
                  className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 ${
                    isRecordingVoiceover
                      ? 'bg-red-600 text-white animate-pulse'
                      : 'bg-blue-700 hover:bg-blue-800 text-white'
                  }`}
                >
                  {isRecordingVoiceover ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>
                        {isEn ? `Stop (${voSeconds}s)` : `Arrêter (${voSeconds}s)`}
                      </span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Record Voiceover' : 'Enregistrer voix-off'}</span>
                    </>
                  )}
                </button>

                <label className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 font-bold flex items-center gap-1.5 cursor-pointer">
                  <Music className="w-3.5 h-3.5" />
                  <span>{isEn ? '+ Audio / Music' : '+ Importer Audio / Musique'}</span>
                  <input type="file" accept="audio/*" multiple onChange={handleImportAudioTrack} className="hidden" />
                </label>
              </div>
            </div>

            {audioTracks.map((tr) => (
              <div
                key={tr.id}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3"
              >
                <span className="font-bold truncate flex-1 min-w-[140px]">{tr.name}</span>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1 text-[11px]">
                    <span>{isEn ? 'Start (s):' : 'Début (s) :'}</span>
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={tr.startSec}
                      onChange={(e) =>
                        updateAudioTrack(tr.id, { startSec: Math.max(0, parseFloat(e.target.value) || 0) })
                      }
                      className="w-16 px-2 py-1 rounded bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 tabular-nums"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-[11px]">
                    <span>Vol {Math.round(tr.volume * 100)}%</span>
                    <input
                      type="range"
                      min={0}
                      max={1.5}
                      step={0.05}
                      value={tr.volume}
                      onChange={(e) =>
                        updateAudioTrack(tr.id, { volume: parseFloat(e.target.value) })
                      }
                      className="w-20"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeAudioTrack(tr.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Live Preview & Render Panel */}
        <div className="lg:col-span-5 space-y-3 lg:sticky lg:top-4">
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center gap-3">
            <canvas
              ref={canvasRef}
              width={dims.w}
              height={dims.h}
              className="rounded-xl bg-black max-h-[380px] w-auto max-w-full"
            />

            <div className="w-full flex items-center gap-2 text-xs text-white px-1">
              <button
                type="button"
                onClick={handleTogglePreviewPlay}
                disabled={totalDurationSec <= 0}
                className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-40 font-bold flex items-center gap-1 shrink-0"
              >
                {isPlayingPreview ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isEn ? 'Preview' : 'Aperçu'}</span>
                  </>
                )}
              </button>
              <input
                type="range"
                min={0}
                max={Math.max(1, totalDurationSec)}
                step={0.1}
                value={Math.min(previewTimeSec, Math.max(1, totalDurationSec))}
                onChange={(e) => {
                  if (isPlayingPreview) handleTogglePreviewPlay();
                  setPreviewTimeSec(parseFloat(e.target.value));
                }}
                className="flex-1 accent-amber-400"
              />
              <span className="tabular-nums text-[11px] shrink-0">
                {previewTimeSec.toFixed(1)}s / {totalDurationSec.toFixed(1)}s
              </span>
            </div>
          </div>

          {!isExporting ? (
            <button
              type="button"
              onClick={handleExportVideo}
              className="w-full py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isEn ? 'Render & Export Video' : 'Assembler & Exporter la Vidéo'}</span>
            </button>
          ) : (
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-blue-800 dark:text-blue-200">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isEn ? 'Rendering video...' : 'Exportation en cours...'}</span>
                </span>
                <span className="tabular-nums">{exportProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-blue-200 dark:bg-blue-900 overflow-hidden">
                <div
                  style={{ width: `${exportProgress}%` }}
                  className="h-full bg-blue-700 transition-all"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  cancelExportRef.current = true;
                }}
                className="text-red-600 font-semibold underline"
              >
                {isEn ? 'Cancel' : 'Annuler'}
              </button>
            </div>
          )}

          {exportedVideoUrl && (
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-3">
              <video
                src={exportedVideoUrl}
                controls
                playsInline
                className="w-full max-h-60 rounded-xl bg-black"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadVideo}
                  className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-bold flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Save to Phone' : 'Téléphone'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveToParole}
                  className="px-3 py-2 rounded-xl bg-blue-700 text-white text-xs font-bold flex items-center gap-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Parole Divine</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveToVault}
                  className="px-3 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold flex items-center gap-1"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Vault' : 'Mon Coffre'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleShareVideo}
                  className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{isEn ? 'Share' : 'Partager'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scenes Timeline List */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Film className="w-4 h-4 text-blue-700 dark:text-blue-400" />
          <span>
            {isEn
              ? `Video Timeline (${scenes.length} scene(s) · ${totalDurationSec.toFixed(1)}s)`
              : `Séquences du montage (${scenes.length} scène(s) · ${totalDurationSec.toFixed(1)}s)`}
          </span>
        </h3>

        <div className="space-y-3">
          {scenes.map((scene, idx) => (
            <div
              key={scene.id}
              className="p-4 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-3 text-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  {scene.kind === 'custom' ? (
                    <Palette className="w-4 h-4 text-amber-600 shrink-0" />
                  ) : scene.kind === 'image' ? (
                    <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <VideoIcon className="w-4 h-4 text-blue-600 shrink-0" />
                  )}
                  <input
                    type="text"
                    value={scene.name}
                    onChange={(e) => updateScene(scene.id, { name: e.target.value })}
                    className="bg-transparent border-b border-transparent focus:border-blue-500 outline-none"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveScene(idx, -1)}
                    disabled={idx === 0}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-40"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveScene(idx, 1)}
                    disabled={idx === scenes.length - 1}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 disabled:opacity-40"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateScene(scene)}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeScene(scene.id)}
                    className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {scene.kind === 'custom' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      {isEn ? 'Background & Colors' : 'Fond & Couleurs'}
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={scene.bgType}
                        onChange={(e) =>
                          updateScene(scene.id, { bgType: e.target.value as 'solid' | 'gradient' })
                        }
                        className="px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                      >
                        <option value="solid">{isEn ? 'Solid' : 'Uni'}</option>
                        <option value="gradient">{isEn ? 'Gradient' : 'Dégradé'}</option>
                      </select>
                      <input
                        type="color"
                        value={scene.bgColor}
                        onChange={(e) => updateScene(scene.id, { bgColor: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer"
                      />
                      {scene.bgType === 'gradient' && (
                        <input
                          type="color"
                          value={scene.bgColor2}
                          onChange={(e) => updateScene(scene.id, { bgColor2: e.target.value })}
                          className="w-8 h-8 rounded cursor-pointer"
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      {isEn ? 'Shape & Color' : 'Forme & Couleur'}
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={scene.shape}
                        onChange={(e) =>
                          updateScene(scene.id, { shape: e.target.value as CustomShapeKind })
                        }
                        className="flex-1 px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                      >
                        <option value="none">{isEn ? 'None' : 'Aucune'}</option>
                        <option value="cross">Croix</option>
                        <option value="circle">Cercle</option>
                        <option value="rect">Carré</option>
                        <option value="star">Étoile</option>
                        <option value="heart">Cœur</option>
                      </select>
                      {scene.shape !== 'none' && (
                        <input
                          type="color"
                          value={scene.shapeColor}
                          onChange={(e) => updateScene(scene.id, { shapeColor: e.target.value })}
                          className="w-8 h-8 rounded cursor-pointer"
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      {isEn ? 'Slide Text' : 'Texte de la scène'}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={scene.text}
                        onChange={(e) => updateScene(scene.id, { text: e.target.value })}
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                      />
                      <input
                        type="color"
                        value={scene.textColor}
                        onChange={(e) => updateScene(scene.id, { textColor: e.target.value })}
                        className="w-8 h-8 rounded cursor-pointer shrink-0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      {isEn ? 'Duration (s) / Font Size' : 'Durée (s) & Taille texte'}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        step={0.5}
                        min={0.5}
                        max={60}
                        value={scene.durationSec}
                        onChange={(e) =>
                          updateScene(scene.id, {
                            durationSec: Math.max(0.5, parseFloat(e.target.value) || 2),
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 tabular-nums"
                      />
                      <input
                        type="number"
                        step={2}
                        min={16}
                        max={120}
                        value={scene.fontSize}
                        onChange={(e) =>
                          updateScene(scene.id, {
                            fontSize: Math.max(16, parseInt(e.target.value, 10) || 40),
                          })
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 tabular-nums"
                      />
                    </div>
                  </div>
                </div>
              )}

              {scene.kind === 'image' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      {isEn ? 'Duration (s)' : 'Durée d’affichage (s)'}
                    </label>
                    <input
                      type="number"
                      step={0.5}
                      min={0.5}
                      max={60}
                      value={scene.durationSec}
                      onChange={(e) =>
                        updateScene(scene.id, {
                          durationSec: Math.max(0.5, parseFloat(e.target.value) || 3),
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      {isEn ? 'Framing' : 'Cadrage'}
                    </label>
                    <select
                      value={scene.fitMode}
                      onChange={(e) =>
                        updateScene(scene.id, { fitMode: e.target.value as 'contain' | 'cover' })
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                    >
                      <option value="contain">{isEn ? 'Fit (entire image)' : 'Adapter (image entière)'}</option>
                      <option value="cover">{isEn ? 'Fill frame' : 'Remplir le cadre'}</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 pt-4 cursor-pointer font-semibold">
                    <input
                      type="checkbox"
                      checked={scene.kenBurns}
                      onChange={(e) => updateScene(scene.id, { kenBurns: e.target.checked })}
                      className="accent-blue-700"
                    />
                    <span>{isEn ? 'Smooth Zoom Animation' : 'Mouvement Zoom doux'}</span>
                  </label>
                </div>
              )}

              {scene.kind === 'video' && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-center">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      {isEn ? 'Trim Start (s)' : 'Début coupe (s)'}
                    </label>
                    <input
                      type="number"
                      step={0.5}
                      min={0}
                      max={Math.max(0, scene.trimEndSec - 0.5)}
                      value={scene.trimStartSec}
                      onChange={(e) =>
                        updateScene(scene.id, {
                          trimStartSec: Math.max(0, parseFloat(e.target.value) || 0),
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      {isEn ? 'Trim End (s)' : 'Fin coupe (s)'}
                    </label>
                    <input
                      type="number"
                      step={0.5}
                      min={scene.trimStartSec + 0.5}
                      max={scene.durationSec}
                      value={scene.trimEndSec}
                      onChange={(e) =>
                        updateScene(scene.id, {
                          trimEndSec: Math.min(
                            scene.durationSec,
                            Math.max(scene.trimStartSec + 0.5, parseFloat(e.target.value) || 3)
                          ),
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      {isEn ? 'Framing' : 'Cadrage'}
                    </label>
                    <select
                      value={scene.fitMode}
                      onChange={(e) =>
                        updateScene(scene.id, { fitMode: e.target.value as 'contain' | 'cover' })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                    >
                      <option value="contain">{isEn ? 'Fit' : 'Adapter'}</option>
                      <option value="cover">{isEn ? 'Fill' : 'Remplir'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      {isEn ? 'Speed' : 'Vitesse'} ({scene.playbackRate}x)
                    </label>
                    <select
                      value={scene.playbackRate}
                      onChange={(e) =>
                        updateScene(scene.id, { playbackRate: parseFloat(e.target.value) })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                    >
                      {[0.75, 1, 1.25, 1.5].map((r) => (
                        <option key={r} value={r}>
                          {r}x
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Volume ({Math.round(scene.volume * 100)}%)
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1.5}
                      step={0.05}
                      value={scene.volume}
                      onChange={(e) => updateScene(scene.id, { volume: parseFloat(e.target.value) })}
                      className="w-full mt-1.5"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          {scenes.length === 0 && (
            <div className="p-8 text-center rounded-2xl bg-white dark:bg-[#0c1631] border border-dashed border-slate-300 dark:border-slate-800 text-xs text-slate-500 space-y-2">
              <p>
                {isEn
                  ? 'Blank Video Studio ready — build from scratch with custom scenes (colors, shapes, texts), photos, videos, timed overlays, voiceovers & music.'
                  : 'Studio Vidéo vierge — créez votre vidéo à partir de rien : ajoutez une scène personnalisée (couleurs, formes, textes), vos photos/vidéos, des calques libres et vos pistes audio.'}
              </p>
              <button
                type="button"
                onClick={addBlankCustomScene}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                <Plus className="w-4 h-4" />
                <span>{isEn ? 'Start with a Custom Blank Scene' : 'Commencer avec une scène vierge'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <SocialShareModal
        isOpen={!!sharePayload}
        onClose={() => setSharePayload(null)}
        payload={sharePayload}
      />
    </div>
  );
};
