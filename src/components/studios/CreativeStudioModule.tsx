import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Type,
  Shapes,
  Image as ImageIcon,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Copy,
  Download,
  Share2,
  Save,
  RotateCcw,
  Eraser,
  CheckCircle2,
  Sparkles,
  CheckSquare,
  Square,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useShalomDB } from '../../hooks/useShalomDB';
import { dbService, STORES } from '../../services/db';
import { useLanguage } from '../../contexts/LanguageContext';
import { CreativeDesignItem } from '../../types';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { SocialShareModal } from '../common/SocialShareModal';
import { SharePayload } from '../../services/socialShare';

type FormatRatio = 'square' | 'portrait' | 'story' | 'landscape';
type ShapeKind = 'rect' | 'roundRect' | 'circle' | 'triangle' | 'star' | 'cross' | 'heart' | 'diamond' | 'line';

interface BaseLayer {
  id: string;
  x: number; // canvas coordinates (center)
  y: number;
  rotation: number;
  opacity: number;
}

interface TextLayer extends BaseLayer {
  kind: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  bgColor: string;
  bgEnabled: boolean;
  shadow: boolean;
}

interface ShapeLayer extends BaseLayer {
  kind: 'shape';
  shape: ShapeKind;
  width: number;
  height: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
}

interface ImageLayer extends BaseLayer {
  kind: 'image';
  imageEl: HTMLImageElement;
  label: string;
  width: number;
  height: number;
  circular: boolean;
}

interface DrawStroke {
  id: string;
  color: string;
  size: number;
  points: Array<{ x: number; y: number }>;
}

type StudioLayer = TextLayer | ShapeLayer | ImageLayer;

const FORMAT_DIMS: Record<FormatRatio, { w: number; h: number; label: string }> = {
  square: { w: 1080, h: 1080, label: '1:1 (1080×1080)' },
  portrait: { w: 1080, h: 1350, label: '4:5 (1080×1350)' },
  story: { w: 1080, h: 1920, label: '9:16 (1080×1920)' },
  landscape: { w: 1280, h: 720, label: '16:9 (1280×720)' },
};

const FONT_CHOICES = [
  { label: 'Sans Moderne', value: '"Plus Jakarta Sans", sans-serif' },
  { label: 'Classique Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Titre Display', value: '"Outfit", sans-serif' },
  { label: 'Manuscrite', value: 'cursive' },
  { label: 'Machine à écrire', value: '"Courier New", monospace' },
];

export const CreativeStudioModule: React.FC = () => {
  const { lang } = useLanguage();
  const { creations, reloadData } = useShalomDB();
  const isEn = lang === 'en';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Start completely blank ("à partir de rien")
  const [designTitle, setDesignTitle] = useState(isEn ? 'My Creation' : 'Ma création');
  const [formatRatio, setFormatRatio] = useState<FormatRatio>('square');
  const [bgType, setBgType] = useState<'solid' | 'gradient' | 'image'>('solid');
  const [bgColor1, setBgColor1] = useState('#ffffff');
  const [bgColor2, setBgColor2] = useState('#173c7a');
  const [bgAngle, setBgAngle] = useState(135);
  const [bgImageEl, setBgImageEl] = useState<HTMLImageElement | null>(null);
  const [bgImageOverlay, setBgImageOverlay] = useState(0.2);

  const [layers, setLayers] = useState<StudioLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // Freehand drawing
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [brushColor, setBrushColor] = useState('#0b1f42');
  const [brushSize, setBrushSize] = useState(10);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const activeStrokeRef = useRef<DrawStroke | null>(null);

  // Dragging layer on canvas
  const dragStateRef = useRef<{
    layerId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  // Two-finger pinch-to-zoom state
  const pinchStateRef = useRef<{
    startDist: number;
    layerId: string;
    startFontSize?: number;
    startWidth?: number;
    startHeight?: number;
  } | null>(null);

  const [notice, setNotice] = useState<string | null>(null);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);
  const [savedPreviews, setSavedPreviews] = useState<Record<string, string>>({});
  const [selectedCreationIds, setSelectedCreationIds] = useState<string[]>([]);
  const [confirmDeleteCreations, setConfirmDeleteCreations] = useState<CreativeDesignItem[] | null>(null);

  const dims = FORMAT_DIMS[formatRatio];

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      const next: Record<string, string> = {};
      for (const item of creations) {
        const blob = await dbService.getMediaBlob(item.mediaBlobKey);
        if (blob && !cancelled) {
          const url = URL.createObjectURL(blob);
          urls.push(url);
          next[item.id] = url;
        }
      }
      if (!cancelled) setSavedPreviews(next);
    })();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [creations]);

  const selectedLayer = layers.find((l) => l.id === selectedLayerId) || null;

  const drawShape = (ctx: CanvasRenderingContext2D, l: ShapeLayer) => {
    const hw = l.width / 2;
    const hh = l.height / 2;
    ctx.beginPath();

    switch (l.shape) {
      case 'rect':
        ctx.rect(-hw, -hh, l.width, l.height);
        break;
      case 'roundRect': {
        const r = Math.min(36, hw, hh);
        ctx.moveTo(-hw + r, -hh);
        ctx.lineTo(hw - r, -hh);
        ctx.quadraticCurveTo(hw, -hh, hw, -hh + r);
        ctx.lineTo(hw, hh - r);
        ctx.quadraticCurveTo(hw, hh, hw - r, hh);
        ctx.lineTo(-hw + r, hh);
        ctx.quadraticCurveTo(-hw, hh, -hw, hh - r);
        ctx.lineTo(-hw, -hh + r);
        ctx.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
        break;
      }
      case 'circle':
        ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
        break;
      case 'triangle':
        ctx.moveTo(0, -hh);
        ctx.lineTo(hw, hh);
        ctx.lineTo(-hw, hh);
        ctx.closePath();
        break;
      case 'diamond':
        ctx.moveTo(0, -hh);
        ctx.lineTo(hw, 0);
        ctx.lineTo(0, hh);
        ctx.lineTo(-hw, 0);
        ctx.closePath();
        break;
      case 'star': {
        const spikes = 5;
        const outerR = Math.min(hw, hh);
        const innerR = outerR * 0.45;
        for (let i = 0; i < spikes * 2; i++) {
          const rad = i % 2 === 0 ? outerR : innerR;
          const angle = (i * Math.PI) / spikes - Math.PI / 2;
          const px = Math.cos(angle) * rad;
          const py = Math.sin(angle) * rad;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      }
      case 'cross': {
        const armW = l.width * 0.28;
        const barY = -l.height * 0.14;
        const barH = l.height * 0.24;
        ctx.moveTo(-armW / 2, -hh);
        ctx.lineTo(armW / 2, -hh);
        ctx.lineTo(armW / 2, barY);
        ctx.lineTo(hw, barY);
        ctx.lineTo(hw, barY + barH);
        ctx.lineTo(armW / 2, barY + barH);
        ctx.lineTo(armW / 2, hh);
        ctx.lineTo(-armW / 2, hh);
        ctx.lineTo(-armW / 2, barY + barH);
        ctx.lineTo(-hw, barY + barH);
        ctx.lineTo(-hw, barY);
        ctx.lineTo(-armW / 2, barY);
        ctx.closePath();
        break;
      }
      case 'heart': {
        const topCurveH = l.height * 0.3;
        ctx.moveTo(0, hh * 0.85);
        ctx.bezierCurveTo(-hw * 1.2, hh * 0.1, -hw, -hh * 0.7, 0, -hh + topCurveH);
        ctx.bezierCurveTo(hw, -hh * 0.7, hw * 1.2, hh * 0.1, 0, hh * 0.85);
        ctx.closePath();
        break;
      }
      case 'line':
        ctx.moveTo(-hw, 0);
        ctx.lineTo(hw, 0);
        break;
    }

    if (l.shape !== 'line' && l.fillColor !== 'transparent') {
      ctx.fillStyle = l.fillColor;
      ctx.fill();
    }
    if (l.strokeWidth > 0) {
      ctx.strokeStyle = l.strokeColor;
      ctx.lineWidth = l.strokeWidth;
      ctx.stroke();
    }
  };

  const renderCanvas = useCallback(
    (showSelectionBox = true) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = dims.w;
      canvas.height = dims.h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Background
      if (bgType === 'solid') {
        ctx.fillStyle = bgColor1;
        ctx.fillRect(0, 0, dims.w, dims.h);
      } else if (bgType === 'gradient') {
        const rad = (bgAngle * Math.PI) / 180;
        const cx = dims.w / 2;
        const cy = dims.h / 2;
        const r = Math.max(dims.w, dims.h) / 2;
        const grad = ctx.createLinearGradient(
          cx - Math.cos(rad) * r,
          cy - Math.sin(rad) * r,
          cx + Math.cos(rad) * r,
          cy + Math.sin(rad) * r
        );
        grad.addColorStop(0, bgColor1);
        grad.addColorStop(1, bgColor2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, dims.w, dims.h);
      } else if (bgType === 'image' && bgImageEl) {
        ctx.fillStyle = bgColor1;
        ctx.fillRect(0, 0, dims.w, dims.h);
        const iRatio = bgImageEl.width / Math.max(1, bgImageEl.height);
        const cRatio = dims.w / dims.h;
        let dw = dims.w;
        let dh = dims.h;
        let dx = 0;
        let dy = 0;
        if (iRatio > cRatio) {
          dh = dims.h;
          dw = dims.h * iRatio;
          dx = (dims.w - dw) / 2;
        } else {
          dw = dims.w;
          dh = dims.w / iRatio;
          dy = (dims.h - dh) / 2;
        }
        ctx.drawImage(bgImageEl, dx, dy, dw, dh);
        if (bgImageOverlay > 0) {
          ctx.fillStyle = `rgba(0,0,0,${bgImageOverlay})`;
          ctx.fillRect(0, 0, dims.w, dims.h);
        }
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, dims.w, dims.h);
      }

      // 2. Layers
      for (const layer of layers) {
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        ctx.translate(layer.x, layer.y);
        ctx.rotate((layer.rotation * Math.PI) / 180);

        if (layer.kind === 'shape') {
          drawShape(ctx, layer);
        } else if (layer.kind === 'image') {
          const hw = layer.width / 2;
          const hh = layer.height / 2;
          if (layer.circular) {
            ctx.beginPath();
            ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
          }
          ctx.drawImage(layer.imageEl, -hw, -hh, layer.width, layer.height);
        } else if (layer.kind === 'text') {
          ctx.font = `${layer.italic ? 'italic ' : ''}${layer.bold ? '700 ' : '400 '}${layer.fontSize}px ${layer.fontFamily}`;
          ctx.textAlign = layer.align;
          ctx.textBaseline = 'middle';
          const lines = layer.text.split('\n');
          const lineH = layer.fontSize * 1.28;
          const maxLineW = Math.max(
            40,
            ...lines.map((ln) => ctx.measureText(ln).width)
          );
          const totalH = lines.length * lineH;

          if (layer.bgEnabled) {
            ctx.fillStyle = layer.bgColor;
            ctx.fillRect(-maxLineW / 2 - 22, -totalH / 2 - 14, maxLineW + 44, totalH + 28);
          }

          if (layer.shadow) {
            ctx.shadowColor = 'rgba(0,0,0,0.4)';
            ctx.shadowBlur = 12;
            ctx.shadowOffsetY = 4;
          }

          ctx.fillStyle = layer.color;
          const startY = -((lines.length - 1) * lineH) / 2;
          lines.forEach((ln, idx) => {
            const tx =
              layer.align === 'left' ? -maxLineW / 2 : layer.align === 'right' ? maxLineW / 2 : 0;
            ctx.fillText(ln, tx, startY + idx * lineH);
          });
        }

        // Selection outline
        if (showSelectionBox && layer.id === selectedLayerId) {
          ctx.shadowColor = 'transparent';
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = 3;
          ctx.setLineDash([10, 6]);
          if (layer.kind === 'text') {
            ctx.strokeRect(-220, -60, 440, 120);
          } else {
            ctx.strokeRect(-layer.width / 2 - 8, -layer.height / 2 - 8, layer.width + 16, layer.height + 16);
          }
        }

        ctx.restore();
      }

      // 3. Freehand strokes
      const allStrokes = activeStrokeRef.current ? [...strokes, activeStrokeRef.current] : strokes;
      for (const s of allStrokes) {
        if (s.points.length < 2) continue;
        ctx.save();
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x, s.points[i].y);
        }
        ctx.stroke();
        ctx.restore();
      }
    },
    [
      dims,
      bgType,
      bgColor1,
      bgColor2,
      bgAngle,
      bgImageEl,
      bgImageOverlay,
      layers,
      selectedLayerId,
      strokes,
    ]
  );

  useEffect(() => {
    renderCanvas(true);
  }, [renderCanvas]);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * dims.w,
      y: ((e.clientY - rect.top) / rect.height) * dims.h,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pinchStateRef.current) return;
    const pt = getCanvasPoint(e);
    if (isDrawMode) {
      const stroke: DrawStroke = {
        id: `stk_${Date.now()}`,
        color: brushColor,
        size: brushSize,
        points: [pt],
      };
      activeStrokeRef.current = stroke;
      renderCanvas(true);
      return;
    }

    // Hit-test layers from top to bottom
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      const hw = l.kind === 'text' ? Math.max(240, l.text.length * l.fontSize * 0.35) : l.width / 2 + 16;
      const hh = l.kind === 'text' ? Math.max(90, l.fontSize * 1.4) : l.height / 2 + 16;
      if (Math.abs(pt.x - l.x) <= hw && Math.abs(pt.y - l.y) <= hh) {
        setSelectedLayerId(l.id);
        dragStateRef.current = {
          layerId: l.id,
          offsetX: pt.x - l.x,
          offsetY: pt.y - l.y,
        };
        return;
      }
    }
    setSelectedLayerId(null);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pinchStateRef.current) return;
    const pt = getCanvasPoint(e);
    if (isDrawMode && activeStrokeRef.current) {
      activeStrokeRef.current.points.push(pt);
      renderCanvas(true);
      return;
    }
    if (dragStateRef.current) {
      const { layerId, offsetX, offsetY } = dragStateRef.current;
      setLayers((prev) =>
        prev.map((l) => (l.id === layerId ? { ...l, x: pt.x - offsetX, y: pt.y - offsetY } : l))
      );
    }
  };

  const handlePointerUp = () => {
    if (isDrawMode && activeStrokeRef.current) {
      const finished = activeStrokeRef.current;
      activeStrokeRef.current = null;
      setStrokes((prev) => [...prev, finished]);
    }
    dragStateRef.current = null;
  };

  // Two-finger pinch gesture on canvas to resize selected text / shape / image
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 2) return;
    dragStateRef.current = null;
    activeStrokeRef.current = null;

    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    if (dist <= 0) return;

    // Use currently selected layer, or fallback to top-most layer under pinch midpoint
    let targetLayer = selectedLayer;
    if (!targetLayer && canvasRef.current && layers.length > 0) {
      const rect = canvasRef.current.getBoundingClientRect();
      const midX = (((t1.clientX + t2.clientX) / 2 - rect.left) / rect.width) * dims.w;
      const midY = (((t1.clientY + t2.clientY) / 2 - rect.top) / rect.height) * dims.h;
      for (let i = layers.length - 1; i >= 0; i--) {
        const l = layers[i];
        const hw = l.kind === 'text' ? 280 : l.width / 2 + 40;
        const hh = l.kind === 'text' ? 120 : l.height / 2 + 40;
        if (Math.abs(midX - l.x) <= hw && Math.abs(midY - l.y) <= hh) {
          targetLayer = l;
          setSelectedLayerId(l.id);
          break;
        }
      }
    }

    if (!targetLayer) return;

    pinchStateRef.current = {
      startDist: dist,
      layerId: targetLayer.id,
      startFontSize: targetLayer.kind === 'text' ? targetLayer.fontSize : undefined,
      startWidth: targetLayer.kind !== 'text' ? targetLayer.width : undefined,
      startHeight: targetLayer.kind !== 'text' ? targetLayer.height : undefined,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!pinchStateRef.current || e.touches.length < 2) return;
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    const { startDist, layerId, startFontSize, startWidth, startHeight } = pinchStateRef.current;
    if (startDist <= 0) return;

    const scale = dist / startDist;
    setLayers((prev) =>
      prev.map((l) => {
        if (l.id !== layerId) return l;
        if (l.kind === 'text' && startFontSize) {
          const nextSize = Math.max(14, Math.min(280, Math.round(startFontSize * scale)));
          return { ...l, fontSize: nextSize };
        }
        if (l.kind !== 'text' && startWidth && startHeight) {
          const nextW = Math.max(20, Math.min(1600, Math.round(startWidth * scale)));
          const nextH = Math.max(10, Math.min(1600, Math.round(startHeight * scale)));
          return { ...l, width: nextW, height: nextH };
        }
        return l;
      })
    );
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length < 2) {
      pinchStateRef.current = null;
    }
  };

  const addTextLayer = () => {
    const id = `txt_${Date.now()}`;
    const next: TextLayer = {
      id,
      kind: 'text',
      text: isEn ? 'Your text here' : 'Votre texte ici',
      fontFamily: FONT_CHOICES[0].value,
      fontSize: 56,
      color: bgColor1 === '#ffffff' ? '#0f172a' : '#ffffff',
      bold: true,
      italic: false,
      align: 'center',
      bgColor: '#0b1f42',
      bgEnabled: false,
      shadow: false,
      x: dims.w / 2,
      y: dims.h / 2,
      rotation: 0,
      opacity: 1,
    };
    setLayers((prev) => [...prev, next]);
    setSelectedLayerId(id);
    setIsDrawMode(false);
  };

  const addShapeLayer = (shape: ShapeKind) => {
    const id = `shp_${Date.now()}`;
    const next: ShapeLayer = {
      id,
      kind: 'shape',
      shape,
      width: shape === 'line' ? 420 : 240,
      height: shape === 'line' ? 12 : 240,
      fillColor: '#1d4ed8',
      strokeColor: '#fbbf24',
      strokeWidth: shape === 'line' ? 10 : 0,
      x: dims.w / 2,
      y: dims.h / 2,
      rotation: 0,
      opacity: 1,
    };
    setLayers((prev) => [...prev, next]);
    setSelectedLayerId(id);
    setIsDrawMode(false);
  };

  const handleAddImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const ratio = img.width / Math.max(1, img.height);
      const w = 360;
      const h = Math.round(w / ratio);
      const id = `img_${Date.now()}`;
      const next: ImageLayer = {
        id,
        kind: 'image',
        imageEl: img,
        label: file.name,
        width: w,
        height: h,
        circular: false,
        x: dims.w / 2,
        y: dims.h / 2,
        rotation: 0,
        opacity: 1,
      };
      setLayers((prev) => [...prev, next]);
      setSelectedLayerId(id);
      setIsDrawMode(false);
    };
    img.src = url;
    e.target.value = '';
  };

  const handleAddBgImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setBgImageEl(img);
      setBgType('image');
    };
    img.src = url;
    e.target.value = '';
  };

  const updateSelectedLayer = (patch: Partial<StudioLayer>) => {
    if (!selectedLayerId) return;
    setLayers((prev) =>
      prev.map((l) => (l.id === selectedLayerId ? ({ ...l, ...patch } as StudioLayer) : l))
    );
  };

  const moveSelectedLayer = (dir: -1 | 1) => {
    if (!selectedLayerId) return;
    const idx = layers.findIndex((l) => l.id === selectedLayerId);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= layers.length) return;
    setLayers((prev) => {
      const next = [...prev];
      const tmp = next[idx];
      next[idx] = next[target];
      next[target] = tmp;
      return next;
    });
  };

  const duplicateSelectedLayer = () => {
    if (!selectedLayer) return;
    const id = `${selectedLayer.kind}_${Date.now()}`;
    const copy = { ...selectedLayer, id, x: selectedLayer.x + 36, y: selectedLayer.y + 36 };
    setLayers((prev) => [...prev, copy as StudioLayer]);
    setSelectedLayerId(id);
  };

  const deleteSelectedLayer = () => {
    if (!selectedLayerId) return;
    setLayers((prev) => prev.filter((l) => l.id !== selectedLayerId));
    setSelectedLayerId(null);
  };

  const clearAllBlank = () => {
    setLayers([]);
    setStrokes([]);
    setSelectedLayerId(null);
    setBgType('solid');
    setBgColor1('#ffffff');
    setBgImageEl(null);
  };

  const exportCleanBlob = (mimeType: 'image/png' | 'image/jpeg'): Promise<Blob | null> => {
    return new Promise((resolve) => {
      renderCanvas(false);
      const canvas = canvasRef.current;
      if (!canvas) {
        resolve(null);
        return;
      }
      canvas.toBlob(
        (blob) => {
          renderCanvas(true);
          resolve(blob);
        },
        mimeType,
        0.95
      );
    });
  };

  const handleDownload = async (ext: 'png' | 'jpg') => {
    const blob = await exportCleanBlob(ext === 'png' ? 'image/png' : 'image/jpeg');
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${designTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'creation'}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setNotice(isEn ? 'Image downloaded!' : 'Création téléchargée sur votre appareil !');
  };

  const handleSaveToGallery = async () => {
    const blob = await exportCleanBlob('image/png');
    if (!blob) return;
    const blobKey = `creation_blob_${Date.now()}`;
    await dbService.saveMediaBlob(blobKey, blob, 'image/png');
    const item: CreativeDesignItem = {
      id: `cr_${Date.now()}`,
      title: designTitle.trim() || 'Création libre',
      templateType: 'verset',
      mediaBlobKey: blobKey,
      mimeType: 'image/png',
      createdAt: new Date().toISOString(),
    };
    await dbService.put(STORES.CREATIONS, item);
    setNotice(isEn ? 'Saved to gallery!' : 'Création enregistrée dans votre galerie !');
    reloadData();
  };

  const handleShare = async () => {
    const blob = await exportCleanBlob('image/png');
    if (!blob) return;
    const file = new File([blob], `shalom_creation_${Date.now()}.png`, { type: 'image/png' });
    setSharePayload({
      title: designTitle,
      text: `${designTitle}\n\nCréé librement dans SHALOM`,
      file,
    });
  };

  const handleShareSavedItem = async (item: CreativeDesignItem) => {
    const blob = await dbService.getMediaBlob(item.mediaBlobKey);
    if (!blob) return;
    const file = new File([blob], `${item.id}.png`, { type: item.mimeType || 'image/png' });
    setSharePayload({
      title: item.title,
      text: `${item.title}\n\nPartagé depuis SHALOM Studio`,
      file,
    });
  };

  const handleConfirmDeleteCreations = async () => {
    if (!confirmDeleteCreations || confirmDeleteCreations.length === 0) return;
    const blobs = confirmDeleteCreations.map((c) => c.mediaBlobKey).filter(Boolean);
    const ids = confirmDeleteCreations.map((c) => c.id);
    if (blobs.length > 0) {
      await dbService.deleteItems(STORES.MEDIA_BLOBS, blobs);
    }
    await dbService.deleteItems(STORES.CREATIONS, ids);
    setSelectedCreationIds((prev) => prev.filter((id) => !ids.includes(id)));
    setConfirmDeleteCreations(null);
    reloadData();
  };

  const toggleCreationId = (id: string) => {
    setSelectedCreationIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAllCreations = () => {
    const allIds = creations.map((c) => c.id);
    const allSel = allIds.length > 0 && allIds.every((id) => selectedCreationIds.includes(id));
    setSelectedCreationIds(allSel ? [] : allIds);
  };

  const resizeSelectedByFactor = (factor: number) => {
    if (!selectedLayer) return;
    if (selectedLayer.kind === 'text') {
      updateSelectedLayer({
        fontSize: Math.max(14, Math.min(280, Math.round(selectedLayer.fontSize * factor))),
      });
    } else {
      updateSelectedLayer({
        width: Math.max(20, Math.min(1600, Math.round(selectedLayer.width * factor))),
        height: Math.max(10, Math.min(1600, Math.round(selectedLayer.height * factor))),
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2 flex-wrap">
        <span className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0 text-amber-600" />
          <span>
            {isEn
              ? 'Free Blank-Canvas Studio: start from zero, pick any colors, shapes, fonts, drawings & images.'
              : 'Studio libre : partez de zéro, choisissez librement vos couleurs, formes, polices, dessins et images. Glissez les éléments sur le canevas.'}
          </span>
        </span>
        <button
          type="button"
          onClick={clearAllBlank}
          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 text-[11px] font-bold flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{isEn ? 'New Blank Canvas' : 'Canevas vierge'}</span>
        </button>
      </div>

      {notice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{notice}</span>
          </span>
          <button type="button" onClick={() => setNotice(null)} className="underline">
            OK
          </button>
        </div>
      )}

      {/* Toolbar: Add Anything */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={addTextLayer}
          className="px-3 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center gap-1.5"
        >
          <Type className="w-4 h-4" />
          <span>+ {isEn ? 'Text' : 'Texte'}</span>
        </button>

        <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
          <span className="px-2 font-bold text-slate-500 flex items-center gap-1">
            <Shapes className="w-3.5 h-3.5" />
            <span>{isEn ? 'Shapes:' : 'Formes :'}</span>
          </span>
          {[
            { id: 'rect', label: '▭' },
            { id: 'roundRect', label: '▢' },
            { id: 'circle', label: '●' },
            { id: 'triangle', label: '▲' },
            { id: 'star', label: '★' },
            { id: 'cross', label: '✝' },
            { id: 'heart', label: '♥' },
            { id: 'diamond', label: '◆' },
            { id: 'line', label: '―' },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => addShapeLayer(s.id as ShapeKind)}
              className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 hover:bg-blue-50 font-bold flex items-center justify-center"
              title={s.id}
            >
              {s.label}
            </button>
          ))}
        </div>

        <label className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 font-bold flex items-center gap-1.5 cursor-pointer">
          <ImageIcon className="w-4 h-4" />
          <span>+ {isEn ? 'Image / Logo' : 'Image / Logo'}</span>
          <input type="file" accept="image/*" onChange={handleAddImageFile} className="hidden" />
        </label>

        <button
          type="button"
          onClick={() => setIsDrawMode((d) => !d)}
          className={`px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 transition ${
            isDrawMode
              ? 'bg-amber-500 text-slate-950'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
          }`}
        >
          <Pencil className="w-4 h-4" />
          <span>{isDrawMode ? (isEn ? 'Drawing ON' : 'Pinceau ACTIF') : (isEn ? 'Free Draw' : 'Dessiner')}</span>
        </button>

        {strokes.length > 0 && (
          <button
            type="button"
            onClick={() => setStrokes((prev) => prev.slice(0, -1))}
            className="px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold flex items-center gap-1"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>{isEn ? 'Undo Stroke' : 'Annuler trait'}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left: Interactive Canvas + Immediate Contextual Controls + Export */}
        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="max-w-full max-h-[480px] w-auto h-auto rounded-xl shadow-xl touch-none cursor-crosshair bg-white"
            />
          </div>

          {/* Immediate contextual bar right under canvas when an element is clicked */}
          {selectedLayer && (
            <div className="p-3.5 rounded-2xl bg-blue-50/90 dark:bg-[#0f2347] border border-blue-200 dark:border-blue-800 space-y-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-extrabold text-blue-800 dark:text-blue-200 uppercase tracking-wider text-[11px]">
                  {selectedLayer.kind === 'text'
                    ? 'Zone de texte sélectionnée'
                    : selectedLayer.kind === 'shape'
                      ? 'Forme sélectionnée'
                      : 'Image sélectionnée'}{' '}
                  · Pincer 2 doigts pour zoomer
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => resizeSelectedByFactor(0.85)}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    title="Réduire la taille"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => resizeSelectedByFactor(1.15)}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    title="Agrandir la taille"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={deleteSelectedLayer}
                    className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Supprimer</span>
                  </button>
                </div>
              </div>

              {selectedLayer.kind === 'text' && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={selectedLayer.text}
                    onChange={(e) => updateSelectedLayer({ text: e.target.value })}
                    placeholder="Texte..."
                    className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={selectedLayer.fontFamily}
                      onChange={(e) => updateSelectedLayer({ fontFamily: e.target.value })}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                    >
                      {FONT_CHOICES.map((f) => (
                        <option key={f.label} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="color"
                      value={selectedLayer.color}
                      onChange={(e) => updateSelectedLayer({ color: e.target.value })}
                      title="Couleur du texte"
                      className="w-8 h-7 rounded cursor-pointer"
                    />
                    <span className="font-semibold tabular-nums">{selectedLayer.fontSize}px</span>
                    <button
                      type="button"
                      onClick={() => updateSelectedLayer({ bold: !selectedLayer.bold })}
                      className={`px-2 py-1 rounded-lg font-bold border ${
                        selectedLayer.bold
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      G
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedLayer({ italic: !selectedLayer.italic })}
                      className={`px-2 py-1 rounded-lg italic border ${
                        selectedLayer.italic
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      I
                    </button>
                  </div>
                </div>
              )}

              {selectedLayer.kind === 'shape' && (
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 font-semibold">
                    <span>Couleur</span>
                    <input
                      type="color"
                      value={selectedLayer.fillColor === 'transparent' ? '#ffffff' : selectedLayer.fillColor}
                      onChange={(e) => updateSelectedLayer({ fillColor: e.target.value })}
                      className="w-8 h-7 rounded cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 font-semibold">
                    <span>Bordure</span>
                    <input
                      type="color"
                      value={selectedLayer.strokeColor}
                      onChange={(e) => updateSelectedLayer({ strokeColor: e.target.value })}
                      className="w-8 h-7 rounded cursor-pointer"
                    />
                  </label>
                  <span className="text-[11px] font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                    {selectedLayer.width}×{selectedLayer.height}px
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSaveToGallery}
              className="px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{isEn ? 'Save' : 'Enregistrer'}</span>
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Share2 className="w-4 h-4" />
              <span>{isEn ? 'Share Social / WhatsApp' : 'Partager'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownload('png')}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PNG</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownload('jpg')}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JPG</span>
            </button>
          </div>
        </div>

        {/* Right: Background + Brush + Selected Layer Properties */}
        <div className="space-y-4 text-xs">
          {/* Canvas & Background Settings */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-3">
            <h3 className="font-bold uppercase tracking-wider text-slate-500">
              {isEn ? 'Canvas & Background' : 'Format & Arrière-plan'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">{isEn ? 'Title' : 'Nom du projet'}</label>
                <input
                  type="text"
                  value={designTitle}
                  onChange={(e) => setDesignTitle(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">{isEn ? 'Format' : 'Format'}</label>
                <select
                  value={formatRatio}
                  onChange={(e) => setFormatRatio(e.target.value as FormatRatio)}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                >
                  {Object.entries(FORMAT_DIMS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { id: 'solid', label: isEn ? 'Solid Color' : 'Couleur unie' },
                { id: 'gradient', label: isEn ? 'Gradient' : 'Dégradé libre' },
                { id: 'image', label: isEn ? 'Photo' : 'Photo de fond' },
              ].map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBgType(b.id as typeof bgType)}
                  className={`px-3 py-1.5 rounded-lg font-semibold ${
                    bgType === b.id
                      ? 'bg-blue-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 font-semibold">
                <span>{isEn ? 'Color 1' : 'Couleur 1'}</span>
                <input
                  type="color"
                  value={bgColor1}
                  onChange={(e) => setBgColor1(e.target.value)}
                  className="w-9 h-8 rounded cursor-pointer"
                />
              </label>

              {bgType === 'gradient' && (
                <>
                  <label className="flex items-center gap-2 font-semibold">
                    <span>{isEn ? 'Color 2' : 'Couleur 2'}</span>
                    <input
                      type="color"
                      value={bgColor2}
                      onChange={(e) => setBgColor2(e.target.value)}
                      className="w-9 h-8 rounded cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center gap-2 font-semibold">
                    <span>Angle</span>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={bgAngle}
                      onChange={(e) => setBgAngle(parseInt(e.target.value, 10))}
                      className="w-20"
                    />
                  </label>
                </>
              )}

              {bgType === 'image' && (
                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 cursor-pointer font-semibold">
                    <span>{isEn ? 'Choose Photo' : 'Choisir photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAddBgImage}
                      className="hidden"
                    />
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={0.85}
                    step={0.05}
                    value={bgImageOverlay}
                    onChange={(e) => setBgImageOverlay(parseFloat(e.target.value))}
                    className="w-24"
                  />
                </div>
              )}
            </div>

            {isDrawMode && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 font-semibold">
                  <span>{isEn ? 'Brush Color' : 'Couleur pinceau'}</span>
                  <input
                    type="color"
                    value={brushColor}
                    onChange={(e) => setBrushColor(e.target.value)}
                    className="w-8 h-7 rounded"
                  />
                </label>
                <label className="flex items-center gap-2 font-semibold">
                  <span>{isEn ? 'Size' : 'Épaisseur'}</span>
                  <input
                    type="range"
                    min={2}
                    max={48}
                    value={brushSize}
                    onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                    className="w-24"
                  />
                  <span>{brushSize}px</span>
                </label>
              </div>
            )}
          </div>

          {/* Selected Layer Inspector */}
          {selectedLayer ? (
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1631] border border-blue-300 dark:border-blue-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                  {selectedLayer.kind === 'text'
                    ? isEn
                      ? 'Edit Text Layer'
                      : 'Modifier le texte'
                    : selectedLayer.kind === 'shape'
                      ? isEn
                        ? 'Edit Shape Layer'
                        : 'Modifier la forme'
                      : isEn
                        ? 'Edit Image Layer'
                        : 'Modifier l’image'}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveSelectedLayer(-1)}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
                    title="Reculer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSelectedLayer(1)}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
                    title="Avancer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={duplicateSelectedLayer}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800"
                    title="Dupliquer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={deleteSelectedLayer}
                    className="p-1.5 rounded-lg text-red-600 hover:bg-red-50"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {selectedLayer.kind === 'text' && (
                <div className="space-y-3">
                  <textarea
                    rows={3}
                    value={selectedLayer.text}
                    onChange={(e) => updateSelectedLayer({ text: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={selectedLayer.fontFamily}
                      onChange={(e) => updateSelectedLayer({ fontFamily: e.target.value })}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                    >
                      {FONT_CHOICES.map((f) => (
                        <option key={f.label} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <span>{isEn ? 'Size' : 'Taille'}</span>
                      <input
                        type="number"
                        min={16}
                        max={220}
                        value={selectedLayer.fontSize}
                        onChange={(e) =>
                          updateSelectedLayer({ fontSize: parseInt(e.target.value, 10) || 40 })
                        }
                        className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 font-semibold">
                      <span>{isEn ? 'Color' : 'Couleur'}</span>
                      <input
                        type="color"
                        value={selectedLayer.color}
                        onChange={(e) => updateSelectedLayer({ color: e.target.value })}
                        className="w-8 h-7 rounded"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => updateSelectedLayer({ bold: !selectedLayer.bold })}
                      className={`px-2.5 py-1 rounded-lg font-bold border ${
                        selectedLayer.bold ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                    >
                      G
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedLayer({ italic: !selectedLayer.italic })}
                      className={`px-2.5 py-1 rounded-lg italic border ${
                        selectedLayer.italic ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                    >
                      I
                    </button>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedLayer.bgEnabled}
                        onChange={(e) => updateSelectedLayer({ bgEnabled: e.target.checked })}
                      />
                      <span>{isEn ? 'Box' : 'Fond'}</span>
                    </label>
                    {selectedLayer.bgEnabled && (
                      <input
                        type="color"
                        value={selectedLayer.bgColor}
                        onChange={(e) => updateSelectedLayer({ bgColor: e.target.value })}
                        className="w-7 h-7 rounded"
                      />
                    )}
                  </div>
                </div>
              )}

              {selectedLayer.kind === 'shape' && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center justify-between font-semibold">
                    <span>{isEn ? 'Fill' : 'Remplissage'}</span>
                    <input
                      type="color"
                      value={selectedLayer.fillColor === 'transparent' ? '#ffffff' : selectedLayer.fillColor}
                      onChange={(e) => updateSelectedLayer({ fillColor: e.target.value })}
                      className="w-9 h-7 rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between font-semibold">
                    <span>{isEn ? 'Border' : 'Bordure'}</span>
                    <input
                      type="color"
                      value={selectedLayer.strokeColor}
                      onChange={(e) => updateSelectedLayer({ strokeColor: e.target.value })}
                      className="w-9 h-7 rounded"
                    />
                  </label>
                  <div>
                    <span className="block mb-1">{isEn ? 'Width' : 'Largeur'}</span>
                    <input
                      type="range"
                      min={20}
                      max={950}
                      value={selectedLayer.width}
                      onChange={(e) => updateSelectedLayer({ width: parseInt(e.target.value, 10) })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <span className="block mb-1">{isEn ? 'Height' : 'Hauteur'}</span>
                    <input
                      type="range"
                      min={10}
                      max={950}
                      value={selectedLayer.height}
                      onChange={(e) => updateSelectedLayer({ height: parseInt(e.target.value, 10) })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <span className="block mb-1">{isEn ? 'Border px' : 'Épaisseur bordure'}</span>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      value={selectedLayer.strokeWidth}
                      onChange={(e) =>
                        updateSelectedLayer({ strokeWidth: parseInt(e.target.value, 10) })
                      }
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              {selectedLayer.kind === 'image' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="block mb-1">{isEn ? 'Width' : 'Largeur'}</span>
                      <input
                        type="range"
                        min={40}
                        max={1080}
                        value={selectedLayer.width}
                        onChange={(e) => updateSelectedLayer({ width: parseInt(e.target.value, 10) })}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <span className="block mb-1">{isEn ? 'Height' : 'Hauteur'}</span>
                      <input
                        type="range"
                        min={40}
                        max={1080}
                        value={selectedLayer.height}
                        onChange={(e) => updateSelectedLayer({ height: parseInt(e.target.value, 10) })}
                        className="w-full"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer font-semibold">
                    <input
                      type="checkbox"
                      checked={selectedLayer.circular}
                      onChange={(e) => updateSelectedLayer({ circular: e.target.checked })}
                    />
                    <span>{isEn ? 'Circular Crop' : 'Découpe en cercle'}</span>
                  </label>
                </div>
              )}

              {/* Common Rotation & Opacity */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="block mb-1">{isEn ? 'Rotation' : 'Rotation'} ({selectedLayer.rotation}°)</span>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    value={selectedLayer.rotation}
                    onChange={(e) =>
                      updateSelectedLayer({ rotation: parseInt(e.target.value, 10) })
                    }
                    className="w-full"
                  />
                </div>
                <div>
                  <span className="block mb-1">
                    {isEn ? 'Opacity' : 'Opacité'} ({Math.round(selectedLayer.opacity * 100)}%)
                  </span>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={selectedLayer.opacity}
                    onChange={(e) =>
                      updateSelectedLayer({ opacity: parseFloat(e.target.value) })
                    }
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-dashed border-slate-300 dark:border-slate-800 text-slate-500 text-center">
              {isEn
                ? 'Add texts, shapes, or images above, then tap any element on the canvas to move and customize it freely.'
                : 'Ajoutez un texte, une forme ou une image ci-dessus, puis touchez l’élément sur le canevas pour le déplacer et personnaliser ses couleurs.'}
            </div>
          )}
        </div>
      </div>

      {/* Saved Designs Gallery */}
      {creations.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {isEn ? 'My Saved Creations' : 'Mes créations enregistrées'}
            </h3>

            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={toggleAllCreations}
                className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 hover:text-blue-700"
              >
                {creations.every((c) => selectedCreationIds.includes(c.id)) ? (
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>Tout sélectionner ({selectedCreationIds.length})</span>
              </button>

              {selectedCreationIds.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setConfirmDeleteCreations(
                      creations.filter((c) => selectedCreationIds.includes(c.id))
                    )
                  }
                  className="px-3 py-1 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer ({selectedCreationIds.length})</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
            {creations.map((item) => {
              const isSel = selectedCreationIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className={`p-2.5 rounded-2xl bg-white dark:bg-[#0c1631] border space-y-2 transition ${
                    isSel
                      ? 'border-blue-600 ring-2 ring-blue-600/20'
                      : 'border-slate-200/80 dark:border-slate-800/80'
                  }`}
                >
                  <div className="relative">
                    {savedPreviews[item.id] && (
                      <img
                        src={savedPreviews[item.id]}
                        alt={item.title}
                        className="w-full h-36 object-cover rounded-xl bg-slate-100 dark:bg-slate-900"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => toggleCreationId(item.id)}
                      aria-label="Sélectionner cette création"
                      className="absolute top-2 left-2 p-1 rounded-lg bg-white/90 dark:bg-slate-900/90 shadow-xs"
                    >
                      {isSel ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                  </div>
                  <div className="text-xs font-bold truncate text-slate-900 dark:text-white">
                    {item.title}
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => handleShareSavedItem(item)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>{isEn ? 'Share' : 'Partager'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteCreations([item])}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmDeleteCreations && confirmDeleteCreations.length > 0}
        title={isEn ? 'Delete creation(s)?' : 'Supprimer la sélection ?'}
        message={
          confirmDeleteCreations && confirmDeleteCreations.length === 1
            ? `${isEn ? 'Delete' : 'Supprimer'} « ${confirmDeleteCreations[0].title} » ?`
            : `${isEn ? 'Delete' : 'Supprimer'} ${confirmDeleteCreations?.length || 0} création(s) ?`
        }
        confirmLabel={isEn ? 'Delete' : 'Supprimer'}
        cancelLabel={isEn ? 'Cancel' : 'Annuler'}
        isDestructive
        onConfirm={handleConfirmDeleteCreations}
        onCancel={() => setConfirmDeleteCreations(null)}
      />

      <SocialShareModal
        isOpen={!!sharePayload}
        onClose={() => setSharePayload(null)}
        payload={sharePayload}
      />
    </div>
  );
};
