import React, { useState, useEffect } from 'react';
import {
  Share2,
  Copy,
  Download,
  CheckCircle2,
  ExternalLink,
  Smartphone,
  MessageCircle,
} from 'lucide-react';
import { Modal } from './Modal';
import {
  SharePayload,
  tryNativeShare,
  copyTextQuietly,
  triggerFileDownload,
  buildPlatformShareUrl,
} from '../../services/socialShare';

interface SocialShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  payload: SharePayload | null;
}

export const SocialShareModal: React.FC<SocialShareModalProps> = ({
  isOpen,
  onClose,
  payload,
}) => {
  const [notice, setNotice] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !payload?.file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(payload.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [isOpen, payload]);

  useEffect(() => {
    if (!isOpen) setNotice(null);
  }, [isOpen]);

  if (!payload) return null;

  const isVideo = payload.file?.type.startsWith('video/');
  const isAudio = payload.file?.type.startsWith('audio/');
  const isImage = payload.file?.type.startsWith('image/');

  const handleNativeShare = async () => {
    await copyTextQuietly(payload.text);
    const result = await tryNativeShare(payload);
    if (result === 'shared') {
      setNotice('Partage envoyé avec succès.');
      return;
    }
    if (result === 'cancelled') return;
    setNotice(
      'Le partage système direct n’est pas disponible sur ce navigateur. Utilisez les boutons ci-dessous (le texte a été copié).'
    );
  };

  const handlePlatformClick = async (
    platform: 'whatsapp' | 'facebook' | 'instagram' | 'x' | 'tiktok',
    label: string
  ) => {
    await copyTextQuietly(payload.text);

    // If media file is present and device supports native file share, try native share first on mobile
    if (payload.file && (platform === 'instagram' || platform === 'tiktok' || platform === 'facebook')) {
      const nativeRes = await tryNativeShare(payload);
      if (nativeRes === 'shared' || nativeRes === 'cancelled') return;
      triggerFileDownload(payload.file, payload.file.name);
      setNotice(
        `Texte copié et fichier média téléchargé (${payload.file.name}). Ouvrez ${label} pour publier votre contenu.`
      );
      window.open(buildPlatformShareUrl(platform, payload), '_blank', 'noopener,noreferrer');
      return;
    }

    if (platform === 'whatsapp' && payload.file) {
      const nativeRes = await tryNativeShare(payload);
      if (nativeRes === 'shared' || nativeRes === 'cancelled') return;
      triggerFileDownload(payload.file, payload.file.name);
      setNotice(
        `Texte copié et média téléchargé (${payload.file.name}). Joignez le fichier dans WhatsApp si besoin.`
      );
    }

    window.open(buildPlatformShareUrl(platform, payload), '_blank', 'noopener,noreferrer');
  };

  const handleCopyText = async () => {
    const ok = await copyTextQuietly(payload.text);
    setNotice(ok ? 'Texte copié dans le presse-papiers.' : 'Impossible de copier automatiquement.');
  };

  const handleDownloadMedia = () => {
    if (!payload.file) return;
    triggerFileDownload(payload.file, payload.file.name);
    setNotice(`Média téléchargé : ${payload.file.name}`);
  };

  const platforms = [
    {
      id: 'whatsapp' as const,
      label: 'WhatsApp',
      className: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    },
    {
      id: 'facebook' as const,
      label: 'Facebook',
      className: 'bg-[#1877F2] hover:bg-[#1565d8] text-white',
    },
    {
      id: 'instagram' as const,
      label: 'Instagram',
      className: 'bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:opacity-95 text-white',
    },
    {
      id: 'x' as const,
      label: 'X (Twitter)',
      className: 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white',
    },
    {
      id: 'tiktok' as const,
      label: 'TikTok',
      className: 'bg-slate-950 hover:bg-black text-white border border-slate-700',
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Partager sur les réseaux sociaux"
      subtitle={payload.title}
      maxWidth="md"
    >
      <div className="space-y-4 text-xs">
        {previewUrl && (
          <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-200 dark:border-slate-800 p-2">
            {isImage && (
              <img
                src={previewUrl}
                alt={payload.title}
                className="w-full max-h-48 object-contain mx-auto rounded-lg"
                referrerPolicy="no-referrer"
              />
            )}
            {isVideo && (
              <video src={previewUrl} controls playsInline className="w-full max-h-48 rounded-lg" />
            )}
            {isAudio && <audio src={previewUrl} controls className="w-full" />}
          </div>
        )}

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed">
          {payload.text}
        </div>

        <button
          type="button"
          onClick={handleNativeShare}
          className="w-full py-2.5 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center justify-center gap-2 shadow-xs transition"
        >
          <Smartphone className="w-4 h-4" />
          <span>
            {payload.file
              ? 'Partager via le menu du téléphone (avec média)'
              : 'Partager via les applications du téléphone'}
          </span>
        </button>

        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Choisir un réseau social
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {platforms.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePlatformClick(p.id, p.label)}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs ${p.className}`}
              >
                {p.id === 'whatsapp' ? (
                  <MessageCircle className="w-3.5 h-3.5" />
                ) : (
                  <Share2 className="w-3.5 h-3.5" />
                )}
                <span>{p.label}</span>
                <ExternalLink className="w-3 h-3 opacity-80" />
              </button>
            ))}
          </div>
        </div>

        {notice && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{notice}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copier le texte</span>
            </button>

            {payload.file && (
              <button
                type="button"
                onClick={handleDownloadMedia}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger média</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Fermer
          </button>
        </div>
      </div>
    </Modal>
  );
};
