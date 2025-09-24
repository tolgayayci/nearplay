import { Button } from '@/components/ui/button';
import { ArrowRight, Zap, Rocket, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';

export function Hero() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleAuthClick = () => {
    const trigger = document.querySelector<HTMLButtonElement>('[data-signin-trigger]');
    if (trigger) trigger.click();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Create fast-moving particles
    const particles: Array<{
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
    }> = [];

    // Create initial particles
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 3 + 1,
        speedX: (Math.random() - 0.5) * 2,
        speedY: (Math.random() - 0.5) * 2,
        opacity: Math.random() * 0.5 + 0.5
      });
    }

    // Animation loop
    const animate = () => {
      // Clear with fade effect
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle) => {
        // Update position
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        // Draw particle
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 192, 139, ${particle.opacity})`;
        ctx.fill();

        // Draw connections between nearby particles
        particles.forEach((otherParticle) => {
          const distance = Math.sqrt(
            Math.pow(particle.x - otherParticle.x, 2) +
            Math.pow(particle.y - otherParticle.y, 2)
          );

          if (distance < 100) {
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            ctx.strokeStyle = `rgba(0, 192, 139, ${0.2 * (1 - distance / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white">
      {/* Fast Animated Network Background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 opacity-40"
      />

      {/* Light gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/30 to-white" />

      {/* Content */}
      <div className="relative z-10 w-full px-6">
        <div className="max-w-7xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-100 border border-teal-200 mb-8">
            <Sparkles className="h-4 w-4 text-teal-600" />
            <span className="text-sm font-medium text-teal-700">
              NEAR Protocol IDE
            </span>
          </div>

          {/* Main Headline with fast gradient */}
          <h1 className="text-6xl lg:text-8xl font-bold mb-8">
            <span className="block text-gray-900 mb-4">
              Ship
            </span>
            <span className="block bg-gradient-to-r from-teal-600 via-cyan-500 to-teal-600 bg-clip-text text-transparent animate-fast-gradient bg-200%">
              60x Faster
            </span>
            <span className="block text-gray-900 text-4xl lg:text-6xl mt-4">
              on NEAR Protocol
            </span>
          </h1>

          <p className="text-xl lg:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto">
            From zero to deployed NEAR contract in 30 seconds.
            <br />
            No downloads. No config. Just ship.
          </p>

          {/* CTA Button with glow effect */}
          <div className="flex flex-wrap gap-4 justify-center mb-16">
            <Button
              size="lg"
              onClick={handleAuthClick}
              className="bg-teal-600 hover:bg-teal-700 text-white px-10 h-14 text-lg group shadow-xl shadow-teal-600/25 hover:shadow-2xl hover:shadow-teal-600/30 transition-all hover:scale-105"
            >
              Start Building Now
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Features instead of stats */}
          <div className="flex flex-wrap justify-center gap-8 lg:gap-16">
            <div className="flex items-center gap-3 hover:scale-105 transition-transform">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <Zap className="h-6 w-6 text-green-600" />
              </div>
              <div className="text-left">
                <div className="text-2xl font-bold text-gray-900">&lt;30s</div>
                <div className="text-sm text-gray-600">To Testnet</div>
              </div>
            </div>

            <div className="flex items-center gap-3 hover:scale-105 transition-transform">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <Rocket className="h-6 w-6 text-blue-600" />
              </div>
              <div className="text-left">
                <div className="text-2xl font-bold text-gray-900">Cloud IDE</div>
                <div className="text-sm text-gray-600">Zero Setup</div>
              </div>
            </div>

            <div className="flex items-center gap-3 hover:scale-105 transition-transform">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-purple-600" />
              </div>
              <div className="text-left">
                <div className="text-2xl font-bold text-gray-900">Templates</div>
                <div className="text-sm text-gray-600">NEP Standards</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fast Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-fast-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-gray-400 p-1">
          <div className="w-1 h-2 bg-gray-400 rounded-full mx-auto animate-fast-scroll" />
        </div>
      </div>

      <style jsx>{`
        @keyframes fast-gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        @keyframes fast-scroll {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(200%); opacity: 0; }
        }

        @keyframes fast-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .animate-fast-gradient {
          animation: fast-gradient 3s ease infinite;
        }

        .animate-fast-scroll {
          animation: fast-scroll 1.5s ease-in-out infinite;
        }

        .animate-fast-bounce {
          animation: fast-bounce 2s ease-in-out infinite;
        }

        .bg-200\\% {
          background-size: 200% 200%;
        }
      `}</style>
    </section>
  );
}