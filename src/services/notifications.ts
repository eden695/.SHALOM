import { ChurchProgram, NotificationSettings, PrayerItem, ReminderFrequency } from '../types';

const NOTIFICATION_STORAGE_KEY = 'shalom_notification_settings_v1';
const NOTIFICATION_FIRED_KEY = 'shalom_notification_fired_v1';
const USAGE_TIPS_STORAGE_KEY = 'shalom_usage_tips_v1';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  dailyPrayer: { enabled: false, time: '06:30', frequency: 'daily' },
  meditation: { enabled: false, time: '12:30', frequency: 'daily' },
  bibleReading: { enabled: false, time: '20:00', frequency: 'daily' },
};

const VALID_FREQS = new Set<ReminderFrequency>(['daily', 'weekdays', 'weekends']);

function sanitizeFrequency(freq?: ReminderFrequency): ReminderFrequency {
  return freq && VALID_FREQS.has(freq) ? freq : 'daily';
}

export function getLocalTodayStr(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseTimeToMinutes(hhmm?: string): number | null {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function getNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_NOTIFICATION_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<NotificationSettings>;
    return {
      dailyPrayer: {
        enabled: Boolean(parsed.dailyPrayer?.enabled),
        time: parsed.dailyPrayer?.time || '06:30',
        frequency: sanitizeFrequency(parsed.dailyPrayer?.frequency),
      },
      meditation: {
        enabled: Boolean(parsed.meditation?.enabled),
        time: parsed.meditation?.time || '12:30',
        frequency: sanitizeFrequency(parsed.meditation?.frequency),
      },
      bibleReading: {
        enabled: Boolean(parsed.bibleReading?.enabled),
        time: parsed.bibleReading?.time || '20:00',
        frequency: sanitizeFrequency(parsed.bibleReading?.frequency),
      },
    };
  } catch {
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
  }
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  try {
    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('shalom-settings-updated'));
  } catch {
    // ignore storage errors
  }
}

export function getUsageTipsEnabled(): boolean {
  try {
    const raw = localStorage.getItem(USAGE_TIPS_STORAGE_KEY);
    if (raw === null) return true;
    return raw !== 'false';
  } catch {
    return true;
  }
}

export function setUsageTipsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(USAGE_TIPS_STORAGE_KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('shalom-settings-updated'));
  } catch {
    // ignore storage errors
  }
}

export async function requestReminderNotificationPermission(): Promise<
  'granted' | 'denied' | 'default' | 'unsupported'
> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') return 'granted';
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

export function showLocalReminderNotification(title: string, body: string): boolean {
  if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    try {
      new Notification(title, {
        body,
        icon: './shalom_logo.jpg',
        tag: `shalom-${title}`,
      });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export interface DueReminderPayload {
  id: string;
  kind: 'daily' | 'prayer' | 'church';
  slotLabel?: string;
  title: string;
  body: string;
  location?: string;
  mediaBlobKey?: string;
  mediaType?: 'image' | 'video';
  mediaMimeType?: string;
  navigateTab?: string;
}

export function dispatchReminderNotification(payload: DueReminderPayload): void {
  showLocalReminderNotification(payload.title, payload.body);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('shalom-trigger-reminder', { detail: payload }));
  }
}

export type ChurchReminderSlot = 'morning' | 'noon' | 'one_hour_before' | 'at_time';

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function buildChurchReminderPayload(
  program: ChurchProgram,
  slot: ChurchReminderSlot,
  isEn = false
): DueReminderPayload {
  const dayLabel =
    program.scheduleType === 'weekly' && typeof program.dayOfWeek === 'number'
      ? isEn
        ? DAYS_EN[program.dayOfWeek] || ''
        : DAYS_FR[program.dayOfWeek] || ''
      : program.date || '';

  let slotLabel = isEn ? 'Church Reminder' : 'Programme d’église';
  if (slot === 'morning') {
    slotLabel = isEn ? `Morning reminder · ${program.time}` : `Rappel du matin · ${program.time}`;
  } else if (slot === 'noon') {
    slotLabel = isEn ? `Noon reminder · ${program.time}` : `Rappel de midi · ${program.time}`;
  } else if (slot === 'one_hour_before') {
    slotLabel = isEn ? `In 1 hour · ${program.time}` : `Dans 1 heure · ${program.time}`;
  } else if (slot === 'at_time') {
    slotLabel = isEn ? `Starting now · ${program.time}` : `À l’heure · ${program.time}`;
  }

  const lines: string[] = [];
  lines.push(
    program.scheduleType === 'weekly'
      ? `${isEn ? 'Weekly worship' : 'Culte'} : ${dayLabel} à ${program.time}`
      : `${isEn ? 'Activity' : 'Activité'} : ${dayLabel} à ${program.time}`
  );
  if (program.location?.trim()) {
    lines.push(`${isEn ? 'Location' : 'Lieu'} : ${program.location.trim()}`);
  }
  if (program.description?.trim()) {
    lines.push(program.description.trim());
  }

  return {
    id: `church_${program.id}_${slot}`,
    kind: 'church',
    slotLabel,
    title: isEn ? `Mon Église · ${program.title}` : `Mon Église · ${program.title}`,
    body: lines.join('\n'),
    location: program.location,
    mediaBlobKey: program.mediaBlobKey,
    mediaType: program.mediaType,
    mediaMimeType: program.mediaMimeType,
    navigateTab: 'church',
  };
}

export function buildPrayerReminderPayload(prayer: PrayerItem, isEn = false): DueReminderPayload {
  const lines: string[] = [];
  if (prayer.description?.trim()) lines.push(prayer.description.trim());
  if (prayer.bibleVerse?.trim()) lines.push(`📖 ${prayer.bibleVerse.trim()}`);
  if (lines.length === 0) {
    lines.push(
      isEn
        ? 'Planned prayer reminder.'
        : 'C’est l’heure prévue pour ce sujet de prière.'
    );
  }

  return {
    id: `prayer_${prayer.id}`,
    kind: 'prayer',
    slotLabel: prayer.reminderTime
      ? isEn
        ? `Prayer reminder · ${prayer.reminderTime}`
        : `Rappel prière · ${prayer.reminderTime}`
      : isEn
      ? 'Prayer reminder'
      : 'Rappel prière',
    title: isEn ? `Prayer · ${prayer.title}` : `Rappel Prière · ${prayer.title}`,
    body: lines.join('\n'),
    mediaBlobKey: prayer.mediaBlobKey,
    mediaType: prayer.mediaType,
    mediaMimeType: prayer.mediaMimeType,
    navigateTab: 'prayers',
  };
}

function isFrequencyDueToday(freq: ReminderFrequency | undefined, dayOfWeek: number): boolean {
  if (!freq || freq === 'daily') return true;
  if (freq === 'weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5;
  if (freq === 'weekends') return dayOfWeek === 0 || dayOfWeek === 6;
  return true;
}

function readFiredMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(NOTIFICATION_FIRED_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    // ignore
  }
  return {};
}

function markReminderFired(key: string, stamp: string): void {
  const map = readFiredMap();
  map[key] = stamp;
  try {
    localStorage.setItem(NOTIFICATION_FIRED_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function checkDueReminders(
  isEn = false,
  churchPrograms: ChurchProgram[] = [],
  prayers: PrayerItem[] = []
): DueReminderPayload | null {
  const settings = getNotificationSettings();
  const now = new Date();
  const today = getLocalTodayStr(now);
  const dayOfWeek = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;

  const firedMap = readFiredMap();

  // 1. Scheduled church worship & activities (Matin 07:00, Midi 12:00, 1h avant, À l'heure)
  for (const program of churchPrograms) {
    if (program.reminderEnabled === false) continue;
    const isToday =
      program.scheduleType === 'weekly'
        ? program.dayOfWeek === dayOfWeek
        : program.date === today;
    if (!isToday) continue;

    const progMinutes = parseTimeToMinutes(program.time);
    if (progMinutes === null) continue;

    const slots: Array<{ slot: ChurchReminderSlot; due: boolean }> = [];

    // 1h before (active from [progMinutes - 60, progMinutes - 1])
    const oneHourBeforeMin = Math.max(0, progMinutes - 60);
    slots.push({
      slot: 'one_hour_before',
      due: nowMinutes >= oneHourBeforeMin && nowMinutes < progMinutes,
    });

    // At exact start time [progMinutes, progMinutes + 20]
    slots.push({
      slot: 'at_time',
      due: nowMinutes >= progMinutes && nowMinutes <= progMinutes + 20,
    });

    // Noon reminder (12:00 = 720m), only if program starts after 12:00 and not yet inside 1h-before window
    if (progMinutes > 720) {
      slots.push({
        slot: 'noon',
        due: nowMinutes >= 720 && nowMinutes < Math.max(720 + 1, progMinutes - 60),
      });
    }

    // Morning reminder (07:00 = 420m), if program starts after 07:00 and before noon / 1h-before
    if (progMinutes > 420) {
      const morningEnd = Math.min(720, progMinutes > 480 ? progMinutes - 60 : progMinutes);
      slots.push({
        slot: 'morning',
        due: nowMinutes >= 420 && nowMinutes < morningEnd,
      });
    }

    for (const s of slots) {
      if (!s.due) continue;
      const fireKey = `church_${program.id}_${s.slot}`;
      if (firedMap[fireKey] === today) continue;
      markReminderFired(fireKey, today);
      const payload = buildChurchReminderPayload(program, s.slot, isEn);
      showLocalReminderNotification(payload.title, payload.body);
      return payload;
    }
  }

  // 2. Planned Prayer reminders (from "Nouvelle prière")
  for (const prayer of prayers) {
    if (!prayer.reminderEnabled || !prayer.nextFollowUpDate) continue;
    if (prayer.nextFollowUpDate !== today) continue;
    const prayerMinutes = parseTimeToMinutes(prayer.reminderTime || '08:00');
    if (prayerMinutes === null) continue;
    if (nowMinutes < prayerMinutes || nowMinutes > prayerMinutes + 60) continue;

    const fireKey = `prayer_${prayer.id}_${prayer.reminderTime || '08:00'}`;
    if (firedMap[fireKey] === today) continue;
    markReminderFired(fireKey, today);
    const payload = buildPrayerReminderPayload(prayer, isEn);
    showLocalReminderNotification(payload.title, payload.body);
    return payload;
  }

  // 3. Global Daily Reminders (Prière, Méditation, Lecture biblique)
  const entries: Array<{
    key: 'dailyPrayer' | 'meditation' | 'bibleReading';
    enabled: boolean;
    time: string;
    frequency?: ReminderFrequency;
    title: string;
    body: string;
    slotLabel: string;
  }> = [
    {
      key: 'dailyPrayer',
      enabled: settings.dailyPrayer.enabled,
      time: settings.dailyPrayer.time,
      frequency: settings.dailyPrayer.frequency,
      slotLabel: isEn ? `Daily · ${settings.dailyPrayer.time}` : `Quotidien · ${settings.dailyPrayer.time}`,
      title: isEn ? 'SHALOM · Daily Prayer' : 'SHALOM · Rappel quotidien de prière',
      body: isEn
        ? 'Take a peaceful moment to bring your prayers before God.'
        : 'Prenez un moment paisible pour déposer vos prières devant Dieu.',
    },
    {
      key: 'meditation',
      enabled: settings.meditation.enabled,
      time: settings.meditation.time,
      frequency: settings.meditation.frequency,
      slotLabel: isEn ? `Daily · ${settings.meditation.time}` : `Quotidien · ${settings.meditation.time}`,
      title: isEn ? 'SHALOM · Meditation Time' : 'SHALOM · Rappel de méditation',
      body: isEn
        ? 'Pause and meditate on God’s Word in peace.'
        : 'Faites une pause pour méditer la Parole et renouveler votre paix.',
    },
    {
      key: 'bibleReading',
      enabled: settings.bibleReading.enabled,
      time: settings.bibleReading.time,
      frequency: settings.bibleReading.frequency,
      slotLabel: isEn ? `Daily · ${settings.bibleReading.time}` : `Quotidien · ${settings.bibleReading.time}`,
      title: isEn ? 'SHALOM · Bible Reading' : 'SHALOM · Rappel de lecture biblique',
      body: isEn
        ? 'It is time for your daily Bible reading.'
        : 'C’est l’heure de votre lecture biblique quotidienne.',
    },
  ];

  for (const item of entries) {
    if (!item.enabled || !item.time) continue;
    if (!isFrequencyDueToday(item.frequency, dayOfWeek)) continue;
    if (firedMap[item.key] === today) continue;
    if (currentHHMM === item.time) {
      markReminderFired(item.key, today);
      showLocalReminderNotification(item.title, item.body);
      return {
        id: item.key,
        kind: 'daily',
        slotLabel: item.slotLabel,
        title: item.title,
        body: item.body,
      };
    }
  }

  return null;
}
