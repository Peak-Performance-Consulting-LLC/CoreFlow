import { motion } from 'framer-motion';
import { SectionHeading } from '../ui/SectionHeading';

const steps = [
  {
    title: 'Sign up',
    description: 'Create your account with secure Supabase Auth and a polished, low-friction form.',
  },
  {
    title: 'Create workspace',
    description: 'Define your shared workspace name and custom slug during the same onboarding flow.',
  },
  {
    title: 'Choose CRM mode',
    description: 'Select the industry experience you want to launch first without fragmenting your platform.',
  },
  {
    title: 'Enter dashboard',
    description: 'Land in a personalized dashboard shell with the right language, badges, and next actions.',
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="section-shell pt-28">
      <SectionHeading
        eyebrow="How It Works"
        title="A fast path from account creation to dashboard entry."
        description="CoreFlow keeps the first-run experience focused: account, workspace, CRM selection, then immediate entry into the right dashboard route."
        align="center"
      />
      <div className="mt-12 grid gap-5 lg:grid-cols-4">
        {steps.map((step, index) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.45, delay: index * 0.06 }}
            className="relative rounded-[28px] border border-white/10 bg-white/[0.04] p-6"
          >
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 font-display text-lg font-semibold text-cyan-200">
              0{index + 1}
            </div>
            <h3 className="font-display text-2xl font-semibold text-white">{step.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-400">{step.description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
