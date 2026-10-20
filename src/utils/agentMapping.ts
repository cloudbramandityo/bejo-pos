/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import { Agent, StoreProfile, AppUser } from '../types';

export interface AgentMappingDefinition {
  username: string;
  agentName: string;
  storeProfileId: string;
  storeName: string;
  branch: string;
  address: string;
  phone: string;
  defaultPassword?: string;
}

export const PRESET_AGENT_ACCOUNTS: AgentMappingDefinition[] = [
  {
    username: 'polsek',
    agentName: 'BEJO Polsek',
    storeProfileId: 'bejo_polsek',
    storeName: 'BEJO Polsek',
    branch: 'Polsek',
    address: 'Jl. Raya Polsek No. 1, Jombang',
    phone: '0812-3456-7814',
    defaultPassword: 'agen123'
  },
  {
    username: 'tanon',
    agentName: 'BEJO Tanon',
    storeProfileId: 'bejo_tanon',
    storeName: 'BEJO Tanon',
    branch: 'Tanon',
    address: 'Jl. Raya Tanon No. 12, Sragen',
    phone: '0812-3456-7810',
    defaultPassword: 'agen123'
  },
  {
    username: 'ceweng',
    agentName: 'BEJO Ceweng',
    storeProfileId: 'bejo_ceweng',
    storeName: 'BEJO Ceweng',
    branch: 'Ceweng',
    address: 'Jl. Raya Ceweng No. 8, Jombang',
    phone: '0812-3456-7811',
    defaultPassword: 'agen123'
  },
  {
    username: 'jombang',
    agentName: 'BEJO Jombang',
    storeProfileId: 'bejo_jombang',
    storeName: 'BEJO Jombang',
    branch: 'Jombang Kota',
    address: 'Jl. KH. Wahid Hasyim No. 45, Jombang',
    phone: '0812-3456-7812',
    defaultPassword: 'agen123'
  },
  {
    username: 'somet',
    agentName: 'BEJO Somet',
    storeProfileId: 'bejo_somet',
    storeName: 'BEJO Somet',
    branch: 'Somet',
    address: 'Jl. Raya Somet No. 18, Jawa Timur',
    phone: '0812-3456-7813',
    defaultPassword: 'agen123'
  }
];

export const DEFAULT_AGENT_PROFILES: StoreProfile[] = PRESET_AGENT_ACCOUNTS.map((preset) => ({
  id: preset.storeProfileId,
  storeName: preset.storeName,
  branch: preset.branch,
  address: preset.address,
  phone: preset.phone,
  receiptFooter: `Terima kasih telah berbelanja di ${preset.storeName}!\nMitra Resmi Percetakan & Bahan Stiker.`,
  isMaster: false,
  canModifyMasterProducts: false,
  storeStatus: 'ONLINE'
}));

export const DEFAULT_AGENTS_LIST: Agent[] = PRESET_AGENT_ACCOUNTS.map((preset) => ({
  id: `agent_${preset.username}`,
  name: preset.agentName,
  contactPerson: `PIC ${preset.agentName}`,
  phone: preset.phone,
  address: preset.address,
  commissionRate: 'Mitra Resmi Agen',
  notes: `Profil Cabang ${preset.storeName}`,
  createdAt: '01 Januari 2026'
}));

export const DEFAULT_AGENT_USERS: AppUser[] = PRESET_AGENT_ACCOUNTS.map((preset) => ({
  id: `user_agen_${preset.username}`,
  username: preset.username,
  password: preset.defaultPassword || 'agen123',
  name: preset.storeName,
  role: 'AGEN',
  phone: preset.phone,
  isActive: true,
  createdAt: '01 Januari 2026'
}));

/**
 * Resolves the corresponding Agent and Store Profile for a given user.
 */
export function resolveAgentForUser(user: AppUser | null | undefined): {
  agentName: string;
  storeProfileId: string;
  storeName: string;
  isPredefinedAgent: boolean;
} {
  if (!user) {
    return {
      agentName: 'BEJO Tanon',
      storeProfileId: 'bejo_tanon',
      storeName: 'BEJO Tanon',
      isPredefinedAgent: false
    };
  }

  const cleanUsername = (user.username || '').toLowerCase().trim();
  const cleanName = (user.name || '').toLowerCase().trim();

  // Match by preset username
  const matchedPreset = PRESET_AGENT_ACCOUNTS.find(
    (p) =>
      p.username.toLowerCase() === cleanUsername ||
      cleanName.includes(p.username.toLowerCase()) ||
      cleanName.includes(p.agentName.toLowerCase()) ||
      cleanName.includes(p.branch.toLowerCase())
  );

  if (matchedPreset) {
    return {
      agentName: matchedPreset.agentName,
      storeProfileId: matchedPreset.storeProfileId,
      storeName: matchedPreset.storeName,
      isPredefinedAgent: true
    };
  }

  // Fallback for custom user with role AGEN: construct sensible profile
  const fallbackStoreName = user.name && user.name.toLowerCase().startsWith('bejo') ? user.name : `BEJO ${user.name || cleanUsername.toUpperCase()}`;
  const fallbackId = `bejo_${cleanUsername.replace(/[^a-z0-9]/g, '_')}`;

  return {
    agentName: fallbackStoreName,
    storeProfileId: fallbackId,
    storeName: fallbackStoreName,
    isPredefinedAgent: false
  };
}
