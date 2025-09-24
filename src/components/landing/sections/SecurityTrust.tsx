import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Shield, Lock, CheckCircle2, Zap } from 'lucide-react';

export function SecurityTrust() {
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
          <Badge className="bg-red-500/10 text-red-400 border-red-500/20 px-4 py-2 mb-4">
            <Shield className="h-4 w-4 mr-2" />
            Built on Solid Ground
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Security & Trust
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Shield, title: 'Secure by Default', description: 'Built-in best practices' },
            { icon: Lock, title: 'Access Control', description: 'Granular permissions' },
            { icon: CheckCircle2, title: 'Audited Code', description: 'Verified templates' },
            { icon: Zap, title: '<600ms Finality', description: 'NEAR Protocol speed' }
          ].map((feature, i) => (
            <Card key={i} className="bg-gray-800/30 backdrop-blur-sm border-gray-700 p-6">
              <feature.icon className="h-10 w-10 text-red-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-gray-400 text-sm">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}