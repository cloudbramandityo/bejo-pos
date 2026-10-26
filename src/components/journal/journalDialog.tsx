import React from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

export const Dialog: React.FC<DialogProps> = ({ title, children, onClose }) => (
  <div
    className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    aria-label={title}
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}
  >
    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
          aria-label="Tutup"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  </div>
);

interface ToolButtonProps {
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}

export const ToolButton: React.FC<ToolButtonProps> = ({
  label,
  icon: Icon,
  onClick,
  disabled,
  active,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={label}
    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
      active
        ? 'bg-slate-900 text-white border-slate-900'
        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
    }`}
  >
    <Icon className="w-3.5 h-3.5" />
    <span className="hidden sm:inline">{label}</span>
  </button>
);
