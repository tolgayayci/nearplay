import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Sparkles, Code2, Rocket, Trophy } from 'lucide-react';

export function DeveloperJourney() {
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
          <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 px-4 py-2 mb-4">
            <Sparkles className="h-4 w-4 mr-2" />
            Your Path to NEAR Mastery
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Choose Your Journey
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: Code2, title: 'Beginner Path', description: 'Learn → Build → Deploy' },
            { icon: Rocket, title: 'Pro Path', description: 'Template → Customize → Scale' },
            { icon: Trophy, title: 'Team Path', description: 'Create → Share → Collaborate' }
          ].map((path, i) => (
            <Card key={i} className="bg-gray-800/30 backdrop-blur-sm border-gray-700 p-6">
              <path.icon className="h-12 w-12 text-teal-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">{path.title}</h3>
              <p className="text-gray-400">{path.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}