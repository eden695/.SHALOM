// Centralized Display, Privacy, Personalization & Sharing Preferences for SHALOM
// 100% Client-side, persisted in localStorage, applied live to DOM root

export type AccentColorId =
  | 'royal_blue'
  | 'gold'
  | 'emerald'
  | 'indigo'
  | 'violet'
  | 'crimson';

export type TextSizeScale = 'small' | 'normal' | 'large' | 'xlarge';

export type DateFormatOption = 'dd_mm_yyyy' | 'iso' | 'long';

export type StartupPageOption =
  | 'dashboard'
  | 'altar'
  | 'prayers'
  | 'journey'
  | 'parole'
  | 'vault'
  | 'calendar'
  | 'contacts'
  | 'messaging';

export type DashboardShortcutId =
  | 'newPrayer'
  | 'recordParole'
  | 'share'
  | 'openAltar'
  | 'openVault'
  | 'openCalendar';

export type PreferredShareChannel = 'whatsapp' | 'gmail' | 'sms' | 'native';

export interface DashboardSectionsConfig {
  todaysAltar: boolean;
  kpis: boolean;
  quickModules: boolean;
  recentPrayers: boolean;
  latestParole: boolean;
  upcomingEvents: boolean;
}

export interface AppPreferences {
  // A. Apparence et affichage
  accentColor: AccentColorId;
  textSize: TextSizeScale;
  readingComfort: boolean;
  reduceAnimations: boolean;
  // C. Confidentialite
  hideSensitiveOnHome: boolean;
  // E. Personnalisation
  dateFormat: DateFormatOption;
  startupPage: StartupPageOption;
  dashboardSections: DashboardSectionsConfig;
  dashboardShortcuts: DashboardShortcutId[];
  // F. Reseaux et partage
  preferredShareChannel: PreferredShareChannel;
  defaultCountryPrefix: string;
  gmailDefaultRecipient: string;
  gmailSubjectPrefix: string;
}

const PREFS_STORAGE_KEY = 'shalom_app_preferences_v1';

export const ACCENT_COLOR_OPTIONS: Array<{
  id: AccentColorId;
  labelFr: string;
  labelEn: string;
  primary: string;
  hover: string;
  swatchClass: string;
}> = [
  {
    id: 'royal_blue',
    labelFr: 'Bleu SHALOM',
    labelEn: 'SHALOM Blue',
    primary: '#1d4ed8',
    hover: '#1e40af',
    swatchClass: 'bg-[#1d4ed8]',
  },
  {
    id: 'gold',
    labelFr: 'Or Sacré',
    labelEn: 'Sacred Gold',
    primary: '#b45309',
    hover: '#92400e',
    swatchClass: 'bg-[#b45309]',
  },
  {
    id: 'emerald',
    labelFr: 'Émeraude',
    labelEn: 'Emerald',
    primary: '#047857',
    hover: '#065f46',
    swatchClass: 'bg-[#047857]',
  },
  {
    id: 'indigo',
    labelFr: 'Indigo Profond',
    labelEn: 'Deep Indigo',
    primary: '#4338ca',
    hover: '#3730a3',
    swatchClass: 'bg-[#4338ca]',
  },
  {
    id: 'violet',
    labelFr: 'Prune Royale',
    labelEn: 'Royal Violet',
    primary: '#6d28d9',
    hover: '#5b21b6',
    swatchClass: 'bg-[#6d28d9]',
  },
  {
    id: 'crimson',
    labelFr: 'Bordeaux',
    labelEn: 'Crimson',
    primary: '#be123c',
    hover: '#9f1239',
    swatchClass: 'bg-[#be123c]',
  },
];

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  accentColor: 'royal_blue',
  textSize: 'normal',
  readingComfort: false,
  reduceAnimations: false,
  hideSensitiveOnHome: false,
  dateFormat: 'dd_mm_yyyy',
  startupPage: 'dashboard',
  dashboardSections: {
    todaysAltar: true,
    kpis: true,
    quickModules: true,
    recentPrayers: true,
    latestParole: true,
    upcomingEvents: true,
  },
  dashboardShortcuts: ['newPrayer', 'recordParole', 'share'],
  preferredShareChannel: 'whatsapp',
  defaultCountryPrefix: '',
  gmailDefaultRecipient: '',
  gmailSubjectPrefix: '',
};

const VALID_STARTUP_PAGES = new Set<string>([
  'dashboard',
  'altar',
  'prayers',
  'journey',
  'parole',
  'vault',
  'calendar',
  'contacts',
  'messaging',
]);

export function getAppPreferences(): AppPreferences {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APP_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<AppPreferences>;

    const accentValid = ACCENT_COLOR_OPTIONS.some((o) => o.id === parsed.accentColor);
    const startupValid = parsed.startupPage && VALID_STARTUP_PAGES.has(parsed.startupPage);

    return {
      accentColor: accentValid ? (parsed.accentColor as AccentColorId) : 'royal_blue',
      textSize:
        parsed.textSize && ['small', 'normal', 'large', 'xlarge'].includes(parsed.textSize)
          ? parsed.textSize
          : 'normal',
      readingComfort: Boolean(parsed.readingComfort),
      reduceAnimations: Boolean(parsed.reduceAnimations),
      hideSensitiveOnHome: Boolean(parsed.hideSensitiveOnHome),
      dateFormat:
        parsed.dateFormat && ['dd_mm_yyyy', 'iso', 'long'].includes(parsed.dateFormat)
          ? parsed.dateFormat
          : 'dd_mm_yyyy',
      startupPage: startupValid ? (parsed.startupPage as StartupPageOption) : 'dashboard',
      dashboardSections: {
        todaysAltar:
          parsed.dashboardSections?.todaysAltar ?? DEFAULT_APP_PREFERENCES.dashboardSections.todaysAltar,
        kpis: parsed.dashboardSections?.kpis ?? DEFAULT_APP_PREFERENCES.dashboardSections.kpis,
        quickModules:
          parsed.dashboardSections?.quickModules ?? DEFAULT_APP_PREFERENCES.dashboardSections.quickModules,
        recentPrayers:
          parsed.dashboardSections?.recentPrayers ?? DEFAULT_APP_PREFERENCES.dashboardSections.recentPrayers,
        latestParole:
          parsed.dashboardSections?.latestParole ?? DEFAULT_APP_PREFERENCES.dashboardSections.latestParole,
        upcomingEvents:
          parsed.dashboardSections?.upcomingEvents ?? DEFAULT_APP_PREFERENCES.dashboardSections.upcomingEvents,
      },
      dashboardShortcuts:
        Array.isArray(parsed.dashboardShortcuts) && parsed.dashboardShortcuts.length > 0
          ? parsed.dashboardShortcuts
          : [...DEFAULT_APP_PREFERENCES.dashboardShortcuts],
      preferredShareChannel:
        parsed.preferredShareChannel &&
        ['whatsapp', 'gmail', 'sms', 'native'].includes(parsed.preferredShareChannel)
          ? parsed.preferredShareChannel
          : 'whatsapp',
      defaultCountryPrefix: typeof parsed.defaultCountryPrefix === 'string' ? parsed.defaultCountryPrefix : '',
      gmailDefaultRecipient:
        typeof parsed.gmailDefaultRecipient === 'string' ? parsed.gmailDefaultRecipient : '',
      gmailSubjectPrefix: typeof parsed.gmailSubjectPrefix === 'string' ? parsed.gmailSubjectPrefix : '',
    };
  } catch {
    return { ...DEFAULT_APP_PREFERENCES };
  }
}

export function applyPreferencesToDOM(prefs: AppPreferences): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-accent', prefs.accentColor);
  root.setAttribute('data-text-scale', prefs.textSize);
  root.setAttribute('data-reading-comfort', prefs.readingComfort ? 'true' : 'false');
  root.setAttribute('data-reduce-motion', prefs.reduceAnimations ? 'true' : 'false');

  const accentObj =
    ACCENT_COLOR_OPTIONS.find((a) => a.id === prefs.accentColor) || ACCENT_COLOR_OPTIONS[0];
  root.style.setProperty('--shalom-primary', accentObj.primary);
  root.style.setProperty('--shalom-primary-hover', accentObj.hover);
}

export function saveAppPreferences(next: AppPreferences): AppPreferences {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage limits
  }
  applyPreferencesToDOM(next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('shalom-preferences-updated', { detail: next }));
    window.dispatchEvent(new CustomEvent('shalom-settings-updated'));
  }
  return next;
}

export function resetAppPreferences(): AppPreferences {
  const defaults: AppPreferences = {
    ...DEFAULT_APP_PREFERENCES,
    dashboardSections: { ...DEFAULT_APP_PREFERENCES.dashboardSections },
    dashboardShortcuts: [...DEFAULT_APP_PREFERENCES.dashboardShortcuts],
  };
  return saveAppPreferences(defaults);
}

export function formatAppDate(
  isoOrDate: string | Date,
  formatOverride?: DateFormatOption,
  isEn = false
): string {
  const fmt = formatOverride || getAppPreferences().dateFormat;
  let dateObj: Date;
  if (isoOrDate instanceof Date) {
    dateObj = isoOrDate;
  } else {
    const clean = isoOrDate.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [y, m, d] = clean.split('-').map(Number);
      dateObj = new Date(y, m - 1, d);
    } else {
      dateObj = new Date(isoOrDate);
    }
  }

  if (Number.isNaN(dateObj.getTime())) {
    return typeof isoOrDate === 'string' ? isoOrDate : '';
  }

  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');

  if (fmt === 'iso') return `${yyyy}-${mm}-${dd}`;
  if (fmt === 'long') {
    try {
      return new Intl.DateTimeFormat(isEn ? 'en-US' : 'fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(dateObj);
    } catch {
      return `${dd}/${mm}/${yyyy}`;
    }
  }
  return `${dd}/${mm}/${yyyy}`;
}
