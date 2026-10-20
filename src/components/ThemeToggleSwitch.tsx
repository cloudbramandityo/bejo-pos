/**
 * Coded by Langgo Bramandityo. Please guys, jangan diutak-atik coding-nya ya. Thanks!
 */
import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleSwitchProps {
  isDarkMode: boolean;
  onToggle: () => void;
  variant?: 'compact' | 'full' | 'dropdown';
  className?: string;
}

export const ThemeToggleSwitch: React.FC<ThemeToggleSwitchProps> = ({
  isDarkMode,
  onToggle,
  variant = 'full',
  className = ''
}) => {
  if (variant === 'dropdown') {
    return (
      <button
        type="button"
        id="dev-theme-toggle-dropdown"
        onClick={onToggle}
        className="w-full text-left px-3.5 py-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/50 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
        title={isDarkMode ? 'Ganti ke Light Mode' : 'Ganti ke Dark Mode'}
      >
        <div className="flex items-center gap-2">
          {isDarkMode ? (
            <Moon className="w-4 h-4 text-indigo-400" />
          ) : (
            <Sun className="w-4 h-4 text-amber-500" />
          )}
          <span className="text-slate-800 dark:text-slate-200">
            {isDarkMode ? 'Dark Mode (Aktif)' : 'Light Mode (Aktif)'}
          </span>
        </div>

        {/* Slide Switch Mini */}
        <div
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
            isDarkMode ? 'bg-indigo-600' : 'bg-slate-300'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
              isDarkMode ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </div>
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        type="button"
        id="dev-theme-toggle-compact"
        onClick={onToggle}
        className={`relative inline-flex items-center h-8 w-16 rounded-full p-1 transition-all duration-300 cursor-pointer border shadow-inner ${
          isDarkMode
            ? 'bg-slate-800 border-slate-700 text-indigo-300 shadow-slate-900/80'
            : 'bg-amber-100/90 border-amber-200 text-amber-700'
        } ${className}`}
        title={isDarkMode ? 'Klik untuk beralih ke Light Mode' : 'Klik untuk beralih ke Dark Mode'}
        aria-label="Toggle Dark/Light Mode"
      >
        {/* Track Icons */}
        <div className="w-full flex items-center justify-between px-1 pointer-events-none">
          <Sun className={`w-3 h-3 transition-opacity ${isDarkMode ? 'opacity-40 text-slate-400' : 'opacity-100 text-amber-600'}`} />
          <Moon className={`w-3 h-3 transition-opacity ${isDarkMode ? 'opacity-100 text-indigo-300' : 'opacity-40 text-slate-400'}`} />
        </div>

        {/* Sliding Thumb */}
        <div
          className={`absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center transition-transform duration-300 ease-spring ${
            isDarkMode
              ? 'translate-x-8 bg-slate-900 border border-indigo-400/40 text-indigo-400'
              : 'translate-x-0 text-amber-500'
          }`}
        >
          {isDarkMode ? (
            <Moon className="w-3.5 h-3.5 fill-indigo-400/20" />
          ) : (
            <Sun className="w-3.5 h-3.5 fill-amber-500/20" />
          )}
        </div>
      </button>
    );
  }

  // Full Interactive Slide Button with Badge & Status
  return (
    <div
      className={`inline-flex items-center gap-2 p-1 pl-2.5 pr-1.5 rounded-2xl border transition-all duration-300 select-none ${
        isDarkMode
          ? 'bg-slate-800/95 border-slate-700 shadow-md text-slate-200'
          : 'bg-slate-100 border-slate-200/90 text-slate-700 shadow-2xs'
      } ${className}`}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-tight">
        {isDarkMode ? (
          <Moon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        )}
        <span className="hidden xl:inline text-[10px] uppercase font-extrabold tracking-wider opacity-80">
          {isDarkMode ? 'Dark' : 'Light'}
        </span>
      </div>

      {/* Slide Toggle Button */}
      <button
        type="button"
        id="dev-theme-toggle-slide"
        onClick={onToggle}
        className={`relative inline-flex items-center h-6 w-12 rounded-full p-0.5 transition-colors duration-300 cursor-pointer ${
          isDarkMode
            ? 'bg-indigo-600/90 hover:bg-indigo-600 focus:ring-2 focus:ring-indigo-400/30'
            : 'bg-slate-300 hover:bg-slate-400/80 focus:ring-2 focus:ring-amber-400/30'
        }`}
        title={isDarkMode ? 'Ganti ke Light Mode' : 'Ganti ke Dark Mode (Abu Tua)'}
        aria-pressed={isDarkMode}
      >
        <span className="sr-only">Toggle Dark Mode</span>
        {/* Thumb */}
        <span
          className={`pointer-events-none inline-flex items-center justify-center h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-300 ease-in-out ${
            isDarkMode ? 'translate-x-6 bg-slate-950 text-indigo-300' : 'translate-x-0 text-amber-500'
          }`}
        >
          {isDarkMode ? (
            <Moon className="w-3 h-3 text-indigo-400" />
          ) : (
            <Sun className="w-3 h-3 text-amber-500" />
          )}
        </span>
      </button>
    </div>
  );
};
