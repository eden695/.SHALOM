import React, { useState, useEffect } from 'react';
import {
  Share2,
  Copy,
  Download,
  CheckCircle2,
  ExternalLink,
  Smartphone,
  MessageCircle,
  Mail,
} from 'lucide-react';
import { Modal } from './Modal';
import {
  SharePayload,
  tryNativeShare,
  copyTextQuietly,
  triggerFileDownload,
  buildPlatformShareUrl,
  buildGmailComposeUrl,
  buildMailtoUrl,
} from '../../services/socialShare';
import { getAppPreferences } from '../../services/preferences';

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
  const [fallbackLink, setFallbackLink] = useState<{
    label: string;
    url: string;
    secondaryLabel?: string;
    secondaryUrl?: string;
  } | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [gmailRecipient, setGmailRecipient] = useState<string>('');

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
    if (isOpen) {
      const prefs = getAppPreferences();
      setGmailRecipient(payload?.recipientEmail || prefs.gmailDefaultRecipient || '');
    } else {
      setNotice(null);
      setFallbackLink(null);
      setIsBusy(false);
    }
  }, [isOpen, payload?.recipientEmail]);

  // Ensure returning to SHALOM from TikTok or external share sheet never leaves UI locked
  useEffect(() => {
    const resetBusyState = () => setIsBusy(false);
    window.addEventListener('focus', resetBusyState);
    window.addEventListener('pageshow', resetBusyState);
    document.addEventListener('visibilitychange', resetBusyState);
    return () => {
      window.removeEventListener('focus', resetBusyState);
      window.removeEventListener('pageshow', resetBusyState);
      document.removeEventListener('visibilitychange', resetBusyState);
    };
  }, []);

  if (!payload) return null;

  const isVideo = payload.file?.type.startsWith('video/');
  const isAudio = payload.file?.type.startsWith('audio/');
  const isImage = payload.file?.type.startsWith('image/');

  const getGmailSubject = () => {
    const prefs = getAppPreferences();
    const prefix = prefs.gmailSubjectPrefix?.trim();
    const base = payload.title?.trim() || 'Partage SHALOM';
    return prefix ? `${prefix} ${base}` : base;
  };

  const handleNativeShare = async () => {
    if (isBusy) return;
    setIsBusy(true);
    setFallbackLink(null);
    try {
      await copyTextQuietly(payload.text);
      const result = await tryNativeShare(payload);
      if (result === 'shared') {
        setNotice('Partage envoyé avec succès.');
        return;
      }
      if (result === 'cancelled') {
        setNotice('Partage annulé.');
        return;
      }
      setNotice(
        'Le menu de partage du téléphone n’est pas disponible sur ce navigateur. Utilisez un bouton ci-dessous (le texte a été copié).'
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleGmailClick = async () => {
    if (isBusy) return;
    setIsBusy(true);
    setFallbackLink(null);
    try {
      await copyTextQuietly(payload.text);
      const subject = getGmailSubject();
      const recipient = gmailRecipient.trim();

      // If an image/video/audio is attached and native file sharing is supported, let user send text+file straight to Gmail
      if (payload.file) {
        const nativeRes = await tryNativeShare({
          ...payload,
          title: subject,
        });
        if (nativeRes === 'shared') {
          setNotice('Contenu et média transmis via le menu de partage vers votre messagerie.');
          return;
        }
        if (nativeRes === 'cancelled') {
          setNotice('Partage Gmail annulé.');
          return;
        }
        triggerFileDownload(payload.file, payload.file.name);
        setNotice(
          `Objet et texte préparés pour Gmail, et média téléchargé (${payload.file.name}) pour le joindre en pièce jointe. L’envoi final se fait dans Gmail.`
        );
      } else {
        setNotice(
          'Objet et message préparés pour Gmail (texte copié). Choisissez votre mode d’ouverture ci-dessous ; la finalisation de l’envoi s’effectue dans Gmail.'
        );
      }

      setFallbackLink({
        label: 'Ouvrir Gmail (Web / App)',
        url: buildGmailComposeUrl(subject, payload.text, recipient),
        secondaryLabel: 'App E-mail / Gmail (mailto)',
        secondaryUrl: buildMailtoUrl(subject, payload.text, recipient),
      });
    } finally {
      setIsBusy(false);
    }
  };

  const handlePlatformClick = async (
    platform: 'whatsapp' | 'facebook' | 'instagram' | 'x' | 'tiktok',
    label: string
  ) => {
    if (isBusy) return;
    setIsBusy(true);
    setFallbackLink(null);
    try {
      await copyTextQuietly(payload.text);

      // Prioritize native Android/iOS system share sheet first so both text + image/video travel together
      // AND cancelling TikTok/Instagram/WhatsApp returns cleanly without opening an uncloseable WebView tab
      const nativeRes = await tryNativeShare(payload);
      if (nativeRes === 'shared') {
        setNotice(`Partage envoyé vers ${label}.`);
        return;
      }
      if (nativeRes === 'cancelled') {
        setNotice(`Partage vers ${label} annulé.`);
        return;
      }

      // Fallback when navigator.share is unavailable (desktop browser or legacy WebView):
      if (payload.file) {
        triggerFileDownload(payload.file, payload.file.name);
        setNotice(
          `Texte copié et média téléchargé (${payload.file.name}). Touchez le lien ci-dessous pour ouvrir ${label} et joindre votre média.`
        );
      } else {
        setNotice(
          `Texte copié ! Touchez le lien ci-dessous pour ouvrir ${label}.`
        );
      }
      setFallbackLink({
        label,
        url: buildPlatformShareUrl(platform, payload),
      });
    } finally {
      setIsBusy(false);
    }
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
      id: 'gmail' as const,
      label: 'Gmail',
      className: 'bg-red-600 hover:bg-red-700 text-white',
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
      title="Partager sur les réseaux et Gmail"
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
          disabled={isBusy}
          style={{ backgroundColor: 'var(--shalom-primary)' }}
          className="w-full min-h-[44px] py-2.5 px-4 rounded-xl hover:opacity-95 disabled:opacity-60 text-white font-bold flex items-center justify-center gap-2 shadow-xs transition"
        >
          <Smartphone className="w-4 h-4 shrink-0" />
          <span>
            {payload.file
              ? 'Partager via le menu du téléphone (avec média)'
              : 'Partager via les applications du téléphone'}
          </span>
        </button>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Choisir un canal de partage
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {platforms.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={isBusy}
                onClick={() =>
                  p.id === 'gmail' ? handleGmailClick() : handlePlatformClick(p.id, p.label)
                }
                className={`min-h-[44px] py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs disabled:opacity-60 ${p.className}`}
              >
                {p.id === 'whatsapp' ? (
                  <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                ) : p.id === 'gmail' ? (
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <Share2 className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>{p.label}</span>
              </button>
            ))}
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Destinataire Gmail (facultatif)
            </label>
            <input
              type="email"
              placeholder="Ex: frere.jean@gmail.com (optionnel)"
              value={gmailRecipient}
              onChange={(e) => setGmailRecipient(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {notice && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200 space-y-2.5">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{notice}</span>
            </div>
            {fallbackLink && (
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={fallbackLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  <span>{fallbackLink.label}</span>
                </a>

                {fallbackLink.secondaryUrl && fallbackLink.secondaryLabel && (
                  <a
                    href={fallbackLink.secondaryUrl}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 font-bold text-xs transition"
                  >
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span>{fallbackLink.secondaryLabel}</span>
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copier le texte</span>
            </button>

            {payload.file && (
              <button
                type="button"
                onClick={handleDownloadMedia}
                className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Télécharger média</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Fermer
          </button>
        </div>
      </div>
    </Modal>
  );
};

