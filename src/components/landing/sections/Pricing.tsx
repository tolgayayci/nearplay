import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Sparkles } from 'lucide-react';

const plans = [
  {
    name: 'Free',
    price: '$0',
    description: 'Perfect for learning and prototyping',
    features: [
      'Unlimited projects',
      '100 deployments/month',
      'All templates',
      'Community support'
    ],
    cta: 'Start Free',
    popular: false
  },
  {
    name: 'Pro',
    price: '$29',
    description: 'For serious developers',
    features: [
      'Everything in Free',
      'Unlimited deployments',
      'Priority compilation',
      'Private projects',
      'Team collaboration',
      'Premium support'
    ],
    cta: 'Go Pro',
    popular: true
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For organizations',
    features: [
      'Everything in Pro',
      'Custom infrastructure',
      'SLA guarantee',
      'Dedicated support',
      'Custom integrations'
    ],
    cta: 'Contact Sales',
    popular: false
  }
];

export function Pricing() {
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
          <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20 px-4 py-2 mb-4">
            <Sparkles className="h-4 w-4 mr-2" />
            Start Free, Scale Smart
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className={`
                relative bg-gray-800/30 backdrop-blur-sm border-gray-700 p-6 h-full
                ${plan.popular ? 'ring-2 ring-teal-500' : ''}
              `}>
                {plan.popular && (
                  <Badge className="absolute -top-3 right-6 bg-teal-500 text-white">
                    Most Popular
                  </Badge>
                )}

                <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                <div className="text-3xl font-bold text-teal-400 mb-2">{plan.price}</div>
                <p className="text-gray-400 mb-6">{plan.description}</p>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-400 flex-shrink-0" />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full ${
                    plan.popular
                      ? 'bg-teal-500 hover:bg-teal-600 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-white'
                  }`}
                >
                  {plan.cta}
                </Button>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}