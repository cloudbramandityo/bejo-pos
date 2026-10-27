/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 * SI BEJO AI - Smart POS Assistant & Internal Team Chat System with Real-Time @Mentions.
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Sparkles,
  X,
  Send,
  Bot,
  Copy,
  Check,
  RotateCcw,
  Maximize2,
  ExternalLink,
  Image as ImageIcon,
  User,
  ChevronRight,
  Download,
  Film,
  Bell,
  Package,
  Printer as PrinterIcon,
  ArrowRight,
  MessageSquare,
  Users,
  AtSign,
  Shield,
  Clock,
  CheckCheck,
  Plus,
  Flame,
  AlertTriangle,
  Settings,
  Volume2,
  VolumeX,
  Radio,
  Zap,
  Wifi,
  WifiOff,
  HelpCircle,
  Lightbulb,
  Palette
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AppUser,
  UserRole,
  Product,
  Customer,
  Supplier,
  Agent,
  CustomerCategory,
  Transaction,
  Shift,
  AgentNotification,
  AiInternalChatMessage,
  UserMentionNotification,
  PrivateChatMessage,
  SpkOrder
} from '../types';
import {
  StoreInfo,
  getStoredAiChatMessages,
  saveStoredAiChatMessages,
  getStoredUserMentions,
  saveStoredUserMentions,
  addStoredUserMention,
  markStoredUserMentionRead,
  BejoAiSettings,
  getStoredAiSettings,
  saveStoredAiSettings,
  DEFAULT_AI_SETTINGS
} from '../utils/storage';
import {
  generateLocalBejoAiReply,
  generateOfflineStickerSvg,
  LocalAiContext,
  AiPersonaStyle
} from '../utils/localBejoAiEngine';
import { formatRupiah } from '../utils/formatters';
import {
  markAgentNotificationReadCloud,
  saveAiChatMessageCloud,
  saveUserMentionCloud,
  markUserMentionReadCloud,
  subscribeAiChatMessages,
  subscribeUserMentions,
  subscribeAllMyPrivateMessages,
  savePrivateChatMessageCloud
} from '../backend/pocketbaseBackend';
import { playMentionChime } from '../utils/notificationSound';
import {
  sendSystemNotification,
  requestSystemNotificationPermission,
  getSystemNotificationPermissionState
} from '../utils/webNotifications';
import {
  evaluateSpkDeadlines,
  isUserEligibleForDeadlineAlert,
  SpkDeadlineAlert
} from '../utils/spkDeadlineMonitor';

interface AiAssistantProps {
  currentTab: string;
  userRole: UserRole;
  currentUser?: AppUser | null;
  users?: AppUser[];
  products?: Product[];
  customers?: Customer[];
  suppliers?: Supplier[];
  agents?: Agent[];
  categories?: CustomerCategory[];
  transactions?: Transaction[];
  activeShift?: Shift | null;
  storeInfo?: StoreInfo;
  agentNotifications?: AgentNotification[];
  onNavigateTab?: (tab: string) => void;
  onMarkNotificationRead?: (notifId: string) => void;
}

export const AiAssistant: React.FC<AiAssistantProps> = ({
  currentTab,
  userRole,
  currentUser,
  users = [],
  products = [],
  customers = [],
  suppliers = [],
  agents = [],
  categories = [],
  transactions = [],
  activeShift = null,
  storeInfo,
  agentNotifications = [],
  onNavigateTab,
  onMarkNotificationRead
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeChatTab, setActiveChatTab] = useState<'team' | 'ai'>('team');
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // SI BEJO AI Settings & Real-Time Engine State
  const [aiSettings, setAiSettings] = useState<BejoAiSettings>(() => getStoredAiSettings());
  const [isAiSettingsModalOpen, setIsAiSettingsModalOpen] = useState(false);
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Online / Offline Status Listener
  useEffect(() => {
    const handleOnline = () => setIsNetworkOnline(true);
    const handleOffline = () => setIsNetworkOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update AI Settings handler
  const handleUpdateAiSettings = (newSettings: Partial<BejoAiSettings>) => {
    setAiSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      saveStoredAiSettings(updated);
      return updated;
    });
  };

  // Text-To-Speech (TTS) Voice Reader for SI BEJO AI
  const speakText = (text: string, speed: number = 1.0) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const cleanText = text
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/\[.*?\]\(.*?\)/g, '')
        .replace(/[*_~`#>•-]/g, '')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/\n+/g, '. ')
        .trim();
      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'id-ID';
      utterance.rate = speed;
      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find((v) => v.lang.startsWith('id') || v.name.toLowerCase().includes('indonesia'));
      if (idVoice) utterance.voice = idVoice;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('TTS error:', e);
    }
  };

  // Extract display name
  const getDisplayName = (): string => {
    if (currentUser?.name) {
      const clean = currentUser.name.replace(/\s*\([^)]*\)/g, '').trim();
      if (clean) {
        const parts = clean.split(' ');
        const first = parts[0];
        if (first.toLowerCase() === 'ahmad' || first.toLowerCase() === 'irdianto' || first.toLowerCase() === 'bejo') {
          return 'Pak Bejo';
        }
        if (first.toUpperCase() === first && first.length > 1) {
          return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
        }
        return first;
      }
    }
    if (currentUser?.username) {
      if (currentUser.username === 'langgo') return 'Langgo';
      if (currentUser.username === 'admin') return 'Syafira';
      if (currentUser.username === 'kasir') return 'Fira';
      if (currentUser.username === 'kasir2') return 'Rio';
      if (currentUser.username === 'owner') return 'Pak Bejo';
    }
    if (userRole === 'DEVELOPER') return 'Langgo';
    if (userRole === 'ADMIN') return 'Syafira';
    if (userRole === 'KASIR') return 'Fira';
    return 'Fira';
  };

  const userCallName = getDisplayName();

  const getWelcomeGreeting = (callName: string) => {
    const title = callName.startsWith('Pak') ? callName : `Kak ${callName || 'Fira'}`;
    return `Sugeng Rawuh ${title} 😊 Saya SI BEJO AI, asisten virtual BEJO Digital Print. Ada yang bisa saya bantu terkait operasional POS? Saya juga diprogram sebagai teman curhat lho ${callName.startsWith('Pak') ? 'Pak' : 'Kak'}! He..he..he..`;
  };

  const getFormattedTime = () => {
    return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  // 1. Internal Team Chat Messages State (Real-time synced across all users)
  const [teamMessages, setTeamMessages] = useState<AiInternalChatMessage[]>(() => {
    const stored = getStoredAiChatMessages().filter(
      (m) => m && m.id && !m.id.startsWith('msg_sys_online_') && !m.content?.includes('online di Chat Tim')
    );
    if (stored.length > 0) return stored;
    return [
      {
        id: 'msg_welcome_sys',
        role: 'assistant',
        content: `👋 Selamat datang di Chat Internal BEJO Digital Print! Kamu bisa ngobrol langsung dengan tim, atau gunakan @mention anggota tim untuk memberi notifikasi. Tag @SiBejoAI jika ingin bantuan AI ya!`,
        timestamp: getFormattedTime(),
        createdAt: Date.now() - 60000,
        senderName: 'SI BEJO AI',
        senderRole: 'AI ASSISTANT'
      }
    ];
  });

  // 2. Private AI Messages State
  const [aiMessages, setAiMessages] = useState<AiInternalChatMessage[]>([
    {
      id: 'init_welcome',
      role: 'assistant',
      content: getWelcomeGreeting(userCallName),
      timestamp: getFormattedTime(),
      createdAt: Date.now(),
      senderName: 'SI BEJO AI',
      senderRole: 'AI ASSISTANT'
    }
  ]);

  // 3. User Mention Notifications State
  const [mentionNotifications, setMentionNotifications] = useState<UserMentionNotification[]>(getStoredUserMentions);
  const [activeMentionPopup, setActiveMentionPopup] = useState<UserMentionNotification | null>(null);
  const [dismissedMentionIds, setDismissedMentionIds] = useState<Set<string>>(new Set());

  // 4. Private 1-on-1 Chat Messages State
  const [allPrivateMessages, setAllPrivateMessages] = useState<PrivateChatMessage[]>([]);
  const [activePrivateUser, setActivePrivateUser] = useState<string>('admin');
  const [openPrivateThreads, setOpenPrivateThreads] = useState<string[]>([]);
  const [isPrivateSelectorOpen, setIsPrivateSelectorOpen] = useState(false);
  const [mentionChoiceCandidate, setMentionChoiceCandidate] = useState<{
    username: string;
    name: string;
    role: string;
    isAi?: boolean;
  } | null>(null);

  // Subscribe to all private messages for logged in user
  useEffect(() => {
    const myUsername = currentUser?.username || '';
    if (!myUsername) return;

    const unsubPrivate = subscribeAllMyPrivateMessages(myUsername, (msgs) => {
      if (msgs) {
        setAllPrivateMessages(msgs);

        // Auto add active thread if new private message received
        setOpenPrivateThreads((prev) => {
          const threadsSet = new Set(prev);
          msgs.forEach((m) => {
            const myU = myUsername.toLowerCase();
            const senderU = (m.senderUsername || '').toLowerCase();
            const recipientU = (m.recipientUsername || '').toLowerCase();
            if (senderU === myU && recipientU && recipientU !== myU) {
              threadsSet.add(recipientU);
            } else if (recipientU === myU && senderU && senderU !== myU) {
              threadsSet.add(senderU);
            }
          });
          return Array.from(threadsSet);
        });
      }
    });

    return () => {
      unsubPrivate();
    };
  }, [currentUser?.username]);

  // Input and Autocomplete States
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Agent Order Notification state
  const [activeAgentNotifPopup, setActiveAgentNotifPopup] = useState<AgentNotification | null>(null);
  const [dismissedNotifIds, setDismissedNotifIds] = useState<Set<string>>(new Set());

  // SPK Deadline Alert state (Si BEJO AI notification for SPK, Admin, Kasir, Developer)
  const [spkDeadlineAlerts, setSpkDeadlineAlerts] = useState<SpkDeadlineAlert[]>([]);
  const [activeDeadlinePopup, setActiveDeadlinePopup] = useState<SpkDeadlineAlert | null>(null);
  const [dismissedDeadlineIds, setDismissedDeadlineIds] = useState<Set<string>>(new Set());

  // Real-time SPK Deadline Monitor & Si BEJO AI Alert Trigger
  useEffect(() => {
    const isEligible = isUserEligibleForDeadlineAlert(userRole);
    if (!isEligible) {
      setSpkDeadlineAlerts([]);
      setActiveDeadlinePopup(null);
      return;
    }

    const checkDeadlines = () => {
      const alerts = evaluateSpkDeadlines();
      setSpkDeadlineAlerts(alerts);

      if (alerts.length > 0) {
        // Find most urgent alert not yet dismissed
        const unreadAlert = alerts.find((a) => !dismissedDeadlineIds.has(a.id));
        if (unreadAlert && !isOpen && !activeMentionPopup && !activeAgentNotifPopup) {
          if (!activeDeadlinePopup || activeDeadlinePopup.id !== unreadAlert.id) {
            setActiveDeadlinePopup(unreadAlert);
            playMentionChime();
            sendSystemNotification(`Si BEJO AI: Peringatan Deadline SPK! ⏰`, {
              body: `${unreadAlert.jobName} (${unreadAlert.customerName}) • ${unreadAlert.timeRemainingText}`,
              tag: unreadAlert.id
            });
          }
        }
      } else {
        setActiveDeadlinePopup(null);
      }
    };

    checkDeadlines();
    const interval = setInterval(checkDeadlines, 20000);

    const handleSpkUpdate = () => {
      checkDeadlines();
    };
    window.addEventListener('bejo_spk_orders_updated', handleSpkUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('bejo_spk_orders_updated', handleSpkUpdate);
    };
  }, [userRole, dismissedDeadlineIds, isOpen, activeMentionPopup, activeAgentNotifPopup, activeDeadlinePopup]);

  const handleDismissDeadlineAlert = (alertId: string) => {
    setDismissedDeadlineIds((prev) => new Set(prev).add(alertId));
    setActiveDeadlinePopup(null);
  };

  const handleOpenSpkWorkflowFromDeadline = (alert: SpkDeadlineAlert) => {
    handleDismissDeadlineAlert(alert.id);
    if (onNavigateTab) {
      onNavigateTab('spk');
    }
  };

  // Listen for real-time AI Chat Messages from PocketBase
  useEffect(() => {
    const unsubChat = subscribeAiChatMessages((cloudMsgs) => {
      if (cloudMsgs && cloudMsgs.length > 0) {
        setTeamMessages((prev) => {
          const msgMap = new Map<string, AiInternalChatMessage>();
          // Filter out online join notifications to avoid forum chat spam
          cloudMsgs
            .filter((m) => m && m.id && !m.id.startsWith('msg_sys_online_') && !m.content?.includes('online di Chat Tim'))
            .forEach((m) => {
              if (m && m.id) msgMap.set(m.id, m);
            });
          prev
            .filter((m) => m && m.id && !m.id.startsWith('msg_sys_online_') && !m.content?.includes('online di Chat Tim'))
            .forEach((m) => {
              if (m && m.id && !msgMap.has(m.id)) {
                msgMap.set(m.id, m);
              }
            });
          const merged = Array.from(msgMap.values()).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
          saveStoredAiChatMessages(merged);
          return merged;
        });
      }
    });

    return () => {
      unsubChat();
    };
  }, []);

  // Online team members state (Used exclusively for top Online Status Bar)
  const onlineUsers = useMemo(() => {
    const now = Date.now();
    return users.filter((u) => {
      const isRecent = u.lastActiveAt ? (now - u.lastActiveAt) < 90000 : false;
      return u.isOnline || isRecent;
    });
  }, [users]);

  // Listen for real-time User Mentions for currently logged-in user
  useEffect(() => {
    const myUsername = currentUser?.username || '';
    if (!myUsername) return;

    const unsubMentions = subscribeUserMentions(myUsername, (cloudNotifs) => {
      if (cloudNotifs) {
        setMentionNotifications(cloudNotifs);
        saveStoredUserMentions(cloudNotifs);

        // Find unread mentions
        const unreadMention = cloudNotifs.find(
          (n) => !n.isRead && !dismissedMentionIds.has(n.id)
        );

        if (unreadMention && (!activeMentionPopup || activeMentionPopup.id !== unreadMention.id)) {
          setActiveMentionPopup(unreadMention);
          playMentionChime();
          sendSystemNotification(`@${unreadMention.senderUsername} menyebut Anda di Chat Tim`, {
            body: unreadMention.content,
            tag: `mention_${unreadMention.id}`
          });
        }
      }
    });

    return () => {
      unsubMentions();
    };
  }, [currentUser?.username, dismissedMentionIds, activeMentionPopup]);

  // Real-time listener for Agent Notifications (DEVELOPER & ADMIN)
  useEffect(() => {
    const isPrivileged = userRole === 'DEVELOPER' || userRole === 'ADMIN';
    if (!isPrivileged) {
      setActiveAgentNotifPopup(null);
      return;
    }

    if (agentNotifications && agentNotifications.length > 0) {
      const latestUnread = agentNotifications.find((n) => {
        const isDismissed = dismissedNotifIds.has(n.id);
        const isReadByMe = currentUser?.id ? (n.readBy || []).includes(currentUser.id) : false;
        return !isDismissed && !isReadByMe;
      });

      if (latestUnread && !isOpen && !activeMentionPopup) {
        setActiveAgentNotifPopup(latestUnread);
      }
    }
  }, [agentNotifications, userRole, dismissedNotifIds, isOpen, currentUser?.id, activeMentionPopup]);

  // Persistent Long-term Memories in LocalStorage
  const memoryStorageKey = `bejo_ai_memory_${currentUser?.username || userRole.toLowerCase()}`;
  const [userMemories, setUserMemories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(memoryStorageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      'Master Developer & Arsitek sistem POS BEJO Digital Print',
      'Kasir & Admin toko yang ramah, teliti dan responsif'
    ];
  });

  const saveMemoryItem = (newMemory: string) => {
    setUserMemories((prev) => {
      if (prev.includes(newMemory)) return prev;
      const updated = [newMemory, ...prev].slice(0, 15);
      try {
        localStorage.setItem(memoryStorageKey, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [teamMessages, aiMessages, isLoading, isOpen, activeChatTab]);

  // Mentionable candidate list (registered users + Bejo AI + All)
  const mentionableCandidates = useMemo(() => {
    const list: { username: string; name: string; role: string; isAi?: boolean; isAll?: boolean }[] = [];
    const seenUsernames = new Set<string>();

    // System AI
    list.push({ username: 'SiBejoAI', name: 'SI BEJO AI', role: 'ASISTEN AI', isAi: true });
    seenUsernames.add('sibejoai');
    seenUsernames.add('bejo');
    seenUsernames.add('ai');

    list.push({ username: 'all', name: 'Semua Tim', role: 'BROADCAST', isAll: true });
    seenUsernames.add('all');

    // Registered users from DB
    users.forEach((u) => {
      if (u.username) {
        const lower = u.username.toLowerCase();
        if (!seenUsernames.has(lower)) {
          seenUsernames.add(lower);
          list.push({
            username: u.username,
            name: u.name || u.username,
            role: u.role
          });
        }
      }
    });

    // Fallbacks if users list is empty
    if (!seenUsernames.has('admin')) {
      seenUsernames.add('admin');
      list.push({ username: 'admin', name: 'Syafira', role: 'ADMIN' });
    }
    if (!seenUsernames.has('langgo')) {
      seenUsernames.add('langgo');
      list.push({ username: 'langgo', name: 'Langgo', role: 'DEVELOPER' });
    }
    if (!seenUsernames.has('kasir')) {
      seenUsernames.add('kasir');
      list.push({ username: 'kasir', name: 'Fira', role: 'KASIR' });
    }
    if (!seenUsernames.has('kasir2')) {
      seenUsernames.add('kasir2');
      list.push({ username: 'kasir2', name: 'Azizah', role: 'KASIR' });
    }
    if (!seenUsernames.has('owner')) {
      seenUsernames.add('owner');
      list.push({ username: 'owner', name: 'Pak Bejo', role: 'OWNER' });
    }

    return list;
  }, [users]);

  // Filter mention suggestions based on query
  const filteredMentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return mentionableCandidates.filter(
      (c) =>
        c.username.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q)
    ).slice(0, 6);
  }, [mentionQuery, mentionableCandidates]);

  // Handle Input changes and detect '@'
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);

    const cursorPos = e.target.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');

    if (lastAtIdx !== -1) {
      const charBeforeAt = lastAtIdx > 0 ? textBeforeCursor[lastAtIdx - 1] : ' ';
      if (charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtIdx === 0) {
        const query = textBeforeCursor.slice(lastAtIdx + 1);
        if (!query.includes(' ')) {
          setMentionQuery(query);
          setMentionIndex(lastAtIdx);
          return;
        }
      }
    }

    setMentionQuery(null);
    setMentionIndex(-1);
  };

  // Start 1-on-1 private chat thread with a target user
  const handleStartPrivateChat = (targetUsername: string) => {
    if (!targetUsername) return;
    const lower = targetUsername.toLowerCase();
    setOpenPrivateThreads((prev) => {
      if (!prev.includes(lower)) return [...prev, lower];
      return prev;
    });
    setActivePrivateUser(lower);
    setActiveChatTab('private');
    setMentionChoiceCandidate(null);
  };

  // Unread private message counts per user
  const unreadPrivateCountMap = useMemo(() => {
    const myU = (currentUser?.username || '').toLowerCase();
    const map = new Map<string, number>();
    allPrivateMessages.forEach((m) => {
      if (m.recipientUsername?.toLowerCase() === myU && !m.isRead) {
        const sender = m.senderUsername.toLowerCase();
        map.set(sender, (map.get(sender) || 0) + 1);
      }
    });
    return map;
  }, [allPrivateMessages, currentUser?.username]);

  // Private messages for active thread
  const activePrivateThreadId = useMemo(() => {
    const myU = (currentUser?.username || '').toLowerCase();
    const peerU = (activePrivateUser || '').toLowerCase();
    return [myU, peerU].sort().join('_');
  }, [currentUser?.username, activePrivateUser]);

  const currentPrivateMessages = useMemo(() => {
    return allPrivateMessages.filter((m) => {
      if (m.threadId) return m.threadId === activePrivateThreadId;
      const myU = (currentUser?.username || '').toLowerCase();
      const peerU = (activePrivateUser || '').toLowerCase();
      const sU = (m.senderUsername || '').toLowerCase();
      const rU = (m.recipientUsername || '').toLowerCase();
      return (sU === myU && rU === peerU) || (sU === peerU && rU === myU);
    });
  }, [allPrivateMessages, activePrivateThreadId, currentUser?.username, activePrivateUser]);

  const insertTagIntoInput = (usernameToTag: string) => {
    if (mentionIndex === -1 && !input.includes('@')) {
      setInput((prev) => `${prev} @${usernameToTag} `);
      return;
    }
    const cursorPos = inputRef.current?.selectionStart || input.length;
    const textBeforeAt = input.slice(0, mentionIndex === -1 ? input.length : mentionIndex);
    const textAfterCursor = input.slice(cursorPos);
    const replacement = `@${usernameToTag} `;
    const newInput = textBeforeAt + replacement + textAfterCursor;
    setInput(newInput);
    setMentionQuery(null);
    setMentionIndex(-1);

    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const nextPos = textBeforeAt.length + replacement.length;
        inputRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 10);
  };

  const handleSelectMention = (candidate: { username: string; name: string; role: string; isAi?: boolean }) => {
    if (candidate.isAi || candidate.username.toLowerCase() === 'all') {
      insertTagIntoInput(candidate.username);
      setMentionQuery(null);
      setMentionIndex(-1);
    } else {
      setMentionQuery(null);
      setMentionIndex(-1);
      setMentionChoiceCandidate(candidate);
    }
  };

  // Helper to extract tagged usernames from message
  const extractMentions = (text: string): string[] => {
    const matches = text.match(/@([a-zA-Z0-9_]+)/g);
    if (!matches) return [];
    return matches.map((m) => m.slice(1).toLowerCase());
  };

  // Dismiss user mention notification
  const handleDismissMention = (notifId: string) => {
    setDismissedMentionIds((prev) => new Set(prev).add(notifId));
    setActiveMentionPopup(null);
    markStoredUserMentionRead(notifId);
    markUserMentionReadCloud(notifId).catch(console.error);
  };

  const handleOpenMentionChat = (notif: UserMentionNotification) => {
    handleDismissMention(notif.id);
    setActiveChatTab('team');
    setIsOpen(true);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        setInput(`@${notif.senderUsername} `);
      }
    }, 200);
  };

  const handleDismissAgentNotif = (notifId: string) => {
    setDismissedNotifIds((prev) => new Set(prev).add(notifId));
    setActiveAgentNotifPopup(null);
    if (currentUser?.id) {
      markAgentNotificationReadCloud(notifId, currentUser.id).catch(console.error);
    }
    if (onMarkNotificationRead) {
      onMarkNotificationRead(notifId);
    }
  };

  const handleAskAiAboutAgentOrder = (notif: AgentNotification) => {
    setActiveChatTab('ai');
    setIsOpen(true);
    handleDismissAgentNotif(notif.id);
    const orderLabel = notif.orderType === 'CETAK_AGEN' ? 'CETAK AGEN' : 'PENGAMBILAN BAHAN';
    const prompt = `Hai SI BEJO AI, ada pesanan baru ${orderLabel} dari mitra agen "${notif.agentName}" (#${notif.orderId}) senilai ${formatRupiah(notif.totalAmount)} (${notif.totalQty} barang: ${notif.itemSummary || '-'}). Tolong verifikasi dan berikan instruksi tindak lanjut untuk admin!`;
    handleSend(prompt);
  };

  // Copy message
  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  // Reset conversation
  const handleResetChat = () => {
    if (activeChatTab === 'ai') {
      setAiMessages([
        {
          id: `welcome_${Date.now()}`,
          role: 'assistant',
          content: getWelcomeGreeting(userCallName),
          timestamp: getFormattedTime(),
          createdAt: Date.now(),
          senderName: 'SI BEJO AI',
          senderRole: 'AI ASSISTANT'
        }
      ]);
    } else {
      // Refresh team messages
      const msgs = getStoredAiChatMessages();
      setTeamMessages(msgs);
    }
  };

  // Prepare system context summary for AI
  const systemContext = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTx = transactions.filter((t) => {
      const txDate = (t.date || '').substring(0, 10);
      return txDate === todayStr && (t as any).status !== 'CANCELLED';
    });

    const todayRevenue = todayTx.reduce((sum, t) => sum + (t.total || t.subtotal || 0), 0);
    const lowStock = products.filter((p) => (p.stock || 0) <= (p.minStock || 5));
    const lowStockNames = lowStock.slice(0, 8).map((p) => `${p.name} (sisa ${p.stock} ${p.unit || 'unit'})`).join(', ');

    return {
      storeName: storeInfo?.storeName || 'BEJO Digital Print',
      storeBranch: storeInfo?.branch || 'Cabang Polsek',
      storePhone: storeInfo?.phone || '0819-1834-4716',
      storeAddress: storeInfo?.address || 'Jl. Raya Diwek (Belakang Polsek Diwek), Jomabang',
      ownerName: 'Bapak Ahmad Irdianto (Pak Bejo)',
      totalProducts: products.length,
      lowStockCount: lowStock.length,
      lowStockItems: lowStockNames || 'Semua stok aman',
      totalCustomers: customers.length,
      customerCategories: categories.map((c) => `${c.name} (Diskon ${c.discountPercent || 0}%)`).join(', '),
      totalSuppliers: suppliers.length,
      totalAgents: agents.length,
      totalTransactions: transactions.length,
      todaySalesCount: todayTx.length,
      todayRevenue,
      activeShift: activeShift
        ? {
            cashierName: activeShift.cashierName,
            shiftName: activeShift.shiftName,
            openingCash: activeShift.startingCash || activeShift.initialCash || 0,
            status: activeShift.status,
            storeName: activeShift.storeName
          }
        : null
    };
  }, [products, customers, suppliers, agents, categories, transactions, activeShift, storeInfo]);

  // Handle Send Message (Team Chat, Private 1-on-1, or AI Personal)
  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input.trim();
    if (!text || isLoading) return;

    if (!textToSend) setInput('');
    setMentionQuery(null);
    setMentionIndex(-1);
    setActiveAgentNotifPopup(null);
    setActiveMentionPopup(null);

    // Private Chat Branch
    if (activeChatTab === 'private') {
      if (!activePrivateUser) return;
      const targetUserObj = users.find((u) => u.username?.toLowerCase() === activePrivateUser.toLowerCase());

      const pMsg: PrivateChatMessage = {
        id: `pmsg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        threadId: activePrivateThreadId,
        senderId: currentUser?.id,
        senderUsername: currentUser?.username || 'user',
        senderName: currentUser?.name || userCallName,
        recipientUsername: activePrivateUser,
        recipientName: targetUserObj?.name || activePrivateUser,
        content: text,
        timestamp: getFormattedTime(),
        createdAt: Date.now(),
        isRead: false
      };

      setAllPrivateMessages((prev) => [...prev, pMsg]);
      savePrivateChatMessageCloud(pMsg).catch(console.error);
      return;
    }

    const mentions = extractMentions(text);
    const isTaggedAi = mentions.some((m) =>
      ['sibejoai', 'sibejo', 'bejo', 'ai', 'all'].includes(m.toLowerCase())
    );

    const newMsg: AiInternalChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      role: 'user',
      content: text,
      timestamp: getFormattedTime(),
      createdAt: Date.now(),
      senderId: currentUser?.id || 'guest',
      senderName: currentUser?.name || userCallName,
      senderUsername: currentUser?.username || 'user',
      senderRole: userRole,
      mentions
    };

    if (activeChatTab === 'team') {
      // 1. Save to team chat & sync to PocketBase
      const updatedTeam = [...teamMessages, newMsg];
      setTeamMessages(updatedTeam);
      saveStoredAiChatMessages(updatedTeam);
      saveAiChatMessageCloud(newMsg).catch(console.error);

      // 2. Dispatch User Mention Notifications to tagged users
      for (const targetUser of mentions) {
        if (!['sibejoai', 'sibejo', 'bejo', 'ai'].includes(targetUser.toLowerCase())) {
          const mentionNotif: UserMentionNotification = {
            id: `notif_men_${Date.now()}_${targetUser}`,
            messageId: newMsg.id,
            senderName: currentUser?.name || userCallName,
            senderUsername: currentUser?.username || 'user',
            senderRole: userRole,
            targetUsername: targetUser,
            content: text,
            timestamp: Date.now(),
            formattedTime: getFormattedTime(),
            isRead: false
          };
          addStoredUserMention(mentionNotif);
          saveUserMentionCloud(mentionNotif).catch(console.error);
        }
      }

      // 3. If Bejo AI was tagged or broadcasted in team chat, trigger AI response to team chat
      if (isTaggedAi) {
        setIsLoading(true);
        const localContext: LocalAiContext = {
          storeName: storeInfo?.storeName || 'BEJO Digital Print',
          userCallName: aiSettings.customCallName || userCallName,
          userRole,
          activeShift,
          products,
          customers,
          agents,
          transactions,
          currentTab,
          todayRevenue: systemContext.todayRevenue,
          todaySalesCount: systemContext.todaySalesCount,
          personaStyle: aiSettings.personaStyle
        };

        let aiReplyText = '';

        if (aiSettings.engineMode === 'OFFLINE_ONLY' || !isNetworkOnline) {
          aiReplyText = generateLocalBejoAiReply(text, localContext);
        } else {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch('/api/ai-assistant', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify({
                messages: updatedTeam.map((m) => ({ role: m.role, content: m.content })),
                currentTab,
                userRole,
                userName: currentUser?.name || userCallName,
                userCallName: aiSettings.customCallName || userCallName,
                userUsername: currentUser?.username,
                registeredUsers: users.map((u) => ({ username: u.username, name: u.name, role: u.role })),
                systemContext,
                userMemories
              })
            });
            clearTimeout(timeoutId);

            if (response.ok) {
              const data = await response.json();
              aiReplyText = data.reply;
            } else {
              aiReplyText = generateLocalBejoAiReply(text, localContext);
            }
          } catch (err) {
            aiReplyText = generateLocalBejoAiReply(text, localContext);
          }
        }

        if (aiReplyText) {
          const aiReplyMsg: AiInternalChatMessage = {
            id: `msg_ai_${Date.now()}`,
            role: 'assistant',
            content: aiReplyText,
            timestamp: getFormattedTime(),
            createdAt: Date.now(),
            senderName: 'SI BEJO AI',
            senderRole: 'AI ASSISTANT',
            isAiResponseTo: newMsg.id
          };
          const withAi = [...updatedTeam, aiReplyMsg];
          setTeamMessages(withAi);
          saveStoredAiChatMessages(withAi);
          saveAiChatMessageCloud(aiReplyMsg).catch(console.error);
        }
        setIsLoading(false);
      }
    } else {
      // AI Personal Mode
      const updatedAi = [...aiMessages, newMsg];
      setAiMessages(updatedAi);
      setIsLoading(true);

      const localContext: LocalAiContext = {
        storeName: storeInfo?.storeName || 'BEJO Digital Print',
        userCallName: aiSettings.customCallName || userCallName,
        userRole,
        activeShift,
        products,
        customers,
        agents,
        transactions,
        currentTab,
        todayRevenue: systemContext.todayRevenue,
        todaySalesCount: systemContext.todaySalesCount,
        personaStyle: aiSettings.personaStyle
      };

      let finalReply = '';

      if (aiSettings.engineMode === 'OFFLINE_ONLY' || !isNetworkOnline) {
        // Immediate ultra-fast response via Local Hybrid Engine
        finalReply = generateLocalBejoAiReply(text, localContext);
      } else {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);

          const response = await fetch('/api/ai-assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              messages: updatedAi.map((m) => ({ role: m.role, content: m.content })),
              currentTab,
              userRole,
              userName: currentUser?.name || userCallName,
              userCallName: aiSettings.customCallName || userCallName,
              userUsername: currentUser?.username,
              registeredUsers: users.map((u) => ({ username: u.username, name: u.name, role: u.role })),
              systemContext,
              userMemories
            })
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            finalReply = data.reply;
          } else {
            finalReply = generateLocalBejoAiReply(text, localContext);
          }
        } catch (error) {
          // Seamless fallback to Local Engine on network/rate-limit error
          finalReply = generateLocalBejoAiReply(text, localContext);
        }
      }

      if (!finalReply) {
        finalReply = generateLocalBejoAiReply(text, localContext);
      }

      setAiMessages((prev) => [
        ...prev,
        {
          id: `ai_${Date.now()}`,
          role: 'assistant',
          content: finalReply,
          timestamp: getFormattedTime(),
          createdAt: Date.now(),
          senderName: 'SI BEJO AI',
          senderRole: 'AI ASSISTANT'
        }
      ]);

      if (aiSettings.enableTts) {
        speakText(finalReply, aiSettings.ttsSpeed);
      }
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (filteredMentionSuggestions.length > 0 && mentionQuery !== null) {
        handleSelectMention(filteredMentionSuggestions[0]);
      } else {
        handleSend();
      }
    }
  };

  // Helper to render markdown and mention badges
  const renderMessageContent = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!line.trim()) {
        elements.push(<div key={`space_${i}`} className="h-1" />);
        continue;
      }

      // Markdown Image Pattern
      const imageMatch = line.match(/^!\[(.*?)\]\(((?:https?:\/\/|data:image\/|\/|blob:).*?)\)$/);
      if (imageMatch) {
        const altText = imageMatch[1] || 'Gambar Desain Stiker AI';
        const imgUrl = imageMatch[2];
        elements.push(
          <div key={`img_${i}`} className="my-2.5 group relative">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-900/5 shadow-xs relative">
              <img
                src={imgUrl}
                alt={altText}
                className="w-full max-h-60 object-contain bg-slate-950/5 rounded-xl cursor-pointer"
                onClick={() => setPreviewImageUrl(imgUrl)}
                loading="lazy"
              />
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <a
                  href={imgUrl}
                  download={`bejo_ai_${Date.now()}.png`}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-slate-900/80 hover:bg-slate-900 text-white p-1.5 rounded-lg shadow-xs"
                  title="Unduh Gambar"
                >
                  <Download size={13} />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImageUrl(imgUrl)}
                  className="bg-slate-900/80 hover:bg-slate-900 text-white p-1.5 rounded-lg shadow-xs cursor-pointer"
                  title="Perbesar gambar"
                >
                  <Maximize2 size={13} />
                </button>
              </div>
            </div>
          </div>
        );
        continue;
      }

      elements.push(
        <p key={`p_${i}`} className="leading-relaxed">
          {renderInline(line)}
        </p>
      );
    }

    return <div className="space-y-1">{elements}</div>;
  };

  const renderInline = (text: string) => {
    const parts = text.split(/(@[a-zA-Z0-9_]+|https?:\/\/[^\s]+|\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

    return parts.map((part, index) => {
      if (!part) return null;

      // Tagged Mention
      if (part.startsWith('@')) {
        const username = part.slice(1);
        const lowerUser = username.toLowerCase();
        const isMe = currentUser?.username?.toLowerCase() === lowerUser;
        const isAi = ['sibejoai', 'sibejo', 'bejo', 'ai'].includes(lowerUser);
        const displayTag = isAi ? 'SiBejoAI' : username;
        return (
          <span
            key={index}
            className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-md font-bold text-[10.5px] border ${
              isMe
                ? 'bg-rose-100 text-rose-800 border-rose-300 ring-1 ring-rose-400'
                : isAi
                ? 'bg-indigo-100 text-indigo-800 border-indigo-300 shadow-2xs'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200'
            }`}
          >
            {isAi ? <Bot size={11} className="shrink-0 text-indigo-600" /> : <AtSign size={10} className="shrink-0" />}
            <span>{displayTag}</span>
          </span>
        );
      }

      // Bold
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-bold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }

      // Italic
      if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
        return (
          <em key={index} className="italic text-slate-700">
            {part.slice(1, -1)}
          </em>
        );
      }

      // Code
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={index} className="bg-slate-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10.5px] font-mono border border-slate-200">
            {part.slice(1, -1)}
          </code>
        );
      }

      return part;
    });
  };

  // Unread mention notifications count
  const unreadMentionCount = useMemo(() => {
    return mentionNotifications.filter((n) => !n.isRead && !dismissedMentionIds.has(n.id)).length;
  }, [mentionNotifications, dismissedMentionIds]);

  // Active messages computed based on current chat tab
  const activeMessages = useMemo(() => {
    if (activeChatTab === 'team') return teamMessages;
    if (activeChatTab === 'ai') return aiMessages;

    return currentPrivateMessages.map((pm) => ({
      id: pm.id,
      role: (pm.senderUsername.toLowerCase() === (currentUser?.username || '').toLowerCase() ? 'user' : 'assistant') as 'user' | 'assistant',
      content: pm.content,
      timestamp: pm.timestamp,
      createdAt: pm.createdAt,
      senderId: pm.senderId,
      senderName: pm.senderName,
      senderUsername: pm.senderUsername,
      senderRole: 'PRIVATE'
    }));
  }, [activeChatTab, teamMessages, aiMessages, currentPrivateMessages, currentUser?.username]);

  return (
    <div className="fixed bottom-28 right-4 md:bottom-6 md:right-6 z-[45] flex flex-col items-end font-sans">
      {/* Main Chat Modal Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="mb-4 w-[430px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[72vh] md:h-[620px] md:max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden ring-1 ring-black/5"
            id="bejo-ai-chat-window"
          >
            {/* Header */}
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between shadow-sm border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-blue-500 flex items-center justify-center text-white shadow-xs">
                    <Bot size={18} />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-sm tracking-tight text-white">SI BEJO AI</h3>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                      Group Chat & AI
                    </span>
                    {userRole === 'DEVELOPER' ? (
                      <button
                        type="button"
                        onClick={() => setIsAiSettingsModalOpen(true)}
                        title={`Status Engine: ${aiSettings.engineMode} (${isNetworkOnline ? 'Online' : 'Offline'}). Klik untuk buka pengaturan.`}
                        className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border flex items-center gap-1 cursor-pointer transition-all hover:brightness-110 active:scale-95 ${
                          aiSettings.engineMode === 'OFFLINE_ONLY' || !isNetworkOnline
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                        }`}
                      >
                        {aiSettings.engineMode === 'OFFLINE_ONLY' || !isNetworkOnline ? (
                          <>
                            <WifiOff size={9} />
                            <span>Offline Lokal</span>
                          </>
                        ) : (
                          <>
                            <Zap size={9} />
                            <span>Real-Time Engine</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border flex items-center gap-1 ${
                        aiSettings.engineMode === 'OFFLINE_ONLY' || !isNetworkOnline
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {aiSettings.engineMode === 'OFFLINE_ONLY' || !isNetworkOnline ? (
                          <>
                            <WifiOff size={9} />
                            <span>Offline Lokal</span>
                          </>
                        ) : (
                          <>
                            <Zap size={9} />
                            <span>Real-Time Engine</span>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                    <span>{userCallName ? `Login: ${userCallName} (${userRole})` : 'Online'}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                {userRole === 'DEVELOPER' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsAiSettingsModalOpen(true)}
                      title="Pengaturan Engine & Persona SI BEJO AI"
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        isAiSettingsModalOpen
                          ? 'text-indigo-400 bg-slate-800'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      <Settings size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const granted = await requestSystemNotificationPermission();
                        if (granted) {
                          sendSystemNotification('Notifikasi System Bejo POS Aktif 🔔', {
                            body: 'Notifikasi SI BEJO AI terhubung dengan OS Windows / iOS!',
                            tag: 'bejo_notif_test'
                          });
                        }
                      }}
                      title="Aktifkan Notifikasi Sistem (Windows / iOS)"
                      className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                      <Bell size={15} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleResetChat}
                  title="Mulai Ulang Obrolan"
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCcw size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title="Tutup"
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  id="bejo-ai-close-btn"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Mode / Channel Switcher Tabs with Private Chat Support */}
            <div className="bg-slate-100/90 p-1.5 border-b border-slate-200 flex items-center gap-1 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveChatTab('team')}
                className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                  activeChatTab === 'team'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Users size={13} className={activeChatTab === 'team' ? 'text-indigo-600' : 'text-slate-500'} />
                <span>Group Chat</span>
                {unreadMentionCount > 0 && (
                  <span className="bg-rose-500 text-white text-[9.5px] px-1.5 py-0.2 rounded-full font-bold">
                    {unreadMentionCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveChatTab('ai')}
                className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                  activeChatTab === 'ai'
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Sparkles size={13} className={activeChatTab === 'ai' ? 'text-indigo-600' : 'text-slate-500'} />
                <span>Asisten AI</span>
              </button>

              {/* Dynamic Open Private Chat Tabs */}
              {openPrivateThreads.map((peerU) => {
                const uObj = users.find((u) => u.username?.toLowerCase() === peerU.toLowerCase());
                const label = uObj?.name ? uObj.name.split(' ')[0] : peerU;
                const unreadCount = unreadPrivateCountMap.get(peerU) || 0;
                const isActive = activeChatTab === 'private' && activePrivateUser.toLowerCase() === peerU.toLowerCase();

                return (
                  <div
                    key={peerU}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer border ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-xs border-emerald-700'
                        : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                    }`}
                    onClick={() => {
                      setActivePrivateUser(peerU);
                      setActiveChatTab('private');
                    }}
                  >
                    <MessageSquare size={12} className={isActive ? 'text-white' : 'text-emerald-600'} />
                    <span>{label}</span>
                    {unreadCount > 0 && (
                      <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold animate-pulse">
                        {unreadCount}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenPrivateThreads((prev) => prev.filter((t) => t.toLowerCase() !== peerU.toLowerCase()));
                        if (isActive) setActiveChatTab('team');
                      }}
                      className="ml-0.5 p-0.5 hover:bg-black/10 rounded cursor-pointer"
                      title="Tutup Chat Privat"
                    >
                      <X size={11} />
                    </button>
                  </div>
                );
              })}

              {/* Add Private Chat Selector */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPrivateSelectorOpen((prev) => !prev)}
                  className="py-1.5 px-2 rounded-lg text-xs font-bold bg-slate-200/80 hover:bg-slate-300/80 text-slate-700 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Buka Private Chat dengan Anggota Tim"
                >
                  <Plus size={13} className="text-emerald-600" />
                  <span className="text-[11px]">Private</span>
                </button>

                {isPrivateSelectorOpen && (
                  <div className="absolute top-full right-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-50 space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
                      Mulai Private Chat:
                    </div>
                    <div className="max-h-44 overflow-y-auto space-y-0.5">
                      {mentionableCandidates
                        .filter((c) => !c.isAi && !c.isAll && c.username.toLowerCase() !== (currentUser?.username || '').toLowerCase())
                        .map((c) => (
                          <button
                            key={c.username}
                            type="button"
                            onClick={() => {
                              handleStartPrivateChat(c.username);
                              setIsPrivateSelectorOpen(false);
                            }}
                            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-emerald-50 text-slate-800 flex items-center justify-between text-xs cursor-pointer font-medium"
                          >
                            <span className="font-bold">@{c.username}</span>
                            <span className="text-[10px] text-slate-500 font-normal">{c.role}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Online Team Members Bar (Minimalist) */}
            {activeChatTab === 'team' && (
              <div className="bg-emerald-50/90 px-3 py-1.2 border-b border-emerald-200/60 flex items-center justify-between text-[10.5px] shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="font-bold text-emerald-950 tracking-tight">
                    {onlineUsers.length || 1} Tim Online
                  </span>
                </div>
                <span className="text-[9.5px] text-emerald-700 font-semibold bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-200/80">
                  Real-Time
                </span>
              </div>
            )}

            {/* Real-time SPK Deadline Warning Strip in Chat Header */}
            {spkDeadlineAlerts.length > 0 && isUserEligibleForDeadlineAlert(userRole) && (
              <div className="bg-gradient-to-r from-amber-500 to-rose-600 text-white px-3 py-1.5 flex items-center justify-between text-xs shadow-xs shrink-0 animate-in fade-in">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Flame size={14} className="animate-pulse shrink-0 text-amber-200" />
                  <span className="font-bold truncate text-[11px]">
                    Si BEJO AI: {spkDeadlineAlerts.length} SPK Mendekati / Lewat Deadline!
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    if (onNavigateTab) onNavigateTab('spk');
                  }}
                  className="bg-white/20 hover:bg-white text-white hover:text-rose-900 text-[10px] font-black px-2 py-0.5 rounded-md transition-colors shrink-0 cursor-pointer ml-2"
                >
                  Lihat SPK ➔
                </button>
              </div>
            )}

            {/* Conversation Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/60">
              {activeMessages.map((msg) => {
                // System notification pill
                if (msg.senderRole === 'SYSTEM' || msg.content.startsWith('🟢')) {
                  return (
                    <div key={msg.id} className="flex justify-center my-1.5">
                      <div className="bg-emerald-50/95 text-emerald-800 text-[10.5px] font-semibold px-3 py-1 rounded-full border border-emerald-200 shadow-2xs flex items-center gap-1.5 animate-in fade-in">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>{msg.content.replace(/^🟢\s*\*\*System\*\*:\s*/i, '').replace(/\*\*/g, '')}</span>
                        <span className="text-[9.5px] text-emerald-600 font-mono font-medium ml-1">({msg.timestamp})</span>
                      </div>
                    </div>
                  );
                }

                const isMe = msg.senderUsername
                  ? msg.senderUsername.toLowerCase() === currentUser?.username?.toLowerCase()
                  : msg.role === 'user';
                const isAssistant = msg.role === 'assistant' || msg.senderRole === 'AI ASSISTANT';

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}
                  >
                    <div
                      className={`flex items-start max-w-[88%] gap-2.5 ${
                        isMe ? 'flex-row-reverse' : 'flex-row'
                      }`}
                    >
                      {/* Avatar */}
                      {isAssistant ? (
                        <div className="w-6 h-6 rounded-lg bg-slate-900 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs">
                          <Bot size={13} />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5 text-[11px] font-bold shadow-2xs">
                          {(msg.senderName || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}

                      {/* Bubble Container */}
                      <div className="flex flex-col gap-1">
                        {/* Sender Label & Role Badge (For team chat) */}
                        {activeChatTab === 'team' && !isMe && (
                          <div className="flex items-center gap-1.5 px-1 text-[10.5px]">
                            <span className="font-bold text-slate-800">
                              {msg.senderName || 'Pengguna'}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${
                              isAssistant
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {msg.senderRole || (isAssistant ? 'AI' : 'TIM')}
                            </span>
                          </div>
                        )}

                        <div
                          className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-2xs ${
                            isMe
                              ? 'bg-indigo-600 text-white rounded-tr-xs font-medium'
                              : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs font-normal'
                          }`}
                        >
                          {renderMessageContent(msg.content)}
                        </div>

                        {/* Timestamp & Copy Action */}
                        <div
                          className={`flex items-center gap-2 text-[10px] text-slate-400 px-1 ${
                            isMe ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          <span>{msg.timestamp}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg.id, msg.content)}
                            className="opacity-0 group-hover:opacity-100 hover:text-indigo-600 transition-opacity flex items-center gap-0.5 cursor-pointer font-medium"
                            title="Salin pesan"
                          >
                            {copiedMessageId === msg.id ? (
                              <Check size={11} className="text-emerald-500" />
                            ) : (
                              <Copy size={11} />
                            )}
                            <span className={copiedMessageId === msg.id ? 'text-emerald-600' : ''}>
                              {copiedMessageId === msg.id ? 'Disalin' : 'Salin'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing / Loading indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-start max-w-[85%] space-x-2">
                    <div className="w-6 h-6 rounded-lg bg-slate-900 text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                      <Bot size={13} />
                    </div>
                    <div className="bg-white text-slate-500 border border-slate-200 rounded-2xl rounded-tl-xs px-3.5 py-2.5 text-xs flex items-center space-x-2 shadow-2xs">
                      <span className="font-medium text-slate-600">SI BEJO AI sedang merespon</span>
                      <span className="flex space-x-1">
                        <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Mention Suggestions Popup */}
            <AnimatePresence>
              {mentionQuery !== null && filteredMentionSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-white border-t border-slate-200 shadow-lg p-2 max-h-44 overflow-y-auto"
                >
                  <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider flex items-center gap-1">
                    <AtSign size={11} className="text-indigo-600" />
                    <span>Tag Pengguna (@)</span>
                  </div>
                  <div className="space-y-1">
                    {filteredMentionSuggestions.map((candidate, idx) => (
                      <button
                        key={`${candidate.username}_${idx}`}
                        type="button"
                        onClick={() => handleSelectMention(candidate)}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 text-slate-800 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                            {candidate.isAi ? '🤖' : candidate.isAll ? '📢' : candidate.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900">@{candidate.username}</span>
                            <span className="text-[11px] text-slate-500 ml-1.5 font-medium">({candidate.name})</span>
                          </div>
                        </div>
                        <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                          {candidate.role}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chat Input Bar */}
            <div className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder={
                  activeChatTab === 'team'
                    ? 'Ketik pesan internal... (gunakan @mention tim atau @SiBejoAI)'
                    : activeChatTab === 'private'
                    ? `Ketik pesan privat untuk @${activePrivateUser}...`
                    : 'Ketik pesan atau pertanyaan untuk SI BEJO AI...'
                }
                className="flex-1 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-all text-slate-800 placeholder:text-slate-400 font-medium"
                disabled={isLoading}
                id="bejo-ai-chat-input"
              />
              <button
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 p-2.5 rounded-xl transition-all active:scale-95 cursor-pointer shadow-xs"
                id="bejo-ai-send-btn"
                title="Kirim pesan"
              >
                <Send size={15} />
              </button>
            </div>

            {/* Mention Action Modal (Private Chat vs Tag di Forum) */}
            <AnimatePresence>
              {mentionChoiceCandidate && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
                >
                  <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 w-full max-w-xs space-y-3 animate-in zoom-in-95">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                          {mentionChoiceCandidate.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">@{mentionChoiceCandidate.username}</h4>
                          <p className="text-[10px] text-slate-500 font-medium">{mentionChoiceCandidate.name} • {mentionChoiceCandidate.role}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMentionChoiceCandidate(null)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                      >
                        <X size={15} />
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                      Pilih opsi komunikasi untuk <strong>@{mentionChoiceCandidate.username}</strong>:
                    </p>

                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          insertTagIntoInput(mentionChoiceCandidate.username);
                          setMentionChoiceCandidate(null);
                        }}
                        className="w-full py-2.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-between transition-colors cursor-pointer border border-indigo-200"
                      >
                        <span className="flex items-center gap-2">
                          <AtSign size={14} className="text-indigo-600" />
                          <span>Tag di Forum Chat Tim</span>
                        </span>
                        <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Public</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleStartPrivateChat(mentionChoiceCandidate.username);
                        }}
                        className="w-full py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-between transition-colors cursor-pointer border border-emerald-200"
                      >
                        <span className="flex items-center gap-2">
                          <MessageSquare size={14} className="text-emerald-600" />
                          <span>Buka Private Chat 1-on-1</span>
                        </span>
                        <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">Privat</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewImageUrl(null)}
            className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col cursor-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-indigo-600/30 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                    <Sparkles size={13} />
                  </div>
                  <span className="text-xs font-bold tracking-tight">Preview Desain SI BEJO AI (HD)</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={previewImageUrl}
                    download={`bejo_ai_design_${Date.now()}.png`}
                    className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs"
                  >
                    <Download size={13} />
                    <span>Unduh HD</span>
                  </a>
                  <button
                    onClick={() => setPreviewImageUrl(null)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer"
                    title="Tutup"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="p-2 bg-slate-950/60 flex items-center justify-center overflow-auto max-h-[78vh]">
                <img
                  src={previewImageUrl}
                  alt="Preview Desain Stiker"
                  className="max-w-full max-h-[74vh] object-contain rounded-xl shadow-md"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Real-time @Mention Tag Notification Popup Card */}
      <AnimatePresence>
        {activeMentionPopup && !isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 15 }}
            className="absolute bottom-16 right-0 mb-2 w-84 sm:w-92 bg-white border border-indigo-200 rounded-2xl shadow-2xl p-4 flex flex-col space-y-3 text-slate-800 z-50 animate-in fade-in ring-2 ring-indigo-500/20"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 to-rose-600 text-white flex items-center justify-center shadow-xs">
                  <AtSign size={15} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-900 tracking-tight">SI BEJO AI • Panggilan Tag</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                      @{activeMentionPopup.targetUsername}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Pesan Internal Tim • {activeMentionPopup.formattedTime || 'Baru Saja'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDismissMention(activeMentionPopup.id)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer hover:bg-slate-100"
                title="Tutup Notifikasi"
              >
                <X size={15} />
              </button>
            </div>

            {/* Content */}
            <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-800">
                <span className="flex items-center gap-1">
                  <User size={12} className="text-indigo-600" />
                  <span>Dari: {activeMentionPopup.senderName}</span>
                </span>
                <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-white text-indigo-700 border border-indigo-200">
                  {activeMentionPopup.senderRole}
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-snug line-clamp-3 bg-white p-2 rounded-lg border border-indigo-100 font-medium">
                {activeMentionPopup.content}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => handleOpenMentionChat(activeMentionPopup)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-95"
              >
                <MessageSquare size={13} />
                <span>Buka & Balas Chat</span>
              </button>

              <button
                type="button"
                onClick={() => handleDismissMention(activeMentionPopup.id)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-2 px-3 rounded-xl transition-all cursor-pointer border border-slate-200 flex items-center justify-center gap-1 active:scale-95"
              >
                <CheckCheck size={13} />
                <span>Sudah Baca</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Real-Time Agent Order Notification Pop-up */}
      <AnimatePresence>
        {activeAgentNotifPopup && !isOpen && !activeMentionPopup && (userRole === 'DEVELOPER' || userRole === 'ADMIN') && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 15 }}
            className="absolute bottom-16 right-0 mb-2 w-84 sm:w-92 bg-white border border-slate-200/95 rounded-2xl shadow-2xl p-4 flex flex-col space-y-3 text-slate-800 z-50 animate-in fade-in ring-1 ring-black/5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Bot size={15} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-900 tracking-tight">SI BEJO AI • Notifikasi Pesanan</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                      activeAgentNotifPopup.orderType === 'CETAK_AGEN'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    }`}>
                      {activeAgentNotifPopup.orderType === 'CETAK_AGEN' ? 'CETAK AGEN' : 'PENGAMBILAN BAHAN'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Sinkronisasi Real-Time Database • {activeAgentNotifPopup.time} WIB
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDismissAgentNotif(activeAgentNotifPopup.id)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer hover:bg-slate-100"
                title="Tutup Notifikasi"
              >
                <X size={15} />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Package size={13} className="text-indigo-600" />
                  <span>Mitra Agen: <strong className="text-slate-900">{activeAgentNotifPopup.agentName}</strong></span>
                </span>
                <span className="text-[10.5px] font-mono font-bold text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                  #{activeAgentNotifPopup.orderId}
                </span>
              </div>

              {activeAgentNotifPopup.itemSummary && (
                <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">
                  <span className="font-semibold text-slate-700">Daftar Barang: </span>
                  {activeAgentNotifPopup.itemSummary}
                </p>
              )}

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 font-semibold">
                <span className="text-slate-500 text-[11px]">
                  Total Qty: <strong className="text-slate-800">{activeAgentNotifPopup.totalQty} Unit</strong>
                </span>
                <span className="text-indigo-700 font-bold text-xs">
                  Rp {formatRupiah(activeAgentNotifPopup.totalAmount)}
                </span>
              </div>

              {activeAgentNotifPopup.notes && (
                <p className="text-[10.5px] text-amber-700 bg-amber-50/80 p-1.5 rounded-lg border border-amber-200 font-medium">
                  Catatan: {activeAgentNotifPopup.notes}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => handleAskAiAboutAgentOrder(activeAgentNotifPopup)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-95"
              >
                <Sparkles size={13} />
                <span>Bantu Proses via AI</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleDismissAgentNotif(activeAgentNotifPopup.id);
                  if (onNavigateTab) {
                    onNavigateTab('agen');
                  }
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-2 px-3 rounded-xl transition-all cursor-pointer border border-slate-200 flex items-center justify-center gap-1 active:scale-95"
              >
                <span>Buka Riwayat</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Real-Time SPK Deadline Alert Pop-up from Si BEJO AI */}
      <AnimatePresence>
        {activeDeadlinePopup && !isOpen && !activeMentionPopup && !activeAgentNotifPopup && isUserEligibleForDeadlineAlert(userRole) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 15 }}
            className={`absolute bottom-16 right-0 mb-2 w-84 sm:w-92 bg-white border-2 rounded-2xl shadow-2xl p-4 flex flex-col space-y-3 text-slate-800 z-50 animate-in fade-in ${
              activeDeadlinePopup.isOverdue
                ? 'border-red-500 ring-2 ring-red-400/40'
                : 'border-amber-400 ring-2 ring-amber-300/40'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center space-x-2.5">
                <div className={`w-7 h-7 rounded-xl text-white flex items-center justify-center shadow-xs ${
                  activeDeadlinePopup.isOverdue
                    ? 'bg-gradient-to-tr from-rose-600 to-red-600'
                    : 'bg-gradient-to-tr from-amber-500 to-orange-600'
                }`}>
                  <Flame size={15} className="animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-slate-900 tracking-tight">SI BEJO AI • Peringatan Deadline</span>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                      activeDeadlinePopup.isOverdue
                        ? 'bg-red-100 text-red-900 border border-red-300'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}>
                      {activeDeadlinePopup.isOverdue ? 'LEWAT WAKTU' : 'MENDEKATI DEADLINE'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Batas: {activeDeadlinePopup.deadlineDate} • {activeDeadlinePopup.deadlineTime} WIB
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDismissDeadlineAlert(activeDeadlinePopup.id)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer hover:bg-slate-100"
                title="Tutup Notifikasi"
              >
                <X size={15} />
              </button>
            </div>

            {/* Content Details */}
            <div className={`p-3 rounded-xl border space-y-2 ${
              activeDeadlinePopup.isOverdue
                ? 'bg-red-50/70 border-red-200'
                : 'bg-amber-50/70 border-amber-200'
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-extrabold text-slate-950 text-xs block">
                    {activeDeadlinePopup.jobName}
                  </span>
                  <span className="text-[11px] text-slate-600 font-medium block">
                    Pelanggan: <strong className="text-slate-900">{activeDeadlinePopup.customerName}</strong>
                  </span>
                </div>
                <span className={`text-xs font-black px-2 py-1 rounded-lg shrink-0 shadow-2xs font-mono ${
                  activeDeadlinePopup.isOverdue
                    ? 'bg-red-600 text-white'
                    : 'bg-amber-500 text-white'
                }`}>
                  {activeDeadlinePopup.timeRemainingText}
                </span>
              </div>

              <div className="text-[10.5px] text-slate-700 bg-white/90 p-2 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-1">
                <span>Bahan: <strong>{activeDeadlinePopup.materialName}</strong></span>
                <span className="font-bold text-indigo-700">Status: {activeDeadlinePopup.status.replace(/_/g, ' ')}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => handleOpenSpkWorkflowFromDeadline(activeDeadlinePopup)}
                className={`flex-1 text-white text-xs font-bold py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-95 ${
                  activeDeadlinePopup.isOverdue
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                <PrinterIcon size={13} />
                <span>Buka Alur SPK</span>
              </button>

              <button
                type="button"
                onClick={() => handleDismissDeadlineAlert(activeDeadlinePopup.id)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-2 px-3 rounded-xl transition-all cursor-pointer border border-slate-200 flex items-center justify-center gap-1 active:scale-95"
              >
                <span>Nanti Saja</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SI BEJO AI Comprehensive Settings Modal (DEVELOPER ONLY) */}
      <AnimatePresence>
        {isAiSettingsModalOpen && userRole === 'DEVELOPER' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-blue-500 flex items-center justify-center text-white shadow-xs">
                    <Settings size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm tracking-tight text-white flex items-center gap-2">
                      Pengaturan SI BEJO AI
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 font-mono">
                        Real-Time Engine
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Konfigurasi engine, mode online/offline, suara TTS, dan persona asisten
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAiSettingsModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-5 text-slate-800 text-xs">
                {/* 1. Engine Mode Selection */}
                <div className="space-y-2">
                  <label className="font-bold text-slate-900 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Zap size={14} className="text-indigo-600" />
                      Mode Engine AI (Online & Offline)
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                      isNetworkOnline ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {isNetworkOnline ? '● Internet Terhubung' : '○ Offline Mode'}
                    </span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateAiSettings({ engineMode: 'HYBRID_AUTO' })}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        aiSettings.engineMode === 'HYBRID_AUTO'
                          ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-950 font-medium'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs flex items-center gap-1">
                          ⚡ Hybrid Auto
                        </span>
                        {aiSettings.engineMode === 'HYBRID_AUTO' && <Check size={14} className="text-indigo-600" />}
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Cloud Gemini saat online + Otomatis beralih ke Lokal jika offline/timeout.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdateAiSettings({ engineMode: 'ONLINE_ONLY' })}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        aiSettings.engineMode === 'ONLINE_ONLY'
                          ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-950 font-medium'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs flex items-center gap-1">
                          🌐 Cloud Gemini
                        </span>
                        {aiSettings.engineMode === 'ONLINE_ONLY' && <Check size={14} className="text-indigo-600" />}
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Mengutamakan pemrosesan cloud Gemini Flash dengan grounding data live.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdateAiSettings({ engineMode: 'OFFLINE_ONLY' })}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        aiSettings.engineMode === 'OFFLINE_ONLY'
                          ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 text-indigo-950 font-medium'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs flex items-center gap-1">
                          💾 Offline Instan
                        </span>
                        {aiSettings.engineMode === 'OFFLINE_ONLY' && <Check size={14} className="text-indigo-600" />}
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Respon super instan (&lt;0.1s) 100% dari database lokal tanpa kuota.
                      </p>
                    </button>
                  </div>
                </div>

                {/* 2. Persona Style */}
                <div className="space-y-2">
                  <label className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-500" />
                    Gaya Karakter / Persona AI
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'CERIA', label: 'Ceria & Ramah', desc: 'Hangat & seru' },
                      { id: 'FORMAL', label: 'Formal / Resmi', desc: 'Terstruktur' },
                      { id: 'SANTAI', label: 'Santai & Akrab', desc: 'Bahasa kasual' },
                      { id: 'RINGKAS', label: 'Ringkas & Cepat', desc: 'To the point' }
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleUpdateAiSettings({ personaStyle: p.id as any })}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          aiSettings.personaStyle === p.id
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-bold'
                            : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="text-xs">{p.label}</div>
                        <div className={`text-[9.5px] mt-0.5 ${aiSettings.personaStyle === p.id ? 'text-indigo-100' : 'text-slate-400'}`}>
                          {p.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Custom Call Name */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-900 flex items-center gap-1.5">
                    <User size={14} className="text-slate-600" />
                    Nama Panggilan Kustom untuk Kamu
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiSettings.customCallName || ''}
                      onChange={(e) => handleUpdateAiSettings({ customCallName: e.target.value })}
                      placeholder={`Contoh: Kak ${userCallName || 'Langgo'} atau Pak Bejo`}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] text-slate-400">Pilihan cepat:</span>
                    {['Langgo', 'Pak Bejo', 'Syafira', 'Fira', 'Rio'].map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => handleUpdateAiSettings({ customCallName: name })}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 font-medium cursor-pointer transition-colors border border-slate-200"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Text-To-Speech (TTS) Voice Reader */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Volume2 size={14} className="text-indigo-600" />
                        Pembacaan Suara AI (Text-to-Speech)
                      </div>
                      <div className="text-[10.5px] text-slate-500">
                        SI BEJO AI akan membacakan jawaban langsung dengan suara Bahasa Indonesia
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={aiSettings.enableTts}
                        onChange={(e) => handleUpdateAiSettings({ enableTts: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {aiSettings.enableTts && (
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-600 font-medium">Kecepatan:</span>
                        {[0.8, 1.0, 1.2, 1.5].map((speed) => (
                          <button
                            key={speed}
                            type="button"
                            onClick={() => handleUpdateAiSettings({ ttsSpeed: speed })}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                              aiSettings.ttsSpeed === speed
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => speakText(`Halo Kak ${aiSettings.customCallName || userCallName || 'Langgo'}! SI BEJO AI siap membantu operasional toko dan cetak stiker hari ini. Semangat ya!`, aiSettings.ttsSpeed)}
                        className="text-[10.5px] font-bold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Volume2 size={12} />
                        Tes Suara
                      </button>
                    </div>
                  )}
                </div>

                {/* 5. Proactive Alerts & Notifications */}
                <div className="space-y-2">
                  <label className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Bell size={14} className="text-indigo-600" />
                    Notifikasi Proaktif & Pengingat Otomatis
                  </label>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <div className="font-bold text-slate-800 text-xs">Peringatan Deadline SPK Cetak</div>
                        <div className="text-[10px] text-slate-500">Popup otomatis saat pesanan mendekati/lewat batas waktu</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={aiSettings.enableDeadlineAlerts}
                        onChange={(e) => handleUpdateAiSettings({ enableDeadlineAlerts: e.target.checked })}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <div className="font-bold text-slate-800 text-xs">Sapaan Ramah saat Buka Shift Kasir</div>
                        <div className="text-[10px] text-slate-500">Mengingatkan modal kas dan motivasi semangat kerja</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={aiSettings.autoGreetingOnShift}
                        onChange={(e) => handleUpdateAiSettings({ autoGreetingOnShift: e.target.checked })}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* 6. Live Engine Diagnostics Card */}
                <div className="p-3 bg-indigo-950 text-indigo-100 rounded-xl space-y-1.5 text-[10.5px]">
                  <div className="font-bold text-white flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Zap size={12} className="text-amber-300" />
                      Status Engine Real-Time Aktif
                    </span>
                    <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      LIVE OPTIMAL
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-indigo-200 pt-1">
                    <div>• Engine: <strong>Gemini Flash + Local Engine</strong></div>
                    <div>• Status Jaringan: <strong>{isNetworkOnline ? '🟢 Online' : '🟠 Offline'}</strong></div>
                    <div>• Respon Waktu: <strong>&lt; 100ms (Instan)</strong></div>
                    <div>• Akses Database POS: <strong>Real-Time Terkoneksi</strong></div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateAiSettings(DEFAULT_AI_SETTINGS);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium underline cursor-pointer"
                >
                  Reset Default
                </button>

                <button
                  type="button"
                  onClick={() => setIsAiSettingsModalOpen(false)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  Tutup & Terapkan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Action Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="bg-slate-900 hover:bg-slate-800 text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-center cursor-pointer relative group border border-slate-700/80 transition-all duration-200"
        id="bejo-ai-trigger-btn"
        title="SI BEJO AI • Chat Tim & Asisten POS"
      >
        {isOpen ? (
          <X size={20} className="text-slate-200" />
        ) : (
          <div className="contents">
            <div className="relative flex items-center justify-center">
              <Bot size={20} className="text-white" />
              {unreadMentionCount > 0 ? (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 text-white text-[9px] font-black items-center justify-center border border-white">
                    {unreadMentionCount}
                  </span>
                </span>
              ) : spkDeadlineAlerts.length > 0 && isUserEligibleForDeadlineAlert(userRole) ? (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-gradient-to-tr from-amber-500 to-red-600 text-white text-[9px] font-black items-center justify-center border border-white">
                    {spkDeadlineAlerts.length}
                  </span>
                </span>
              ) : activeAgentNotifPopup && (userRole === 'DEVELOPER' || userRole === 'ADMIN') ? (
                <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 border border-white" />
                </span>
              ) : (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                </span>
              )}
            </div>
            {/* Clean Minimalist Tooltip */}
            <span className="absolute right-14 bg-slate-900 text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-md pointer-events-none border border-slate-800">
              {unreadMentionCount > 0
                ? `${unreadMentionCount} Panggilan Tag Internal!`
                : spkDeadlineAlerts.length > 0 && isUserEligibleForDeadlineAlert(userRole)
                ? `${spkDeadlineAlerts.length} SPK Mendekati Deadline!`
                : activeAgentNotifPopup && (userRole === 'DEVELOPER' || userRole === 'ADMIN')
                ? 'Pesanan Agen Masuk!'
                : 'SI BEJO AI • Chat Tim'}
            </span>
          </div>
        )}
      </motion.button>
    </div>
  );
};
