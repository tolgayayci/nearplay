import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'DeFi Developer',
    content: 'NEAR Playground cut our deployment time from hours to minutes. The templates are production-ready and gas-optimized.',
    rating: 5
  },
  {
    name: 'Alex Rodriguez',
    role: 'NFT Creator',
    content: 'Finally, a development environment that just works. No more fighting with toolchains!',
    rating: 5
  },
  {
    name: 'Jordan Smith',
    role: 'Startup Founder',
    content: 'We launched our entire smart contract infrastructure using NEAR Playground. Incredible speed and reliability.',
    rating: 5
  }
];

export function Testimonials() {
  return (
    <section className="relative py-24 px-6">
      <div className="container mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge className="bg-pink-500/10 text-pink-400 border-pink-500/20 px-4 py-2 mb-4">
            <Quote className="h-4 w-4 mr-2" />
            Voices from the NEAR Field
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Developers Love NEAR Playground
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="bg-gray-800/30 backdrop-blur-sm border-gray-700 p-6 h-full">
                <div className="flex mb-4">
                  {[...Array(testimonial.rating)].map((_, j) => (
                    <Star key={j} className="h-5 w-5 text-yellow-400 fill-current" />
                  ))}
                </div>

                <p className="text-gray-300 mb-6 italic">"{testimonial.content}"</p>

                <div>
                  <div className="font-semibold text-white">{testimonial.name}</div>
                  <div className="text-sm text-gray-400">{testimonial.role}</div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}