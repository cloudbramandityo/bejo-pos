/**
 * Coded by Langgo Bramandityo. Store Identity & Logo Emblem Component
 */
import React, { useState, useEffect } from 'react';
import { getStoredStoreInfo, getStoredDefaultLogo } from '../utils/storage';

const DEFAULT_BEJO_STORE_LOGO = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231e295d"/><stop offset="50%" stop-color="%230f172a"/><stop offset="100%" stop-color="%230284c7"/></linearGradient><linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23f59e0b"/><stop offset="100%" stop-color="%23fbbf24"/></linearGradient></defs><rect width="200" height="200" rx="30" fill="url(%23bg)"/><circle cx="100" cy="85" r="48" fill="none" stroke="url(%23gold)" stroke-width="5" stroke-dasharray="6 4"/><text x="100" y="98" text-anchor="middle" fill="%23ffffff" font-family="system-ui, sans-serif" font-weight="900" font-size="38" letter-spacing="1">BJ</text><rect x="30" y="145" width="140" height="26" rx="13" fill="url(%23gold)"/><text x="100" y="163" text-anchor="middle" fill="%230f172a" font-family="system-ui, sans-serif" font-weight="900" font-size="12" letter-spacing="1">BEJO Digital Print</text></svg>';

interface StoreLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  className?: string;
  rounded?: 'rounded-sm' | 'rounded-md' | 'rounded-lg' | 'rounded-xl' | 'rounded-2xl' | 'rounded-full';
  showText?: boolean;
  storeName?: string;
  subtitle?: string;
  customLogoUrl?: string;
  variant?: 'icon' | 'badge' | 'header';
}

export const StoreLogo: React.FC<StoreLogoProps> = ({
  size = 'md',
  className = '',
  rounded = 'rounded-xl',
  showText = false,
  storeName = 'BEJO Digital Print',
  subtitle,
  customLogoUrl,
  variant = 'icon',
}) => {
  const [imgError, setImgError] = useState(false);
  const [currentStoredLogo, setCurrentStoredLogo] = useState<string | null>(() => {
    return getStoredDefaultLogo() || getStoredStoreInfo()?.logoUrl || null;
  });

  // Listen to live logo update events across tabs / components
  useEffect(() => {
    const handleUpdate = () => {
      const activeLogo = getStoredDefaultLogo() || getStoredStoreInfo()?.logoUrl || null;
      setCurrentStoredLogo(activeLogo);
      setImgError(false);
    };

    window.addEventListener('bejo_logo_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('bejo_logo_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Resolve logo image source: explicit prop > stored default logo / storeInfo > default asset image
  const resolvedLogoSrc = customLogoUrl || currentStoredLogo || getStoredDefaultLogo() || getStoredStoreInfo()?.logoUrl || DEFAULT_BEJO_STORE_LOGO;

  useEffect(() => {
    setImgError(false);
  }, [resolvedLogoSrc]);

  const sizeMap = {
    xs: 'w-5 h-5',
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    xl: 'w-12 h-12',
    '2xl': 'w-16 h-16',
    '3xl': 'w-20 h-20',
  };

  const currentSizeClass = sizeMap[size] || sizeMap.md;

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Emblem Logo */}
      <div
        className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden bg-white border border-slate-200/90 shadow-2xs select-none ${rounded} ${currentSizeClass}`}
        title={`${storeName} Logo`}
      >
        {!imgError ? (
          <img
            src={resolvedLogoSrc}
            alt={`${storeName} Logo`}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover object-center"
          />
        ) : (
          /* High-res gradient fallback badge */
          <div className="w-full h-full bg-gradient-to-tr from-[#1e295d] via-[#1a2350] to-[#0ea5e9] flex items-center justify-center text-white font-black text-sm tracking-wider">
            BJ
          </div>
        )}
      </div>

      {/* Optional Brand Text */}
      {showText && (
        <div className="text-left leading-tight">
          <div className="font-black text-slate-900 tracking-tight text-sm sm:text-base uppercase">
            {storeName}
          </div>
          {subtitle && (
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              {subtitle}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StoreLogo;
