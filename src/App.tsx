import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, X } from 'lucide-react';
import { useShalomDB } from './hooks/useShalomDB';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { RecordingProvider } from './contexts/RecordingContext';
import { NavigationProvider, useNavigation } from './contexts/NavigationContext';
import { Header } from './components/layout/Header';
import { Sidebar, NAV_ITEMS } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { FloatingRecordingBar } from './components/layout/FloatingRecordingBar';
import { Dashboard } from './components/dashboard/Dashboard';
import { AltarModule } from './components/altar/AltarModule';
import { PrayerModule } from './components/prayers/PrayerModule';
import { ChurchModule } from './components/church/ChurchModule';
import { SpiritualJourneyModule } from './components/journey/SpiritualJourneyModule';
import { ParoleModule } from './components/parole/ParoleModule';
import { SpiritualVaultModule } from './components/vault/SpiritualVaultModule';
import { UnifiedCalendarModule } from './components/calendar/UnifiedCalendarModule';
import { ContactsModule } from './components/contacts/ContactsModule';
import { MessagingModule } from './components/messaging/MessagingModule';
import { SettingsModule } from './components/settings/SettingsModule';
import { LockModal } from './components/security/LockModal';
import { StoredMediaViewer } from './components/common/MediaAttachment';
import {
  getSecurityConfig,
  isAppSessionUnlocked,
  setAppSessionUnlocked,
  isFeatureSessionUnlocked,
  unlockFeatureSession,
  lockAllSessions,
} from './services/security';
import { checkDueReminders, DueReminderPayload } from './services/notifications';
import { applyPreferencesToDOM, getAppPreferences } from './services/preferences';
import { Contact, SecurityConfig, LockableFeatureId } from './types';

const LOCKABLE_IDS: LockableFeatureId[] = [
  'altar',
  'prayers',
  'church',
  'journey',
  'parole',
  'vault',
  'calendar',
  'contacts',
  'messaging',
  'settings',
];

interface ShellProps {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  securityConfig: SecurityConfig;
  setSecurityConfig: React.Dispatch<React.SetStateAction<SecurityConfig>>;
  isLaunchLockOpen: boolean;
  setIsLaunchLockOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

function ShalomAppShell({
  isDarkMode,
  toggleDarkMode,
  securityConfig,
  setSecurityConfig,
  isLaunchLockOpen,
  setIsLaunchLockOpen,
}: ShellProps) {
  const { userProfile, loading, churchPrograms, prayers } = useShalomDB();
  const { t, lang } = useLanguage();
  const isEn = lang === 'en';
  const { activeTab, canGoBack, navigateTo, goBack, goHome } = useNavigation();

  const [pendingFeatureUnlock, setPendingFeatureUnlock] = useState<{
    tab: string;
    subView?: string;
    lockId: LockableFeatureId;
  } | null>(null);

  const [activeReminderBanner, setActiveReminderBanner] = useState<DueReminderPayload | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const handleLockNow = useCallback(() => {
    lockAllSessions();
    const latestCfg = getSecurityConfig();
    if (latestCfg.isEnabled && latestCfg.secretHash) {
      setIsLaunchLockOpen(true);
    }
  }, [setIsLaunchLockOpen]);

  // Automatic inactivity lock monitor
  useEffect(() => {
    const minutes = securityConfig.autoLockMinutes || 0;
    if (!securityConfig.isEnabled || !securityConfig.secretHash || minutes <= 0) {
      return;
    }

    lastActivityRef.current = Date.now();
    const touchActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const thresholdMs = minutes * 60_000;
    const checkInactivity = () => {
      if (!isLaunchLockOpen && Date.now() - lastActivityRef.current >= thresholdMs) {
        handleLockNow();
      }
    };

    window.addEventListener('pointerdown', touchActivity, { passive: true });
    window.addEventListener('keydown', touchActivity, { passive: true });
    window.addEventListener('touchstart', touchActivity, { passive: true });
    window.addEventListener('scroll', touchActivity, { passive: true });
    document.addEventListener('visibilitychange', checkInactivity);

    const intervalId = window.setInterval(checkInactivity, 1000);

    return () => {
      window.removeEventListener('pointerdown', touchActivity);
      window.removeEventListener('keydown', touchActivity);
      window.removeEventListener('touchstart', touchActivity);
      window.removeEventListener('scroll', touchActivity);
      document.removeEventListener('visibilitychange', checkInactivity);
      window.clearInterval(intervalId);
    };
  }, [
    securityConfig.isEnabled,
    securityConfig.secretHash,
    securityConfig.autoLockMinutes,
    isLaunchLockOpen,
    handleLockNow,
  ]);

  // Scheduled local reminders (daily spiritual reminders + Mon Église + planned prayers, offline & online)
  useEffect(() => {
    const runCheck = () => {
      const due = checkDueReminders(isEn, churchPrograms, prayers);
      if (due) {
        setActiveReminderBanner(due);
      }
    };
    const onManualTrigger = (evt: Event) => {
      const custom = evt as CustomEvent<DueReminderPayload>;
      if (custom.detail) {
        setActiveReminderBanner(custom.detail);
      }
    };

    runCheck();
    const timer = window.setInterval(runCheck, 15000);
    window.addEventListener('shalom-settings-updated', runCheck);
    window.addEventListener('shalom-db-updated', runCheck);
    window.addEventListener('shalom-trigger-reminder', onManualTrigger);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('shalom-settings-updated', runCheck);
      window.removeEventListener('shalom-db-updated', runCheck);
      window.removeEventListener('shalom-trigger-reminder', onManualTrigger);
    };
  }, [isEn, churchPrograms, prayers]);

  const handleSelectTab = (tab: string, subView?: string) => {
    const isFeatureProtected =
      securityConfig.isEnabled &&
      !!securityConfig.secretHash &&
      LOCKABLE_IDS.includes(tab as LockableFeatureId) &&
      securityConfig.lockedFeatures.includes(tab as LockableFeatureId) &&
      !isFeatureSessionUnlocked(tab as LockableFeatureId);

    if (isFeatureProtected) {
      setPendingFeatureUnlock({
        tab,
        subView,
        lockId: tab as LockableFeatureId,
      });
      return;
    }

    navigateTo(tab, subView);
  };

  useEffect(() => {
    if (
      securityConfig.isEnabled &&
      !!securityConfig.secretHash &&
      LOCKABLE_IDS.includes(activeTab as LockableFeatureId) &&
      securityConfig.lockedFeatures.includes(activeTab as LockableFeatureId) &&
      !isFeatureSessionUnlocked(activeTab as LockableFeatureId)
    ) {
      goHome();
    }
  }, [activeTab, securityConfig, goHome]);

  const [campaignContacts, setCampaignContacts] = useState<Contact[] | undefined>(undefined);
  const [campaignMessage, setCampaignMessage] = useState<string | undefined>(undefined);

  const handleStartCampaignWithContacts = (targetContacts: Contact[], initialMsg?: string) => {
    setCampaignContacts(targetContacts);
    setCampaignMessage(initialMsg);
    handleSelectTab('messaging');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f7f8fa] dark:bg-[#060d1d] text-slate-800 dark:text-slate-100 p-4">
        <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-amber-400/50 shadow-xl mb-4 animate-pulse">
          <img
            src="./shalom_logo.jpg"
            alt="SHALOM"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover scale-[1.06]"
          />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[#0b1f42] dark:text-white font-display">
          SHALOM
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Chargement de votre espace personnel...
        </p>
      </div>
    );
  }

  const activeNavItem = NAV_ITEMS.find((item) => item.id === activeTab);
  const pageTitle = activeNavItem
    ? t(activeNavItem.labelKey, activeNavItem.fallbackLabel)
    : 'SHALOM';

  return (
    <div className="min-h-screen flex bg-[#f7f8fa] dark:bg-[#060d1d] text-slate-900 dark:text-slate-100 transition-colors">
      <Sidebar
        userName={userProfile?.fullName}
        userAvatarUrl={userProfile?.avatarDataUrl}
        activeTab={activeTab}
        onSelectTab={(tab) => handleSelectTab(tab)}
        lockedFeatures={securityConfig.isEnabled ? securityConfig.lockedFeatures : []}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          pageTitle={pageTitle}
          showBackButton={canGoBack}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          isSecurityEnabled={securityConfig.isEnabled}
          isUnlocked={isAppSessionUnlocked() || !isLaunchLockOpen}
          onLockClick={() => handleLockNow()}
          onGoBack={goBack}
          onGoHome={goHome}
        />

        {activeReminderBanner && (
          <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 pt-3">
            <div className="p-4 rounded-2xl bg-blue-700 text-white shadow-lg border border-blue-500/40 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Bell className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                  <div className="min-w-0 text-xs space-y-1">
                    {activeReminderBanner.slotLabel && (
                      <span className="inline-block px-2 py-0.5 rounded-md bg-white/15 text-amber-200 font-bold text-[10px] uppercase tracking-wider">
                        {activeReminderBanner.slotLabel}
                      </span>
                    )}
                    <div className="font-bold text-sm">{activeReminderBanner.title}</div>
                    <div className="text-blue-100 whitespace-pre-line leading-relaxed">
                      {activeReminderBanner.body}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {activeReminderBanner.navigateTab && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = activeReminderBanner.navigateTab!;
                        setActiveReminderBanner(null);
                        handleSelectTab(target);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-bold"
                    >
                      Ouvrir
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveReminderBanner(null)}
                    className="p-1.5 rounded-lg hover:bg-white/15 shrink-0"
                    aria-label="Fermer le rappel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {activeReminderBanner.mediaBlobKey && (
                <StoredMediaViewer
                  mediaBlobKey={activeReminderBanner.mediaBlobKey}
                  mediaType={activeReminderBanner.mediaType}
                  alt={activeReminderBanner.title}
                  className="max-w-md"
                />
              )}
            </div>
          </div>
        )}

        <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 pb-24 lg:pb-10">
          {activeTab === 'dashboard' && (
            <Dashboard
              onNavigate={handleSelectTab}
              onOpenNewPrayer={() => handleSelectTab('prayers', 'requests')}
              onOpenNewParole={() => handleSelectTab('parole')}
              onOpenShareModal={() => handleSelectTab('messaging')}
            />
          )}

          {activeTab === 'altar' && <AltarModule />}

          {activeTab === 'prayers' && (
            <PrayerModule
              onShareWithContacts={(recipients, text) => {
                setCampaignContacts(recipients);
                setCampaignMessage(text);
                handleSelectTab('messaging');
              }}
              onOpenWhatsAppShare={(text: string) => {
                setCampaignContacts(undefined);
                setCampaignMessage(text);
                handleSelectTab('messaging');
              }}
            />
          )}

          {activeTab === 'church' && <ChurchModule />}

          {activeTab === 'journey' && <SpiritualJourneyModule />}

          {activeTab === 'parole' && <ParoleModule />}

          {activeTab === 'vault' && <SpiritualVaultModule />}

          {activeTab === 'calendar' && <UnifiedCalendarModule />}

          {activeTab === 'contacts' && (
            <ContactsModule onStartCampaignWithContacts={handleStartCampaignWithContacts} />
          )}

          {activeTab === 'messaging' && (
            <MessagingModule
              initialContacts={campaignContacts}
              initialMessage={campaignMessage}
              onClose={() => {
                setCampaignContacts(undefined);
                setCampaignMessage(undefined);
                goBack();
              }}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsModule
              isDarkMode={isDarkMode}
              onToggleDarkMode={toggleDarkMode}
              onLockNow={() => handleLockNow()}
              onSecurityChanged={(cfg) => setSecurityConfig(cfg)}
            />
          )}
        </main>
      </div>

      <FloatingRecordingBar
        activeTab={activeTab}
        onReturnToParole={() => handleSelectTab('parole')}
      />

      <BottomNav
        activeTab={activeTab}
        onSelectTab={(tab) => handleSelectTab(tab)}
        lockedFeatures={securityConfig.isEnabled ? securityConfig.lockedFeatures : []}
      />

      {securityConfig.isEnabled && securityConfig.secretHash && (
        <LockModal
          isOpen={isLaunchLockOpen}
          lockMode={securityConfig.lockMode}
          storedHash={securityConfig.secretHash}
          title="Ouverture Protégée — SHALOM"
          subtitle="Saisissez votre identification pour ouvrir l’application"
          onUnlocked={() => {
            setAppSessionUnlocked(true);
            setIsLaunchLockOpen(false);
          }}
        />
      )}

      {pendingFeatureUnlock && securityConfig.secretHash && (
        <LockModal
          isOpen={!!pendingFeatureUnlock}
          lockMode={securityConfig.lockMode}
          storedHash={securityConfig.secretHash}
          title="Fonctionnalité Verrouillée"
          subtitle="Confirmez votre identité pour accéder à cet espace"
          onUnlocked={() => {
            unlockFeatureSession(pendingFeatureUnlock.lockId);
            const target = pendingFeatureUnlock.tab;
            const subView = pendingFeatureUnlock.subView;
            setPendingFeatureUnlock(null);
            navigateTo(target, subView);
          }}
          onCancel={() => setPendingFeatureUnlock(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  const { userProfile } = useShalomDB();

  useEffect(() => {
    applyPreferencesToDOM(getAppPreferences());
  }, []);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('shalom_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('shalom_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('shalom_theme', 'light');
      }
    } catch {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);

  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>(() => getSecurityConfig());
  const [isLaunchLockOpen, setIsLaunchLockOpen] = useState<boolean>(() => {
    const cfg = getSecurityConfig();
    return cfg.isEnabled && cfg.lockOnLaunch && !!cfg.secretHash && !isAppSessionUnlocked();
  });

  return (
    <LanguageProvider initialLanguage={userProfile?.language}>
      <RecordingProvider>
        <NavigationProvider isLaunchLocked={isLaunchLockOpen}>
          <ShalomAppShell
            isDarkMode={isDarkMode}
            toggleDarkMode={toggleDarkMode}
            securityConfig={securityConfig}
            setSecurityConfig={setSecurityConfig}
            isLaunchLockOpen={isLaunchLockOpen}
            setIsLaunchLockOpen={setIsLaunchLockOpen}
          />
        </NavigationProvider>
      </RecordingProvider>
    </LanguageProvider>
  );
}
