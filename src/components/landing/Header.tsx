import { useEffect, useState } from 'react';
import { Sparkles, ArrowRight, Menu, X, BookOpen, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SignInDialog } from './SignInDialog';

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLaunchClick = () => {
    const trigger = document.querySelector<HTMLButtonElement>('[data-signin-trigger]');
    if (trigger) {
      trigger.click();
    }
  };

  return (
    <>
      <header
        className={`fixed top-0 z-50 w-full transition-all duration-500 ${
          isScrolled
            ? 'bg-white/95 backdrop-blur-md shadow-sm py-3'
            : 'bg-transparent py-6'
        }`}
      >
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between">
            {/* Logo - Left */}
            <div
              className="flex items-center gap-3 cursor-pointer group flex-1"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <div className={`p-2 rounded-xl transition-all ${
                isScrolled ? 'bg-teal-50' : 'bg-white/10 backdrop-blur-sm'
              }`}>
                <Sparkles className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <span className="text-xl font-bold text-gray-900">NEAR Playground</span>
              </div>
            </div>

            {/* Desktop Navigation - Center */}
            <nav className="hidden lg:flex items-center gap-2 absolute left-1/2 transform -translate-x-1/2">
              <a
                href="https://docs.near.org/smart-contracts/what-is"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  isScrolled
                    ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                <BookOpen className="h-4 w-4" />
                Docs
              </a>

              <a
                href="https://github.com/tolgayayci/near-playground"
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  isScrolled
                    ? 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-white/50'
                }`}
              >
                <Github className="h-4 w-4" />
                GitHub
              </a>
            </nav>

            {/* CTA Buttons - Right */}
            <div className="flex items-center gap-3 justify-end flex-1">
              {/* Desktop CTA */}
              <div className="hidden sm:block">
                <Button
                  className="bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/25 hover:shadow-xl hover:shadow-teal-600/30 transition-all px-6"
                  onClick={handleLaunchClick}
                >
                  Launch IDE
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              {/* Mobile Menu Button */}
              <button
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? (
                  <X className="h-5 w-5 text-gray-700" />
                ) : (
                  <Menu className="h-5 w-5 text-gray-700" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <div className={`fixed inset-0 z-40 lg:hidden transition-all duration-300 ${
        isMobileMenuOpen ? 'visible' : 'invisible'
      }`}>
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black transition-opacity duration-300 ${
            isMobileMenuOpen ? 'opacity-50' : 'opacity-0'
          }`}
          onClick={() => setIsMobileMenuOpen(false)}
        />

        {/* Menu Panel */}
        <div className={`absolute right-0 top-0 h-full w-72 bg-white shadow-xl transition-transform duration-300 ${
          isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}>
          <div className="p-6">
            {/* Close button */}
            <div className="flex justify-end mb-8">
              <button
                className="p-2 rounded-lg hover:bg-gray-100"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="h-5 w-5 text-gray-700" />
              </button>
            </div>

            {/* Mobile Navigation */}
            <nav className="space-y-1">
              <a
                href="https://docs.near.org/smart-contracts/what-is"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg font-medium"
              >
                <BookOpen className="h-4 w-4" />
                Documentation
              </a>

              <a
                href="https://github.com/tolgayayci/near-playground"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg font-medium"
              >
                <Github className="h-4 w-4" />
                GitHub
              </a>

              <div className="mt-6">
                <Button
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                  onClick={() => {
                    handleLaunchClick();
                    setIsMobileMenuOpen(false);
                  }}
                >
                  Launch IDE
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </nav>
          </div>
        </div>
      </div>

      {/* Hidden SignInDialog component */}
      <SignInDialog />
    </>
  );
}