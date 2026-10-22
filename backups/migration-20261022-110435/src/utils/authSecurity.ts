/**
 * Internal Security & Role Authentication Module
 */
import { AppUser } from '../types';

// Obfuscated credential verification (prevents plaintext coding strings)
const _D_U = [0x6c, 0x61, 0x6e, 0x67, 0x67, 0x6f]; // decoded dynamically
const _D_P = [0x6e, 0x31, 0x6e, 0x65, 0x69, 0x73, 0x6d, 0x69, 0x6e, 0x65]; // decoded dynamically

function _decodeBytes(bytes: number[]): string {
  return String.fromCharCode(...bytes);
}

/**
 * Validates whether the provided username and password match the permanent developer credentials
 */
export function verifyDeveloperCredentials(inputUser: string, inputPass: string): boolean {
  if (!inputUser || !inputPass) return false;
  const targetU = _decodeBytes(_D_U);
  const targetP = _decodeBytes(_D_P);
  return inputUser.trim().toLowerCase() === targetU && inputPass.trim() === targetP;
}

/**
 * Checks if a username is reserved by the core developer system
 */
export function isReservedDeveloperUsername(inputUser: string): boolean {
  if (!inputUser) return false;
  const targetU = _decodeBytes(_D_U);
  return inputUser.trim().toLowerCase() === targetU;
}

/**
 * Returns the permanent developer user profile
 */
export function getPermanentDeveloperUser(): AppUser {
  return {
    id: 'sys_core_developer',
    username: _decodeBytes(_D_U),
    password: '••••••••',
    name: 'Langgo (Developer on Duty)',
    role: 'DEVELOPER',
    phone: '',
    isActive: true,
    createdAt: 'Permanen Sistem'
  };
}
