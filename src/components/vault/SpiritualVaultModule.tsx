import React, { useState, useMemo, useEffect } from 'react';
import {
  Vault,
  BookOpen,
  Upload,
  Download,
  FileText,
  Plus,
  Trash2,
  Eye,
  CheckCircle2,
  Search,
  Lock,
  Share2,
  ExternalLink,
  AlertCircle,
  CheckSquare,
  Square,
  Smartphone,
} from 'lucide-react';
import { useShalomDB } from '../../hooks/useShalomDB';
import { dbService, STORES } from '../../services/db';
import { useLanguage } from '../../contexts/LanguageContext';
import { VaultDocument } from '../../types';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { SocialShareModal } from '../common/SocialShareModal';
import { SharePayload } from '../../services/socialShare';
import { downloadBlobSafe } from '../../utils/download';

export const SpiritualVaultModule: React.FC = () => {
  const { lang } = useLanguage();
  const { vaultDocuments, reloadData } = useShalomDB();
  const isEn = lang === 'en';

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteCategory, setNoteCategory] = useState<VaultDocument['category']>('note');
  const [noteAuthor, setNoteAuthor] = useState('');
  const [noteContent, setNoteContent] = useState('');

  const [viewingDoc, setViewingDoc] = useState<VaultDocument | null>(null);
  const [viewingBlobUrl, setViewingBlobUrl] = useState<string | null>(null);
  const [viewingText, setViewingText] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [confirmDeleteDocs, setConfirmDeleteDocs] = useState<VaultDocument[] | null>(null);
  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);

  const onlineBooksHref = isEn
    ? 'https://books.google.com/?hl=en'
    : 'https://books.google.com/?hl=fr';

  useEffect(() => {
    let activeUrl: string | null = null;
    if (!viewingDoc) {
      setViewingBlobUrl(null);
      setViewingText(null);
      return;
    }

    if (viewingDoc.textContent) {
      setViewingText(viewingDoc.textContent);
      setViewingBlobUrl(null);
      return;
    }

    if (viewingDoc.blobKey) {
      dbService.getMediaBlob(viewingDoc.blobKey).then(async (blob) => {
        if (!blob) return;
        if (
          viewingDoc.mimeType.startsWith('text/') ||
          viewingDoc.fileName.endsWith('.txt') ||
          viewingDoc.fileName.endsWith('.md')
        ) {
          const txt = await blob.text();
          setViewingText(txt);
        } else {
          activeUrl = URL.createObjectURL(blob);
          setViewingBlobUrl(activeUrl);
        }
      });
    }

    return () => {
      if (activeUrl) URL.revokeObjectURL(activeUrl);
    };
  }, [viewingDoc]);

  const handleImportFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let added = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const blobKey = `vault_blob_${Date.now()}_${i}`;
      await dbService.saveMediaBlob(blobKey, file, file.type || 'application/octet-stream');

      const doc: VaultDocument = {
        id: `vdoc_${Date.now()}_${i}`,
        title: file.name.replace(/\.[^.]+$/, ''),
        category:
          file.type.includes('pdf') || file.name.endsWith('.epub') ? 'livre' : 'autre',
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        blobKey,
        createdAt: new Date().toISOString(),
      };
      await dbService.put(STORES.VAULT_DOCUMENTS, doc);
      added++;
    }

    e.target.value = '';
    setNotice(
      isEn
        ? `${added} book/file(s) stored in your Spiritual Vault.`
        : `${added} livre(s) / fichier(s) enregistré(s) dans votre Coffre Spirituel.`
    );
    reloadData();
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) return;
    const bytes = new TextEncoder().encode(noteContent).length;
    const doc: VaultDocument = {
      id: `vdoc_${Date.now()}`,
      title: noteTitle.trim(),
      category: noteCategory,
      author: noteAuthor.trim() || undefined,
      fileName: `${noteTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}.txt`,
      mimeType: 'text/plain;charset=utf-8',
      sizeBytes: bytes,
      textContent: noteContent,
      createdAt: new Date().toISOString(),
    };
    await dbService.put(STORES.VAULT_DOCUMENTS, doc);
    setNoteTitle('');
    setNoteAuthor('');
    setNoteContent('');
    setIsNoteModalOpen(false);
    setNotice(
      isEn ? 'Private spiritual note saved in vault.' : 'Document enregistré dans votre Coffre Spirituel.'
    );
    reloadData();
  };

  const triggerBlobDownload = (blob: Blob, fileName: string) => {
    void downloadBlobSafe(blob, fileName);
  };

  const handleSaveDocToPhone = async (doc: VaultDocument) => {
    if (doc.blobKey) {
      const blob = await dbService.getMediaBlob(doc.blobKey);
      if (blob) {
        triggerBlobDownload(blob, doc.fileName);
        setNotice(
          isEn
            ? `Sent « ${doc.title} » to your phone Downloads.`
            : `« ${doc.title} » envoyé sur votre téléphone (Téléchargements).`
        );
        return;
      }
    }
    if (doc.textContent) {
      const blob = new Blob([doc.textContent], { type: 'text/plain;charset=utf-8' });
      const fileName = doc.fileName.endsWith('.txt') ? doc.fileName : `${doc.fileName}.txt`;
      triggerBlobDownload(blob, fileName);
      setNotice(
        isEn
          ? `Sent « ${doc.title} » to your phone.`
          : `« ${doc.title} » envoyé sur votre téléphone.`
      );
    }
  };

  const handleBulkSaveToPhone = async () => {
    const targets = vaultDocuments.filter((d) => selectedDocIds.includes(d.id));
    for (const doc of targets) {
      await handleSaveDocToPhone(doc);
    }
  };

  const handleShareVaultDoc = async (doc: VaultDocument) => {
    let file: File | undefined;
    if (doc.blobKey) {
      const blob = await dbService.getMediaBlob(doc.blobKey);
      if (blob) {
        file = new File([blob], doc.fileName, { type: doc.mimeType || 'text/plain' });
      }
    } else if (doc.textContent) {
      const blob = new Blob([doc.textContent], { type: 'text/plain;charset=utf-8' });
      file = new File([blob], doc.fileName, { type: 'text/plain' });
    }

    const lines = [
      `📖 ${doc.title}`,
      doc.author ? `✍️ ${doc.author}` : '',
      doc.sourceUrl ? `🔗 Lien du livre : ${doc.sourceUrl}` : '',
      doc.epubUrl ? `📥 Télécharger EPUB : ${doc.epubUrl}` : '',
      '',
      'Partagé depuis Mon Coffre Spirituel · SHALOM',
    ].filter(Boolean);

    setSharePayload({
      title: doc.title,
      text: lines.join('\n'),
      url: doc.sourceUrl,
      file,
    });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteDocs || confirmDeleteDocs.length === 0) return;
    const blobKeys = confirmDeleteDocs
      .map((d) => d.blobKey)
      .filter((k): k is string => !!k);
    const ids = confirmDeleteDocs.map((d) => d.id);
    if (blobKeys.length > 0) {
      await dbService.deleteItems(STORES.MEDIA_BLOBS, blobKeys);
    }
    await dbService.deleteItems(STORES.VAULT_DOCUMENTS, ids);
    setSelectedDocIds((prev) => prev.filter((id) => !ids.includes(id)));
    setConfirmDeleteDocs(null);
    reloadData();
  };

  const filteredVaultDocs = useMemo(() => {
    return vaultDocuments.filter((doc) => {
      const matchesCat = categoryFilter === 'all' || doc.category === categoryFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        doc.title.toLowerCase().includes(q) ||
        (doc.author || '').toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [vaultDocuments, categoryFilter, searchQuery]);

  const toggleSelectDoc = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAllDocs = () => {
    const visibleIds = filteredVaultDocs.map((d) => d.id);
    const allSel = visibleIds.length > 0 && visibleIds.every((id) => selectedDocIds.includes(id));
    setSelectedDocIds(allSel ? [] : visibleIds);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 font-display">
            <Vault className="w-6 h-6 text-blue-700 dark:text-blue-400" />
            <span>{isEn ? 'My Spiritual Vault' : 'Mon Coffre Spirituel'}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            <span>
              {isEn
                ? `Private books & documents stored in vault (${vaultDocuments.length})`
                : `Livres et documents stockés en sécurité (${vaultDocuments.length}) — envoyables ou partageables`}
            </span>
          </p>
        </div>

        <a
          href={onlineBooksHref}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-xs transition self-start sm:self-auto shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>{isEn ? 'Download Books Online' : 'Télécharger des livres en ligne'}</span>
          <ExternalLink className="w-3.5 h-3.5 opacity-75" />
        </a>
      </div>

      {notice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </span>
          <button type="button" onClick={() => setNotice(null)} className="text-[11px] underline">
            OK
          </button>
        </div>
      )}

      {errorBanner && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs font-semibold text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorBanner}</span>
          </span>
          <button type="button" onClick={() => setErrorBanner(null)} className="text-[11px] underline">
            OK
          </button>
        </div>
      )}

      <div className="space-y-4">
        {vaultDocuments.length === 0 ? (
          <div className="py-12 px-6 text-center rounded-3xl bg-white dark:bg-[#0c1631] border border-dashed border-slate-300 dark:border-slate-800 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 flex items-center justify-center mx-auto">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isEn ? 'Your Spiritual Vault is Empty' : 'Votre Coffre Spirituel est vide'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEn
                  ? 'Import a book or file from your phone, create a private note, or download books online.'
                  : 'Importez un livre ou document depuis votre téléphone, écrivez une note privée ou téléchargez des livres en ligne.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <label className="px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 cursor-pointer shadow-sm transition">
                <Upload className="w-4 h-4" />
                <span>{isEn ? 'Import Book / File' : 'Importer un livre / fichier'}</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.txt,.md,.doc,.docx,.epub,image/*,audio/*,video/*"
                  onChange={handleImportFiles}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => setIsNoteModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>{isEn ? 'Write a Note' : 'Écrire une note'}</span>
              </button>

              <a
                href={onlineBooksHref}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 shadow-sm transition"
              >
                <Download className="w-4 h-4" />
                <span>{isEn ? 'Download Books Online' : 'Télécharger des livres en ligne'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-3 justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isEn ? 'Search my vault...' : 'Rechercher dans mon coffre...'}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-[#0c1631] border border-slate-200 dark:border-slate-800"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <label className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition">
                  <Upload className="w-4 h-4" />
                  <span>{isEn ? 'Import File' : 'Importer un livre / fichier'}</span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.txt,.md,.doc,.docx,.epub,image/*,audio/*,video/*"
                    onChange={handleImportFiles}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setIsNoteModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isEn ? 'New Note' : 'Écrire'}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 max-w-full overflow-x-auto no-scrollbar pb-0.5">
              {[
                { id: 'all', label: isEn ? 'All' : 'Tous' },
                { id: 'livre', label: isEn ? 'Books' : 'Livres' },
                { id: 'etude', label: isEn ? 'Bible Studies' : 'Études' },
                { id: 'note', label: isEn ? 'Personal Notes' : 'Notes' },
                { id: 'certificat', label: isEn ? 'Certificates' : 'Certificats' },
                { id: 'autre', label: isEn ? 'Other' : 'Autres' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition whitespace-nowrap shrink-0 ${
                    categoryFilter === cat.id
                      ? 'bg-[#0b1f42] text-white dark:bg-blue-700'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Multi-selection bar */}
            {filteredVaultDocs.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <button
                  type="button"
                  onClick={toggleAllDocs}
                  className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 hover:text-blue-700"
                >
                  {filteredVaultDocs.every((d) => selectedDocIds.includes(d.id)) ? (
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Tout sélectionner ({selectedDocIds.length})</span>
                </button>

                {selectedDocIds.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleBulkSaveToPhone}
                      className="px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Envoyer sur téléphone ({selectedDocIds.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmDeleteDocs(
                          vaultDocuments.filter((d) => selectedDocIds.includes(d.id))
                        )
                      }
                      className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer ({selectedDocIds.length})</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredVaultDocs.map((doc) => {
                const isSel = selectedDocIds.includes(doc.id);
                return (
                  <div
                    key={doc.id}
                    className={`p-4 rounded-2xl bg-white dark:bg-[#0c1631] border space-y-2.5 flex flex-col justify-between transition ${
                      isSel
                        ? 'border-blue-600 ring-2 ring-blue-600/20'
                        : 'border-slate-200/80 dark:border-slate-800/80'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleSelectDoc(doc.id)}
                            aria-label="Sélectionner ce document"
                            className="text-slate-400 hover:text-blue-600"
                          >
                            {isSel ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                          <span className="font-bold text-blue-700 dark:text-blue-400 uppercase">
                            {doc.category}
                          </span>
                        </div>
                        <span className="tabular-nums">{formatSize(doc.sizeBytes)}</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="truncate">{doc.title}</span>
                      </h4>
                      {doc.author && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">{doc.author}</p>
                      )}
                      {doc.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                          {doc.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <span className="text-[11px] text-slate-400 tabular-nums">
                        {doc.createdAt.split('T')[0]}
                      </span>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingDoc(doc)}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isEn ? 'Read' : 'Lire'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveDocToPhone(doc)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1"
                          title={isEn ? 'Send to phone' : 'Envoyer sur mon téléphone'}
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>{isEn ? 'To Phone' : 'Téléphone'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShareVaultDoc(doc)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1"
                          title={isEn ? 'Share' : 'Partager'}
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteDocs([doc])}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal Write Private Document */}
      <Modal
        isOpen={isNoteModalOpen}
        onClose={() => setIsNoteModalOpen(false)}
        title={isEn ? 'Create Private Spiritual Document' : 'Créer un document spirituel privé'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveNote} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">{isEn ? 'Title *' : 'Titre *'}</label>
              <input
                type="text"
                required
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">{isEn ? 'Category' : 'Catégorie'}</label>
              <select
                value={noteCategory}
                onChange={(e) => setNoteCategory(e.target.value as VaultDocument['category'])}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <option value="note">{isEn ? 'Personal Note' : 'Note spirituelle'}</option>
                <option value="etude">{isEn ? 'Bible Study' : 'Étude biblique'}</option>
                <option value="livre">{isEn ? 'Book / Treatise' : 'Livre / Texte'}</option>
                <option value="certificat">{isEn ? 'Certificate / Testimony' : 'Certificat / Acte'}</option>
                <option value="autre">{isEn ? 'Other' : 'Autre'}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">
              {isEn ? 'Author / Source (optional)' : 'Auteur / Source'}
            </label>
            <input
              type="text"
              value={noteAuthor}
              onChange={(e) => setNoteAuthor(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">{isEn ? 'Content *' : 'Contenu *'}</label>
            <textarea
              rows={8}
              required
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 leading-relaxed"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsNoteModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-500 font-semibold"
            >
              {isEn ? 'Cancel' : 'Annuler'}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold"
            >
              {isEn ? 'Save to Vault' : 'Enregistrer dans le coffre'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Document / Book Reader */}
      <Modal
        isOpen={!!viewingDoc}
        onClose={() => setViewingDoc(null)}
        title={viewingDoc?.title || ''}
        subtitle={viewingDoc?.author || viewingDoc?.fileName}
        maxWidth="xl"
      >
        {viewingDoc && (
          <div className="space-y-4">
            {viewingDoc.sourceUrl && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <a
                  href={viewingDoc.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{viewingDoc.sourceUrl}</span>
                </a>
                {viewingDoc.epubUrl && (
                  <a
                    href={viewingDoc.epubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold"
                  >
                    EPUB
                  </a>
                )}
              </div>
            )}

            {viewingText && (
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/40 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 max-h-[60vh] overflow-y-auto text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-serif text-slate-800 dark:text-slate-100">
                {viewingText}
              </div>
            )}

            {viewingBlobUrl && viewingDoc.mimeType.startsWith('image/') && (
              <img
                src={viewingBlobUrl}
                alt={viewingDoc.title}
                className="max-h-[60vh] mx-auto rounded-xl object-contain"
              />
            )}

            {viewingBlobUrl && viewingDoc.mimeType.includes('pdf') && (
              <div className="space-y-3">
                <div className="md:hidden p-5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
                  <FileText className="w-10 h-10 text-blue-700 dark:text-blue-400 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {viewingDoc.fileName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {isEn
                        ? 'Android mobile WebView opens PDF files with your device reader. Tap below to save and open it on your phone.'
                        : 'Sur téléphone Android / APK, enregistrez le PDF sur votre appareil pour l’ouvrir avec votre lecteur PDF habituel.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSaveDocToPhone(viewingDoc)}
                    className="px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isEn ? 'Save & Open PDF' : 'Enregistrer / Ouvrir le PDF'}</span>
                  </button>
                </div>
                <iframe
                  src={viewingBlobUrl}
                  title={viewingDoc.title}
                  className="hidden md:block w-full h-[60vh] rounded-xl border border-slate-200 dark:border-slate-800"
                />
              </div>
            )}

            {viewingBlobUrl && viewingDoc.mimeType.startsWith('audio/') && (
              <audio src={viewingBlobUrl} controls className="w-full" />
            )}

            {viewingBlobUrl && viewingDoc.mimeType.startsWith('video/') && (
              <video
                src={viewingBlobUrl}
                controls
                playsInline
                className="w-full max-h-[55vh] rounded-xl"
              />
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => handleShareVaultDoc(viewingDoc)}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{isEn ? 'Share Book' : 'Partager'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSaveDocToPhone(viewingDoc)}
                className="px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>{isEn ? 'Send to Phone' : 'Envoyer sur mon téléphone'}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewingDoc(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold"
              >
                {isEn ? 'Close' : 'Fermer'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmDeleteDocs && confirmDeleteDocs.length > 0}
        title={isEn ? 'Remove from Spiritual Vault?' : 'Supprimer du Coffre Spirituel ?'}
        message={
          confirmDeleteDocs && confirmDeleteDocs.length === 1
            ? `${isEn ? 'Delete' : 'Supprimer'} « ${confirmDeleteDocs[0].title} » ?`
            : `${isEn ? 'Delete' : 'Supprimer'} ${confirmDeleteDocs?.length || 0} document(s) sélectionné(s) ?`
        }
        confirmLabel={isEn ? 'Delete' : 'Supprimer'}
        cancelLabel={isEn ? 'Cancel' : 'Annuler'}
        isDestructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteDocs(null)}
      />

      <SocialShareModal
        isOpen={!!sharePayload}
        onClose={() => setSharePayload(null)}
        payload={sharePayload}
      />
    </div>
  );
};
