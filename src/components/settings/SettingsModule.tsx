import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Download,
  Upload,
  HardDrive,
  User,
  Lock,
  CheckCircle2,
  Sun,
  Moon,
  KeyRound,
  Grid3X3,
  Hash,
  Image as ImageIcon,
  Camera,
  Trash2,
  BookOpen,
  RotateCcw,
  Loader2,
  Sparkles,
  Globe,
  Bell,
  BellOff,
  Clock,
  Info,
  Wifi,
  WifiOff,
  RefreshCw,
  FileText,
  ShieldCheck,
  Lightbulb,
  Eraser,
  Palette,
  Sliders,
  Share2,
  Mail,
  Eye,
  EyeOff,
  Mic,
  Smartphone,
  LayoutDashboard,
  ChevronRight,
  Copy,
} from 'lucide-react';
import { dbService, STORES } from '../../services/db';
import { useShalomDB } from '../../hooks/useShalomDB';
import { useLanguage, WORLD_LANGUAGES } from '../../contexts/LanguageContext';
import { downloadBlobSafe } from '../../utils/download';
import { useModuleSubView } from '../../contexts/NavigationContext';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { SocialShareModal } from '../common/SocialShareModal';
import { DataExplorerCard } from './DataExplorerCard';
import {
  getNotificationSettings,
  saveNotificationSettings,
  getUsageTipsEnabled,
  setUsageTipsEnabled,
  requestReminderNotificationPermission,
  showLocalReminderNotification,
} from '../../services/notifications';
import {
  hashSecret,
  getSecurityConfig,
  saveSecurityConfig,
  setAppSessionUnlocked,
  LOCKABLE_FEATURES,
} from '../../services/security';
import {
  AppPreferences,
  ACCENT_COLOR_OPTIONS,
  TextSizeScale,
  DateFormatOption,
  StartupPageOption,
  DashboardSectionsConfig,
  DashboardShortcutId,
  PreferredShareChannel,
  getAppPreferences,
  saveAppPreferences,
  resetAppPreferences,
} from '../../services/preferences';
import { buildGmailComposeUrl, buildMailtoUrl, SharePayload } from '../../services/socialShare';
import {
  UserProfile,
  LockMode,
  LockableFeatureId,
  SecurityConfig,
  AppLanguage,
  NotificationSettings,
  ReminderFrequency,
} from '../../types';
import { PatternGrid } from '../security/PatternGrid';

interface SettingsModuleProps {
  initialSubTab?: string;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onLockNow: () => void;
  onSecurityChanged: (cfg: SecurityConfig) => void;
}

type PermissionStatusLabel = 'granted' | 'denied' | 'prompt' | 'unsupported';

const CATEGORY_TABS: Array<{
  id: string;
  code?: string;
  label: string;
  shortLabel: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'general',
    label: 'Centre de contrôle',
    shortLabel: 'Vue générale',
    desc: 'Aperçu rapide de vos réglages',
    icon: Settings,
  },
  {
    id: 'appearance',
    code: 'A',
    label: 'Apparence et affichage',
    shortLabel: 'Apparence',
    desc: 'Thème, couleur, taille du texte, confort & animations',
    icon: Palette,
  },
  {
    id: 'notifications',
    code: 'B',
    label: 'Notifications et rappels',
    shortLabel: 'Notifications',
    desc: 'Rappels prière, méditation, lecture, horaires & fréquences',
    icon: Bell,
  },
  {
    id: 'security',
    code: 'C',
    label: 'Confidentialité et sécurité',
    shortLabel: 'Sécurité',
    desc: 'PIN, mot de passe, schéma, verrouillage & autorisations',
    icon: Shield,
  },
  {
    id: 'backup',
    code: 'D',
    label: 'Données et stockage',
    shortLabel: 'Données',
    desc: 'Mémoire locale, cache, sauvegarde JSON & explorateur',
    icon: HardDrive,
  },
  {
    id: 'personalization',
    code: 'E',
    label: 'Personnalisation',
    shortLabel: 'Personnalisation',
    desc: 'Profil, langue, accueil, page de démarrage & dates',
    icon: Sliders,
  },
  {
    id: 'sharing',
    code: 'F',
    label: 'Réseaux et partage',
    shortLabel: 'Partage',
    desc: 'WhatsApp, Gmail, SMS, indicatif pays & canaux sociaux',
    icon: Share2,
  },
  {
    id: 'about',
    code: 'G',
    label: 'Informations sur SHALOM',
    shortLabel: 'Informations',
    desc: 'Version, mode autonome, mises à jour, aide & confidentialité',
    icon: Info,
  },
];

export const SettingsModule: React.FC<SettingsModuleProps> = ({
  initialSubTab = 'general',
  isDarkMode,
  onToggleDarkMode,
  onLockNow,
  onSecurityChanged,
}) => {
  const { userProfile, reloadData } = useShalomDB();
  const { lang, setLang, t, currentLanguageInfo } = useLanguage();
  const [subTab, setSubTab] = useModuleSubView<string>('settings', initialSubTab || 'general');

  const [prefs, setPrefs] = useState<AppPreferences>(() => getAppPreferences());
  const [prefsNotice, setPrefsNotice] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const [langSearch, setLangSearch] = useState('');
  const [draftLanguage, setDraftLanguage] = useState<AppLanguage>(
    (userProfile?.language as AppLanguage) || lang
  );
  const [langAppliedNotice, setLangAppliedNotice] = useState<string | null>(null);

  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const [userForm, setUserForm] = useState<UserProfile>({
    id: userProfile?.id || 'user_main',
    fullName: userProfile?.fullName || 'Utilisateur',
    phone: userProfile?.phone || '',
    email: userProfile?.email || '',
    avatarDataUrl: userProfile?.avatarDataUrl || undefined,
    dashboardVerseText: userProfile?.dashboardVerseText || '',
    dashboardVerseRef: userProfile?.dashboardVerseRef || '',
    theme: userProfile?.theme || 'light',
    language: userProfile?.language || lang,
    createdAt: userProfile?.createdAt || new Date().toISOString(),
  });

  // Security Protection Config State
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>(() => getSecurityConfig());
  const [draftLockMode, setDraftLockMode] = useState<LockMode>(() => getSecurityConfig().lockMode);
  const [draftLockOnLaunch, setDraftLockOnLaunch] = useState<boolean>(
    () => getSecurityConfig().lockOnLaunch
  );
  const [draftLockedFeatures, setDraftLockedFeatures] = useState<LockableFeatureId[]>(
    () => getSecurityConfig().lockedFeatures
  );
  const [draftAutoLockMinutes, setDraftAutoLockMinutes] = useState<number>(
    () => getSecurityConfig().autoLockMinutes || 0
  );
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [patternStep1, setPatternStep1] = useState<string>('');
  const [patternStep2, setPatternStep2] = useState<string>('');
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);

  // Instant Launch-Lock Setup Modal State
  const [isLaunchSetupModalOpen, setIsLaunchSetupModalOpen] = useState(false);
  const [modalLockMode, setModalLockMode] = useState<LockMode>(() => getSecurityConfig().lockMode);
  const [modalPin, setModalPin] = useState('');
  const [modalConfirmPin, setModalConfirmPin] = useState('');
  const [modalPassword, setModalPassword] = useState('');
  const [modalConfirmPassword, setModalConfirmPassword] = useState('');
  const [modalPatternStep1, setModalPatternStep1] = useState('');
  const [modalPatternStep2, setModalPatternStep2] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isCompletingLaunchSetup, setIsCompletingLaunchSetup] = useState(false);

  // Device Permissions State
  const [micPermission, setMicPermission] = useState<PermissionStatusLabel>('prompt');
  const [camPermission, setCamPermission] = useState<PermissionStatusLabel>('prompt');
  const [permCheckMessage, setPermCheckMessage] = useState<string | null>(null);

  // Notification Reminders & Usage Tips State
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>(() =>
    getNotificationSettings()
  );
  const [notifPermission, setNotifPermission] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );
  const [notifNotice, setNotifNotice] = useState<string | null>(null);
  const [showUsageTips, setShowUsageTips] = useState<boolean>(() => getUsageTipsEnabled());

  // About / Connection / Update / Legal Modals / Diagnostic State
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 390
  );
  const [updateCheckStatus, setUpdateCheckStatus] = useState<
    'idle' | 'checking' | 'up-to-date' | 'available' | 'offline' | 'error'
  >('idle');
  const [updateCheckMessage, setUpdateCheckMessage] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [aboutNotice, setAboutNotice] = useState<string | null>(null);

  // Sharing test modal
  const [testSharePayload, setTestSharePayload] = useState<SharePayload | null>(null);

  // Storage & Backup State
  const [storageStats, setStorageStats] = useState<{
    usageMB: number;
    quotaMB: number;
    percentage: number;
    persisted: boolean;
  }>({ usageMB: 0, quotaMB: 1000, percentage: 0, persisted: false });
  const [includeMediaInBackup, setIncludeMediaInBackup] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [cacheClearing, setCacheClearing] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [storageActionMessage, setStorageActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile) {
      setUserForm(userProfile);
      if (userProfile.language) {
        setDraftLanguage(userProfile.language as AppLanguage);
      }
    }
    dbService.getStorageEstimate().then(setStorageStats);
  }, [userProfile]);

  useEffect(() => {
    const syncConnection = () => setIsOnline(navigator.onLine);
    const syncWidth = () => setViewportWidth(window.innerWidth);
    const syncPrefs = () => setPrefs(getAppPreferences());

    window.addEventListener('online', syncConnection);
    window.addEventListener('offline', syncConnection);
    window.addEventListener('resize', syncWidth);
    window.addEventListener('shalom-preferences-updated', syncPrefs);

    return () => {
      window.removeEventListener('online', syncConnection);
      window.removeEventListener('offline', syncConnection);
      window.removeEventListener('resize', syncWidth);
      window.removeEventListener('shalom-preferences-updated', syncPrefs);
    };
  }, []);

  const refreshMediaPermissions = async () => {
    if (typeof navigator === 'undefined') return;
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }
    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      try {
        const mic = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setMicPermission(mic.state as PermissionStatusLabel);
      } catch {
        setMicPermission(navigator.mediaDevices ? 'prompt' : 'unsupported');
      }
      try {
        const cam = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setCamPermission(cam.state as PermissionStatusLabel);
      } catch {
        setCamPermission(navigator.mediaDevices ? 'prompt' : 'unsupported');
      }
    } else if (!navigator.mediaDevices) {
      setMicPermission('unsupported');
      setCamPermission('unsupported');
    }
  };

  useEffect(() => {
    if (subTab === 'security') {
      refreshMediaPermissions();
    }
  }, [subTab]);

  const updatePrefs = (patch: Partial<AppPreferences>, notice?: string) => {
    const next = saveAppPreferences({ ...prefs, ...patch });
    setPrefs(next);
    if (notice) {
      setPrefsNotice(notice);
    }
  };

  const handleRequestDeviceMedia = async (kind: 'microphone' | 'camera') => {
    setPermCheckMessage(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPermCheckMessage(
        `L’accès ${kind === 'microphone' ? 'au microphone' : 'à la caméra'} n’est pas disponible dans ce navigateur.`
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === 'microphone' ? { audio: true } : { video: true }
      );
      stream.getTracks().forEach((track) => track.stop());
      if (kind === 'microphone') setMicPermission('granted');
      else setCamPermission('granted');
      setPermCheckMessage(
        `${kind === 'microphone' ? 'Microphone' : 'Caméra'} autorisé(e) et prêt(e) pour Parole Divine.`
      );
    } catch {
      if (kind === 'microphone') setMicPermission('denied');
      else setCamPermission('denied');
      setPermCheckMessage(
        `Autorisation refusée ou matériel indisponible pour ${kind === 'microphone' ? 'le microphone' : 'la caméra'}. Vérifiez les réglages Android / navigateur.`
      );
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        setUserForm((prev) => ({ ...prev, avatarDataUrl: dataUrl }));
      };
      if (typeof reader.result === 'string') {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleApplyAndSaveLanguage = async () => {
    setLangAppliedNotice(null);
    const chosen = draftLanguage || lang;
    const nextProfile: UserProfile = {
      ...userForm,
      language: chosen,
    };
    setLang(chosen);
    setUserForm(nextProfile);
    await dbService.put(STORES.PROFILES, nextProfile);
    setLangAppliedNotice(
      chosen === 'en' ? 'Language applied and saved.' : 'Langue appliquée et enregistrée.'
    );
    reloadData();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveNotice(null);
    setIsSavingProfile(true);
    try {
      const chosenLang = draftLanguage || userForm.language || lang;
      const cleaned: UserProfile = {
        ...userForm,
        fullName: userForm.fullName.trim() || 'Utilisateur',
        email: userForm.email?.trim() || '',
        phone: userForm.phone?.trim() || '',
        dashboardVerseText: userForm.dashboardVerseText?.trim() || '',
        dashboardVerseRef: userForm.dashboardVerseRef?.trim() || '',
        language: chosenLang,
        showUsageTips,
      };
      setLang(chosenLang);
      setUsageTipsEnabled(showUsageTips);
      await Promise.all([
        dbService.put(STORES.PROFILES, cleaned),
        new Promise((resolve) => setTimeout(resolve, 250)),
      ]);
      setUserForm(cleaned);
      setSaveNotice(
        chosenLang === 'en'
          ? 'Your profile and personalization preferences have been saved.'
          : 'Votre profil et vos préférences ont bien été enregistrés.'
      );
      reloadData();
    } catch {
      setSaveNotice('Une erreur est survenue lors de l’enregistrement.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const toggleFeatureLock = (featureId: LockableFeatureId) => {
    setDraftLockedFeatures((prev) =>
      prev.includes(featureId) ? prev.filter((id) => id !== featureId) : [...prev, featureId]
    );
  };

  const handleSaveSecurityPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityNotice(null);

    let secretToHash = '';
    const needsNewSecret =
      !securityConfig.secretHash ||
      securityConfig.lockMode !== draftLockMode ||
      newPin.length > 0 ||
      newPassword.length > 0 ||
      patternStep1.length > 0;

    if (needsNewSecret) {
      if (draftLockMode === 'pin') {
        if (!/^\d{4}$/.test(newPin)) {
          setSecurityNotice('Le code PIN doit contenir exactement 4 chiffres.');
          return;
        }
        if (newPin !== confirmPin) {
          setSecurityNotice('Les deux codes PIN ne correspondent pas.');
          return;
        }
        secretToHash = newPin;
      } else if (draftLockMode === 'password') {
        if (newPassword.length < 4) {
          setSecurityNotice('Le mot de passe doit contenir au moins 4 caractères.');
          return;
        }
        if (newPassword !== confirmPassword) {
          setSecurityNotice('Les deux mots de passe ne correspondent pas.');
          return;
        }
        secretToHash = newPassword;
      } else if (draftLockMode === 'pattern') {
        if (!patternStep1 || patternStep1.split('-').length < 4) {
          setSecurityNotice('Tracez un schéma reliant au moins 4 points.');
          return;
        }
        if (patternStep1 !== patternStep2) {
          setSecurityNotice('Les deux schémas tracés ne correspondent pas.');
          setPatternStep1('');
          setPatternStep2('');
          return;
        }
        secretToHash = patternStep1;
      }
    }

    setIsSavingSecurity(true);
    try {
      const finalHash = secretToHash ? await hashSecret(secretToHash) : securityConfig.secretHash;

      if (!draftLockOnLaunch && draftLockedFeatures.length === 0) {
        setSecurityNotice(
          'Sélectionnez au moins « Verrouiller l’ouverture de l’application » ou une fonctionnalité à protéger.'
        );
        return;
      }

      const nextConfig: SecurityConfig = {
        isEnabled: true,
        lockMode: draftLockMode,
        secretHash: finalHash,
        lockOnLaunch: draftLockOnLaunch,
        lockedFeatures: draftLockedFeatures,
        autoLockMinutes: draftAutoLockMinutes,
      };

      await new Promise((resolve) => setTimeout(resolve, 250));
      saveSecurityConfig(nextConfig);
      setSecurityConfig(nextConfig);
      onSecurityChanged(nextConfig);
      setAppSessionUnlocked(true);

      setNewPin('');
      setConfirmPin('');
      setNewPassword('');
      setConfirmPassword('');
      setPatternStep1('');
      setPatternStep2('');
      setSecurityNotice('Protection enregistrée et activée avec succès.');
    } finally {
      setIsSavingSecurity(false);
    }
  };

  const handleDisableSecurity = () => {
    const disabled: SecurityConfig = {
      isEnabled: false,
      lockMode: draftLockMode,
      secretHash: '',
      lockOnLaunch: false,
      lockedFeatures: [],
      autoLockMinutes: 0,
    };
    saveSecurityConfig(disabled);
    setSecurityConfig(disabled);
    setDraftLockOnLaunch(false);
    setDraftLockedFeatures([]);
    setDraftAutoLockMinutes(0);
    onSecurityChanged(disabled);
    setAppSessionUnlocked(true);
    setSecurityNotice('Protection désactivée.');
  };

  const handleToggleLockOnLaunch = (checked: boolean) => {
    if (checked) {
      setDraftLockOnLaunch(true);
      setModalLockMode(draftLockMode);
      setModalPin('');
      setModalConfirmPin('');
      setModalPassword('');
      setModalConfirmPassword('');
      setModalPatternStep1('');
      setModalPatternStep2('');
      setModalError(null);
      setIsLaunchSetupModalOpen(true);
    } else {
      setDraftLockOnLaunch(false);
      if (securityConfig.isEnabled && securityConfig.lockOnLaunch) {
        if (draftLockedFeatures.length > 0) {
          const updated: SecurityConfig = {
            ...securityConfig,
            lockOnLaunch: false,
            lockedFeatures: draftLockedFeatures,
          };
          saveSecurityConfig(updated);
          setSecurityConfig(updated);
          onSecurityChanged(updated);
          setSecurityNotice('Verrouillage au lancement désactivé.');
        } else {
          handleDisableSecurity();
        }
      }
    }
  };

  const handleCancelLaunchSetup = () => {
    setIsLaunchSetupModalOpen(false);
    setModalError(null);
    if (!securityConfig.isEnabled || !securityConfig.lockOnLaunch) {
      setDraftLockOnLaunch(false);
    }
  };

  const handleCompleteLaunchLockSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    let secretToHash = '';
    const canKeepExisting =
      Boolean(securityConfig.secretHash) &&
      securityConfig.lockMode === modalLockMode &&
      modalPin.length === 0 &&
      modalPassword.length === 0 &&
      modalPatternStep1.length === 0;

    if (!canKeepExisting) {
      if (modalLockMode === 'pin') {
        if (!/^\d{4}$/.test(modalPin)) {
          setModalError('Le code PIN doit contenir exactement 4 chiffres.');
          return;
        }
        if (modalPin !== modalConfirmPin) {
          setModalError('Les deux codes PIN ne correspondent pas.');
          return;
        }
        secretToHash = modalPin;
      } else if (modalLockMode === 'password') {
        if (modalPassword.length < 4) {
          setModalError('Le mot de passe doit contenir au moins 4 caractères.');
          return;
        }
        if (modalPassword !== modalConfirmPassword) {
          setModalError('Les deux mots de passe ne correspondent pas.');
          return;
        }
        secretToHash = modalPassword;
      } else if (modalLockMode === 'pattern') {
        if (!modalPatternStep1 || modalPatternStep1.split('-').length < 4) {
          setModalError('Tracez un schéma reliant au moins 4 points.');
          return;
        }
        if (modalPatternStep1 !== modalPatternStep2) {
          setModalError('Les deux schémas tracés ne correspondent pas.');
          setModalPatternStep1('');
          setModalPatternStep2('');
          return;
        }
        secretToHash = modalPatternStep1;
      }
    }

    setIsCompletingLaunchSetup(true);
    try {
      const finalHash = secretToHash ? await hashSecret(secretToHash) : securityConfig.secretHash;
      const nextConfig: SecurityConfig = {
        isEnabled: true,
        lockMode: modalLockMode,
        secretHash: finalHash,
        lockOnLaunch: true,
        lockedFeatures: draftLockedFeatures,
        autoLockMinutes: draftAutoLockMinutes,
      };
      saveSecurityConfig(nextConfig);
      setSecurityConfig(nextConfig);
      setDraftLockMode(modalLockMode);
      setDraftLockOnLaunch(true);
      onSecurityChanged(nextConfig);
      setIsLaunchSetupModalOpen(false);
      setModalPin('');
      setModalConfirmPin('');
      setModalPassword('');
      setModalConfirmPassword('');
      setModalPatternStep1('');
      setModalPatternStep2('');
      setSecurityNotice('Verrouillage au lancement activé et appliqué immédiatement.');
      // Engage launch lock screen immediately without restarting phone/app
      onLockNow();
    } finally {
      setIsCompletingLaunchSetup(false);
    }
  };

  const handleUpdateReminder = async (
    key: keyof NotificationSettings,
    patch: Partial<{ enabled: boolean; time: string; frequency: ReminderFrequency }>
  ) => {
    const next: NotificationSettings = {
      ...notifSettings,
      [key]: {
        ...notifSettings[key],
        ...patch,
      },
    };
    setNotifSettings(next);
    saveNotificationSettings(next);

    if (patch.enabled) {
      const perm = await requestReminderNotificationPermission();
      setNotifPermission(perm);
      if (perm === 'granted') {
        setNotifNotice('Rappel activé et enregistré.');
      } else if (perm === 'denied') {
        setNotifNotice(
          'Rappel enregistré. Les notifications système sont bloquées par l’appareil, mais le rappel s’affichera en bannière dans SHALOM.'
        );
      } else {
        setNotifNotice('Rappel enregistré (alerte intégrée dans SHALOM active).');
      }
    } else if (patch.enabled === false) {
      setNotifNotice('Ce rappel a été désactivé.');
    } else if (patch.frequency) {
      setNotifNotice('Fréquence du rappel mise à jour.');
    } else {
      setNotifNotice('Heure du rappel mise à jour.');
    }
  };

  const handleToggleUsageTips = (nextValue: boolean) => {
    setShowUsageTips(nextValue);
    setUsageTipsEnabled(nextValue);
    setUserForm((prev) => ({ ...prev, showUsageTips: nextValue }));
    setSaveNotice(
      nextValue
        ? 'Les conseils d’utilisation sont maintenant activés sur l’accueil.'
        : 'Les conseils d’utilisation ont été masqués.'
    );
  };

  const handleClearCacheOnly = async () => {
    setCacheClearing(true);
    setStorageActionMessage(null);
    try {
      let deletedCount = 0;
      if (typeof window !== 'undefined' && 'caches' in window) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((key) => window.caches.delete(key)));
        deletedCount = keys.length;
      }
      const stats = await dbService.getStorageEstimate();
      setStorageStats(stats);
      setStorageActionMessage(
        deletedCount > 0
          ? `Cache vidé (${deletedCount} espace(s) supprimé(s)). Vos données personnelles (prières, notes, contacts, livres et médias) sont 100 % intactes.`
          : 'Aucun fichier en cache à supprimer. Vos données personnelles restent 100 % intactes.'
      );
    } catch {
      setStorageActionMessage(
        'Impossible d’accéder au cache système dans cet environnement, mais vos données personnelles sont intactes.'
      );
    } finally {
      setCacheClearing(false);
    }
  };

  const handleCheckForUpdates = async () => {
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
      setUpdateCheckStatus('up-to-date');
      setUpdateCheckMessage(
        `Application APK autonome installée (v${__SHALOM_APP_VERSION__}) — Prête hors ligne sur votre téléphone.`
      );
      return;
    }

    if (!navigator.onLine) {
      setUpdateCheckStatus('offline');
      setUpdateCheckMessage(
        'Connexion Internet requise pour vérifier la disponibilité d’une nouvelle version.'
      );
      return;
    }

    setUpdateCheckStatus('checking');
    setUpdateCheckMessage('Vérification auprès du serveur en cours...');
    try {
      let hasNewSw = false;
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.update();
            if (reg.waiting || reg.installing) {
              hasNewSw = true;
            }
          }
        } catch {
          // ignore SW errors
        }
      }

      let hasNewHtmlBundle = false;
      try {
        const res = await fetch(`./index.html?check=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const html = await res.text();
          const remoteMatches = Array.from(html.matchAll(/assets\/index-[A-Za-z0-9_-]+\.js/g)).map(
            (m) => m[0]
          );
          const currentScripts = Array.from(document.querySelectorAll('script[src]')).map(
            (s) => s.getAttribute('src') || ''
          );
          if (remoteMatches.length > 0 && currentScripts.some((s) => s.includes('assets/index-'))) {
            const matchesCurrent = remoteMatches.some((rm) =>
              currentScripts.some((cs) => cs.includes(rm))
            );
            if (!matchesCurrent) {
              hasNewHtmlBundle = true;
            }
          }
        }
      } catch {
        // ignore fetch error
      }

      if (hasNewSw || hasNewHtmlBundle) {
        setUpdateCheckStatus('available');
        setUpdateCheckMessage(
          'Une nouvelle version de SHALOM est disponible ! Appuyez sur « Actualiser l’application ».'
        );
      } else {
        setUpdateCheckStatus('up-to-date');
        setUpdateCheckMessage(
          `Vous utilisez déjà la dernière version disponible (${__SHALOM_APP_VERSION__}).`
        );
      }
    } catch {
      setUpdateCheckStatus('error');
      setUpdateCheckMessage('Impossible de joindre le serveur de mise à jour pour le moment.');
    }
  };

  const handleDownloadBackup = async () => {
    try {
      setBackupLoading(true);
      const jsonBackup = await dbService.exportBackup(includeMediaInBackup);
      const blob = new Blob([jsonBackup], { type: 'application/json' });
      const fileName = `shalom_sauvegarde_${includeMediaInBackup ? 'complete_' : ''}${new Date().toISOString().split('T')[0]}.json`;
      await downloadBlobSafe(blob, fileName);
      setRestoreMessage(
        includeMediaInBackup
          ? 'Sauvegarde complète (avec médias) téléchargée.'
          : 'Sauvegarde JSON téléchargée.'
      );
    } catch {
      setRestoreMessage('Erreur lors de la création de la sauvegarde.');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result as string;
      if (!content) return;
      const result = await dbService.restoreBackup(content);
      setRestoreMessage(result.message);
      if (result.success) reloadData();
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDownloadLogo = async (format: 'png' | 'jpg') => {
    const fileName = `shalom_logo_512x512.${format}`;
    try {
      const response = await fetch(`./${fileName}`);
      const blob = await response.blob();
      await downloadBlobSafe(blob, fileName);
      setAboutNotice(`Logo ${fileName} téléchargé.`);
    } catch {
      setAboutNotice('Erreur lors du téléchargement du logo.');
    }
  };

  const toggleDashboardSection = (key: keyof DashboardSectionsConfig) => {
    updatePrefs({
      dashboardSections: {
        ...prefs.dashboardSections,
        [key]: !prefs.dashboardSections[key],
      },
    });
  };

  const toggleDashboardShortcut = (id: DashboardShortcutId) => {
    const exists = prefs.dashboardShortcuts.includes(id);
    const nextList = exists
      ? prefs.dashboardShortcuts.filter((item) => item !== id)
      : [...prefs.dashboardShortcuts, id];
    if (nextList.length === 0) return;
    updatePrefs({ dashboardShortcuts: nextList });
  };

  const activeNotificationsCount = [
    notifSettings.dailyPrayer.enabled,
    notifSettings.meditation.enabled,
    notifSettings.bibleReading.enabled,
  ].filter(Boolean).length;

  const deviceCategoryLabel =
    viewportWidth < 400
      ? 'Téléphone compact'
      : viewportWidth < 768
      ? 'Smartphone'
      : viewportWidth < 1024
      ? 'Tablette'
      : 'Grand écran';

  const diagnosticSummary = `SHALOM v${__SHALOM_APP_VERSION__} (${__SHALOM_BUILD_DATE__}) | Écran: ${deviceCategoryLabel} (${viewportWidth}px) | Stockage: ${storageStats.usageMB} Mo | Mode: ${isDarkMode ? 'Sombre' : 'Clair'} | Réseau: ${isOnline ? 'En ligne' : 'Hors ligne'}`;

  const supportPayload: SharePayload = {
    title: 'Support / Retour SHALOM',
    text: `Bonjour,\n\nVoici mon message concernant SHALOM :\n\n---\n${diagnosticSummary}`,
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header + Horizontal Scrollable Category Bar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2 font-display">
              <Settings className="w-6 h-6" style={{ color: 'var(--shalom-primary)' }} />
              <span>Centre de Paramètres</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Apparence, rappels, sécurité, données locales, personnalisation et partage
            </p>
          </div>

          <button
            type="button"
            onClick={onToggleDarkMode}
            className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-white dark:bg-[#0c1631] border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 shadow-xs hover:border-slate-300 transition min-h-[40px]"
          >
            {isDarkMode ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span>Passer au thème clair</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-blue-700" />
                <span>Passer au thème sombre</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 max-w-full overflow-x-auto no-scrollbar">
          {CATEGORY_TABS.map((cat) => {
            const Icon = cat.icon;
            const active = subTab === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSubTab(cat.id)}
                className={`px-3 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[38px] ${
                  active
                    ? 'bg-white dark:bg-[#0f2b5c] text-blue-700 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{cat.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* HUB VUE GÉNÉRALE */}
      {subTab === 'general' && (
        <div className="space-y-6">
          {/* Control Center Identity Banner */}
          <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#0b1f42] via-[#132d5e] to-[#1e40af] text-white shadow-lg border border-blue-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden bg-white/10 border border-amber-400/50 flex items-center justify-center font-extrabold text-xl shrink-0">
                {userForm.avatarDataUrl ? (
                  <img
                    src={userForm.avatarDataUrl}
                    alt={userForm.fullName || 'Profil'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{(userForm.fullName || 'U').trim().charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">
                  Centre de contrôle SHALOM
                </span>
                <h3 className="text-lg sm:text-xl font-extrabold truncate">
                  {userForm.fullName || 'Utilisateur'}
                </h3>
                <p className="text-xs text-blue-100/90 mt-0.5 truncate">
                  {currentLanguageInfo.nativeName} · {activeNotificationsCount} rappel(s) actif(s) ·{' '}
                  {securityConfig.isEnabled ? 'Verrouillage activé' : 'Accès libre'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSubTab('personalization')}
                className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition min-h-[40px]"
              >
                Modifier le profil
              </button>
              <button
                type="button"
                onClick={() => setSubTab('backup')}
                className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold transition min-h-[40px]"
              >
                Sauvegarde ({storageStats.usageMB} Mo)
              </button>
            </div>
          </div>

          {/* 7 Category Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CATEGORY_TABS.filter((c) => c.id !== 'general').map((cat) => {
              const Icon = cat.icon;
              let statusSummary = '';
              if (cat.id === 'appearance') {
                statusSummary = `${isDarkMode ? 'Sombre' : 'Clair'} · Texte ${prefs.textSize}`;
              } else if (cat.id === 'notifications') {
                statusSummary = `${activeNotificationsCount} sur 3 activé(s)`;
              } else if (cat.id === 'security') {
                statusSummary = securityConfig.isEnabled
                  ? `Protection (${securityConfig.lockMode.toUpperCase()})`
                  : 'Aucun verrou actif';
              } else if (cat.id === 'backup') {
                statusSummary = `${storageStats.usageMB} Mo utilisés`;
              } else if (cat.id === 'personalization') {
                statusSummary = `${currentLanguageInfo.nativeName} · Accueil personnalisable`;
              } else if (cat.id === 'sharing') {
                statusSummary = `WhatsApp, Gmail & Réseaux (${prefs.preferredShareChannel})`;
              } else if (cat.id === 'about') {
                statusSummary = `v${__SHALOM_APP_VERSION__} · ${isOnline ? 'En ligne' : 'Hors ligne'}`;
              }

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSubTab(cat.id)}
                  className="p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 hover:border-blue-500/60 dark:hover:border-blue-500/60 text-left space-y-3 shadow-xs transition group flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0 shadow-xs"
                        style={{ backgroundColor: 'var(--shalom-primary)' }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        {cat.code && (
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                            Catégorie {cat.code}
                          </span>
                        )}
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 transition truncate">
                          {cat.label}
                        </h3>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition shrink-0 mt-1" />
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {cat.desc}
                  </p>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    {statusSummary}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* A. APPARENCE ET AFFICHAGE */}
      {subTab === 'appearance' && (
        <div className="max-w-2xl space-y-5">
          {prefsNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{prefsNotice}</span>
            </div>
          )}

          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-5 shadow-xs">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--shalom-primary)' }}>
              <Palette className="w-4 h-4" />
              <span>A. Apparence et affichage</span>
            </div>

            {/* Mode clair / sombre */}
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">
                  Mode clair ou mode sombre
                </span>
                <span className="text-[11px] text-slate-500">
                  Adapte la luminosité de toute l’interface selon votre environnement.
                </span>
              </div>
              <button
                type="button"
                onClick={onToggleDarkMode}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-2 font-bold shrink-0 min-h-[40px]"
              >
                {isDarkMode ? <Moon className="w-4 h-4 text-blue-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                <span>{isDarkMode ? 'Sombre' : 'Clair'}</span>
              </button>
            </div>

            {/* Couleur principale */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Couleur principale de l’application
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {ACCENT_COLOR_OPTIONS.map((opt) => {
                  const selected = prefs.accentColor === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        updatePrefs(
                          { accentColor: opt.id },
                          `Couleur principale « ${opt.labelFr} » appliquée.`
                        )
                      }
                      className={`p-3 rounded-xl border text-left flex items-center gap-2.5 text-xs transition min-h-[44px] ${
                        selected
                          ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30 font-bold text-slate-900 dark:text-white ring-2 ring-blue-500/20'
                          : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full shrink-0 border border-black/10 ${opt.swatchClass}`} />
                      <span className="truncate">{opt.labelFr}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Taille du texte */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Taille du texte
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { id: 'small', label: 'Compact' },
                    { id: 'normal', label: 'Normal' },
                    { id: 'large', label: 'Grand' },
                    { id: 'xlarge', label: 'Très grand' },
                  ] as Array<{ id: TextSizeScale; label: string }>
                ).map((item) => {
                  const selected = prefs.textSize === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        updatePrefs({ textSize: item.id }, `Taille du texte « ${item.label} » appliquée.`)
                      }
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition min-h-[42px] ${
                        selected
                          ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Confort de lecture & Animations */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">
                    Mode confort de lecture
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Adoucit le fond et contraste chaleureusement pour réduire la fatigue visuelle.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updatePrefs(
                      { readingComfort: !prefs.readingComfort },
                      !prefs.readingComfort
                        ? 'Confort de lecture activé.'
                        : 'Confort de lecture désactivé.'
                    )
                  }
                  className={`px-3.5 py-2 rounded-xl border font-bold shrink-0 min-h-[40px] ${
                    prefs.readingComfort
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {prefs.readingComfort ? 'Activé' : 'Désactivé'}
                </button>
              </div>

              <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">
                    Réduire les animations
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Accélère les transitions pour un confort maximal et une meilleure fluidité mobile.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updatePrefs(
                      { reduceAnimations: !prefs.reduceAnimations },
                      !prefs.reduceAnimations
                        ? 'Animations réduites activées.'
                        : 'Animations standards rétablies.'
                    )
                  }
                  className={`px-3.5 py-2 rounded-xl border font-bold shrink-0 min-h-[40px] ${
                    prefs.reduceAnimations
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {prefs.reduceAnimations ? 'Activé' : 'Désactivé'}
                </button>
              </div>
            </div>

            {/* Adapter à l'appareil */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">
                    Affichage détecté : {deviceCategoryLabel} ({viewportWidth}px)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Mise en page optimisée automatiquement pour votre écran.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* B. NOTIFICATIONS ET RAPPELS */}
      {subTab === 'notifications' && (
        <div className="max-w-2xl space-y-5">
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
                  <Bell className="w-4 h-4" />
                  <span>B. Notifications et rappels quotidiens</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Activez, planifiez l’heure et définissez la fréquence de chaque rappel spirituel séparément.
                </p>
              </div>

              <button
                type="button"
                onClick={async () => {
                  const perm = await requestReminderNotificationPermission();
                  setNotifPermission(perm);
                  const sent = showLocalReminderNotification(
                    'SHALOM · Test de rappel',
                    'Vos rappels spirituels sont bien configurés.'
                  );
                  setNotifNotice(
                    sent
                      ? 'Notification de test envoyée avec succès.'
                      : 'Aperçu enregistré. Si l’appareil bloque les alertes système, le rappel s’affichera en bannière dans SHALOM.'
                  );
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto min-h-[40px]"
              >
                <Bell className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Tester une notification</span>
              </button>
            </div>

            {notifNotice && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{notifNotice}</span>
              </div>
            )}

            <div className="space-y-3">
              {[
                {
                  key: 'dailyPrayer' as const,
                  title: 'Rappel quotidien de prière',
                  desc: 'Un moment dédié pour votre vie de prière et d’intercession.',
                },
                {
                  key: 'meditation' as const,
                  title: 'Rappel de méditation',
                  desc: 'Une pause calme pour méditer la Parole et cultiver la paix intérieure.',
                },
                {
                  key: 'bibleReading' as const,
                  title: 'Rappel de lecture biblique',
                  desc: 'Un rendez-vous régulier pour lire votre passage biblique.',
                },
              ].map((item) => {
                const cfg = notifSettings[item.key];
                const freq: ReminderFrequency = cfg.frequency || 'daily';
                return (
                  <div
                    key={item.key}
                    className={`p-4 rounded-xl border transition space-y-3 ${
                      cfg.enabled
                        ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/60'
                        : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        {cfg.enabled ? (
                          <Bell className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
                        ) : (
                          <BellOff className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                            {item.title}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {item.desc}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleUpdateReminder(item.key, { enabled: !cfg.enabled })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 border transition min-h-[38px] ${
                          cfg.enabled
                            ? 'bg-blue-700 text-white border-blue-700'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {cfg.enabled ? 'Activé' : 'Désactivé'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Heure :</span>
                        </label>
                        <input
                          type="time"
                          value={cfg.time}
                          onChange={(e) => handleUpdateReminder(item.key, { time: e.target.value })}
                          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Fréquence :
                        </label>
                        <select
                          value={freq}
                          onChange={(e) =>
                            handleUpdateReminder(item.key, {
                              frequency: e.target.value as ReminderFrequency,
                            })
                          }
                          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        >
                          <option value="daily">Tous les jours</option>
                          <option value="weekdays">Lun – Ven</option>
                          <option value="weekends">Week-end</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span>
                Autorisation système :{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {notifPermission === 'granted'
                    ? 'Accordée'
                    : notifPermission === 'denied'
                    ? 'Refusée (alerte interne active)'
                    : notifPermission === 'unsupported'
                    ? 'Non supportée (alerte interne active)'
                    : 'Non demandée'}
                </strong>
              </span>
              {notifPermission === 'default' && (
                <button
                  type="button"
                  onClick={async () => {
                    const perm = await requestReminderNotificationPermission();
                    setNotifPermission(perm);
                  }}
                  className="text-blue-700 dark:text-blue-400 font-bold hover:underline"
                >
                  Autoriser les notifications
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* C. CONFIDENTIALITÉ ET SÉCURITÉ */}
      {subTab === 'security' && (
        <div className="max-w-2xl space-y-6">
          <form onSubmit={handleSaveSecurityPolicy} className="space-y-6">
            <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-5 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
                  <Shield className="w-4 h-4" />
                  <span>C. Protection & Verrouillage au choix</span>
                </div>
                {securityConfig.isEnabled && (
                  <button
                    type="button"
                    onClick={handleDisableSecurity}
                    className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-50"
                  >
                    Désactiver
                  </button>
                )}
              </div>

              {securityNotice && (
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-xs font-semibold text-blue-800 dark:text-blue-300">
                  {securityNotice}
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  1. Que souhaitez-vous protéger ?
                </h3>

                <label className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      Bloquer l’ouverture de l’application
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Demande une identification au démarrage
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={draftLockOnLaunch}
                    onChange={(e) => handleToggleLockOnLaunch(e.target.checked)}
                    className="w-4 h-4 accent-blue-700"
                  />
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {LOCKABLE_FEATURES.map((feat) => {
                    const checked = draftLockedFeatures.includes(feat.id);
                    return (
                      <label
                        key={feat.id}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 cursor-pointer transition ${
                          checked
                            ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 font-semibold'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <span className="truncate">{feat.label}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFeatureLock(feat.id)}
                          className="accent-blue-700 shrink-0"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  2. Mode de verrouillage
                </h3>

                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'pin', label: 'Code PIN', icon: Hash },
                    { id: 'password', label: 'Mot de passe', icon: KeyRound },
                    { id: 'pattern', label: 'Schéma 3×3', icon: Grid3X3 },
                  ].map((m) => {
                    const Icon = m.icon;
                    const active = draftLockMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setDraftLockMode(m.id as LockMode);
                          setSecurityNotice(null);
                        }}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-xs font-semibold transition ${
                          active
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-2 ring-blue-600/20'
                            : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-3">
                  {securityConfig.secretHash && securityConfig.lockMode === draftLockMode && (
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                      Un secret ({draftLockMode}) est déjà configuré. Laissez vide pour le conserver.
                    </p>
                  )}

                  {draftLockMode === 'pin' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-semibold mb-1">Nouveau PIN (4 chiffres)</label>
                        <input
                          type="password"
                          maxLength={4}
                          placeholder="••••"
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-full px-3 py-2 text-center font-mono tracking-widest rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Confirmer</label>
                        <input
                          type="password"
                          maxLength={4}
                          placeholder="••••"
                          value={confirmPin}
                          onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))}
                          className="w-full px-3 py-2 text-center font-mono tracking-widest rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                        />
                      </div>
                    </div>
                  )}

                  {draftLockMode === 'password' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block font-semibold mb-1">Mot de passe</label>
                        <input
                          type="password"
                          placeholder="Min. 4 caractères"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Confirmer</label>
                        <input
                          type="password"
                          placeholder="Confirmer"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                        />
                      </div>
                    </div>
                  )}

                  {draftLockMode === 'pattern' && (
                    <div className="text-center space-y-2">
                      {!patternStep1 ? (
                        <PatternGrid
                          key="pattern-step-1"
                          label="Étape 1/2 : Tracez votre schéma (min. 4 points)"
                          onPatternComplete={(pat) => {
                            if (pat.split('-').length >= 4) {
                              setSecurityNotice(null);
                              setPatternStep1(pat);
                            } else {
                              setSecurityNotice('Reliez au moins 4 points.');
                            }
                          }}
                        />
                      ) : !patternStep2 ? (
                        <div className="space-y-2">
                          <PatternGrid
                            key="pattern-step-2"
                            label="Étape 2/2 : Confirmez le même schéma"
                            onPatternComplete={(pat) => {
                              if (pat !== patternStep1) {
                                setSecurityNotice('Les deux schémas ne correspondent pas. Tracez à nouveau.');
                                return;
                              }
                              setSecurityNotice(null);
                              setPatternStep2(pat);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setPatternStep1('');
                              setPatternStep2('');
                            }}
                            className="text-xs text-slate-500 underline"
                          >
                            Recommencer
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            Schéma confirmé et prêt à être enregistré.
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPatternStep1('');
                              setPatternStep2('');
                            }}
                            className="text-xs text-slate-500 underline"
                          >
                            Tracer un autre schéma
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  3. Verrouillage automatique & Discrétion
                </h3>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        Délai d’inactivité avant verrouillage
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Verrouille automatiquement l’application après une période sans action
                      </span>
                    </div>
                  </div>
                  <select
                    value={draftAutoLockMinutes}
                    onChange={(e) => {
                      const nextMinutes = Number(e.target.value);
                      setDraftAutoLockMinutes(nextMinutes);
                      if (securityConfig.isEnabled && securityConfig.secretHash) {
                        const updated: SecurityConfig = {
                          ...securityConfig,
                          autoLockMinutes: nextMinutes,
                        };
                        saveSecurityConfig(updated);
                        setSecurityConfig(updated);
                        onSecurityChanged(updated);
                        setSecurityNotice('Délai d’inactivité mis à jour et appliqué immédiatement.');
                      }
                    }}
                    className="px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white shrink-0"
                  >
                    <option value={0}>Désactivé (Jamais)</option>
                    <option value={0.25}>Après 15 secondes</option>
                    <option value={0.5}>Après 30 secondes</option>
                    <option value={1}>Après 1 minute</option>
                    <option value={3}>Après 3 minutes</option>
                    <option value={5}>Après 5 minutes</option>
                    <option value={15}>Après 15 minutes</option>
                    <option value={30}>Après 30 minutes</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    {prefs.hideSensitiveOnHome ? (
                      <EyeOff className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
                    ) : (
                      <Eye className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-white block">
                        Masquer les titres personnels sur l’accueil
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Protège vos sujets de prière, notes et enregistrements des regards indiscrets
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updatePrefs({ hideSensitiveOnHome: !prefs.hideSensitiveOnHome })
                    }
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold shrink-0 min-h-[38px] ${
                      prefs.hideSensitiveOnHome
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {prefs.hideSensitiveOnHome ? 'Masqué' : 'Visible'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                {securityConfig.isEnabled && (
                  <button
                    type="button"
                    onClick={onLockNow}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Verrouiller maintenant</span>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSavingSecurity}
                  className="px-6 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-70 text-white text-xs font-bold flex items-center gap-2"
                >
                  {isSavingSecurity ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Enregistrer la protection</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Gestion des autorisations de l'appareil */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-4 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Autorisations de l’appareil</span>
              </div>
              <button
                type="button"
                onClick={refreshMediaPermissions}
                className="text-[11px] font-bold text-blue-700 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Actualiser</span>
              </button>
            </div>

            {permCheckMessage && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200">
                {permCheckMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Bell className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <span className="font-bold block">Notifications</span>
                    <span className="text-[11px] text-slate-500">
                      {notifPermission === 'granted'
                        ? 'Accordée'
                        : notifPermission === 'denied'
                        ? 'Refusée'
                        : notifPermission === 'unsupported'
                        ? 'Indisponible'
                        : 'À autoriser'}
                    </span>
                  </div>
                </div>
                {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
                  <button
                    type="button"
                    onClick={async () => {
                      const p = await requestReminderNotificationPermission();
                      setNotifPermission(p);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-700 text-white text-[11px] font-bold"
                  >
                    Autoriser
                  </button>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Mic className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold block">Microphone</span>
                    <span className="text-[11px] text-slate-500">
                      {micPermission === 'granted'
                        ? 'Accordé'
                        : micPermission === 'denied'
                        ? 'Refusé'
                        : micPermission === 'unsupported'
                        ? 'Indisponible'
                        : 'À tester'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRequestDeviceMedia('microphone')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[11px] font-bold"
                >
                  Tester
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Camera className="w-4 h-4 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-bold block">Caméra</span>
                    <span className="text-[11px] text-slate-500">
                      {camPermission === 'granted'
                        ? 'Accordée'
                        : camPermission === 'denied'
                        ? 'Refusée'
                        : camPermission === 'unsupported'
                        ? 'Indisponible'
                        : 'À tester'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRequestDeviceMedia('camera')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[11px] font-bold"
                >
                  Tester
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <HardDrive className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <span className="font-bold block">Stockage persistant</span>
                    <span className="text-[11px] text-slate-500">
                      {storageStats.persisted ? 'Actif' : 'Standard'}
                    </span>
                  </div>
                </div>
                {!storageStats.persisted && (
                  <button
                    type="button"
                    onClick={async () => {
                      await dbService.requestPersistentStorage();
                      const s = await dbService.getStorageEstimate();
                      setStorageStats(s);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-700 text-white text-[11px] font-bold"
                  >
                    Activer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* D. DONNÉES ET STOCKAGE */}
      {subTab === 'backup' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-4 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
                  <HardDrive className="w-4 h-4" />
                  <span>D. Stockage Local Haute Capacité</span>
                </div>
                {storageStats.persisted && (
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    Mémoire persistante active
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="tabular-nums">Utilisé : {storageStats.usageMB} Mo</span>
                  <span className="tabular-nums">
                    Capacité :{' '}
                    {storageStats.quotaMB >= 1024
                      ? `${(storageStats.quotaMB / 1024).toFixed(1)} Go`
                      : `${storageStats.quotaMB} Mo`}
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-blue-700 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(2, storageStats.percentage)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Vos audios, vidéos, photos, livres et notes sont enregistrés dans IndexedDB sur votre appareil.
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {!storageStats.persisted && (
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await dbService.requestPersistentStorage();
                        const stats = await dbService.getStorageEstimate();
                        setStorageStats(stats);
                        setStorageActionMessage(
                          ok
                            ? 'Mémoire persistante haute capacité activée.'
                            : 'La mémoire maximale disponible sur ce navigateur est déjà allouée.'
                        );
                      }}
                      className="px-3 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Activer mémoire étendue</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={async () => {
                      const count = await dbService.purgeOrphanMediaBlobs();
                      const stats = await dbService.getStorageEstimate();
                      setStorageStats(stats);
                      setStorageActionMessage(
                        count > 0
                          ? `${count} fichier(s) résiduel(s) nettoyé(s) pour libérer de la mémoire.`
                          : 'Mémoire déjà propre et optimisée.'
                      );
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold"
                  >
                    Optimiser la mémoire
                  </button>

                  <button
                    type="button"
                    onClick={handleClearCacheOnly}
                    disabled={cacheClearing}
                    className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {cacheClearing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Eraser className="w-3.5 h-3.5" />
                    )}
                    <span>Vider uniquement le cache</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  « Vider uniquement le cache » efface les fichiers temporaires hors-ligne sans jamais supprimer vos données personnelles.
                </p>

                {storageActionMessage && (
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {storageActionMessage}
                  </p>
                )}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-4 shadow-xs">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
                <Download className="w-4 h-4" />
                <span>Exporter / Restaurer (JSON)</span>
              </div>

              <label className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs cursor-pointer">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">
                    Inclure les fichiers médias (audio, vidéo, images)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Produit un fichier plus volumineux mais 100 % complet
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={includeMediaInBackup}
                  onChange={(e) => setIncludeMediaInBackup(e.target.checked)}
                  className="w-4 h-4 accent-blue-700 shrink-0"
                />
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  disabled={backupLoading}
                  className="px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  {backupLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>Télécharger Sauvegarde</span>
                </button>

                <label className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Restaurer</span>
                  <input type="file" accept=".json" onChange={handleRestoreFile} className="hidden" />
                </label>
              </div>

              {restoreMessage && (
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {restoreMessage}
                </p>
              )}
            </div>
          </div>

          {/* Interactive Stored Data Explorer */}
          <DataExplorerCard
            onDataChanged={() => {
              reloadData();
              dbService.getStorageEstimate().then(setStorageStats);
            }}
          />
        </div>
      )}

      {/* E. PERSONNALISATION */}
      {subTab === 'personalization' && (
        <div className="max-w-2xl space-y-6">
          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-4 shadow-xs">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
                <User className="w-4 h-4" />
                <span>E. Profil & Verset d’accueil</span>
              </div>

              {/* Photo de profil */}
              <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-[#0b1f42] text-white flex items-center justify-center font-bold text-lg shrink-0 border-2 border-amber-400/50">
                  {userForm.avatarDataUrl ? (
                    <img
                      src={userForm.avatarDataUrl}
                      alt={userForm.fullName || 'Profil'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{(userForm.fullName || 'U').trim().charAt(0).toUpperCase()}</span>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Photo de profil
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition">
                      <Camera className="w-3.5 h-3.5" />
                      <span>{userForm.avatarDataUrl ? 'Changer la photo' : 'Ajouter une photo'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                    </label>
                    {userForm.avatarDataUrl && (
                      <button
                        type="button"
                        onClick={() => setUserForm({ ...userForm, avatarDataUrl: undefined })}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Retirer</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Nom complet / Prénom</label>
                  <input
                    type="text"
                    placeholder="Ex: David Kouassi"
                    value={userForm.fullName}
                    onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Téléphone</label>
                  <input
                    type="tel"
                    value={userForm.phone || ''}
                    onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">E-mail personnel (optionnel)</label>
                <input
                  type="email"
                  placeholder="exemple@gmail.com"
                  value={userForm.email || ''}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
              </div>

              {/* Verset affiché dans le Dashboard */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-400">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Verset affiché à l’Accueil (Dashboard)</span>
                  </span>
                  {(userForm.dashboardVerseText || userForm.dashboardVerseRef) && (
                    <button
                      type="button"
                      onClick={() =>
                        setUserForm({ ...userForm, dashboardVerseText: '', dashboardVerseRef: '' })
                      }
                      className="text-[11px] font-semibold text-slate-500 hover:text-blue-700 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Verset par défaut</span>
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Texte du verset</label>
                  <textarea
                    rows={3}
                    placeholder="Collez ici le verset à afficher sur l’écran d’accueil..."
                    value={userForm.dashboardVerseText || ''}
                    onChange={(e) =>
                      setUserForm({ ...userForm, dashboardVerseText: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Référence (facultatif)</label>
                  <input
                    type="text"
                    placeholder="Ex: Psaume 23:1"
                    value={userForm.dashboardVerseRef || ''}
                    onChange={(e) =>
                      setUserForm({ ...userForm, dashboardVerseRef: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  />
                </div>
              </div>

              {/* Langue avec sélection puis bouton Appliquer et Enregistrer */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                <label className="block text-xs font-semibold">{t('settings.languageLabel')}</label>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <Globe className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
                    <span>
                      {currentLanguageInfo.nativeName} ({currentLanguageInfo.code}) · {t('settings.languageDesc')}
                    </span>
                  </div>

                  <input
                    type="text"
                    value={langSearch}
                    onChange={(e) => setLangSearch(e.target.value)}
                    placeholder="Rechercher une langue (Français, English, Lingala, Swahili, Español...)"
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  />

                  <select
                    value={draftLanguage}
                    onChange={(e) => {
                      setDraftLanguage(e.target.value as AppLanguage);
                      setLangAppliedNotice(null);
                    }}
                    size={5}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  >
                    {WORLD_LANGUAGES.filter((opt) => {
                      const q = langSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        opt.nativeName.toLowerCase().includes(q) ||
                        opt.labelFr.toLowerCase().includes(q) ||
                        opt.code.toLowerCase().includes(q)
                      );
                    }).map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.nativeName} — {opt.labelFr} ({opt.code})
                      </option>
                    ))}
                  </select>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-slate-500">
                      Sélectionnée : <strong>{draftLanguage}</strong>
                      {draftLanguage !== lang ? ' (non encore appliquée)' : ' (active)'}
                    </span>
                    <button
                      type="button"
                      onClick={handleApplyAndSaveLanguage}
                      className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Appliquer et enregistrer la langue</span>
                    </button>
                  </div>

                  {langAppliedNotice && (
                    <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      {langAppliedNotice}
                    </p>
                  )}
                </div>
              </div>

              {saveNotice && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{saveNotice}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-6 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-70 text-white font-bold text-xs shadow-sm transition inline-flex items-center gap-2"
              >
                {isSavingProfile ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Enregistrer le profil</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Organisation Accueil, Page d'ouverture, Format Dates & Conseils */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-5 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
                <LayoutDashboard className="w-4 h-4" />
                <span>Organisation & Expérience</span>
              </div>
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(true)}
                className="text-[11px] font-semibold text-slate-500 hover:text-red-600 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Réinitialiser les préférences</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Page d’ouverture au lancement</label>
                <select
                  value={prefs.startupPage}
                  onChange={(e) =>
                    updatePrefs({ startupPage: e.target.value as StartupPageOption })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                >
                  <option value="dashboard">Accueil (Tableau de bord)</option>
                  <option value="altar">Mon Autel</option>
                  <option value="prayers">Prières & Témoignages</option>
                  <option value="journey">Parcours Spirituel</option>
                  <option value="parole">Parole Divine</option>
                  <option value="vault">Coffre Spirituel</option>
                  <option value="calendar">Mon Calendrier</option>
                  <option value="contacts">Mes Contacts</option>
                  <option value="messaging">Partage & Messages</option>
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">Format d’affichage des dates</label>
                <select
                  value={prefs.dateFormat}
                  onChange={(e) =>
                    updatePrefs({ dateFormat: e.target.value as DateFormatOption })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                >
                  <option value="dd_mm_yyyy">JJ/MM/AAAA (ex: 21/11/2026)</option>
                  <option value="long">Long (ex: 21 novembre 2026)</option>
                  <option value="iso">AAAA-MM-JJ (ex: 2026-11-21)</option>
                </select>
              </div>
            </div>

            {/* Sections visibles sur l'Accueil */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Sections visibles sur l’écran d’accueil
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {(
                  [
                    { key: 'todaysAltar', label: 'Autel et prière du jour' },
                    { key: 'kpis', label: 'Cartes de progression (KPI)' },
                    { key: 'quickModules', label: 'Accès rapide aux fonctionnalités' },
                    { key: 'recentPrayers', label: 'Prières récentes' },
                    { key: 'latestParole', label: 'Dernières paroles enregistrées' },
                    { key: 'upcomingEvents', label: 'Prochains événements' },
                  ] as Array<{ key: keyof DashboardSectionsConfig; label: string }>
                ).map((sec) => {
                  const enabled = prefs.dashboardSections[sec.key];
                  return (
                    <label
                      key={sec.key}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                        {sec.label}
                      </span>
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => toggleDashboardSection(sec.key)}
                        className="accent-blue-700 shrink-0"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Raccourcis rapides sur la bannière d'accueil */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                Boutons d’action rapide sur l’accueil
              </span>
              <div className="flex flex-wrap gap-2 text-xs">
                {(
                  [
                    { id: 'newPrayer', label: 'Nouvelle prière' },
                    { id: 'recordParole', label: 'Enregistrer Parole' },
                    { id: 'share', label: 'Partager' },
                    { id: 'openAltar', label: 'Mon Autel' },
                    { id: 'openVault', label: 'Coffre Spirituel' },
                    { id: 'openCalendar', label: 'Calendrier' },
                  ] as Array<{ id: DashboardShortcutId; label: string }>
                ).map((sc) => {
                  const active = prefs.dashboardShortcuts.includes(sc.id);
                  return (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => toggleDashboardShortcut(sc.id)}
                      className={`px-3 py-1.5 rounded-xl border font-semibold transition ${
                        active
                          ? 'bg-blue-700 text-white border-blue-700'
                          : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {sc.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Conseils d'utilisation */}
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex items-start gap-2.5">
                <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white block">
                    Afficher les conseils d’utilisation
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Astuces pratiques affichées sur l’écran d’accueil de SHALOM
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleToggleUsageTips(!showUsageTips)}
                className={`px-3 py-1.5 rounded-lg border font-bold shrink-0 transition ${
                  showUsageTips
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                }`}
              >
                {showUsageTips ? 'Activés' : 'Désactivés'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* F. RÉSEAUX ET PARTAGE (AVEC GMAIL) */}
      {subTab === 'sharing' && (
        <div className="max-w-2xl space-y-5">
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
                  <Share2 className="w-4 h-4" />
                  <span>F. Réseaux et partage (WhatsApp, Gmail & Social)</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Configurez vos canaux de partage favoris, l’indicatif pays et vos réglages Gmail.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setTestSharePayload({
                    title: 'Test de partage SHALOM',
                    text: `Que la paix du Seigneur vous accompagne !\n— ${userForm.fullName || 'SHALOM'}`,
                    recipientEmail: prefs.gmailDefaultRecipient || undefined,
                  })
                }
                className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Tester le partage / Gmail</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold mb-1">Canal de partage favori</label>
                <select
                  value={prefs.preferredShareChannel}
                  onChange={(e) =>
                    updatePrefs({
                      preferredShareChannel: e.target.value as PreferredShareChannel,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                >
                  <option value="whatsapp">WhatsApp</option>
                  <option value="gmail">Gmail</option>
                  <option value="sms">SMS Natif</option>
                  <option value="native">Menu natif du téléphone</option>
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">Indicatif pays WhatsApp par défaut</label>
                <input
                  type="tel"
                  placeholder="Ex: 225, 237, 243, 33"
                  value={prefs.defaultCountryPrefix}
                  onChange={(e) =>
                    updatePrefs({
                      defaultCountryPrefix: e.target.value.replace(/[^0-9+]/g, ''),
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>

            {/* Réglages Gmail */}
            <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/50 space-y-3 text-xs">
              <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
                <Mail className="w-4 h-4" />
                <span>Configuration Gmail</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Destinataire Gmail par défaut (optionnel)
                  </label>
                  <input
                    type="email"
                    placeholder="destinataire@gmail.com"
                    value={prefs.gmailDefaultRecipient}
                    onChange={(e) => updatePrefs({ gmailDefaultRecipient: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-rose-200 dark:border-rose-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Préfixe d’objet Gmail (optionnel)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: [SHALOM]"
                    value={prefs.gmailSubjectPrefix}
                    onChange={(e) => updatePrefs({ gmailSubjectPrefix: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-rose-200 dark:border-rose-800"
                  />
                </div>
              </div>

              <p className="text-[11px] text-rose-900/80 dark:text-rose-200/80 leading-relaxed">
                Depuis chaque partage (Témoignage, Parole Divine, Coffre, Messagerie), l’option <strong>Gmail</strong> ouvre directement Gmail avec l’objet et le texte pré-remplis. L’envoi final est validé directement dans Gmail.
              </p>
            </div>

            {/* Aperçu canaux */}
            <div className="space-y-2">
              <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Canaux disponibles dans SHALOM
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                {[
                  { name: 'WhatsApp', status: 'Actif' },
                  { name: 'Gmail', status: 'Actif' },
                  { name: 'SMS Natif', status: 'Actif' },
                  { name: 'Menu téléphone', status: 'Actif + Média' },
                  { name: 'Facebook', status: 'Actif' },
                  { name: 'Instagram', status: 'Texte copié' },
                  { name: 'X / Twitter', status: 'Actif' },
                  { name: 'TikTok', status: 'Texte copié' },
                ].map((ch) => (
                  <div
                    key={ch.name}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                  >
                    <span className="font-bold text-slate-900 dark:text-white block">
                      {ch.name}
                    </span>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                      {ch.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* G. INFORMATIONS SUR SHALOM */}
      {subTab === 'about' && (
        <div className="max-w-2xl space-y-5">
          {aboutNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{aboutNotice}</span>
            </div>
          )}

          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-5 shadow-xs">
            <div className="flex items-center gap-3">
              <img
                src="./shalom_logo.jpg"
                alt="SHALOM"
                className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
              />
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  G. Informations sur SHALOM
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Compagnon spirituel autonome · 100 % hors ligne sur cet appareil
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 block">Version installée</span>
                <strong className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5 block">
                  v{__SHALOM_APP_VERSION__}
                </strong>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 block">Date de dernière mise à jour</span>
                <strong className="text-sm font-extrabold text-slate-900 dark:text-white mt-0.5 block">
                  {__SHALOM_BUILD_DATE__}
                </strong>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 block">État de connexion</span>
                <div className="flex items-center gap-1.5 mt-0.5 font-bold">
                  {isOnline ? (
                    <>
                      <Wifi className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-700 dark:text-emerald-300">En ligne (connecté)</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span className="text-amber-700 dark:text-amber-300">Hors ligne (fonctionnel)</span>
                    </>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 block">État du stockage</span>
                <strong className="text-xs font-bold text-slate-900 dark:text-white mt-0.5 block tabular-nums">
                  {storageStats.usageMB} Mo utilisés /{' '}
                  {storageStats.quotaMB >= 1024
                    ? `${(storageStats.quotaMB / 1024).toFixed(1)} Go`
                    : `${storageStats.quotaMB} Mo`}{' '}
                  ({storageStats.persisted ? 'Persistant' : 'Standard'})
                </strong>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Disponibilité d’une nouvelle version
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Vérifier si une mise à jour de SHALOM est disponible en ligne
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCheckForUpdates}
                  disabled={updateCheckStatus === 'checking'}
                  className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${updateCheckStatus === 'checking' ? 'animate-spin' : ''}`}
                  />
                  <span>Vérifier les mises à jour</span>
                </button>
              </div>

              {updateCheckMessage && (
                <div
                  className={`p-3 rounded-lg text-xs font-semibold flex flex-wrap items-center justify-between gap-2 ${
                    updateCheckStatus === 'available'
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : updateCheckStatus === 'up-to-date'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>{updateCheckMessage}</span>
                  {updateCheckStatus === 'available' && (
                    <button
                      type="button"
                      onClick={async () => {
                        if ('serviceWorker' in navigator) {
                          const reg = await navigator.serviceWorker.getRegistration();
                          if (reg?.waiting) {
                            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                          }
                        }
                        window.location.reload();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
                    >
                      Actualiser l’application
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Support & Contact via Gmail / Mailto */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-rose-600" />
                <span>Aide, support et diagnostic</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Préparez un message avec les informations techniques de votre appareil ou copiez le résumé diagnostic.
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={buildGmailComposeUrl(supportPayload.title, supportPayload.text)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Écrire via Gmail</span>
                </a>
                <a
                  href={buildMailtoUrl(supportPayload.title, supportPayload.text)}
                  className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-1.5"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>App E-mail</span>
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(diagnosticSummary);
                      setAboutNotice('Résumé diagnostic copié dans le presse-papiers.');
                    } catch {
                      setAboutNotice(diagnosticSummary);
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copier diagnostic</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowTermsModal(true)}
                className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-left flex items-center gap-3 transition"
              >
                <FileText className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Conditions d’utilisation
                  </span>
                  <span className="text-[11px] text-slate-500">Consulter les conditions</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                className="p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-left flex items-center gap-3 transition"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Politique de confidentialité
                  </span>
                  <span className="text-[11px] text-slate-500">Protection de vos données</span>
                </div>
              </button>
            </div>
          </div>

          {/* Logo Download Card */}
          <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
              <ImageIcon className="w-4 h-4" />
              <span>Logo officiel SHALOM (512 × 512 px)</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-md border border-slate-200/70 dark:border-slate-700/70 shrink-0 bg-slate-100 dark:bg-slate-900">
                <img
                  src="./shalom_logo_512x512.png"
                  alt="Logo SHALOM 512x512"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="space-y-2.5 flex-1 text-center sm:text-left">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Téléchargez le logo en haute netteté <strong>512 × 512 px</strong> pour vos documents ou icônes externes.
                </p>

                <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadLogo('png')}
                    className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PNG transparent (512×512)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadLogo('jpg')}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>JPG plein cadre (512×512)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Test Modal (Gmail / WhatsApp / Social) */}
      <SocialShareModal
        isOpen={!!testSharePayload}
        onClose={() => setTestSharePayload(null)}
        payload={testSharePayload}
      />

      {/* Immediate Launch-Lock Setup Modal */}
      <Modal
        isOpen={isLaunchSetupModalOpen}
        onClose={handleCancelLaunchSetup}
        title="Bloquer le lancement de l’application"
        subtitle="Choisissez votre mode de verrouillage et cliquez sur Terminer pour verrouiller immédiatement."
        maxWidth="md"
      >
        <form onSubmit={handleCompleteLaunchLockSetup} className="space-y-4 text-xs">
          {modalError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 font-semibold">
              {modalError}
            </div>
          )}

          <div className="space-y-2">
            <label className="block font-bold uppercase tracking-wider text-slate-500">
              Mode de verrouillage
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'pin', label: 'Code PIN', icon: Hash },
                { id: 'password', label: 'Mot de passe', icon: KeyRound },
                { id: 'pattern', label: 'Schéma 3×3', icon: Grid3X3 },
              ].map((m) => {
                const Icon = m.icon;
                const active = modalLockMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setModalLockMode(m.id as LockMode);
                      setModalError(null);
                    }}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 font-semibold transition ${
                      active
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-2 ring-blue-600/20'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-3">
            {securityConfig.secretHash && securityConfig.lockMode === modalLockMode && (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                Un secret ({modalLockMode}) est déjà enregistré. Saisissez-en un nouveau pour le modifier ou laissez vide pour le conserver.
              </p>
            )}

            {modalLockMode === 'pin' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Code PIN (4 chiffres)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    value={modalPin}
                    onChange={(e) => setModalPin(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full px-3 py-2 text-center font-mono tracking-widest rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Confirmer le PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    value={modalConfirmPin}
                    onChange={(e) => setModalConfirmPin(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full px-3 py-2 text-center font-mono tracking-widest rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  />
                </div>
              </div>
            )}

            {modalLockMode === 'password' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Mot de passe</label>
                  <input
                    type="password"
                    placeholder="Min. 4 caractères"
                    value={modalPassword}
                    onChange={(e) => setModalPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Confirmer</label>
                  <input
                    type="password"
                    placeholder="Confirmer"
                    value={modalConfirmPassword}
                    onChange={(e) => setModalConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                  />
                </div>
              </div>
            )}

            {modalLockMode === 'pattern' && (
              <div className="text-center space-y-2">
                {!modalPatternStep1 ? (
                  <PatternGrid
                    key="modal-pattern-step-1"
                    label="Étape 1/2 : Tracez votre schéma (min. 4 points)"
                    onPatternComplete={(pat) => {
                      if (pat.split('-').length >= 4) {
                        setModalError(null);
                        setModalPatternStep1(pat);
                      } else {
                        setModalError('Reliez au moins 4 points.');
                      }
                    }}
                  />
                ) : !modalPatternStep2 ? (
                  <div className="space-y-2">
                    <PatternGrid
                      key="modal-pattern-step-2"
                      label="Étape 2/2 : Confirmez le même schéma"
                      onPatternComplete={(pat) => {
                        if (pat !== modalPatternStep1) {
                          setModalError('Les deux schémas ne correspondent pas. Tracez à nouveau.');
                          return;
                        }
                        setModalError(null);
                        setModalPatternStep2(pat);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setModalPatternStep1('');
                        setModalPatternStep2('');
                      }}
                      className="text-xs text-slate-500 underline"
                    >
                      Recommencer
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                      Schéma confirmé. Appuyez sur Terminer pour bloquer l’application.
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setModalPatternStep1('');
                        setModalPatternStep2('');
                      }}
                      className="text-xs text-slate-500 underline"
                    >
                      Tracer un autre schéma
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleCancelLaunchSetup}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isCompletingLaunchSetup}
              className="px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-70 text-white font-bold flex items-center gap-1.5"
            >
              {isCompletingLaunchSetup ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Application...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Terminer</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Preferences Dialog */}
      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        title="Réinitialiser les préférences d’affichage ?"
        message="Cette action remettra l’apparence, l’organisation de l’accueil et les réglages de partage aux valeurs par défaut sans effacer vos prières, livres, contacts ou enregistrements."
        confirmLabel="Réinitialiser"
        isDestructive
        onConfirm={() => {
          const reset = resetAppPreferences();
          setPrefs(reset);
          setIsResetConfirmOpen(false);
          setPrefsNotice('Préférences réinitialisées aux valeurs par défaut.');
        }}
        onCancel={() => setIsResetConfirmOpen(false)}
      />

      {/* Modale Conditions d'utilisation */}
      <Modal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        title="Conditions d’utilisation de SHALOM"
        subtitle={`Version v${__SHALOM_APP_VERSION__} · Dernière mise à jour : ${__SHALOM_BUILD_DATE__}`}
        maxWidth="2xl"
      >
        <div className="space-y-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1">1. Objet de l’application</h4>
            <p>
              SHALOM est un espace spirituel personnel destiné à accompagner la prière, la méditation, l’organisation chrétienne, l’enregistrement audio/vidéo de paroles et la conservation personnelle de ressources bibliques.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1">2. Usage personnel et responsabilité</h4>
            <p>
              Vous demeurez entièrement propriétaire et responsable des contenus que vous rédigez, enregistrez, importez ou partagez depuis votre appareil (notes, témoignages, audios, vidéos, contacts et livres).
            </p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1">3. Services externes et liens tiers</h4>
            <p>
              Lorsque vous ouvrez Google Play Store, Google Livres, Open Library, Wikisource, Gmail ou des plateformes sociales pour partager un contenu, vous êtes soumis aux conditions propres à chacun de ces services tiers.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1">4. Sauvegarde de vos données</h4>
            <p>
              Vos données étant stockées localement sur votre appareil, nous vous recommandons d’utiliser régulièrement la fonction « Exporter / Restaurer (JSON) » dans Données et stockage afin de conserver une copie de sécurité.
            </p>
          </div>
        </div>
      </Modal>

      {/* Modale Politique de confidentialité */}
      <Modal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        title="Politique de confidentialité de SHALOM"
        subtitle="Approche 100 % locale et confidentielle"
        maxWidth="2xl"
      >
        <div className="space-y-4 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1">1. Stockage strictement local</h4>
            <p>
              SHALOM fonctionne sans compte cloud imposé : vos prières, autels, journaux, contacts, enregistrements et fichiers du Coffre Spirituel sont enregistrés exclusivement sur votre appareil (IndexedDB et stockage local).
            </p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1">2. Aucune collecte ni revente</h4>
            <p>
              SHALOM ne collecte, ne vend et ne transmet aucune de vos données spirituelles ou personnelles à des serveurs publicitaires ou tiers.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1">3. Sécurité locale</h4>
            <p>
              Votre code PIN, mot de passe ou schéma est transformé localement par hachage SHA-256 avant enregistrement sur votre appareil.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1">4. Recherches et partages volontaires</h4>
            <p>
              Seules les recherches volontaires de livres en ligne ou l’ouverture manuelle de Gmail, WhatsApp ou Play Store interagissent avec un service externe choisi par vous.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
