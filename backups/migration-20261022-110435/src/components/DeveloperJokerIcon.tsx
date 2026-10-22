/**
 * Coded by Langgo Bramandityo. Developer Joker Emblem Icon
 */
import React, { useState } from 'react';
import jokerImg from '../assets/images/joker_dev_icon_1789442235997.jpg';

interface DeveloperJokerIconProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  rounded?: 'rounded-sm' | 'rounded-md' | 'rounded-lg' | 'rounded-xl' | 'rounded-2xl' | 'rounded-full';
}

export const DeveloperJokerIcon: React.FC<DeveloperJokerIconProps> = ({
  size = 'md',
  className = '',
  rounded = 'rounded-xl',
}) => {
  const [imgError, setImgError] = useState(false);

  const sizeMap = {
    xs: 'w-4 h-4',
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-10 h-10',
  };

  const currentSizeClass = sizeMap[size] || sizeMap.md;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden bg-black text-white border border-slate-800 shadow-xs select-none ${rounded} ${currentSizeClass} ${className}`}
      title="Developer Account (Joker Emblem)"
    >
      {!imgError ? (
        <img
          src={jokerImg}
          alt="Joker Developer Icon"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover object-center"
        />
      ) : (
        /* Minimalist Joker Mask SVG Fallback on Black Background */
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-3/4 h-3/4 text-emerald-400"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#000000" />
          <path d="M8 9l1 2-1 2" stroke="#10b981" />
          <path d="M16 9l-1 2 1 2" stroke="#10b981" />
          <path d="M7 16c2 2.5 8 2.5 10 0" stroke="#ef4444" strokeWidth="2.5" />
          <path d="M6 15.5l2-1" stroke="#ef4444" />
          <path d="M18 15.5l-2-1" stroke="#ef4444" />
          <path d="M9 4l3 3 3-3" stroke="#a855f7" />
        </svg>
      )}
    </div>
  );
};

export default DeveloperJokerIcon;

