import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface StatCardProps {
  label: string;
  value: string;
  delta: string;
  positive: boolean;
  icon: React.ReactNode;
  accentColor?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, delta, positive, icon, accentColor = 'indigo' }) => {
  const { isDark } = useTheme();

  const cardBg = isDark ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white border-slate-200';
  const labelColor = isDark ? 'text-slate-400' : 'text-slate-500';
  const valueColor = isDark ? 'text-white' : 'text-slate-900';
  const deltaColor = positive
    ? isDark ? 'text-emerald-400' : 'text-emerald-600'
    : isDark ? 'text-rose-400' : 'text-rose-600';
  const deltaBg = positive
    ? isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'
    : isDark ? 'bg-rose-500/10' : 'bg-rose-50';

  const iconBg = isDark
    ? `bg-${accentColor}-500/15 text-${accentColor}-400`
    : `bg-${accentColor}-50 text-${accentColor}-600`;

  return (
    <div className={`rounded-xl border p-4 sm:p-5 transition-all duration-300 hover:scale-[1.02] ${cardBg}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium uppercase tracking-wider truncate ${labelColor}`}>{label}</p>
          <p className={`text-2xl sm:text-3xl font-bold mt-1.5 tracking-tight ${valueColor}`}>{value}</p>
          <div className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-semibold ${deltaBg} ${deltaColor}`}>
            {positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {delta}
          </div>
        </div>
        <div className={`p-2.5 rounded-xl flex-shrink-0 ${iconBg}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
