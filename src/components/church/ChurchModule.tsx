import React, { useMemo, useState } from 'react';
import {
  Church,
  Plus,
  Bell,
  BellOff,
  Clock,
  Calendar as CalendarIcon,
  MapPin,
  Edit2,
  Trash2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { dbService, STORES } from '../../services/db';
import { useShalomDB } from '../../hooks/useShalomDB';
import { ChurchProgram } from '../../types';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import {
  MediaPickerBox,
  StoredMediaViewer,
  persistOptionalMedia,
} from '../common/MediaAttachment';
import {
  buildChurchReminderPayload,
  dispatchReminderNotification,
  getLocalTodayStr,
  requestReminderNotificationPermission,
} from '../../services/notifications';
import { formatAppDate } from '../../services/preferences';

const DAYS_OF_WEEK: Array<{ value: number; label: string; short: string }> = [
  { value: 0, label: 'Dimanche', short: 'Dim' },
  { value: 1, label: 'Lundi', short: 'Lun' },
  { value: 2, label: 'Mardi', short: 'Mar' },
  { value: 3, label: 'Mercredi', short: 'Mer' },
  { value: 4, label: 'Jeudi', short: 'Jeu' },
  { value: 5, label: 'Vendredi', short: 'Ven' },
  { value: 6, label: 'Samedi', short: 'Sam' },
];

export const ChurchModule: React.FC = () => {
  const { churchPrograms, reloadData } = useShalomDB();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<ChurchProgram | null>(null);
  const [deletingProgram, setDeletingProgram] = useState<ChurchProgram | null>(null);
  const [pendingMedia, setPendingMedia] = useState<File | null>(null);
  const [removedExistingMedia, setRemovedExistingMedia] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState<{
    title: string;
    scheduleType: 'weekly' | 'event';
    dayOfWeek: number;
    date: string;
    time: string;
    location: string;
    description: string;
    reminderEnabled: boolean;
  }>({
    title: '',
    scheduleType: 'weekly',
    dayOfWeek: 0,
    date: getLocalTodayStr(),
    time: '09:00',
    location: '',
    description: '',
    reminderEnabled: true,
  });

  const weeklyWorshipPrograms = useMemo(
    () =>
      churchPrograms
        .filter((p) => p.scheduleType === 'weekly')
        .sort(
          (a, b) =>
            (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0) || a.time.localeCompare(b.time)
        ),
    [churchPrograms]
  );

  const datedActivities = useMemo(
    () =>
      churchPrograms
        .filter((p) => p.scheduleType === 'event')
        .sort(
          (a, b) =>
            (a.date || '').localeCompare(b.date || '') || a.time.localeCompare(b.time)
        ),
    [churchPrograms]
  );

  const openAddModal = (defaultType: 'weekly' | 'event' = 'weekly') => {
    setEditingProgram(null);
    setPendingMedia(null);
    setRemovedExistingMedia(false);
    setForm({
      title: '',
      scheduleType: defaultType,
      dayOfWeek: 0,
      date: getLocalTodayStr(),
      time: defaultType === 'weekly' ? '09:00' : '18:00',
      location: '',
      description: '',
      reminderEnabled: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (program: ChurchProgram) => {
    setEditingProgram(program);
    setPendingMedia(null);
    setRemovedExistingMedia(false);
    setForm({
      title: program.title,
      scheduleType: program.scheduleType,
      dayOfWeek: program.dayOfWeek ?? 0,
      date: program.date || getLocalTodayStr(),
      time: program.time || '09:00',
      location: program.location || '',
      description: program.description || '',
      reminderEnabled: program.reminderEnabled !== false,
    });
    setIsModalOpen(true);
  };

  const handleSaveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.time) return;
    if (form.scheduleType === 'event' && !form.date) return;

    const now = new Date().toISOString();
    const mediaMeta = await persistOptionalMedia({
      prefix: 'church',
      pendingFile: pendingMedia,
      removedExisting: removedExistingMedia,
      existingBlobKey: editingProgram?.mediaBlobKey,
      existingMediaType: editingProgram?.mediaType,
      existingMimeType: editingProgram?.mediaMimeType,
    });

    const item: ChurchProgram = {
      id: editingProgram ? editingProgram.id : `church_${Date.now()}`,
      title: form.title.trim(),
      scheduleType: form.scheduleType,
      dayOfWeek: form.scheduleType === 'weekly' ? form.dayOfWeek : undefined,
      date: form.scheduleType === 'event' ? form.date : undefined,
      time: form.time,
      location: form.location.trim() || undefined,
      description: form.description.trim() || undefined,
      reminderEnabled: true, // Always automatically enables reminders on add/save
      createdAt: editingProgram ? editingProgram.createdAt : now,
      updatedAt: now,
      ...mediaMeta,
    };

    await dbService.put(STORES.CHURCH_PROGRAMS, item);
    requestReminderNotificationPermission().catch(() => {});
    setPendingMedia(null);
    setRemovedExistingMedia(false);
    setIsModalOpen(false);
    setNotice(
      form.scheduleType === 'weekly'
        ? `Culte « ${item.title} » enregistré avec rappels automatiques (Matin, Midi et 1h avant).`
        : `Activité « ${item.title} » enregistrée avec rappel automatique pour le ${formatAppDate(item.date || '')} à ${item.time}.`
    );
    await reloadData();
  };

  const handleToggleReminder = async (program: ChurchProgram) => {
    const updated: ChurchProgram = {
      ...program,
      reminderEnabled: program.reminderEnabled === false,
      updatedAt: new Date().toISOString(),
    };
    await dbService.put(STORES.CHURCH_PROGRAMS, updated);
    await reloadData();
  };

  const handleConfirmDelete = async () => {
    if (!deletingProgram) return;
    if (deletingProgram.mediaBlobKey) {
      await dbService.deleteItem(STORES.MEDIA_BLOBS, deletingProgram.mediaBlobKey).catch(() => {});
    }
    await dbService.deleteItem(STORES.CHURCH_PROGRAMS, deletingProgram.id);
    setDeletingProgram(null);
    await reloadData();
  };

  const handlePreviewNotification = (program: ChurchProgram) => {
    const payload = buildChurchReminderPayload(program, 'one_hour_before', false);
    dispatchReminderNotification(payload);
    setNotice(
      `Aperçu de notification affiché pour « ${program.title} » (avec texte et média associé, fonctionnel hors connexion).`
    );
  };

  const renderProgramCard = (program: ChurchProgram) => {
    const dayObj = DAYS_OF_WEEK.find((d) => d.value === program.dayOfWeek);
    const activeReminder = program.reminderEnabled !== false;

    return (
      <div
        key={program.id}
        className="p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-col justify-between space-y-3"
      >
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-400">
              {program.scheduleType === 'weekly' ? (
                <>
                  <Church className="w-3.5 h-3.5 shrink-0" />
                  <span>Chaque {dayObj?.label || 'Semaine'} · {program.time}</span>
                </>
              ) : (
                <>
                  <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {program.date ? formatAppDate(program.date) : ''} · {program.time}
                  </span>
                </>
              )}
            </span>

            <button
              type="button"
              onClick={() => handleToggleReminder(program)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition ${
                activeReminder
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
              }`}
            >
              {activeReminder ? (
                <>
                  <Bell className="w-3 h-3" />
                  <span>Rappels actifs</span>
                </>
              ) : (
                <>
                  <BellOff className="w-3 h-3" />
                  <span>Rappels en pause</span>
                </>
              )}
            </button>
          </div>

          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {program.title}
          </h3>

          {program.location && (
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>{program.location}</span>
            </p>
          )}

          {program.description && (
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {program.description}
            </p>
          )}

          {program.mediaBlobKey && (
            <StoredMediaViewer
              mediaBlobKey={program.mediaBlobKey}
              mediaType={program.mediaType}
              alt={program.title}
            />
          )}

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              Rappels auto : <strong>Matin (07h00)</strong> · <strong>Midi (12h00)</strong> ·{' '}
              <strong>1h avant</strong> · <strong>À {program.time}</strong>
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <button
            type="button"
            onClick={() => handlePreviewNotification(program)}
            className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold flex items-center gap-1.5 transition"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Tester la notification</span>
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => openEditModal(program)}
              aria-label="Modifier ce programme"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setDeletingProgram(program)}
              aria-label="Supprimer ce programme"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight font-display flex items-center gap-2">
            <Church className="w-6 h-6" style={{ color: 'var(--shalom-primary)' }} />
            <span>Mon Église</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Vos jours de culte hebdomadaires et activités d’église avec rappels automatiques (Matin, Midi, 1h avant) en ligne comme hors connexion.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openAddModal('weekly')}
          style={{ backgroundColor: 'var(--shalom-primary)' }}
          className="px-4 py-2.5 rounded-xl hover:opacity-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Ajouter un programme</span>
        </button>
      </div>

      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Section 1: Cultes hebdomadaires */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Church className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            <span>Cultes chaque semaine ({weeklyWorshipPrograms.length})</span>
          </h3>
          <button
            type="button"
            onClick={() => openAddModal('weekly')}
            className="text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter un culte</span>
          </button>
        </div>

        {weeklyWorshipPrograms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {weeklyWorshipPrograms.map(renderProgramCard)}
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 text-center space-y-2.5">
            <Church className="w-9 h-9 text-slate-400 mx-auto" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Aucun horaire de culte enregistré pour le moment.
            </p>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              Ajoutez vos jours et heures de culte (ex. Dimanche à 09h00, Mercredi à 18h30) pour être rappelé le matin, à midi et 1h avant.
            </p>
            <button
              type="button"
              onClick={() => openAddModal('weekly')}
              className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter un culte hebdomadaire</span>
            </button>
          </div>
        )}
      </section>

      {/* Section 2: Activités & Programmes datés */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Activités & Programmes datés ({datedActivities.length})</span>
          </h3>
          <button
            type="button"
            onClick={() => openAddModal('event')}
            className="text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter une activité</span>
          </button>
        </div>

        {datedActivities.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {datedActivities.map(renderProgramCard)}
          </div>
        ) : (
          <div className="p-6 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 text-center space-y-2.5">
            <Sparkles className="w-8 h-8 text-amber-500 mx-auto" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Aucune activité spéciale ajoutée.
            </p>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              Convention, veillée, répétition ou sortie : chaque activité créée génère directement un rappel selon sa date et son heure.
            </p>
            <button
              type="button"
              onClick={() => openAddModal('event')}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter une activité datée</span>
            </button>
          </div>
        )}
      </section>

      {/* Modal Add / Edit */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProgram ? 'Modifier le programme d’église' : 'Ajouter un programme d’église'}
        subtitle="Crée automatiquement vos rappels locaux (avec ou sans connexion) en incluant texte et image/vidéo."
        maxWidth="lg"
      >
        <form onSubmit={handleSaveProgram} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, scheduleType: 'weekly' }))}
              className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                form.scheduleType === 'weekly'
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Church className="w-3.5 h-3.5" />
              <span>Culte chaque semaine</span>
            </button>
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, scheduleType: 'event' }))}
              className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                form.scheduleType === 'event'
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Activité (Date précise)</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nom du culte ou de l’activité *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Culte dominical, Réunion d’intercession, Veillée..."
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {form.scheduleType === 'weekly' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Jour de la semaine *
                </label>
                <select
                  value={form.dayOfWeek}
                  onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.value} value={d.value}>
                      Chaque {d.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Date du programme *
                </label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Heure du programme *
              </label>
              <input
                type="time"
                required
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Lieu / Église (facultatif)
            </label>
            <input
              type="text"
              placeholder="Ex: Temple central, Salle annexe..."
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Texte / Description du programme
            </label>
            <textarea
              rows={3}
              placeholder="Thème, orateur, recommandations, détails affichés lors du rappel..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <MediaPickerBox
            label="Image ou vidéo associée au programme (affichée dans la notification)"
            pendingFile={pendingMedia}
            existingBlobKey={editingProgram?.mediaBlobKey}
            existingMediaType={editingProgram?.mediaType}
            removedExisting={removedExistingMedia}
            onSelectFile={(f) => {
              setPendingMedia(f);
              if (f) setRemovedExistingMedia(false);
            }}
            onRemoveExisting={() => setRemovedExistingMedia(true)}
          />

          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2">
            <Bell className="w-4 h-4 shrink-0 mt-0.5 text-blue-700 dark:text-blue-400" />
            <div>
              <span className="font-bold block">Rappels créés automatiquement (avec ou sans connexion)</span>
              <span className="text-[11px] opacity-90">
                Vous recevrez un rappel le matin (07h00), à midi (12h00), 1h avant le début et à l’heure exacte, avec ce texte et le média associé.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
            >
              Annuler
            </button>
            <button
              type="submit"
              style={{ backgroundColor: 'var(--shalom-primary)' }}
              className="px-5 py-2 text-xs font-bold text-white rounded-xl hover:opacity-95"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingProgram}
        title="Supprimer ce programme d’église ?"
        message={`Voulez-vous supprimer « ${deletingProgram?.title || ''} » et ses rappels automatiques ?`}
        confirmLabel="Supprimer"
        isDestructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingProgram(null)}
      />
    </div>
  );
};
