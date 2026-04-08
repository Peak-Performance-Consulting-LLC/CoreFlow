import { motion } from 'framer-motion';
import { featureHighlights } from '../../lib/constants';
import { Card } from '../ui/Card';
import { SectionHeading } from '../ui/SectionHeading';

export function FeaturesSection() {
  return (
    <section id="features" className="section-shell pt-28">
      <SectionHeading
        eyebrow="Platform Highlights"
        title="Designed like a premium SaaS from the first click."
        description="CoreFlow combines polished product design with a practical onboarding and auth foundation, so the first version already feels fundable and scalable."
        align="center"
      />
      <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {featureHighlights.map((feature, index) => {
          const Icon = feature.icon;

          return (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: index * 0.06 }}
            >
              <Card className="h-full p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-6 font-display text-2xl font-semibold text-white">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">{feature.description}</p>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
