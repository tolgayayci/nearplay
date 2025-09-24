import { Sparkles, Github, ExternalLink, BookOpen, MessageSquare, GraduationCap, Code2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const FOOTER_LINKS = {
  resources: [
    { label: 'NEAR Docs', href: 'https://docs.near.org/smart-contracts/what-is', external: true },
    { label: 'Rust SDK', href: 'https://docs.near.org/tools/sdk', external: true },
    { label: 'Near Tools Community Group', href: 'https://t.me/NEAR_Tools_Community_Group', external: true },
    { label: 'GitHub', href: 'https://github.com/tolgayayci/near-playground', external: true },
    { label: 'Discord', href: 'http://near.chat', external: true },
  ],
  legal: [
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Use', href: '#' },
  ],
};

const LEARNING_RESOURCES = [
  {
    icon: GraduationCap,
    title: 'Interactive Tutorials',
    description: 'Step-by-step guides for beginners',
    href: 'https://docs.near.org/tutorials/examples/xcc',
  },
  {
    icon: Code2,
    title: 'Code Examples',
    description: 'Real-world contract examples',
    href: 'https://docs.near.org/tutorials/examples/count-near',
  },
  {
    icon: Users,
    title: 'Community Support',
    description: 'Get help from other developers',
    href: 'https://t.me/NEAR_Tools_Community_Group',
  },
];

export function Footer() {
  return (
    <footer className="border-t mb-8 pt-16">
      <div className="container mx-auto">
        <div className="grid gap-12 lg:grid-cols-3">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950">
                <Sparkles className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <span className="text-xl font-bold text-gray-900 dark:text-white">NEAR Playground</span>
              </div>
            </div>
            <p className="text-muted-foreground mb-6 max-w-sm">
              The fastest way to build, test, and deploy NEAR smart contracts.
            </p>
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                asChild
              >
                <a
                  href="https://github.com/tolgayayci/near-playground"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="h-4 w-4" />
                  Open Source
                </a>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                asChild
              >
                <a
                  href="https://docs.near.org/smart-contracts/what-is"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  Documentation
                </a>
              </Button>
            </div>
          </div>

          {/* Resources Column */}
          <div className="lg:col-span-1">
            <h4 className="font-semibold mb-4">Resources</h4>
            <ul className="space-y-3">
              {FOOTER_LINKS.resources.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                  >
                    {link.label}
                    {link.external && <ExternalLink className="h-3 w-3" />}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Learning Resources Column */}
          <div className="lg:col-span-1">
            <h4 className="font-semibold mb-4">Learning Resources</h4>
            <div className="space-y-4">
              {LEARNING_RESOURCES.map((resource, index) => (
                <a
                  key={index}
                  href={resource.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 p-3 rounded-lg border bg-muted/20 hover:border-primary/50 transition-all cursor-pointer block"
                >
                  <div className="p-2 rounded-lg bg-primary/10">
                    <resource.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-medium group-hover:text-primary transition-colors">
                      {resource.title}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {resource.description}
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="border-t mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2025 NEAR Playground. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            {FOOTER_LINKS.legal.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}