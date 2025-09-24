import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Code2,
  Rocket,
  TestTube2,
  Share2,
  Layers,
  Zap,
  Shield,
  Database,
  GitBranch,
  Terminal,
  Braces,
  Globe,
  Sparkles
} from 'lucide-react';

const features = [
  {
    id: 'code',
    name: 'Code Planet',
    icon: Code2,
    color: 'from-blue-500 to-cyan-500',
    description: 'Rust smart contracts with NEAR SDK',
    details: ['Syntax highlighting', 'Auto-complete', 'Error detection', 'Templates'],
    x: 50,
    y: 30,
    size: 'large'
  },
  {
    id: 'build',
    name: 'Build Asteroid',
    icon: Layers,
    color: 'from-purple-500 to-pink-500',
    description: 'cargo-near compilation in the cloud',
    details: ['WASM optimization', 'Size analysis', 'Gas estimation'],
    x: 80,
    y: 50,
    size: 'medium'
  },
  {
    id: 'deploy',
    name: 'Deploy Moon',
    icon: Rocket,
    color: 'from-green-500 to-emerald-500',
    description: 'One-click deployment to NEAR',
    details: ['Testnet ready', 'Mainnet compatible', 'Auto wallet'],
    x: 20,
    y: 60,
    size: 'large'
  },
  {
    id: 'test',
    name: 'Test Nebula',
    icon: TestTube2,
    color: 'from-orange-500 to-red-500',
    description: 'Interactive contract testing',
    details: ['Method execution', 'Transaction history', 'ABI interface'],
    x: 60,
    y: 70,
    size: 'medium'
  },
  {
    id: 'share',
    name: 'Share Galaxy',
    icon: Share2,
    color: 'from-teal-500 to-cyan-500',
    description: 'Collaborate with your team',
    details: ['Project links', 'View analytics', 'Team workspace'],
    x: 35,
    y: 40,
    size: 'small'
  },
  {
    id: 'security',
    name: 'Security Shield',
    icon: Shield,
    color: 'from-red-500 to-orange-500',
    description: 'Built-in security features',
    details: ['Access control', 'Audit logs', 'Best practices'],
    x: 70,
    y: 20,
    size: 'small'
  }
];

export function FeatureConstellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedFeature, setSelectedFeature] = useState<typeof features[0] | null>(null);
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Draw connection lines
    const drawConnections = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(0, 192, 139, 0.1)';
      ctx.lineWidth = 1;

      // Draw connections between features
      features.forEach((feature, i) => {
        features.slice(i + 1).forEach(otherFeature => {
          ctx.beginPath();
          ctx.moveTo(
            (feature.x / 100) * canvas.width,
            (feature.y / 100) * canvas.height
          );
          ctx.lineTo(
            (otherFeature.x / 100) * canvas.width,
            (otherFeature.y / 100) * canvas.height
          );
          ctx.stroke();
        });
      });

      requestAnimationFrame(drawConnections);
    };

    drawConnections();

    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'large':
        return 'w-32 h-32';
      case 'medium':
        return 'w-24 h-24';
      case 'small':
        return 'w-20 h-20';
      default:
        return 'w-24 h-24';
    }
  };

  return (
    <section className="relative py-24 px-6 overflow-hidden">
      <div className="container mx-auto max-w-7xl">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 px-4 py-2 mb-4">
            <Sparkles className="h-4 w-4 mr-2" />
            Your Development Universe
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Feature Constellation
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Click on any planet to explore how our features work together to create
            the perfect development environment
          </p>
        </motion.div>

        {/* 3D Space Visualization */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
          className="relative h-[600px] rounded-2xl bg-gradient-to-b from-gray-900/50 to-gray-800/50 backdrop-blur-sm border border-gray-700 overflow-hidden"
        >
          {/* Connection Lines Canvas */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ pointerEvents: 'none' }}
          />

          {/* Stars Background */}
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                opacity: Math.random() * 0.5 + 0.2
              }}
            />
          ))}

          {/* Feature Planets */}
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isHovered = hoveredFeature === feature.id;
            const isSelected = selectedFeature?.id === feature.id;

            return (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="absolute"
                style={{
                  left: `${feature.x}%`,
                  top: `${feature.y}%`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <motion.div
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedFeature(feature)}
                  onMouseEnter={() => setHoveredFeature(feature.id)}
                  onMouseLeave={() => setHoveredFeature(null)}
                  className={`
                    ${getSizeClasses(feature.size)}
                    relative cursor-pointer group
                  `}
                >
                  {/* Planet Glow Effect */}
                  <div
                    className={`
                      absolute inset-0 rounded-full bg-gradient-to-br ${feature.color}
                      blur-xl opacity-50 group-hover:opacity-75 transition-opacity
                    `}
                  />

                  {/* Planet Body */}
                  <div
                    className={`
                      relative w-full h-full rounded-full
                      bg-gradient-to-br ${feature.color}
                      flex items-center justify-center
                      shadow-2xl transition-all duration-300
                      ${isHovered || isSelected ? 'ring-4 ring-white/20' : ''}
                    `}
                  >
                    <Icon className="w-1/3 h-1/3 text-white" />
                  </div>

                  {/* Planet Label */}
                  <div
                    className={`
                      absolute -bottom-8 left-1/2 -translate-x-1/2
                      text-sm font-medium text-white whitespace-nowrap
                      transition-opacity duration-200
                      ${isHovered || isSelected ? 'opacity-100' : 'opacity-70'}
                    `}
                  >
                    {feature.name}
                  </div>

                  {/* Hover Details */}
                  {isHovered && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute top-full mt-4 left-1/2 -translate-x-1/2 z-10"
                    >
                      <Card className="bg-gray-900/95 backdrop-blur-sm border-gray-700 p-4 min-w-[200px]">
                        <p className="text-sm text-gray-300 mb-2">
                          {feature.description}
                        </p>
                        <div className="text-xs text-gray-500">
                          Click to explore
                        </div>
                      </Card>
                    </motion.div>
                  )}
                </motion.div>
              </motion.div>
            );
          })}

          {/* Selected Feature Details */}
          {selectedFeature && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute right-6 top-6 w-80"
            >
              <Card className="bg-gray-900/95 backdrop-blur-sm border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${selectedFeature.color}`}>
                      <selectedFeature.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">
                      {selectedFeature.name}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedFeature(null)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    ×
                  </button>
                </div>

                <p className="text-gray-300 mb-4">
                  {selectedFeature.description}
                </p>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-400">Features:</h4>
                  {selectedFeature.details.map((detail, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                      <span className="text-sm text-gray-300">{detail}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}
        </motion.div>

        {/* Feature Grid (Alternative View) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          viewport={{ once: true }}
          className="grid md:grid-cols-3 gap-6 mt-12"
        >
          {features.slice(0, 3).map((feature, index) => {
            const Icon = feature.icon;

            return (
              <Card
                key={feature.id}
                className="bg-gray-800/30 backdrop-blur-sm border-gray-700 p-6 hover:bg-gray-800/50 transition-all"
              >
                <div className={`inline-flex p-3 rounded-lg bg-gradient-to-br ${feature.color} mb-4`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {feature.name}
                </h3>
                <p className="text-gray-400 text-sm">
                  {feature.description}
                </p>
              </Card>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}