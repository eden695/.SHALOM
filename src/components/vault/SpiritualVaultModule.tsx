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
  Globe,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckSquare,
  Square,
  Smartphone,
  ShoppingBag,
} from 'lucide-react';
import { useShalomDB } from '../../hooks/useShalomDB';
import { dbService, STORES } from '../../services/db';
import { useLanguage } from '../../contexts/LanguageContext';
import { useModuleSubView } from '../../contexts/NavigationContext';
import { VaultDocument } from '../../types';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { SocialShareModal } from '../common/SocialShareModal';
import { SharePayload } from '../../services/socialShare';

interface OnlineBookEntry {
  bookId: string;
  wikiLang: 'fr' | 'en';
  wikiPage: string;
  title: string;
  author: string;
  category: 'livre' | 'etude';
  description: string;
  sourceUrl: string;
  epubUrl: string;
  pdfUrl: string;
}

const ONLINE_BOOKS_CATALOG: OnlineBookEntry[] = [
  {
    bookId: 'ws_fr_psaumes',
    wikiLang: 'fr',
    wikiPage: 'Bible_Segond_1910/Livre_des_Psaumes',
    title: 'La Sainte Bible — Livre des Psaumes (Louis Segond 1910)',
    author: 'Traduction Louis Segond (Domaine public)',
    category: 'livre',
    description:
      'Texte intégral des 150 Psaumes en français (traduction Louis Segond 1910) provenant de Wikisource.',
    sourceUrl: 'https://fr.wikisource.org/wiki/Bible_Segond_1910/Livre_des_Psaumes',
    epubUrl:
      'https://ws-export.wmcloud.org/?lang=fr&format=epub&page=Bible_Segond_1910/Livre_des_Psaumes',
    pdfUrl:
      'https://ws-export.wmcloud.org/?lang=fr&format=pdf&page=Bible_Segond_1910/Livre_des_Psaumes',
  },
  {
    bookId: 'ws_fr_jean',
    wikiLang: 'fr',
    wikiPage: 'Bible_Segond_1910/Évangile_selon_Jean',
    title: 'Évangile selon Jean (Louis Segond 1910)',
    author: 'Traduction Louis Segond (Domaine public)',
    category: 'livre',
    description:
      'Texte complet de l’Évangile selon Jean (chapitres 1 à 21) récupéré en ligne sur Wikisource.',
    sourceUrl: 'https://fr.wikisource.org/wiki/Bible_Segond_1910/%C3%89vangile_selon_Jean',
    epubUrl:
      'https://ws-export.wmcloud.org/?lang=fr&format=epub&page=Bible_Segond_1910/%C3%89vangile_selon_Jean',
    pdfUrl:
      'https://ws-export.wmcloud.org/?lang=fr&format=pdf&page=Bible_Segond_1910/%C3%89vangile_selon_Jean',
  },
  {
    bookId: 'ws_fr_proverbes',
    wikiLang: 'fr',
    wikiPage: 'Bible_Segond_1910/Proverbes',
    title: 'Livre des Proverbes (Louis Segond 1910)',
    author: 'Traduction Louis Segond (Domaine public)',
    category: 'livre',
    description:
      'Texte intégral des 31 chapitres du Livre des Proverbes sur la sagesse pratique et la crainte de Dieu.',
    sourceUrl: 'https://fr.wikisource.org/wiki/Bible_Segond_1910/Proverbes',
    epubUrl:
      'https://ws-export.wmcloud.org/?lang=fr&format=epub&page=Bible_Segond_1910/Proverbes',
    pdfUrl:
      'https://ws-export.wmcloud.org/?lang=fr&format=pdf&page=Bible_Segond_1910/Proverbes',
  },
  {
    bookId: 'ws_fr_imitation',
    wikiLang: 'fr',
    wikiPage: 'Imitation_de_Jésus-Christ',
    title: 'L’Imitation de Jésus-Christ',
    author: 'Thomas à Kempis (Trad. Lamennais · Wikisource)',
    category: 'livre',
    description:
      'Classique spirituel chrétien sur la vie intérieure, l’humilité et la paix du cœur, téléchargeable chapitre par chapitre.',
    sourceUrl: 'https://fr.wikisource.org/wiki/Imitation_de_J%C3%A9sus-Christ',
    epubUrl:
      'https://ws-export.wmcloud.org/?lang=fr&format=epub&page=Imitation_de_J%C3%A9sus-Christ',
    pdfUrl:
      'https://ws-export.wmcloud.org/?lang=fr&format=pdf&page=Imitation_de_J%C3%A9sus-Christ',
  },
  {
    bookId: 'ws_fr_confessions_8',
    wikiLang: 'fr',
    wikiPage: 'Les_Confessions_(Augustin)/Livre_huitième',
    title: 'Les Confessions — Livre VIII (La Conversion)',
    author: 'Saint Augustin d’Hippone (Wikisource)',
    category: 'livre',
    description:
      'Le célèbre récit de la conversion de Saint Augustin (« Prends et lis »), issu des Œuvres complètes sur Wikisource.',
    sourceUrl: 'https://fr.wikisource.org/wiki/Les_Confessions_(Augustin)/Livre_huiti%C3%A8me',
    epubUrl:
      'https://ws-export.wmcloud.org/?lang=fr&format=epub&page=Les_Confessions_(Augustin)/Livre_huiti%C3%A8me',
    pdfUrl:
      'https://ws-export.wmcloud.org/?lang=fr&format=pdf&page=Les_Confessions_(Augustin)/Livre_huiti%C3%A8me',
  },
  {
    bookId: 'ws_fr_pensees',
    wikiLang: 'fr',
    wikiPage: 'Pensées_(Pascal)',
    title: 'Pensées sur la religion',
    author: 'Blaise Pascal (Wikisource)',
    category: 'etude',
    description:
      'Réflexions philosophiques et chrétiennes de Blaise Pascal sur la foi, la grâce et la condition humaine.',
    sourceUrl: 'https://fr.wikisource.org/wiki/Pens%C3%A9es_(Pascal)',
    epubUrl: 'https://ws-export.wmcloud.org/?lang=fr&format=epub&page=Pens%C3%A9es_(Pascal)',
    pdfUrl: 'https://ws-export.wmcloud.org/?lang=fr&format=pdf&page=Pens%C3%A9es_(Pascal)',
  },
  {
    bookId: 'ws_fr_vie_devote',
    wikiLang: 'fr',
    wikiPage: 'Introduction_à_la_vie_dévote',
    title: 'Introduction à la vie dévote',
    author: 'Saint François de Sales (Wikisource)',
    category: 'livre',
    description:
      'Guide pratique de vie chrétienne au quotidien destiné à tous ceux qui vivent dans le monde.',
    sourceUrl: 'https://fr.wikisource.org/wiki/Introduction_%C3%A0_la_vie_d%C3%A9vote',
    epubUrl:
      'https://ws-export.wmcloud.org/?lang=fr&format=epub&page=Introduction_%C3%A0_la_vie_d%C3%A9vote',
    pdfUrl:
      'https://ws-export.wmcloud.org/?lang=fr&format=pdf&page=Introduction_%C3%A0_la_vie_d%C3%A9vote',
  },
  {
    bookId: 'ws_en_presence',
    wikiLang: 'en',
    wikiPage: 'The_Practice_of_the_Presence_of_God',
    title: 'The Practice of the Presence of God',
    author: 'Brother Lawrence (Wikisource)',
    category: 'livre',
    description:
      'Classic Christian devotional letters & conversations on walking continuously in God’s presence.',
    sourceUrl: 'https://en.wikisource.org/wiki/The_Practice_of_the_Presence_of_God',
    epubUrl:
      'https://ws-export.wmcloud.org/?lang=en&format=epub&page=The_Practice_of_the_Presence_of_God',
    pdfUrl:
      'https://ws-export.wmcloud.org/?lang=en&format=pdf&page=The_Practice_of_the_Presence_of_God',
  },
  {
    bookId: 'ws_en_pilgrim',
    wikiLang: 'en',
    wikiPage: "The_Pilgrim's_Progress",
    title: "The Pilgrim's Progress",
    author: 'John Bunyan (Wikisource)',
    category: 'livre',
    description:
      'Timeless Christian allegory of the spiritual journey from the City of Destruction to the Celestial City.',
    sourceUrl: 'https://en.wikisource.org/wiki/The_Pilgrim%27s_Progress',
    epubUrl:
      'https://ws-export.wmcloud.org/?lang=en&format=epub&page=The_Pilgrim%27s_Progress',
    pdfUrl:
      'https://ws-export.wmcloud.org/?lang=en&format=pdf&page=The_Pilgrim%27s_Progress',
  },
];

function extractCleanTextFromWikisourceHtml(html: string): {
  text: string;
  subPages: string[];
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const subPages: string[] = [];
  doc.querySelectorAll('a[href^="/wiki/"]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (
      !href.includes(':') &&
      !href.includes('#') &&
      (href.includes('/Chapitre') ||
        href.includes('/Livre') ||
        href.includes('/Chapter') ||
        href.includes('/Part'))
    ) {
      const pageName = decodeURIComponent(href.replace(/^\/wiki\//, ''));
      if (!subPages.includes(pageName)) subPages.push(pageName);
    }
  });

  doc
    .querySelectorAll(
      '#headertemplate, .ws-noexport, .mw-editsection, .prp-page-qualityheader, .footertemplate, style, script'
    )
    .forEach((el) => el.remove());

  const blocks: string[] = [];
  doc.querySelectorAll('h1, h2, h3, h4, p, li, blockquote').forEach((el) => {
    const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (txt && txt.length > 1) {
      blocks.push(txt);
    }
  });

  const cleanText =
    blocks.length > 0
      ? blocks.join('\n\n')
      : (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();

  return { text: cleanText, subPages };
}

async function fetchWikisourceBookText(
  wikiLang: string,
  pageTitle: string,
  onProgress?: (msg: string) => void
): Promise<string> {
  const endpoint = `https://${wikiLang}.wikisource.org/w/api.php`;
  const fetchPage = async (title: string) => {
    const url = `${endpoint}?action=parse&page=${encodeURIComponent(
      title
    )}&prop=text&format=json&origin=*`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      parse?: { title?: string; text?: { '*': string } };
      error?: { info?: string };
    };
    if (data.error || !data.parse?.text?.['*']) {
      throw new Error(data.error?.info || 'Page introuvable sur Wikisource.');
    }
    return extractCleanTextFromWikisourceHtml(data.parse.text['*']);
  };

  onProgress?.('Connexion à Wikisource...');
  const root = await fetchPage(pageTitle);

  const prefix = pageTitle.split('/')[0];
  const relevantSubs = root.subPages
    .filter((sp) => sp.startsWith(prefix) && sp !== pageTitle)
    .slice(0, 12);

  if (root.text.length < 1800 && relevantSubs.length > 0) {
    const sections: string[] = [root.text];
    for (let i = 0; i < relevantSubs.length; i++) {
      onProgress?.(`Téléchargement chapitre ${i + 1}/${relevantSubs.length}...`);
      try {
        const sub = await fetchPage(relevantSubs[i]);
        if (sub.text.trim()) {
          sections.push(
            `\n==============================\n${relevantSubs[i].replace(/_/g, ' ')}\n==============================\n\n${sub.text}`
          );
        }
      } catch {
        // continue with remaining chapters
      }
    }
    return sections.join('\n\n');
  }

  return root.text;
}

export const SpiritualVaultModule: React.FC = () => {
  const { lang } = useLanguage();
  const { vaultDocuments, reloadData } = useShalomDB();
  const isEn = lang === 'en';

  const [subTab, setSubTab] = useModuleSubView<'vault' | 'library'>('vault', 'vault');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Play Store Books search query
  const [playStoreQuery, setPlayStoreQuery] = useState('');

  // Online book search (Wikisource)
  const [onlineSearchQuery, setOnlineSearchQuery] = useState('');
  const [onlineSearchLang, setOnlineSearchLang] = useState<'fr' | 'en'>(
    lang === 'en' ? 'en' : 'fr'
  );
  const [onlineResults, setOnlineResults] = useState<OnlineBookEntry[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);

  const [downloadingBookId, setDownloadingBookId] = useState<string | null>(null);
  const [downloadProgressMsg, setDownloadProgressMsg] = useState<string | null>(null);

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
    setSubTab('vault');
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

  const handleSearchOnlineBooks = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = onlineSearchQuery.trim();
    if (!q) {
      setOnlineResults([]);
      return;
    }
    setIsSearchingOnline(true);
    setErrorBanner(null);
    try {
      const apiUrl = `https://${onlineSearchLang}.wikisource.org/w/api.php?action=opensearch&search=${encodeURIComponent(
        q
      )}&limit=10&format=json&origin=*`;
      const res = await fetch(apiUrl);
      const data = (await res.json()) as [string, string[], string[], string[]];
      const titles = data[1] || [];
      const urls = data[3] || [];

      const entries: OnlineBookEntry[] = titles.map((title, idx) => {
        const wikiPage = title.replace(/ /g, '_');
        return {
          bookId: `ws_${onlineSearchLang}_${wikiPage}`,
          wikiLang: onlineSearchLang,
          wikiPage,
          title,
          author: `Wikisource (${onlineSearchLang.toUpperCase()})`,
          category: 'livre',
          description: isEn
            ? 'Public domain text found online on Wikisource.'
            : 'Livre / texte du domaine public trouvé en ligne sur Wikisource.',
          sourceUrl:
            urls[idx] ||
            `https://${onlineSearchLang}.wikisource.org/wiki/${encodeURIComponent(wikiPage)}`,
          epubUrl: `https://ws-export.wmcloud.org/?lang=${onlineSearchLang}&format=epub&page=${encodeURIComponent(
            wikiPage
          )}`,
          pdfUrl: `https://ws-export.wmcloud.org/?lang=${onlineSearchLang}&format=pdf&page=${encodeURIComponent(
            wikiPage
          )}`,
        };
      });
      setOnlineResults(entries);
    } catch {
      setErrorBanner(
        isEn
          ? 'Unable to search Wikisource online right now. Check your internet connection.'
          : 'Impossible de rechercher sur Wikisource pour le moment. Vérifiez votre connexion internet.'
      );
    } finally {
      setIsSearchingOnline(false);
    }
  };

  const handleDownloadOnlineBookIntoVault = async (book: OnlineBookEntry) => {
    const existing = vaultDocuments.find((d) => d.bookId === book.bookId);
    if (existing) {
      setNotice(
        isEn
          ? `« ${book.title} » is already downloaded in your Vault.`
          : `« ${book.title} » est déjà téléchargé dans votre Coffre.`
      );
      return;
    }

    setDownloadingBookId(book.bookId);
    setDownloadProgressMsg(
      isEn ? 'Downloading book from Wikisource...' : 'Téléchargement du livre depuis Wikisource...'
    );
    setErrorBanner(null);

    try {
      const bodyText = await fetchWikisourceBookText(
        book.wikiLang,
        book.wikiPage,
        (msg) => setDownloadProgressMsg(msg)
      );

      const fullContent = `${book.title}\n${book.author}\nSource en ligne : ${book.sourceUrl}\n\n========================================\n\n${bodyText}`;
      const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
      const blobKey = `vault_book_${book.bookId}_${Date.now()}`;
      await dbService.saveMediaBlob(blobKey, blob, 'text/plain;charset=utf-8');

      const doc: VaultDocument = {
        id: `vdoc_${book.bookId}_${Date.now()}`,
        title: book.title,
        category: book.category,
        author: book.author,
        description: book.description,
        fileName: `${book.title.replace(/[^a-z0-9àâéèêîôùûç_-]+/gi, '_').slice(0, 50)}.txt`,
        mimeType: 'text/plain;charset=utf-8',
        sizeBytes: blob.size,
        blobKey,
        textContent: fullContent,
        isBuiltInBook: true,
        bookId: book.bookId,
        sourceUrl: book.sourceUrl,
        epubUrl: book.epubUrl,
        createdAt: new Date().toISOString(),
      };
      await dbService.put(STORES.VAULT_DOCUMENTS, doc);

      setNotice(
        isEn
          ? `« ${book.title} » downloaded inside SHALOM! Ready to read offline, send to phone, or share.`
          : `« ${book.title} » téléchargé dans votre Coffre Spirituel ! Vous pouvez maintenant le lire hors-ligne, l’envoyer sur votre téléphone ou le partager.`
      );
      reloadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur réseau';
      setErrorBanner(
        isEn
          ? `Could not download book inside app (${msg}). Use the EPUB link directly.`
          : `Impossible de télécharger le texte dans l’application (${msg}). Utilisez le lien EPUB ci-dessous.`
      );
    } finally {
      setDownloadingBookId(null);
      setDownloadProgressMsg(null);
    }
  };

  const triggerBlobDownload = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
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

  const handleShareOnlineBook = (book: OnlineBookEntry) => {
    setSharePayload({
      title: book.title,
      text: `📖 ${book.title}\n✍️ ${book.author}\n\n🔗 Lire en ligne : ${book.sourceUrl}\n📥 Télécharger EPUB : ${book.epubUrl}\n\nPartagé depuis SHALOM`,
      url: book.sourceUrl,
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

  const displayedOnlineBooks =
    onlineResults.length > 0 ? onlineResults : ONLINE_BOOKS_CATALOG;

  const playStoreHref = playStoreQuery.trim()
    ? `https://play.google.com/store/search?q=${encodeURIComponent(playStoreQuery.trim())}&c=books`
    : 'https://play.google.com/store/books';

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
                ? 'Private books & documents stored in vault, sendable to phone or shareable'
                : 'Livres et documents stockés en sécurité, envoyables sur votre téléphone ou partageables'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => setSubTab('vault')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              subTab === 'vault'
                ? 'bg-white dark:bg-[#0f2b5c] text-blue-700 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {isEn ? `My Vault (${vaultDocuments.length})` : `Mon Coffre (${vaultDocuments.length})`}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('library')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 ${
              subTab === 'library'
                ? 'bg-white dark:bg-[#0f2b5c] text-blue-700 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{isEn ? 'Books Online & Play Store' : 'Livres en ligne'}</span>
          </button>
        </div>
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

      {/* TAB 1: MON COFFRE PERSONNEL */}
      {subTab === 'vault' && (
        <div className="space-y-4">
          {vaultDocuments.length === 0 ? (
            <div className="py-12 px-6 text-center rounded-3xl bg-white dark:bg-[#0c1631] border border-dashed border-slate-300 dark:border-slate-800 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 flex items-center justify-center mx-auto">
                <Vault className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {isEn ? 'Your Spiritual Vault is Empty' : 'Votre Coffre Spirituel est vide'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isEn
                    ? 'Find books online or on Google Play Store and store them securely here, then send to your phone anytime.'
                    : 'Téléchargez un livre sur Play Store ou en ligne pour le stocker ici et l’envoyer sur votre téléphone à tout moment.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSubTab('library')}
                className="px-5 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-sm"
              >
                <BookOpen className="w-4 h-4" />
                <span>
                  {isEn ? 'Find & Download Books Online' : 'Trouver des livres en ligne'}
                </span>
              </button>
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

              <div className="flex flex-wrap gap-1.5">
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
                    className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition ${
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
                              {doc.sourceUrl ? (isEn ? ' · Online Book' : ' · Livre téléchargé') : ''}
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
      )}

      {/* TAB 2: LIVRES EN LIGNE (GOOGLE PLAY STORE + WIKISOURCE RÉEL) */}
      {subTab === 'library' && (
        <div className="space-y-5">
          {/* Google Play Store Books Direct Card */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-[#0b1f42] via-[#132d5e] to-[#1a3c7c] text-white border border-blue-900/60 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
                  <ShoppingBag className="w-4 h-4" />
                  <span>Google Play Store Livres</span>
                </div>
                <h3 className="text-base sm:text-lg font-extrabold font-display">
                  {isEn
                    ? 'Open Play Store Books & Store Downloaded Books in Vault'
                    : 'Ouvrir Play Store Livres & importer vos livres téléchargés'}
                </h3>
                <p className="text-xs text-blue-100 leading-relaxed max-w-2xl">
                  {isEn
                    ? 'Browse Google Play Books, download your book, then import it directly into your SHALOM Vault — or send any Vault book back to your phone.'
                    : 'Accédez directement aux livres sur Google Play Store, téléchargez votre livre puis importez le fichier dans votre Coffre SHALOM pour le lire, l’envoyer sur votre téléphone ou le partager.'}
                </p>
              </div>

              <a
                href="https://play.google.com/store/books"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shrink-0 self-start sm:self-auto transition"
              >
                <ExternalLink className="w-4 h-4" />
                <span>{isEn ? 'Open Play Store' : 'Ouvrir Play Store Livres'}</span>
              </a>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 text-xs">
              <input
                type="text"
                value={playStoreQuery}
                onChange={(e) => setPlayStoreQuery(e.target.value)}
                placeholder={
                  isEn
                    ? 'Search book title on Play Store (e.g. Bible, Prayer, Joyce Meyer...)'
                    : 'Chercher un titre sur Play Store (ex: Bible, Prière, Foi...)'
                }
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-blue-200/70"
              />
              <a
                href={playStoreHref}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-white text-[#0b1f42] hover:bg-blue-50 font-bold flex items-center justify-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{isEn ? 'Search Play Store' : 'Rechercher sur Play Store'}</span>
              </a>
              <label className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>
                  {isEn ? 'Add downloaded book to Vault' : 'Importer livre téléchargé → Coffre'}
                </span>
                <input
                  type="file"
                  multiple
                  accept=".epub,.pdf,.txt,.md,.doc,.docx"
                  onChange={handleImportFiles}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Direct In-App Wikisource Search */}
          <form
            onSubmit={handleSearchOnlineBooks}
            className="p-4 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row gap-2.5 text-xs"
          >
            <select
              value={onlineSearchLang}
              onChange={(e) => setOnlineSearchLang(e.target.value as 'fr' | 'en')}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold"
            >
              <option value="fr">Wikisource FR</option>
              <option value="en">Wikisource EN</option>
            </select>
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={onlineSearchQuery}
                onChange={(e) => setOnlineSearchQuery(e.target.value)}
                placeholder={
                  isEn
                    ? 'Search direct downloadable books inside SHALOM...'
                    : 'Rechercher un livre directement téléchargeable dans votre coffre (Psaumes, Augustin...)'
                }
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
            </div>
            <button
              type="submit"
              disabled={isSearchingOnline}
              className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold flex items-center justify-center gap-1.5"
            >
              {isSearchingOnline ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>{isEn ? 'Search' : 'Rechercher'}</span>
            </button>
            {onlineResults.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setOnlineResults([]);
                  setOnlineSearchQuery('');
                }}
                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold"
              >
                {isEn ? 'Catalog' : 'Catalogue'}
              </button>
            )}
          </form>

          {downloadProgressMsg && (
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>{downloadProgressMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedOnlineBooks.map((book) => {
              const vaultCopy = vaultDocuments.find((d) => d.bookId === book.bookId);
              const isBusy = downloadingBookId === book.bookId;

              return (
                <div
                  key={book.bookId}
                  className="p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-3 flex flex-col justify-between shadow-xs"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        Wikisource ({book.wikiLang.toUpperCase()}) · {book.category}
                      </span>
                      <a
                        href={book.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <span>{isEn ? 'Original link' : 'Lien source'}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-start gap-2">
                      <BookOpen className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
                      <span>{book.title}</span>
                    </h3>
                    <p className="text-xs font-medium text-slate-500">{book.author}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {book.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleDownloadOnlineBookIntoVault(book)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                        vaultCopy
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
                          : 'bg-blue-700 hover:bg-blue-800 text-white'
                      }`}
                    >
                      {isBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : vaultCopy ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isBusy
                          ? isEn
                            ? 'Downloading...'
                            : 'Téléchargement...'
                          : vaultCopy
                            ? isEn
                              ? 'In My Vault'
                              : 'Dans mon coffre'
                            : isEn
                              ? 'Download to Vault'
                              : 'Ajouter à mon coffre'}
                      </span>
                    </button>

                    {vaultCopy ? (
                      <button
                        type="button"
                        onClick={() => handleSaveDocToPhone(vaultCopy)}
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>{isEn ? 'Send to Phone' : 'Envoyer sur téléphone'}</span>
                      </button>
                    ) : (
                      <a
                        href={book.epubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{isEn ? 'EPUB to Phone' : 'Téléphone (EPUB)'}</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => handleShareOnlineBook(book)}
                      className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Share' : 'Partager'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              <iframe
                src={viewingBlobUrl}
                title={viewingDoc.title}
                className="w-full h-[60vh] rounded-xl border border-slate-200 dark:border-slate-800"
              />
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
