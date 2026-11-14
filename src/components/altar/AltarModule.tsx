import React, { useState, useMemo } from 'react';
import {
  Flame,
  CalendarDays,
  Sparkles,
  Users,
  CheckCircle2,
  Plus,
  Edit3,
  Trash2,
  BookOpen,
  Share2,
  UserPlus,
  Heart,
  Target,
} from 'lucide-react';
import { useShalomDB } from '../../hooks/useShalomDB';
import { dbService, STORES } from '../../services/db';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  WeeklyAltarDay,
  LifeChangeGoal,
  IntercessionPerson,
  SpiritualCommitment,
} from '../../types';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { SocialShareModal } from '../common/SocialShareModal';
import { SharePayload, formatPrayerShareText } from '../../services/socialShare';

const DAY_NAMES_FR = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
];

const DAY_NAMES_EN = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

// Display Monday -> Sunday order
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const AltarModule: React.FC = () => {
  const { lang } = useLanguage();
  const {
    weeklyAltarDays,
    lifeGoals,
    intercessionPeople,
    commitments,
    contacts,
    reloadData,
  } = useShalomDB();

  const isEn = lang === 'en';
  const dayNames = isEn ? DAY_NAMES_EN : DAY_NAMES_FR;
  const todayDow = new Date().getDay();

  const [subTab, setSubTab] = useState<'weekly' | 'changes' | 'people' | 'commitments'>('weekly');
  const [editingDay, setEditingDay] = useState<WeeklyAltarDay | null>(null);
  const [dayTitle, setDayTitle] = useState('');
  const [dayFocus, setDayFocus] = useState('');
  const [dayVerse, setDayVerse] = useState('');

  // Life goals modal
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<LifeChangeGoal | null>(null);
  const [goalArea, setGoalArea] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('');
  const [goalDesired, setGoalDesired] = useState('');
  const [goalPrayer, setGoalPrayer] = useState('');

  // Intercession person modal
  const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
  const [personName, setPersonName] = useState('');
  const [personContactId, setPersonContactId] = useState('');
  const [personRelation, setPersonRelation] = useState('');
  const [personTopic, setPersonTopic] = useState('');

  // Commitment modal
  const [isCommitmentModalOpen, setIsCommitmentModalOpen] = useState(false);
  const [commitmentTitle, setCommitmentTitle] = useState('');
  const [commitmentCategory, setCommitmentCategory] = useState('Lecture biblique');
  const [commitmentFreq, setCommitmentFreq] = useState('Chaque matin');
  const [commitmentNotes, setCommitmentNotes] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<{
    store: typeof STORES.LIFE_GOALS | typeof STORES.INTERCESSION_PEOPLE | typeof STORES.COMMITMENTS;
    id: string;
    label: string;
  } | null>(null);

  const [sharePayload, setSharePayload] = useState<SharePayload | null>(null);

  const orderedDays = useMemo(() => {
    const map = new Map<number, WeeklyAltarDay>();
    weeklyAltarDays.forEach((d) => map.set(d.dayOfWeek, d));
    return WEEK_ORDER.map((dow) => {
      return (
        map.get(dow) || {
          id: `day_${dow}`,
          dayOfWeek: dow,
          prayerTitle: `${isEn ? 'Prayer for' : 'Prière du'} ${dayNames[dow]}`,
          prayerFocus: isEn
            ? 'Prepare a prayer focus for this day.'
            : 'Préparez votre sujet de prière pour ce jour.',
          bibleVerse: '',
          updatedAt: new Date().toISOString(),
        }
      );
    });
  }, [weeklyAltarDays, dayNames, isEn]);

  const todaysAltar = useMemo(
    () => orderedDays.find((d) => d.dayOfWeek === todayDow) || orderedDays[0],
    [orderedDays, todayDow]
  );

  const openEditDay = (day: WeeklyAltarDay) => {
    setEditingDay(day);
    setDayTitle(day.prayerTitle);
    setDayFocus(day.prayerFocus);
    setDayVerse(day.bibleVerse || '');
  };

  const handleSaveDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDay) return;
    const updated: WeeklyAltarDay = {
      ...editingDay,
      prayerTitle: dayTitle.trim() || editingDay.prayerTitle,
      prayerFocus: dayFocus.trim(),
      bibleVerse: dayVerse.trim(),
      updatedAt: new Date().toISOString(),
    };
    await dbService.put(STORES.WEEKLY_ALTAR, updated);
    setEditingDay(null);
    reloadData();
  };

  const openNewGoal = () => {
    setEditingGoal(null);
    setGoalArea('');
    setGoalCurrent('');
    setGoalDesired('');
    setGoalPrayer('');
    setIsGoalModalOpen(true);
  };

  const openEditGoal = (g: LifeChangeGoal) => {
    setEditingGoal(g);
    setGoalArea(g.area);
    setGoalCurrent(g.currentHabit);
    setGoalDesired(g.desiredChange);
    setGoalPrayer(g.prayerSupport || '');
    setIsGoalModalOpen(true);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalDesired.trim()) return;
    const now = new Date().toISOString();
    const item: LifeChangeGoal = {
      id: editingGoal?.id || `goal_${Date.now()}`,
      area: goalArea.trim() || (isEn ? 'Character' : 'Caractère'),
      currentHabit: goalCurrent.trim(),
      desiredChange: goalDesired.trim(),
      prayerSupport: goalPrayer.trim(),
      status: editingGoal?.status || 'en_cours',
      createdAt: editingGoal?.createdAt || now,
      updatedAt: now,
    };
    await dbService.put(STORES.LIFE_GOALS, item);
    setIsGoalModalOpen(false);
    reloadData();
  };

  const toggleGoalStatus = async (g: LifeChangeGoal) => {
    await dbService.put(STORES.LIFE_GOALS, {
      ...g,
      status: g.status === 'accompli' ? 'en_cours' : 'accompli',
      updatedAt: new Date().toISOString(),
    });
    reloadData();
  };

  const handleSelectContact = (contactId: string) => {
    setPersonContactId(contactId);
    const c = contacts.find((item) => item.id === contactId);
    if (c) {
      setPersonName(`${c.firstName} ${c.lastName}`.trim());
      if (!personRelation) setPersonRelation(c.category);
    }
  };

  const handleSavePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim() || !personTopic.trim()) return;
    const item: IntercessionPerson = {
      id: `ip_${Date.now()}`,
      name: personName.trim(),
      contactId: personContactId || undefined,
      relation: personRelation.trim(),
      prayerTopic: personTopic.trim(),
      createdAt: new Date().toISOString(),
    };
    await dbService.put(STORES.INTERCESSION_PEOPLE, item);
    setPersonName('');
    setPersonContactId('');
    setPersonRelation('');
    setPersonTopic('');
    setIsPersonModalOpen(false);
    reloadData();
  };

  const handleMarkPrayedToday = async (person: IntercessionPerson) => {
    await dbService.put(STORES.INTERCESSION_PEOPLE, {
      ...person,
      lastPrayedAt: new Date().toISOString().split('T')[0],
    });
    reloadData();
  };

  const handleSaveCommitment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitmentTitle.trim()) return;
    const item: SpiritualCommitment = {
      id: `comm_${Date.now()}`,
      title: commitmentTitle.trim(),
      category: commitmentCategory,
      frequency: commitmentFreq.trim() || (isEn ? 'Daily' : 'Quotidien'),
      startDate: new Date().toISOString().split('T')[0],
      isActive: true,
      notes: commitmentNotes.trim(),
      createdAt: new Date().toISOString(),
    };
    await dbService.put(STORES.COMMITMENTS, item);
    setCommitmentTitle('');
    setCommitmentNotes('');
    setIsCommitmentModalOpen(false);
    reloadData();
  };

  const toggleCommitment = async (c: SpiritualCommitment) => {
    await dbService.put(STORES.COMMITMENTS, {
      ...c,
      isActive: !c.isActive,
    });
    reloadData();
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    await dbService.deleteItem(confirmDelete.store, confirmDelete.id);
    setConfirmDelete(null);
    reloadData();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 font-display">
            <Flame className="w-6 h-6 text-amber-500" />
            <span>{isEn ? 'My Altar' : 'Mon Autel'}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isEn
              ? 'Weekly prayer preparation, personal transformation, intercession & commitments'
              : 'Préparation de prière hebdomadaire, transformation personnelle, intercession & engagements'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
          {[
            { id: 'weekly', label: isEn ? '7-Day Altar' : 'Semaine (7j)' },
            { id: 'changes', label: isEn ? 'Life Changes' : 'À changer' },
            { id: 'people', label: isEn ? 'People' : 'Intercession' },
            { id: 'commitments', label: isEn ? 'Commitments' : 'Engagements' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id as typeof subTab)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                subTab === tab.id
                  ? 'bg-white dark:bg-[#0f2b5c] text-blue-700 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* MA PRIÈRE DU JOUR — Always visible focal highlight */}
      {todaysAltar && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0b1f42] via-[#132d5e] to-[#1d4285] text-white p-5 sm:p-6 shadow-lg border border-blue-900/50">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
                <Sparkles className="w-4 h-4" />
                <span>
                  {isEn
                    ? `My Prayer Today · ${dayNames[todayDow]}`
                    : `Ma prière du jour · ${dayNames[todayDow]}`}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold font-display">
                {todaysAltar.prayerTitle}
              </h3>
              <p className="text-xs sm:text-sm text-blue-100 leading-relaxed whitespace-pre-line">
                {todaysAltar.prayerFocus}
              </p>
              {todaysAltar.bibleVerse && (
                <p className="text-xs font-semibold text-amber-200 flex items-center gap-1.5 pt-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{todaysAltar.bibleVerse}</span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
              <button
                type="button"
                onClick={() => openEditDay(todaysAltar)}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEn ? 'Edit today' : 'Modifier aujourd’hui'}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setSharePayload({
                    title: `${isEn ? 'My Prayer Today' : 'Ma prière du jour'} (${dayNames[todayDow]})`,
                    text: formatPrayerShareText(
                      todaysAltar.prayerTitle,
                      todaysAltar.prayerFocus,
                      todaysAltar.bibleVerse
                    ),
                  })
                }
                className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white font-semibold text-xs flex items-center gap-1.5 transition"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{isEn ? 'Share' : 'Partager'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: 7-DAY PRAYER PLAN */}
      {subTab === 'weekly' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              <span>
                {isEn
                  ? 'Weekly Altar Preparation (Monday – Sunday)'
                  : 'Préparation de l’autel de la semaine (Lundi – Dimanche)'}
              </span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {orderedDays.map((day) => {
              const isToday = day.dayOfWeek === todayDow;
              return (
                <div
                  key={day.id}
                  className={`p-4 rounded-2xl border transition flex flex-col justify-between gap-3 ${
                    isToday
                      ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-400 dark:border-amber-600 shadow-sm'
                      : 'bg-white dark:bg-[#0c1631] border-slate-200/80 dark:border-slate-800/80'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span
                        className={`font-extrabold uppercase tracking-wider ${
                          isToday
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-blue-700 dark:text-blue-400'
                        }`}
                      >
                        {dayNames[day.dayOfWeek]}
                        {isToday ? (isEn ? ' · Today' : ' · Aujourd’hui') : ''}
                      </span>
                      {day.bibleVerse && (
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          {day.bibleVerse}
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {day.prayerTitle}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {day.prayerFocus}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => openEditDay(day)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{isEn ? 'Prepare / Edit' : 'Préparer / Modifier'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: CE QUE JE VEUX CHANGER DANS MA VIE */}
      {subTab === 'changes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isEn ? 'What I Want to Change in My Life' : 'Ce que je veux changer dans ma vie'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEn
                  ? 'Areas of growth surrendered to God with concrete steps'
                  : 'Domaines de transformation confiés à Dieu avec des étapes concrètes'}
              </p>
            </div>
            <button
              type="button"
              onClick={openNewGoal}
              className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{isEn ? 'Add goal' : 'Ajouter'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lifeGoals.map((g) => (
              <div
                key={g.id}
                className={`p-4 rounded-2xl border space-y-2.5 ${
                  g.status === 'accompli'
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
                    : 'bg-white dark:bg-[#0c1631] border-slate-200/80 dark:border-slate-800/80'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-blue-700 dark:text-blue-400">
                    {g.area} · {g.status === 'accompli' ? (isEn ? 'Achieved' : 'Accompli') : (isEn ? 'In progress' : 'En progrès')}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleGoalStatus(g)}
                      className="p-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                      title={isEn ? 'Toggle completed' : 'Marquer accompli / en cours'}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditGoal(g)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmDelete({
                          store: STORES.LIFE_GOALS,
                          id: g.id,
                          label: g.desiredChange,
                        })
                      }
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {g.desiredChange}
                </h4>

                {g.currentHabit && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <strong>{isEn ? 'Current point:' : 'Point de départ :'}</strong> {g.currentHabit}
                  </p>
                )}

                {g.prayerSupport && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                    « {g.prayerSupport} »
                  </p>
                )}
              </div>
            ))}

            {lifeGoals.length === 0 && (
              <div className="md:col-span-2 p-8 text-center rounded-2xl bg-white dark:bg-[#0c1631] border border-dashed border-slate-300 dark:border-slate-800 text-xs text-slate-500">
                {isEn
                  ? 'No life change goals yet. Write down what God is inviting you to transform.'
                  : 'Aucun objectif de transformation pour le moment. Notez ce que vous souhaitez améliorer avec l’aide de Dieu.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: LES PERSONNES POUR LESQUELLES JE PRIE */}
      {subTab === 'people' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isEn ? 'People I Pray For' : 'Les personnes pour lesquelles je prie'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEn
                  ? 'Your personal intercession list linked with your contacts'
                  : 'Votre liste d’intercession personnelle reliée à vos contacts'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPersonModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isEn ? 'Add person' : 'Ajouter'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {intercessionPeople.map((person) => (
              <div
                key={person.id}
                className="p-4 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>{person.name}</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {person.relation || (isEn ? 'Intercession' : 'Intercession')}
                      {person.lastPrayedAt
                        ? ` · ${isEn ? 'Last prayed:' : 'Prié le'} ${person.lastPrayedAt}`
                        : ''}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setConfirmDelete({
                        store: STORES.INTERCESSION_PEOPLE,
                        id: person.id,
                        label: person.name,
                      })
                    }
                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {person.prayerTopic}
                </p>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => handleMarkPrayedToday(person)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Heart className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Prayed today' : 'J’ai prié aujourd’hui'}</span>
                  </button>
                </div>
              </div>
            ))}

            {intercessionPeople.length === 0 && (
              <div className="md:col-span-2 p-8 text-center rounded-2xl bg-white dark:bg-[#0c1631] border border-dashed border-slate-300 dark:border-slate-800 text-xs text-slate-500">
                {isEn
                  ? 'Add family members, friends, pastors, or anyone on your heart.'
                  : 'Ajoutez des membres de votre famille, des amis ou des frères et sœurs à porter dans la prière.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: MES ENGAGEMENTS SPIRITUELS */}
      {subTab === 'commitments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isEn ? 'My Spiritual Commitments' : 'Mes engagements spirituels'}
              </h3>
              <p className="text-xs text-slate-500">
                {isEn
                  ? 'Covenants and faithful disciplines before the Lord'
                  : 'Engagements personnels et disciplines de foi devant le Seigneur'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCommitmentModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{isEn ? 'New commitment' : 'Nouvel engagement'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {commitments.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-bold text-blue-700 dark:text-blue-400">
                      {c.category} · {c.frequency} · {c.isActive ? (isEn ? 'Active' : 'Actif') : (isEn ? 'Paused' : 'En pause')}
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>{c.title}</span>
                    </h4>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleCommitment(c)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold"
                    >
                      {c.isActive ? (isEn ? 'Pause' : 'Pause') : (isEn ? 'Resume' : 'Activer')}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmDelete({
                          store: STORES.COMMITMENTS,
                          id: c.id,
                          label: c.title,
                        })
                      }
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {c.notes && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {c.notes}
                  </p>
                )}

                <p className="text-[11px] text-slate-400 tabular-nums">
                  {isEn ? 'Started:' : 'Depuis le'} {c.startDate}
                </p>
              </div>
            ))}

            {commitments.length === 0 && (
              <div className="md:col-span-2 p-8 text-center rounded-2xl bg-white dark:bg-[#0c1631] border border-dashed border-slate-300 dark:border-slate-800 text-xs text-slate-500">
                {isEn
                  ? 'No spiritual commitments yet. Define a clear, joyful commitment.'
                  : 'Aucun engagement spirituel enregistré. Prenez un engagement simple et fidèle.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Edit Weekly Altar Day */}
      <Modal
        isOpen={!!editingDay}
        onClose={() => setEditingDay(null)}
        title={
          editingDay
            ? `${isEn ? 'Prepare prayer' : 'Préparer la prière'} — ${dayNames[editingDay.dayOfWeek]}`
            : ''
        }
        maxWidth="md"
      >
        <form onSubmit={handleSaveDay} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold mb-1">
              {isEn ? 'Prayer Title' : 'Titre du sujet de prière'}
            </label>
            <input
              type="text"
              required
              value={dayTitle}
              onChange={(e) => setDayTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">
              {isEn ? 'Prayer Focus / Points' : 'Contenu & points de prière'}
            </label>
            <textarea
              rows={4}
              required
              value={dayFocus}
              onChange={(e) => setDayFocus(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">
              {isEn ? 'Bible Verse (optional)' : 'Verset biblique d’appui (facultatif)'}
            </label>
            <input
              type="text"
              placeholder="Ex: Psaume 91:1-2"
              value={dayVerse}
              onChange={(e) => setDayVerse(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingDay(null)}
              className="px-4 py-2 rounded-xl text-slate-500 font-semibold"
            >
              {isEn ? 'Cancel' : 'Annuler'}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold"
            >
              {isEn ? 'Save' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Add/Edit Life Change Goal */}
      <Modal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        title={isEn ? 'What I Want to Change in My Life' : 'Ce que je veux changer dans ma vie'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveGoal} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold mb-1">
              {isEn ? 'Life Area' : 'Domaine concerné'}
            </label>
            <input
              type="text"
              placeholder={isEn ? 'Ex: Patience, Speech, Time discipline' : 'Ex: Patience, Paroles, Discipline, Pardon'}
              value={goalArea}
              onChange={(e) => setGoalArea(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">
              {isEn ? 'What I want to leave behind (optional)' : 'Habitude actuelle à transformer'}
            </label>
            <input
              type="text"
              placeholder={isEn ? 'Ex: Reacting with impatience' : 'Ex: M’inquiéter rapidement face aux imprévus'}
              value={goalCurrent}
              onChange={(e) => setGoalCurrent(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">
              {isEn ? 'Desired Change *' : 'Changement souhaité *'}
            </label>
            <textarea
              rows={3}
              required
              placeholder={isEn ? 'Ex: Respond with gentleness and prayer first' : 'Ex: Répondre avec douceur et prier avant de réagir'}
              value={goalDesired}
              onChange={(e) => setGoalDesired(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">
              {isEn ? 'Prayer / Verse' : 'Prière ou verset d’appui'}
            </label>
            <input
              type="text"
              placeholder="Ex: Philippiens 4:6-7"
              value={goalPrayer}
              onChange={(e) => setGoalPrayer(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsGoalModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-500 font-semibold"
            >
              {isEn ? 'Cancel' : 'Annuler'}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold"
            >
              {isEn ? 'Save' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Add Person to Pray For */}
      <Modal
        isOpen={isPersonModalOpen}
        onClose={() => setIsPersonModalOpen(false)}
        title={isEn ? 'Add a Person to Pray For' : 'Ajouter une personne pour qui prier'}
        maxWidth="md"
      >
        <form onSubmit={handleSavePerson} className="space-y-4 text-xs">
          {contacts.length > 0 && (
            <div>
              <label className="block font-semibold mb-1">
                {isEn ? 'Pick from my contacts (optional)' : 'Choisir dans mes contacts (facultatif)'}
              </label>
              <select
                value={personContactId}
                onChange={(e) => handleSelectContact(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <option value="">
                  {isEn ? '— Enter manually —' : '— Saisie manuelle —'}
                </option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName} ({c.phone})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">
                {isEn ? 'Name *' : 'Nom / Prénom *'}
              </label>
              <input
                type="text"
                required
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                {isEn ? 'Relation' : 'Lien (famille, ami, pasteur...)'}
              </label>
              <input
                type="text"
                value={personRelation}
                onChange={(e) => setPersonRelation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">
              {isEn ? 'Prayer Subject *' : 'Sujet de prière pour cette personne *'}
            </label>
            <textarea
              rows={3}
              required
              value={personTopic}
              onChange={(e) => setPersonTopic(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsPersonModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-500 font-semibold"
            >
              {isEn ? 'Cancel' : 'Annuler'}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold"
            >
              {isEn ? 'Add' : 'Ajouter'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Add Spiritual Commitment */}
      <Modal
        isOpen={isCommitmentModalOpen}
        onClose={() => setIsCommitmentModalOpen(false)}
        title={isEn ? 'New Spiritual Commitment' : 'Nouvel engagement spirituel'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveCommitment} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold mb-1">
              {isEn ? 'Commitment Title *' : 'Engagement *'}
            </label>
            <input
              type="text"
              required
              placeholder={isEn ? 'Ex: Read 1 chapter of the Bible every morning' : 'Ex: Lire un chapitre de la Bible chaque matin'}
              value={commitmentTitle}
              onChange={(e) => setCommitmentTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">{isEn ? 'Category' : 'Catégorie'}</label>
              <select
                value={commitmentCategory}
                onChange={(e) => setCommitmentCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <option value="Lecture biblique">{isEn ? 'Bible reading' : 'Lecture biblique'}</option>
                <option value="Prière">{isEn ? 'Prayer' : 'Prière'}</option>
                <option value="Jeûne">{isEn ? 'Fasting' : 'Jeûne'}</option>
                <option value="Service & Amour">{isEn ? 'Service & Love' : 'Service & Amour'}</option>
                <option value="Générosité">{isEn ? 'Generosity' : 'Générosité'}</option>
                <option value="Sanctification">{isEn ? 'Holiness' : 'Sanctification'}</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">{isEn ? 'Frequency' : 'Fréquence'}</label>
              <input
                type="text"
                value={commitmentFreq}
                onChange={(e) => setCommitmentFreq(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">{isEn ? 'Notes' : 'Notes personnelles'}</label>
            <textarea
              rows={2}
              value={commitmentNotes}
              onChange={(e) => setCommitmentNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCommitmentModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-500 font-semibold"
            >
              {isEn ? 'Cancel' : 'Annuler'}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold"
            >
              {isEn ? 'Save' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title={isEn ? 'Delete this item?' : 'Supprimer cet élément ?'}
        message={
          confirmDelete
            ? `${isEn ? 'Are you sure you want to delete' : 'Voulez-vous supprimer'} « ${confirmDelete.label} » ?`
            : ''
        }
        confirmLabel={isEn ? 'Delete' : 'Supprimer'}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      <SocialShareModal
        isOpen={!!sharePayload}
        onClose={() => setSharePayload(null)}
        payload={sharePayload}
      />
    </div>
  );
};
