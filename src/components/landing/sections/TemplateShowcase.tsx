import { useState } from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Code2,
  Coins,
  Image,
  Vote,
  Lock,
  FileCode,
  Gauge,
  Users,
  Sparkles,
  ArrowRight
} from 'lucide-react';

const templates = [
  {
    id: 'counter',
    name: 'Counter',
    category: 'Beginner',
    icon: Code2,
    color: 'from-blue-500 to-cyan-500',
    gasEfficiency: 95,
    complexity: 1,
    description: 'Simple state management contract',
    code: 'pub fn increment(&mut self)',
    useCase: 'Learn the basics'
  },
  {
    id: 'nep141',
    name: 'NEP-141 Token',
    category: 'DeFi',
    icon: Coins,
    color: 'from-green-500 to-emerald-500',
    gasEfficiency: 88,
    complexity: 3,
    description: 'Fungible token standard',
    code: 'impl FungibleToken',
    useCase: 'Create your own token'
  },
  {
    id: 'nep171',
    name: 'NEP-171 NFT',
    category: 'Digital Art',
    icon: Image,
    color: 'from-purple-500 to-pink-500',
    gasEfficiency: 82,
    complexity: 4,
    description: 'Non-fungible token standard',
    code: 'impl NonFungibleToken',
    useCase: 'Launch NFT collection'
  },
  {
    id: 'voting',
    name: 'Voting',
    category: 'Governance',
    icon: Vote,
    color: 'from-orange-500 to-red-500',
    gasEfficiency: 90,
    complexity: 3,
    description: 'Democratic voting system',
    code: 'pub fn vote(&mut self, proposal_id)',
    useCase: 'DAO governance'
  },
  {
    id: 'escrow',
    name: 'Escrow',
    category: 'Commerce',
    icon: Lock,
    color: 'from-teal-500 to-cyan-500',
    gasEfficiency: 85,
    complexity: 4,
    description: 'Secure payment escrow',
    code: 'pub fn release_funds(&mut self)',
    useCase: 'Marketplace payments'
  },
  {
    id: 'custom',
    name: 'Blank Canvas',
    category: 'Pro',
    icon: FileCode,
    color: 'from-gray-500 to-gray-600',
    gasEfficiency: 100,
    complexity: 0,
    description: 'Start from scratch',
    code: '#[near_bindgen]',
    useCase: 'Build anything'
  }
];

export function TemplateShowcase() {
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0]);
  const [isFlipped, setIsFlipped] = useState(false);

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
          <Badge className="bg-green-500/10 text-green-400 border-green-500/20 px-4 py-2 mb-4">
            <Sparkles className="h-4 w-4 mr-2" />
            Start with Excellence
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Template Collection
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Production-ready smart contract templates. Each one optimized, audited, and ready to deploy.
          </p>
        </motion.div>

        {/* 3D Card Showcase */}
        <div className="grid lg:grid-cols-3 gap-8">
          {templates.map((template, index) => {
            const Icon = template.icon;
            const isSelected = selectedTemplate.id === template.id;

            return (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ y: -10 }}
                onClick={() => setSelectedTemplate(template)}
                className="cursor-pointer"
              >
                <Card className={`
                  relative h-full bg-gray-800/30 backdrop-blur-sm border-gray-700
                  hover:bg-gray-800/50 transition-all duration-300
                  ${isSelected ? 'ring-2 ring-teal-500' : ''}
                `}>
                  {/* Card Header */}
                  <div className="p-6 border-b border-gray-700">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`
                        p-3 rounded-lg bg-gradient-to-br ${template.color}
                      `}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <Badge variant="outline" className="bg-gray-900/50">
                        {template.category}
                      </Badge>
                    </div>

                    <h3 className="text-xl font-semibold text-white mb-2">
                      {template.name}
                    </h3>
                    <p className="text-gray-400 text-sm">
                      {template.description}
                    </p>
                  </div>

                  {/* Card Stats */}
                  <div className="p-6 space-y-4">
                    {/* Gas Efficiency */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400 flex items-center gap-1">
                          <Gauge className="h-4 w-4" />
                          Gas Efficiency
                        </span>
                        <span className="text-sm font-medium text-white">
                          {template.gasEfficiency}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${template.gasEfficiency}%` }}
                          transition={{ duration: 1, delay: index * 0.1 }}
                          viewport={{ once: true }}
                          className={`h-2 rounded-full bg-gradient-to-r ${template.color}`}
                        />
                      </div>
                    </div>

                    {/* Complexity */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Complexity</span>
                        <div className="flex gap-1">
                          {[...Array(5)].map((_, i) => (
                            <div
                              key={i}
                              className={`
                                w-2 h-2 rounded-full
                                ${i < template.complexity ? 'bg-teal-400' : 'bg-gray-600'}
                              `}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Code Preview */}
                    <div className="pt-2">
                      <code className="text-xs text-teal-400 font-mono">
                        {template.code}
                      </code>
                    </div>

                    {/* Use Case */}
                    <div className="pt-2 border-t border-gray-700">
                      <span className="text-sm text-gray-500">Use case: </span>
                      <span className="text-sm text-white">{template.useCase}</span>
                    </div>
                  </div>

                  {/* Hover Effect */}
                  {isSelected && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 pointer-events-none"
                    >
                      <div className={`
                        absolute inset-0 bg-gradient-to-br ${template.color}
                        opacity-10 rounded-lg
                      `} />
                    </motion.div>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <button className="group inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-teal-500/25 transition-all">
            Start with {selectedTemplate.name} Template
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </div>
    </section>
  );
}