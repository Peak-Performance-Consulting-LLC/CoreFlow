import { motion } from 'framer-motion';
import { crmOptions } from '../../lib/constants';
import { cn } from '../../lib/utils';
import type { CRMType } from '../../lib/types';

interface CRMSelectorProps {
  value: CRMType;
  onChange: (crmType: CRMType) => void;
  error?: string;
}

export function CRMSelector({ value, onChange, error }: CRMSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-200">Select your CRM mode</span>
        <span className="text-xs text-slate-500">Choose one shared workspace mode for launch</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {crmOptions.map((option, index) => {
          const Icon = option.icon;
          const isSelected = option.value === value;

          return (
            <motion.button
              key={option.value}
              type="button"
              whileHover={{ y: -4, scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onChange(option.value)}
              className={cn(
                'relative overflow-hidden rounded-[26px] border p-4 text-left transition',
                isSelected
                  ? 'border-cyan-300/60 bg-white/[0.08] shadow-glow'
                  : 'border-white/10 bg-slate-950/70 hover:border-white/20 hover:bg-white/[0.06]',
              )}
            >
              <div className={cn('absolute inset-0 bg-gradient-to-br opacity-80', option.accent)} />
              <div className="absolute inset-[1px] rounded-[25px] bg-slate-950/90" />
              <div className="relative space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-cyan-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  {isSelected ? (
                    <span className="rounded-full border border-cyan-300/30 bg-cyan-300/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">
                      Selected
                    </span>
                  ) : null}
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-white">{option.label}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{option.description}</p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
