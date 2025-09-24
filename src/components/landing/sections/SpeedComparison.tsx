import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Clock,
  Gauge,
  Download,
  Settings,
  Code2,
  Rocket,
  CheckCircle2,
  XCircle,
  Timer,
  Zap
} from 'lucide-react';

const traditionalSteps = [
  { time: 0, task: 'Install Rust', status: 'waiting', duration: 15 },
  { time: 15, task: 'Install cargo-near', status: 'waiting', duration: 10 },
  { time: 25, task: 'Setup environment', status: 'waiting', duration: 10 },
  { time: 35, task: 'Configure toolchain', status: 'waiting', duration: 15 },
  { time: 50, task: 'Create project', status: 'waiting', duration: 5 },
  { time: 55, task: 'Write code', status: 'waiting', duration: 20 },
  { time: 75, task: 'Compile contract', status: 'waiting', duration: 10 },
  { time: 85, task: 'Deploy to testnet', status: 'waiting', duration: 15 },
];

const playgroundSteps = [
  { time: 0, task: 'Open browser', status: 'waiting', duration: 2 },
  { time: 2, task: 'Choose template', status: 'waiting', duration: 3 },
  { time: 5, task: 'Write code', status: 'waiting', duration: 15 },
  { time: 20, task: 'Click compile', status: 'waiting', duration: 5 },
  { time: 25, task: 'Deploy instantly', status: 'waiting', duration: 5 },
];

export function SpeedComparison() {
  const [sliderValue, setSliderValue] = useState([50]);
  const [isAnimating, setIsAnimating] = useState(false);

  const startAnimation = () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 3000);
  };

  const timePosition = sliderValue[0];

  return (
    <section className="relative py-24 px-6 overflow-hidden">
      {/* Background Effect */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-teal-900/10 to-transparent" />
      </div>

      <div className="container mx-auto max-w-7xl relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20 px-4 py-2 mb-4">
            <Clock className="h-4 w-4 mr-2" />
            The NEAR Time Machine
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Hours to Seconds
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Drag the timeline to see how we compress 100 minutes of setup into 30 seconds of productivity
          </p>
        </motion.div>

        {/* Interactive Timeline Slider */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700 p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Timeline Controller</h3>
              <button
                onClick={startAnimation}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                Animate
              </button>
            </div>

            <div className="space-y-4">
              <Slider
                value={sliderValue}
                onValueChange={setSliderValue}
                max={100}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-400">
                <span>0 min</span>
                <span className="text-teal-400 font-semibold">{timePosition} min</span>
                <span>100 min</span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Side-by-side Comparison */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Traditional Setup */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            viewport={{ once: true }}
          >
            <Card className="bg-gray-800/30 backdrop-blur-sm border-red-500/20 h-full">
              <div className="p-6 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Download className="h-5 w-5 text-red-400" />
                    Traditional Setup
                  </h3>
                  <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
                    100+ minutes
                  </Badge>
                </div>
              </div>

              <div className="p-6 space-y-3">
                {traditionalSteps.map((step, index) => {
                  const isActive = timePosition >= step.time && timePosition < step.time + step.duration;
                  const isComplete = timePosition >= step.time + step.duration;

                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                        isActive
                          ? 'bg-red-500/10 border border-red-500/30'
                          : isComplete
                          ? 'bg-gray-700/20'
                          : 'opacity-50'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        {isComplete ? (
                          <CheckCircle2 className="h-5 w-5 text-green-400" />
                        ) : isActive ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-400" />
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-white">{step.task}</div>
                        <div className="text-xs text-gray-500">
                          {step.time}-{step.time + step.duration} min
                        </div>
                      </div>
                      {isActive && (
                        <Badge className="bg-red-500/20 text-red-400 text-xs">
                          In Progress
                        </Badge>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Terminal Simulation */}
              <div className="p-6 border-t border-gray-700">
                <div className="bg-gray-900/50 rounded-lg p-4 font-mono text-sm">
                  <AnimatePresence mode="wait">
                    {timePosition < 15 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <p className="text-gray-400">$ curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh</p>
                        <p className="text-gray-500">Installing Rust...</p>
                      </motion.div>
                    )}
                    {timePosition >= 15 && timePosition < 25 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <p className="text-gray-400">$ cargo install cargo-near</p>
                        <p className="text-gray-500">Compiling dependencies...</p>
                      </motion.div>
                    )}
                    {timePosition >= 25 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <p className="text-gray-400">$ near login</p>
                        <p className="text-red-400">Error: Permission denied</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* NEAR Playground */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            viewport={{ once: true }}
          >
            <Card className="bg-gray-800/30 backdrop-blur-sm border-teal-500/20 h-full">
              <div className="p-6 border-b border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Rocket className="h-5 w-5 text-teal-400" />
                    NEAR Playground
                  </h3>
                  <Badge className="bg-teal-500/10 text-teal-400 border-teal-500/20">
                    30 seconds
                  </Badge>
                </div>
              </div>

              <div className="p-6 space-y-3">
                {playgroundSteps.map((step, index) => {
                  const scaledTime = (timePosition / 100) * 30; // Scale to 30 seconds
                  const isActive = scaledTime >= step.time && scaledTime < step.time + step.duration;
                  const isComplete = scaledTime >= step.time + step.duration;

                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                        isActive
                          ? 'bg-teal-500/10 border border-teal-500/30'
                          : isComplete
                          ? 'bg-gray-700/20'
                          : 'opacity-50'
                      }`}
                    >
                      <div className="flex-shrink-0">
                        {isComplete ? (
                          <CheckCircle2 className="h-5 w-5 text-green-400" />
                        ) : isActive ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-teal-400" />
                        ) : (
                          <Timer className="h-5 w-5 text-gray-600" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-white">{step.task}</div>
                        <div className="text-xs text-gray-500">
                          {step.time}-{step.time + step.duration} sec
                        </div>
                      </div>
                      {isActive && (
                        <Badge className="bg-teal-500/20 text-teal-400 text-xs">
                          In Progress
                        </Badge>
                      )}
                    </motion.div>
                  );
                })}

                {/* Extra space for visual balance */}
                <div className="h-32" />
              </div>

              {/* Browser Simulation */}
              <div className="p-6 border-t border-gray-700">
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                    </div>
                    <div className="flex-1 bg-gray-800 rounded px-3 py-1 text-xs text-gray-400">
                      nearplay.app
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="text-teal-400">✓ No downloads required</p>
                    <p className="text-teal-400">✓ Instant compilation</p>
                    <p className="text-teal-400">✓ Deploy with one click</p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Speed Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-8 p-6 bg-gradient-to-r from-teal-500/10 to-purple-500/10 rounded-2xl border border-gray-700">
            <div>
              <Gauge className="h-12 w-12 text-teal-400 mx-auto mb-2" />
              <div className="text-3xl font-bold text-white">200x</div>
              <div className="text-sm text-gray-400">Faster Setup</div>
            </div>
            <div className="h-16 w-px bg-gray-700" />
            <div>
              <Settings className="h-12 w-12 text-purple-400 mx-auto mb-2" />
              <div className="text-3xl font-bold text-white">0</div>
              <div className="text-sm text-gray-400">Dependencies</div>
            </div>
            <div className="h-16 w-px bg-gray-700" />
            <div>
              <Code2 className="h-12 w-12 text-orange-400 mx-auto mb-2" />
              <div className="text-3xl font-bold text-white">100%</div>
              <div className="text-sm text-gray-400">Cloud-Based</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}