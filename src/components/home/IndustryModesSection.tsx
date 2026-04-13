import { motion } from 'framer-motion';
import { crmOptions } from '../../lib/constants';
import { Card } from '../ui/Card';
import { SectionHeading } from '../ui/SectionHeading';

export function IndustryModesSection() {
  return (
    <section id="modes" className="section-shell pt-28">
      <div className="grid gap-10 xl:grid-cols-[0.9fr_1.1fr] xl:items-end">
        <SectionHeading
          eyebrow="Industry Modes"
          title="One platform. Five launch-ready CRM modes."
          description="Users choose the mode that matches their business during onboarding, but everything still starts from the same shared product foundation."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {crmOptions.map((crm, index) => {
            const Icon = crm.icon;

            return (
              <motion.div
                key={crm.value}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.45, delay: index * 0.05 }}
              >
                <Card className="relative h-full overflow-hidden p-5">
                  <div className={`absolute inset-0 bg-gradient-to-br ${crm.accent} opacity-80`} />
                  <div className="absolute inset-[1px] rounded-[27px] bg-[#FFFDFC]" />
                  <div className="relative">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E7DED2] bg-[#F7F4EE] text-accent-blue">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-6 font-display text-2xl font-semibold text-slate-900">{crm.label}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{crm.description}</p>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
