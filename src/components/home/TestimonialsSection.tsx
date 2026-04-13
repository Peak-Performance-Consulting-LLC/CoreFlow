import { motion } from 'framer-motion';
import { testimonials } from '../../lib/constants';
import { Card } from '../ui/Card';
import { SectionHeading } from '../ui/SectionHeading';

export function TestimonialsSection() {
  return (
    <section id="testimonials" className="section-shell pt-28">
      <SectionHeading
        eyebrow="Trust & Signal"
        title="UI-only social proof that still feels credible."
        description="This starter includes premium trust blocks so the landing page already tells a strong product story while the deeper CRM modules are still being built."
      />
      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {testimonials.map((testimonial, index) => (
          <motion.div
            key={testimonial.name}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.45, delay: index * 0.06 }}
          >
            <Card className="h-full p-6">
              <p className="text-base leading-8 text-slate-700">"{testimonial.quote}"</p>
              <div className="mt-8">
                <div className="font-display text-lg font-semibold text-slate-900">{testimonial.name}</div>
                <div className="text-sm text-slate-600">{testimonial.title}</div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
