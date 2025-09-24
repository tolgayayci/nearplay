import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Activity, Users, Code2, Globe } from 'lucide-react';

export function LiveMetrics() {
  const [metrics, setMetrics] = useState({
    compilations: 15234,
    activeDevs: 142,
    deployments: 8921,
    gasOptimized: '2.4M'
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        compilations: prev.compilations + Math.floor(Math.random() * 5),
        activeDevs: prev.activeDevs + (Math.random() > 0.5 ? 1 : -1),
        deployments: prev.deployments + Math.floor(Math.random() * 3),
        gasOptimized: prev.gasOptimized
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

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
          <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 px-4 py-2 mb-4">
            <Activity className="h-4 w-4 mr-2 animate-pulse" />
            The NEAR Pulse
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Live Platform Metrics
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-4 gap-6">
          {[
            { icon: Code2, label: 'Contracts Compiled', value: metrics.compilations.toLocaleString(), color: 'text-teal-400' },
            { icon: Users, label: 'Active Developers', value: metrics.activeDevs, color: 'text-purple-400' },
            { icon: Globe, label: 'Total Deployments', value: metrics.deployments.toLocaleString(), color: 'text-green-400' },
            { icon: Activity, label: 'NEAR Gas Saved', value: metrics.gasOptimized, color: 'text-orange-400' }
          ].map((metric, i) => (
            <Card key={i} className="bg-gray-800/30 backdrop-blur-sm border-gray-700 p-6 text-center">
              <metric.icon className={`h-8 w-8 ${metric.color} mx-auto mb-3`} />
              <div className={`text-3xl font-bold ${metric.color} mb-2`}>{metric.value}</div>
              <div className="text-sm text-gray-400">{metric.label}</div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}