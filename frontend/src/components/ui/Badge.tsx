import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'info' | 'danger' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  info: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
  danger: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
  neutral: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
};

const dotStyles: Record<BadgeVariant, string> = {
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  info: 'bg-indigo-400',
  danger: 'bg-rose-400',
  neutral: 'bg-slate-400',
};

const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral', dot = false }) => {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border uppercase tracking-wide ${variantStyles[variant]}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[variant]}`} />}
      {label}
    </span>
  );
};

export default Badge;
