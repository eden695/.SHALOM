import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Trash2,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  FileText,
  FolderOpen,
  CheckCircle2,
} from 'lucide-react';
import { dbService, STORES, StoreName } from '../../services/db';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { formatAppDate } from '../../services/preferences';

interface ExplorerCategory {
  store: StoreName;
  label: string;
}

const EXPLORER_CATEGORIES: ExplorerCategory[] = [
  { store: STORES.PRAYERS, label: 'Prières' },
  { store: STORES.TESTIMONIES, label: 'Témoignages' },
  { store: STORES.WEEKLY_ALTAR, label: 'Autel hebdomadaire' },
  { store: STORES.LIFE_GOALS, label: 'Objectifs de transformation' },
  { store: STORES.INTERCESSION_PEOPLE, label: 'Personnes d’intercession' },
  { store: STORES.COMMITMENTS, label: 'Engagements spirituels' },
  { store: STORES.HABIT_LOGS, label: 'Suivi de croissance' },
  { store: STORES.PERSONAL_PROGRAMS, label: 'Programmes personnels' },
  { store: STORES.RECORDINGS, label: 'Enregistrements Parole Divine' },
  { store: STORES.VAULT_DOCUMENTS, label: 'Coffre Spirituel' },
  { store: STORES.CALENDAR_ACTIVITIES, label: 'Calendrier' },
  { store: STORES.CONTACTS, label: 'Contacts' },
  { store: STORES.SHARE_HISTORY, label: 'Historique de partage' },
];

interface StoredRecord {
  id: string;
  title?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  dayName?: string;
  contactName?: string;
  date?: string;
  createdAt?: string;
  timestamp?: string;
  updatedAt?: string;
  mediaBlobKey?: string;
  blobKey?: string;
  thumbnailBlobKey?: string;
}

interface DataExplorerCardProps {
  onDataChanged: () => void;
}

export const DataExplorerCard: React.FC<DataExplorerCardProps> = ({ onDataChanged }) => {
  const [recordsByStore, setRecordsByStore] = useState<Record<string, StoredRecord[]>>({});
  const [mediaBlobCount, setMediaBlobCount] = useState(0);
  const [expandedStore, setExpandedStore] = useState<StoreName | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{
    store: StoreName;
    record: StoredRecord;
    label: string;
  } | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadAllCounts = useCallback(async () => {
    setLoading(true);
    try {
      const entries = await Promise.all(
        EXPLORER_CATEGORIES.map(async (cat) => {
          const items = await dbService.getAll<StoredRecord>(cat.store).catch(() => []);
          return [cat.store, items] as const;
        })
      );
      const map: Record<string, StoredRecord[]> = {};
      entries.forEach(([store, items]) => {
        map[store] = items;
      });
      setRecordsByStore(map);
      const blobs = await dbService.getAll<StoredRecord>(STORES.MEDIA_BLOBS).catch(() => []);
      setMediaBlobCount(blobs.length);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllCounts();
  }, [loadAllCounts]);

  const getRecordTitle = (item: StoredRecord) => {
    if (item.title && item.title.trim()) return item.title;
    if (item.firstName || item.lastName) {
      return `${item.firstName || ''} ${item.lastName || ''}`.trim();
    }
    if (item.name && item.name.trim()) return item.name;
    if (item.dayName && item.dayName.trim()) return item.dayName;
    if (item.contactName && item.contactName.trim()) return item.contactName;
    return item.id;
  };

  const getRecordDate = (item: StoredRecord) => {
    const raw = item.updatedAt || item.createdAt || item.timestamp || item.date;
    return raw ? formatAppDate(raw) : '';
  };

  const handleConfirmDeleteRecord = async () => {
    if (!pendingDelete) return;
    const { store, record, label } = pendingDelete;

    // Clean any associated media blobs safely
    const blobKeysToDelete = [
      record.mediaBlobKey,
      record.blobKey,
      record.thumbnailBlobKey,
    ].filter((k): k is string => Boolean(k));

    if (blobKeysToDelete.length > 0) {
      await dbService.deleteItems(STORES.MEDIA_BLOBS, blobKeysToDelete).catch(() => {});
    }

    await dbService.deleteItem(store, record.id);
    setPendingDelete(null);
    setActionNotice(`Élément supprimé dans « ${label} ».`);
    await loadAllCounts();
    onDataChanged();
  };

  const totalItems = EXPLORER_CATEGORIES.reduce(
    (sum, cat) => sum + (recordsByStore[cat.store]?.length || 0),
    0
  );

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
            <Database className="w-4 h-4" />
            <span>Explorateur des données enregistrées</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Consultez le contenu exact stocké sur cet appareil ({totalItems} enregistrement(s), {mediaBlobCount} fichier(s) média).
          </p>
        </div>

        <button
          type="button"
          onClick={loadAllCounts}
          disabled={loading}
          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 min-h-[38px]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {actionNotice && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      <div className="divide-y divide-slate-100 dark:divide-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden">
        {EXPLORER_CATEGORIES.map((cat) => {
          const items = recordsByStore[cat.store] || [];
          const isExpanded = expandedStore === cat.store;

          return (
            <div key={cat.store} className="bg-slate-50/40 dark:bg-slate-900/30">
              <button
                type="button"
                onClick={() => setExpandedStore(isExpanded ? null : cat.store)}
                className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition min-h-[44px]"
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-blue-600 shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <FolderOpen className="w-4 h-4 text-slate-500 shrink-0" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {cat.label}
                  </span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tabular-nums bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shrink-0">
                  {items.length}
                </span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 pt-1 bg-white dark:bg-[#0c1631] border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 max-h-64 overflow-y-auto overscroll-contain">
                  {items.length === 0 ? (
                    <p className="text-[11px] text-slate-500 py-2">
                      Aucun élément enregistré dans cette catégorie.
                    </p>
                  ) : (
                    items.map((item) => {
                      const title = getRecordTitle(item);
                      const dateStr = getRecordDate(item);
                      return (
                        <div
                          key={item.id}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
                                {title}
                              </span>
                              {dateStr && (
                                <span className="text-[10px] text-slate-500 tabular-nums">
                                  {dateStr}
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setPendingDelete({
                                store: cat.store,
                                record: item,
                                label: cat.label,
                              })
                            }
                            aria-label={`Supprimer ${title}`}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 shrink-0 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        isOpen={!!pendingDelete}
        title="Supprimer cet enregistrement ?"
        message={
          pendingDelete
            ? `Vous allez supprimer « ${getRecordTitle(pendingDelete.record)} » (${pendingDelete.label}) de la mémoire locale.`
            : ''
        }
        confirmLabel="Oui, supprimer"
        isDestructive
        onConfirm={handleConfirmDeleteRecord}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};
