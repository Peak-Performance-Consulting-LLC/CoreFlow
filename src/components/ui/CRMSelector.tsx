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
        <span className="text-sm font-medium text-slate-700">Select your CRM mode</span>
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
                  ? 'border-accent-blue/35 bg-[#FCF7F0] shadow-glow'
                  : 'border-[#E7DED2] bg-[#FFFDFC] hover:border-[#D8CCBD] hover:bg-[#F7F4EE]',
              )}
            >
              <div className={cn('absolute inset-0 bg-gradient-to-br opacity-20', option.accent)} />
              <div className="absolute inset-[1px] rounded-[25px] bg-[#FFFDFC]" />
              <div className="relative space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#E7DED2] bg-[#F7F4EE] text-accent-blue">
                    <Icon className="h-5 w-5" />
                  </div>
                  {isSelected ? (
                    <span className="rounded-full border border-accent-blue/30 bg-accent-blue/12 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-blue">
                      Selected
                    </span>
                  ) : null}
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-slate-900">{option.label}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{option.description}</p>
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
