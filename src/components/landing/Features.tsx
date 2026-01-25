import { motion } from 'framer-motion';
import {
  Rocket,
  Code2,
  Terminal,
  Network,
  Share2,
  Zap,
  Blocks,
  PlayCircle,
  ArrowRight,
  Plus,
  FileCode2,
  GitBranch,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const FEATURES = [
  {
    icon: Rocket,
    title: 'Instant Project Setup',
    description: 'Start with templates, import from GitHub, or create from scratch. Get building in seconds.',
    color: 'from-emerald-500/20 via-transparent to-transparent',
    preview: (
      <div className="relative overflow-hidden rounded-lg border bg-muted h-[200px]">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-background/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Rocket className="h-4 w-4" />
            New Project
          </div>
        </div>
        <div className="p-4">
          {/* Project Options */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border hover:border-primary/50 transition-colors cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-blue-500/10">
                  <Plus className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <div className="font-medium text-sm">Create New Project</div>
                  <div className="text-xs text-muted-foreground">Empty NEAR contract</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border hover:border-primary/50 transition-colors cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-purple-500/10">
                  <GitBranch className="h-4 w-4 text-purple-500" />
                </div>
                <div>
                  <div className="font-medium text-sm">Import from GitHub</div>
                  <div className="text-xs text-muted-foreground">Clone existing repo</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: Code2,
    title: 'Multi-File Editor',
    description: 'Full file explorer, dependency management, and Monaco editor with Rust syntax highlighting.',
    color: 'from-blue-500/20 via-transparent to-transparent',
    preview: (
      <div className="relative overflow-hidden rounded-lg border bg-muted h-[200px]">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-background/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Code2 className="h-4 w-4" />
            Project Explorer
          </div>
        </div>
        <div className="flex h-[calc(200px-34px)]">
          {/* File tree */}
          <div className="w-1/3 border-r p-2 text-xs space-y-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <FileCode2 className="h-3 w-3" /> src/
            </div>
            <div className="pl-3 text-blue-500">lib.rs</div>
            <div className="pl-3 text-muted-foreground">state.rs</div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <FileCode2 className="h-3 w-3" /> Cargo.toml
            </div>
          </div>
          {/* Code */}
          <div className="flex-1 p-3 font-mono text-xs">
            <div className="text-blue-500">#[near_bindgen]</div>
            <div className="text-purple-500">pub struct</div>
            <div className="pl-2">Contract {'{'}</div>
            <div className="pl-4 text-muted-foreground">state: State</div>
            <div className="pl-2">{'}'}</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: Network,
    title: 'Multi-Network Deploy',
    description: 'Deploy to testnet for testing or mainnet for production. Connect your wallet or use built-in accounts.',
    color: 'from-yellow-500/20 via-transparent to-transparent',
    preview: (
      <div className="relative overflow-hidden rounded-lg border bg-muted h-[200px]">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-background/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Network className="h-4 w-4" />
            Deploy Contract
          </div>
        </div>
        <div className="p-4">
          {/* Network selector */}
          <div className="flex gap-2 mb-4">
            <div className="flex-1 p-2 rounded-lg bg-background/50 border text-center text-xs">
              <div className="font-medium">Testnet</div>
              <div className="text-muted-foreground">Testing</div>
            </div>
            <div className="flex-1 p-2 rounded-lg bg-primary/10 border border-primary text-center text-xs">
              <div className="font-medium text-primary">Mainnet</div>
              <div className="text-muted-foreground">Production</div>
            </div>
          </div>

          {/* Deploy options */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 rounded-lg bg-background/50 border">
              <span className="text-sm">Wallet Connected</span>
              <Badge variant="outline" className="text-xs">myaccount.near</Badge>
            </div>
            <Button size="sm" className="w-full h-8 gap-1.5">
              <Rocket className="h-4 w-4" />
              Deploy to Mainnet
            </Button>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: PlayCircle,
    title: 'Built-in Testing',
    description: 'Run contract tests with NEAR sandbox. View results, debug failures, and ensure your code works.',
    color: 'from-red-500/20 via-transparent to-transparent',
    preview: (
      <div className="relative overflow-hidden rounded-lg border bg-muted h-[200px]">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-background/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Terminal className="h-4 w-4" />
            Test Runner
          </div>
        </div>
        <div className="p-4 font-mono text-xs space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-green-500">PASS</span>
            <span className="text-muted-foreground">test_increment</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-500">PASS</span>
            <span className="text-muted-foreground">test_decrement</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-500">PASS</span>
            <span className="text-muted-foreground">test_reset</span>
          </div>
          <div className="pt-2 border-t mt-2">
            <span className="text-green-500 font-semibold">3 passed</span>
            <span className="text-muted-foreground"> in 1.2s</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: Blocks,
    title: 'Template Marketplace',
    description: 'Browse community templates. Publish your own contracts. Build on battle-tested code.',
    color: 'from-purple-500/20 via-transparent to-transparent',
    preview: (
      <div className="relative overflow-hidden rounded-lg border bg-muted h-[200px]">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-background/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Blocks className="h-4 w-4" />
            Template Marketplace
          </div>
        </div>
        <div className="p-3 space-y-2">
          {[
            { name: 'NEP-141 Token', author: 'near-examples', stars: 142 },
            { name: 'NFT Collection', author: 'community', stars: 89 },
            { name: 'DAO Voting', author: 'defi-dao', stars: 67 },
          ].map((template, i) => (
            <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-background/50 border">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-purple-500/10">
                  <FileCode2 className="h-3 w-3 text-purple-500" />
                </div>
                <div>
                  <div className="text-xs font-medium">{template.name}</div>
                  <div className="text-[10px] text-muted-foreground">by {template.author}</div>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">{template.stars}</Badge>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: Share2,
    title: 'Embeddable Widgets',
    description: 'Share your contracts anywhere. Generate embed codes for websites, docs, and tutorials.',
    color: 'from-pink-500/20 via-transparent to-transparent',
    preview: (
      <div className="relative overflow-hidden rounded-lg border bg-muted h-[200px]">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-background/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Share2 className="h-4 w-4" />
            Embed Widget
          </div>
        </div>
        <div className="p-4 space-y-3">
          <div className="space-y-2">
            <span className="text-xs font-medium">Embed Code</span>
            <div className="rounded-md bg-background/80 p-2 text-[10px] font-mono text-muted-foreground overflow-hidden">
              {'<iframe src="nearplay.app/embed/counter" />'}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Badge variant="outline" className="text-[10px]">Button</Badge>
              <Badge variant="outline" className="text-[10px] bg-primary/10">Widget</Badge>
              <Badge variant="outline" className="text-[10px]">Full</Badge>
            </div>
            <Button size="sm" variant="outline" className="h-6 text-xs">
              Copy
            </Button>
          </div>
          <div className="rounded border p-2 bg-background/50 text-center">
            <Button size="sm" className="h-7 text-xs gap-1">
              <Zap className="h-3 w-3" />
              Try Counter
            </Button>
          </div>
        </div>
      </div>
    ),
  },
];

export function Features() {
  return (
    <section id="features" className="container mx-auto py-24 lg:py-32">
      <motion.div 
        className="text-center max-w-2xl mx-auto mb-16"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        viewport={{ once: true }}
      >
        <h2 className="text-3xl font-bold tracking-tight mb-4">
          Everything You Need to Build on NEAR
        </h2>
        <p className="text-lg text-muted-foreground">
          A complete development environment for NEAR smart contracts,
          right in your browser.
        </p>
      </motion.div>

      <div className="grid gap-8 lg:grid-cols-2">
        {FEATURES.map((feature, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            viewport={{ once: true }}
            whileHover={{ scale: 1.02 }}
            className="group relative"
          >
            <motion.div 
              className={cn(
                "absolute inset-0 bg-gradient-to-br rounded-lg",
                feature.color
              )}
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 0.2 }}
              transition={{ duration: 0.2 }}
            />
            
            <div className="relative border rounded-lg bg-background/50 backdrop-blur-sm">
              {/* Header */}
              <div className="p-6 border-b">
                <div className="flex items-center gap-4">
                  <motion.div 
                    className="flex-none p-3 rounded-lg bg-primary/10"
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  >
                    <feature.icon className="h-6 w-6 text-primary" />
                  </motion.div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </div>

              {/* Preview - No animations here */}
              <div className="p-6">
                {feature.preview}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}