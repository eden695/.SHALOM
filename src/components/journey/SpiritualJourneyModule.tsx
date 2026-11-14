import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Clock,
  BookOpen,
  Heart,
  Sparkles,
  Award,
  Plus,
  Trash2,
  CheckCircle2,
  Calendar,
  Sun,
} from 'lucide-react';
import { useShalomDB } from '../../hooks/useShalomDB';
import { dbService, STORES } from '../../services/db';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  SpiritualHabitLog,
  SpiritualHabitType,
  PersonalProgram,
} from '../../types';
import { Modal } from '../common/Modal';

export const SpiritualJourneyModule: React.FC = () => {
  const { lang } = useLanguage();
  const { habitLogs, personalPrograms, reloadData } = useShalomDB();
  const isEn = lang === 'en';

  const currentYear = new Date().getFullYear();
  const todayIso = new Date().toISOString().split('T')[0];

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logType, setLogType] = useState<SpiritualHabitType>('priere');
  const [logDate, setLogDate] = useState(todayIso);
  const [logMinutes, setLogMinutes] = useState('15');
  const [logNote, setLogNote] = useState('');
  const [logVerseRef, setLogVerseRef] = useState('');
  const [logVerseText, setLogVerseText] = useState('');

  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [progTitle, setProgTitle] = useState('');
  const [progTheme, setProgTheme] = useState('');
  const [progStartDate, setProgStartDate] = useState(todayIso);
  const [progTargetDays, setProgTargetDays] = useState('7');

  const [progressView, setProgressView] = useState<'weekly' | 'monthly'>('weekly');
  const [filterHabit, setFilterHabit] = useState<SpiritualHabitType | 'all'>('all');

  const habitConfig: Record<
    SpiritualHabitType,
    { label: string; unitLabel: string; colorClass: string; barColor: string }
  > = {
    priere: {
      label: isEn ? 'Prayer' : 'Prière',
      unitLabel: isEn ? 'Time spent' : 'Temps consacré',
      colorClass: 'text-blue-700 dark:text-blue-400',
      barColor: 'bg-blue-600',
    },
    meditation: {
      label: isEn ? 'Meditation' : 'Méditation',
      unitLabel: isEn ? 'Reflections recorded' : 'Réflexions enregistrées',
      colorClass: 'text-indigo-700 dark:text-indigo-400',
      barColor: 'bg-indigo-600',
    },
    jeune: {
      label: isEn ? 'Fasting' : 'Jeûne',
      unitLabel: isEn ? 'Voluntary fasting days' : 'Jours déclarés volontairement',
      colorClass: 'text-amber-700 dark:text-amber-400',
      barColor: 'bg-amber-500',
    },
    memorisation: {
      label: isEn ? 'Memorization' : 'Mémorisation',
      unitLabel: isEn ? 'Verses learned' : 'Versets appris',
      colorClass: 'text-emerald-700 dark:text-emerald-400',
      barColor: 'bg-emerald-600',
    },
    gratitude: {
      label: isEn ? 'Gratitude' : 'Gratitude',
      unitLabel: isEn ? 'Thanksgiving topics' : 'Sujets de reconnaissance',
      colorClass: 'text-rose-700 dark:text-rose-400',
      barColor: 'bg-rose-500',
    },
  };

  // Summary metrics
  const summary = useMemo(() => {
    const prayerMinutes = habitLogs
      .filter((h) => h.type === 'priere')
      .reduce((acc, h) => acc + (h.durationMinutes || 15), 0);
    const meditationCount = habitLogs.filter((h) => h.type === 'meditation').length;
    const fastingDays = new Set(
      habitLogs.filter((h) => h.type === 'jeune').map((h) => h.date)
    ).size;
    const versesCount = habitLogs.filter((h) => h.type === 'memorisation').length;
    const gratitudeCount = habitLogs.filter((h) => h.type === 'gratitude').length;

    const programsThisYear = personalPrograms.filter(
      (p) => p.year === currentYear || p.startDate.startsWith(String(currentYear))
    );
    const completedProgramsThisYear = programsThisYear.filter((p) => p.status === 'termine').length;

    return {
      prayerMinutes,
      meditationCount,
      fastingDays,
      versesCount,
      gratitudeCount,
      programsCount: programsThisYear.length,
      completedProgramsThisYear,
    };
  }, [habitLogs, personalPrograms, currentYear]);

  // Weekly progression (last 7 days)
  const weeklyData = useMemo(() => {
    const days: Array<{ iso: string; label: string; count: number; minutes: number }> = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      const dayLabel = new Intl.DateTimeFormat(isEn ? 'en-US' : 'fr-FR', {
        weekday: 'short',
      }).format(d);
      const matching = habitLogs.filter((h) => h.date === iso);
      days.push({
        iso,
        label: dayLabel,
        count: matching.length,
        minutes: matching.reduce((sum, item) => sum + (item.durationMinutes || 0), 0),
      });
    }
    const maxCount = Math.max(1, ...days.map((d) => d.count));
    return { days, maxCount };
  }, [habitLogs, isEn]);

  // Monthly progression (last 4 weeks / current month breakdown)
  const monthlyData = useMemo(() => {
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const inMonth = habitLogs.filter((h) => h.date.startsWith(monthPrefix));
    const buckets = [
      { label: isEn ? 'Week 1 (1–7)' : 'Sem. 1 (1–7)', count: 0 },
      { label: isEn ? 'Week 2 (8–14)' : 'Sem. 2 (8–14)', count: 0 },
      { label: isEn ? 'Week 3 (15–21)' : 'Sem. 3 (15–21)', count: 0 },
      { label: isEn ? 'Week 4 (22–31)' : 'Sem. 4 (22–31)', count: 0 },
    ];
    inMonth.forEach((item) => {
      const dayNum = parseInt(item.date.split('-')[2] || '1', 10);
      if (dayNum <= 7) buckets[0].count++;
      else if (dayNum <= 14) buckets[1].count++;
      else if (dayNum <= 21) buckets[2].count++;
      else buckets[3].count++;
    });
    const maxCount = Math.max(1, ...buckets.map((b) => b.count));
    return { buckets, maxCount, totalMonth: inMonth.length };
  }, [habitLogs, isEn]);

  // Encouraging, zero-guilt message based on activity
  const encouragementMessage = useMemo(() => {
    const activeLast7Days = weeklyData.days.filter((d) => d.count > 0).length;
    if (habitLogs.length === 0) {
      return isEn
        ? 'Welcome to your spiritual journey! Every small moment with God counts. Start gently whenever you are ready.'
        : 'Bienvenue dans votre parcours spirituel ! Chaque petit pas avec Dieu compte. Commencez doucement à votre rythme.';
    }
    if (activeLast7Days === 0) {
      return isEn
        ? 'The Lord’s mercies are new every morning (Lam. 3:22-23). Pause whenever you can — there is no pressure or guilt here.'
        : 'Les bontés de l’Éternel se renouvellent chaque matin (Lamentations 3:22-23). Reprenez simplement aujourd’hui avec paix et sans culpabilité.';
    }
    if (activeLast7Days < 4) {
      return isEn
        ? `You nurtured your faith on ${activeLast7Days} day(s) this week. Celebrate every step forward — grace walks with you!`
        : `Vous avez nourri votre foi ${activeLast7Days} jour(s) cette semaine. Réjouissez-vous de chaque pas — la grâce marche avec vous !`;
    }
    return isEn
      ? `Wonderful faithfulness! ${activeLast7Days} days of fellowship this week. Keep walking in joy and peace.`
      : `Belle fidélité ! ${activeLast7Days} jours de communion cette semaine. Continuez dans la joie et la paix du Seigneur.`;
  }, [weeklyData, habitLogs.length, isEn]);

  const openLogModal = (defaultType?: SpiritualHabitType) => {
    if (defaultType) setLogType(defaultType);
    setLogDate(todayIso);
    setLogMinutes('15');
    setLogNote('');
    setLogVerseRef('');
    setLogVerseText('');
    setIsLogModalOpen(true);
  };

  const handleSaveHabitLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const item: SpiritualHabitLog = {
      id: `hab_${Date.now()}`,
      type: logType,
      date: logDate || todayIso,
      durationMinutes: logType === 'priere' ? Math.max(1, parseInt(logMinutes, 10) || 15) : undefined,
      note: logNote.trim() || undefined,
      verseRef: logType === 'memorisation' ? logVerseRef.trim() || undefined : undefined,
      verseText: logType === 'memorisation' ? logVerseText.trim() || undefined : undefined,
      createdAt: new Date().toISOString(),
    };
    await dbService.put(STORES.HABIT_LOGS, item);
    setIsLogModalOpen(false);
    reloadData();
  };

  const handleDeleteLog = async (id: string) => {
    await dbService.deleteItem(STORES.HABIT_LOGS, id);
    reloadData();
  };

  const handleSaveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progTitle.trim()) return;
    const start = progStartDate || todayIso;
    const yr = parseInt(start.split('-')[0] || String(currentYear), 10);
    const prog: PersonalProgram = {
      id: `prog_${Date.now()}`,
      title: progTitle.trim(),
      theme: progTheme.trim() || (isEn ? 'Spiritual Growth' : 'Croissance spirituelle'),
      startDate: start,
      targetDays: Math.max(1, parseInt(progTargetDays, 10) || 7),
      completedDays: 0,
      status: 'en_cours',
      year: yr,
      createdAt: new Date().toISOString(),
    };
    await dbService.put(STORES.PERSONAL_PROGRAMS, prog);
    setProgTitle('');
    setProgTheme('');
    setIsProgramModalOpen(false);
    reloadData();
  };

  const handleAdvanceProgramDay = async (prog: PersonalProgram) => {
    const nextDays = Math.min(prog.targetDays, prog.completedDays + 1);
    await dbService.put(STORES.PERSONAL_PROGRAMS, {
      ...prog,
      completedDays: nextDays,
      status: nextDays >= prog.targetDays ? 'termine' : 'en_cours',
    });
    reloadData();
  };

  const handleDeleteProgram = async (id: string) => {
    await dbService.deleteItem(STORES.PERSONAL_PROGRAMS, id);
    reloadData();
  };

  const filteredLogs = useMemo(() => {
    if (filterHabit === 'all') return habitLogs;
    return habitLogs.filter((h) => h.type === filterHabit);
  }, [habitLogs, filterHabit]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 font-display">
            <TrendingUp className="w-6 h-6 text-blue-700 dark:text-blue-400" />
            <span>{isEn ? 'My Spiritual Journey' : 'Mon Parcours Spirituel'}</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isEn
              ? 'Track prayer, meditation, fasting, memorization, gratitude & annual programs'
              : 'Suivi bienveillant de vos habitudes et programmes personnels depuis le début de l’année'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openLogModal('priere')}
            className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{isEn ? 'Log Moment' : 'Enregistrer un temps'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsProgramModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5"
          >
            <Award className="w-4 h-4" />
            <span>{isEn ? 'New Program' : 'Nouveau programme'}</span>
          </button>
        </div>
      </div>

      {/* Gentle Encouraging Card (Anti-Guilt) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 to-sky-50 dark:from-emerald-950/30 dark:to-blue-950/30 border border-emerald-200/80 dark:border-emerald-900/50 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
          <Sun className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
            {isEn ? 'Grace & Encouragement' : 'Encouragement du jour'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 mt-0.5 leading-relaxed">
            {encouragementMessage}
          </p>
        </div>
      </div>

      {/* 5 Habits + Annual Personal Programs KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          type="button"
          onClick={() => openLogModal('priere')}
          className="text-left p-3.5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 hover:border-blue-500 transition"
        >
          <div className="text-[11px] font-bold text-blue-700 dark:text-blue-400 flex items-center justify-between">
            <span>{habitConfig.priere.label}</span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-extrabold tabular-nums text-slate-900 dark:text-white mt-1.5">
            {summary.prayerMinutes} min
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{habitConfig.priere.unitLabel}</div>
        </button>

        <button
          type="button"
          onClick={() => openLogModal('meditation')}
          className="text-left p-3.5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 hover:border-indigo-500 transition"
        >
          <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 flex items-center justify-between">
            <span>{habitConfig.meditation.label}</span>
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-extrabold tabular-nums text-slate-900 dark:text-white mt-1.5">
            {summary.meditationCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {habitConfig.meditation.unitLabel}
          </div>
        </button>

        <button
          type="button"
          onClick={() => openLogModal('jeune')}
          className="text-left p-3.5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 hover:border-amber-500 transition"
        >
          <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center justify-between">
            <span>{habitConfig.jeune.label}</span>
            <Calendar className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-extrabold tabular-nums text-slate-900 dark:text-white mt-1.5">
            {summary.fastingDays} {isEn ? 'd' : 'j'}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">{habitConfig.jeune.unitLabel}</div>
        </button>

        <button
          type="button"
          onClick={() => openLogModal('memorisation')}
          className="text-left p-3.5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-500 transition"
        >
          <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
            <span>{habitConfig.memorisation.label}</span>
            <BookOpen className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-extrabold tabular-nums text-slate-900 dark:text-white mt-1.5">
            {summary.versesCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {habitConfig.memorisation.unitLabel}
          </div>
        </button>

        <button
          type="button"
          onClick={() => openLogModal('gratitude')}
          className="text-left p-3.5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 hover:border-rose-500 transition"
        >
          <div className="text-[11px] font-bold text-rose-700 dark:text-rose-400 flex items-center justify-between">
            <span>{habitConfig.gratitude.label}</span>
            <Heart className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-extrabold tabular-nums text-slate-900 dark:text-white mt-1.5">
            {summary.gratitudeCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {habitConfig.gratitude.unitLabel}
          </div>
        </button>

        <div className="p-3.5 rounded-2xl bg-[#0b1f42] text-white border border-blue-900">
          <div className="text-[11px] font-bold text-amber-300 flex items-center justify-between">
            <span>{isEn ? `Programs ${currentYear}` : `Programmes ${currentYear}`}</span>
            <Award className="w-3.5 h-3.5" />
          </div>
          <div className="text-xl font-extrabold tabular-nums mt-1.5">
            {summary.programsCount}
          </div>
          <div className="text-[11px] text-blue-200 mt-0.5">
            {isEn
              ? `${summary.completedProgramsThisYear} completed since Jan 1`
              : `${summary.completedProgramsThisYear} terminé(s) depuis janv.`}
          </div>
        </div>
      </div>

      {/* Weekly & Monthly Progression + Annual Personal Programs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly / Monthly Chart */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {isEn ? 'Spiritual Progression' : 'Progression hebdomadaire & mensuelle'}
            </h3>
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setProgressView('weekly')}
                className={`px-2.5 py-1 rounded-md transition ${
                  progressView === 'weekly'
                    ? 'bg-white dark:bg-[#0f2b5c] text-blue-700 dark:text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                {isEn ? 'Weekly' : 'Semaine'}
              </button>
              <button
                type="button"
                onClick={() => setProgressView('monthly')}
                className={`px-2.5 py-1 rounded-md transition ${
                  progressView === 'monthly'
                    ? 'bg-white dark:bg-[#0f2b5c] text-blue-700 dark:text-white shadow-xs'
                    : 'text-slate-500'
                }`}
              >
                {isEn ? 'Monthly' : 'Mois'}
              </button>
            </div>
          </div>

          {progressView === 'weekly' ? (
            <div className="grid grid-cols-7 gap-2 items-end h-40 pt-4">
              {weeklyData.days.map((d) => {
                const heightPct = d.count === 0 ? 8 : Math.max(18, Math.round((d.count / weeklyData.maxCount) * 100));
                return (
                  <div key={d.iso} className="flex flex-col items-center justify-end h-full gap-1.5">
                    <span className="text-[11px] font-bold tabular-nums text-slate-600 dark:text-slate-300">
                      {d.count}
                    </span>
                    <div className="w-full max-w-[32px] flex-1 flex items-end">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full rounded-t-lg transition-all ${
                          d.count > 0
                            ? 'bg-blue-700 dark:bg-blue-500'
                            : 'bg-slate-200 dark:bg-slate-800'
                        }`}
                      />
                    </div>
                    <span className="text-[11px] capitalize text-slate-500">{d.label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {monthlyData.buckets.map((b) => {
                const widthPct = b.count === 0 ? 4 : Math.max(12, Math.round((b.count / monthlyData.maxCount) * 100));
                return (
                  <div key={b.label} className="space-y-1 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-600 dark:text-slate-300">{b.label}</span>
                      <span className="tabular-nums text-slate-900 dark:text-white">
                        {b.count} {isEn ? 'moments' : 'temps enregistrés'}
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        style={{ width: `${widthPct}%` }}
                        className={`h-full rounded-full transition-all ${
                          b.count > 0
                            ? 'bg-emerald-600 dark:bg-emerald-500'
                            : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
              <p className="text-[11px] text-slate-500 pt-1">
                {isEn
                  ? `Total this month: ${monthlyData.totalMonth} spiritual entries.`
                  : `Total ce mois-ci : ${monthlyData.totalMonth} moments enregistrés.`}
              </p>
            </div>
          )}
        </div>

        {/* Annual Personal Programs */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isEn
                  ? `Personal Programs (${currentYear})`
                  : `Mes programmes personnels (${currentYear})`}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isEn
                  ? `${summary.programsCount} program(s) since January 1, ${currentYear}`
                  : `${summary.programsCount} programme(s) suivi(s) depuis le 1er janvier ${currentYear}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsProgramModalOpen(true)}
              className="text-xs font-bold text-blue-700 dark:text-blue-400 hover:underline"
            >
              + {isEn ? 'Add' : 'Ajouter'}
            </button>
          </div>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {personalPrograms.map((p) => {
              const pct = Math.min(100, Math.round((p.completedDays / p.targetDays) * 100));
              return (
                <div
                  key={p.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{p.title}</h4>
                      <p className="text-[11px] text-slate-500">
                        {p.theme} · {p.startDate} ·{' '}
                        {p.status === 'termine'
                          ? isEn
                            ? 'Completed'
                            : 'Accompli'
                          : isEn
                            ? 'Ongoing'
                            : 'En cours'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {p.status !== 'termine' && (
                        <button
                          type="button"
                          onClick={() => handleAdvanceProgramDay(p)}
                          className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>+1 {isEn ? 'd' : 'j'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteProgram(p.id)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className="h-full bg-blue-700 dark:bg-blue-500 rounded-full transition-all"
                      />
                    </div>
                    <span className="text-[11px] font-bold tabular-nums text-slate-600 dark:text-slate-300">
                      {p.completedDays}/{p.targetDays} {isEn ? 'd' : 'j'}
                    </span>
                  </div>
                </div>
              );
            })}

            {personalPrograms.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-6">
                {isEn
                  ? 'Create a personal program (e.g. 21-day prayer, Bible reading, fasting retreat).'
                  : 'Ajoutez un programme personnel (ex : 21 jours de prière, lecture des Psaumes, retraite de jeûne).'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Journal of Spiritual Habits */}
      <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {isEn ? 'Habit Journal & Reflections' : 'Journal des habitudes & versets mémorisés'}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'priere', 'meditation', 'jeune', 'memorisation', 'gratitude'] as const).map(
              (f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilterHabit(f)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                    filterHabit === f
                      ? 'bg-blue-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {f === 'all' ? (isEn ? 'All' : 'Tout') : habitConfig[f].label}
                </button>
              )
            )}
          </div>
        </div>

        <div className="space-y-2.5">
          {filteredLogs.slice(0, 20).map((log) => (
            <div
              key={log.id}
              className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 flex items-start justify-between gap-3"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className={`font-bold ${habitConfig[log.type].colorClass}`}>
                    {habitConfig[log.type].label}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-500 tabular-nums">{log.date}</span>
                  {log.durationMinutes && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                        {log.durationMinutes} min
                      </span>
                    </>
                  )}
                  {log.verseRef && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {log.verseRef}
                      </span>
                    </>
                  )}
                </div>
                {log.verseText && (
                  <p className="text-xs italic font-serif text-slate-700 dark:text-slate-200">
                    « {log.verseText} »
                  </p>
                )}
                {log.note && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {log.note}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleDeleteLog(log.id)}
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {filteredLogs.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-6">
              {isEn
                ? 'No entries yet. Tap any habit card above to record a moment.'
                : 'Aucune entrée enregistrée. Cliquez sur « Enregistrer un temps » ou une carte ci-dessus.'}
            </p>
          )}
        </div>
      </div>

      {/* Modal Log Habit */}
      <Modal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        title={isEn ? 'Record Spiritual Moment' : 'Enregistrer une habitude spirituelle'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveHabitLog} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">{isEn ? 'Habit' : 'Habitude'}</label>
              <select
                value={logType}
                onChange={(e) => setLogType(e.target.value as SpiritualHabitType)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <option value="priere">{habitConfig.priere.label}</option>
                <option value="meditation">{habitConfig.meditation.label}</option>
                <option value="jeune">{habitConfig.jeune.label}</option>
                <option value="memorisation">{habitConfig.memorisation.label}</option>
                <option value="gratitude">{habitConfig.gratitude.label}</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold mb-1">{isEn ? 'Date' : 'Date'}</label>
              <input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
            </div>
          </div>

          {logType === 'priere' && (
            <div>
              <label className="block font-semibold mb-1">
                {isEn ? 'Time spent (minutes)' : 'Temps consacré (en minutes)'}
              </label>
              <input
                type="number"
                min={1}
                value={logMinutes}
                onChange={(e) => setLogMinutes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
            </div>
          )}

          {logType === 'memorisation' && (
            <div className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">
                  {isEn ? 'Verse Reference' : 'Référence du verset appris'}
                </label>
                <input
                  type="text"
                  placeholder="Ex: Psaume 119:11"
                  value={logVerseRef}
                  onChange={(e) => setLogVerseRef(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  {isEn ? 'Verse Text' : 'Texte du verset'}
                </label>
                <textarea
                  rows={2}
                  value={logVerseText}
                  onChange={(e) => setLogVerseText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold mb-1">
              {logType === 'meditation'
                ? isEn
                  ? 'Recorded reflection'
                  : 'Réflexion enregistrée'
                : logType === 'gratitude'
                  ? isEn
                    ? 'Thanksgiving subject'
                    : 'Sujet de reconnaissance'
                  : isEn
                    ? 'Personal note (optional)'
                    : 'Note personnelle (facultatif)'}
            </label>
            <textarea
              rows={3}
              value={logNote}
              onChange={(e) => setLogNote(e.target.value)}
              placeholder={
                logType === 'jeune'
                  ? isEn
                    ? 'Voluntary fasting intention...'
                    : 'Intention volontaire de ce jour de jeûne...'
                  : undefined
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsLogModalOpen(false)}
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

      {/* Modal New Personal Program */}
      <Modal
        isOpen={isProgramModalOpen}
        onClose={() => setIsProgramModalOpen(false)}
        title={isEn ? 'New Personal Spiritual Program' : 'Nouveau programme personnel'}
        maxWidth="md"
      >
        <form onSubmit={handleSaveProgram} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold mb-1">
              {isEn ? 'Program Title *' : 'Titre du programme *'}
            </label>
            <input
              type="text"
              required
              placeholder={isEn ? 'Ex: 21 Days of Prayer & Gratitude' : 'Ex: 21 jours de prière et de gratitude'}
              value={progTitle}
              onChange={(e) => setProgTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">{isEn ? 'Theme' : 'Thème'}</label>
            <input
              type="text"
              placeholder={isEn ? 'Ex: Faith renewal, Peace, Wisdom' : 'Ex: Renouvellement, Paix, Sagesse'}
              value={progTheme}
              onChange={(e) => setProgTheme(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">{isEn ? 'Start Date' : 'Date de début'}</label>
              <input
                type="date"
                value={progStartDate}
                onChange={(e) => setProgStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">
                {isEn ? 'Duration (days)' : 'Durée cible (jours)'}
              </label>
              <input
                type="number"
                min={1}
                max={365}
                value={progTargetDays}
                onChange={(e) => setProgTargetDays(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsProgramModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-500 font-semibold"
            >
              {isEn ? 'Cancel' : 'Annuler'}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold"
            >
              {isEn ? 'Create Program' : 'Créer le programme'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
