import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SignInDialog } from '@/components/landing/SignInDialog';
import { ArrowRight, Zap, Code2, Rocket, Globe } from 'lucide-react';

const codeSnippets = [
  '#[near_bindgen]',
  'pub struct Contract {',
  '  value: i32,',
  '}',
  'impl Contract {',
  '  pub fn increment(&mut self)',
  '  self.value += 1;',
  '  log!("Incremented");',
  '}',
];

export function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [deploymentCount, setDeploymentCount] = useState(1247);
  const [activeUsers, setActiveUsers] = useState(89);
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 300], [0, -50]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0.3]);

  useEffect(() => {
    // Simulate live deployment counter
    const interval = setInterval(() => {
      setDeploymentCount(prev => prev + Math.floor(Math.random() * 3));
      setActiveUsers(prev => prev + (Math.random() > 0.5 ? 1 : -1));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Code rain animation
    const columns = Math.floor(canvas.width / 20);
    const drops: number[] = new Array(columns).fill(1);

    const animate = () => {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#00C08B';
      ctx.font = '15px monospace';

      for (let i = 0; i < drops.length; i++) {
        const text = codeSnippets[Math.floor(Math.random() * codeSnippets.length)];
        ctx.fillText(text.charAt(Math.floor(Math.random() * text.length)), i * 20, drops[i] * 20);

        if (drops[i] * 20 > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }

      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  const handleLaunchClick = () => {
    const trigger = document.querySelector<HTMLButtonElement>('[data-signin-trigger]');
    if (trigger) {
      trigger.click();
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Code Rain Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 opacity-30"
        style={{ filter: 'blur(0.5px)' }}
      />

      {/* Floating Code Snippets */}
      {codeSnippets.map((snippet, i) => (
        <motion.div
          key={i}
          className="absolute text-teal-400/20 font-mono text-sm select-none"
          initial={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
          }}
          animate={{
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
          }}
          transition={{
            duration: 20 + Math.random() * 10,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "linear"
          }}
        >
          {snippet}
        </motion.div>
      ))}

      <motion.div
        style={{ y, opacity }}
        className="relative z-10 container mx-auto px-6 text-center"
      >
        {/* Live Counter Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-center gap-4 mb-8"
        >
          <Badge className="bg-teal-500/10 text-teal-400 border-teal-500/20 px-4 py-2">
            <Globe className="h-4 w-4 mr-2 animate-pulse" />
            {activeUsers} developers online
          </Badge>
          <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 px-4 py-2">
            <Zap className="h-4 w-4 mr-2" />
            {deploymentCount.toLocaleString()} contracts deployed
          </Badge>
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6"
        >
          <span className="block text-white mb-4">From Idea to</span>
          <span className="block bg-gradient-to-r from-teal-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent animate-gradient bg-300%">
            NEAR Contract
          </span>
          <span className="block text-3xl md:text-5xl text-gray-300 mt-4">
            in Under 60 Seconds
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto mb-12"
        >
          The only IDE that thinks as fast as you code. Zero setup, instant deployment,
          complete with templates and testing tools.
        </motion.p>

        {/* 3D Rotating Cube Feature Display */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="flex items-center justify-center gap-8 mb-12"
        >
          <div className="relative w-48 h-48 preserve-3d animate-spin-slow">
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/20 to-purple-500/20 rounded-2xl transform rotate-y-0 backface-hidden flex items-center justify-center">
              <div className="text-center">
                <Code2 className="h-12 w-12 text-teal-400 mx-auto mb-2" />
                <span className="text-white font-semibold">Write Code</span>
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl transform rotate-y-90 backface-hidden flex items-center justify-center">
              <div className="text-center">
                <Zap className="h-12 w-12 text-purple-400 mx-auto mb-2" />
                <span className="text-white font-semibold">Compile</span>
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/20 to-orange-500/20 rounded-2xl transform rotate-y-180 backface-hidden flex items-center justify-center">
              <div className="text-center">
                <Rocket className="h-12 w-12 text-pink-400 mx-auto mb-2" />
                <span className="text-white font-semibold">Deploy</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.8 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button
            size="lg"
            onClick={handleLaunchClick}
            className="group bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white px-8 py-6 text-lg shadow-2xl shadow-teal-500/25 hover:shadow-teal-500/40 transition-all duration-300 hover:scale-105"
          >
            Start Building Now
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="border-gray-600 text-gray-300 hover:bg-gray-800 px-8 py-6 text-lg"
            asChild
          >
            <a href="#demo">
              Try Live Demo
            </a>
          </Button>
        </motion.div>

        <SignInDialog />

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <div className="w-6 h-10 rounded-full border-2 border-gray-600 p-1 animate-bounce">
            <div className="w-1 h-2 bg-gray-400 rounded-full mx-auto animate-scroll" />
          </div>
        </motion.div>
      </motion.div>

      <style jsx>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        @keyframes scroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(200%); }
        }

        @keyframes spin-slow {
          from { transform: rotateY(0deg); }
          to { transform: rotateY(360deg); }
        }

        .animate-gradient {
          animation: gradient 6s ease infinite;
        }

        .animate-scroll {
          animation: scroll 2s ease-in-out infinite;
        }

        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }

        .preserve-3d {
          transform-style: preserve-3d;
        }

        .backface-hidden {
          backface-visibility: hidden;
        }

        .rotate-y-0 {
          transform: rotateY(0deg);
        }

        .rotate-y-90 {
          transform: rotateY(90deg);
        }

        .rotate-y-180 {
          transform: rotateY(180deg);
        }

        .bg-300\\% {
          background-size: 300% 300%;
        }
      `}</style>
    </section>
  );
}