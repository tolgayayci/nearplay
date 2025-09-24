import { motion } from 'framer-motion';
import {
  Rocket,
  Code2,
  Terminal,
  Network,
  Share2,
  Zap,
  FileCode,
  Blocks,
  PlayCircle,
  Braces,
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
    description: 'Start with NEAR smart contract templates including Counter, NFT, FT, and DeFi contracts.',
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
                <div className="p-2 rounded-md bg-blue-500/10">
                  <FileCode2 className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <div className="font-medium text-sm">Use Template</div>
                  <div className="text-xs text-muted-foreground">NEP-141, NEP-171, Counter...</div>
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
    title: 'Rust Code, NEAR-Ready',
    description: 'Write Rust code with NEAR SDK macros and attributes. The IDE provides NEAR-specific syntax highlighting.',
    color: 'from-blue-500/20 via-transparent to-transparent',
    preview: (
      <div className="relative overflow-hidden rounded-lg border bg-muted h-[200px]">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-background/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Code2 className="h-4 w-4" />
            lib.rs
          </div>
        </div>
        <div className="p-6 font-mono text-sm">
          <div className="text-blue-500">#[near_bindgen]</div>
          <div className="text-purple-500">pub struct</div>
          <div className="pl-4">Counter {'{'}</div>
          <div className="pl-8 text-muted-foreground">value: i32</div>
          <div className="pl-4">{'}'}</div>
        </div>
      </div>
    ),
  },
  {
    icon: Terminal,
    title: 'Zero-Setup Compilation',
    description: 'Compile and deploy your contracts via cargo-near. No local toolchain setup needed – runs in the cloud.',
    color: 'from-purple-500/20 via-transparent to-transparent',
    preview: (
      <div className="relative overflow-hidden rounded-lg border bg-muted h-[200px]">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-background/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Terminal className="h-4 w-4" />
            Compilation Output
          </div>
        </div>
        <div className="p-4 font-mono text-xs">
          <pre className="whitespace-pre-wrap space-y-1">
            <div className="text-muted-foreground">Building NEAR contract with cargo-near v0.6.0</div>
            <div>
              <span className="text-muted-foreground">contract size: </span>
              <span className="text-green-500 font-semibold">4.2 KB</span>
            </div>
            <div>
              <span className="text-muted-foreground">wasm size: </span>
              <span className="text-green-500 font-semibold">12.1 KB</span>
            </div>
            <div className="text-muted-foreground">Deployed to: counter.testnet</div>
            <div className="text-muted-foreground">...</div>
          </pre>
        </div>
      </div>
    ),
  },
  {
    icon: Network,
    title: '1-Click NEAR Deployment',
    description: 'Deploy directly to NEAR testnet. Auto-configured RPC endpoints and account management.',
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
          {/* Deployment Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-yellow-500/10">
                <Network className="h-4 w-4 text-yellow-500" />
              </div>
              <div>
                <div className="font-medium text-sm">Ready to Deploy</div>
                <div className="text-xs text-muted-foreground">NEAR Testnet</div>
              </div>
            </div>
            <Button size="sm" className="h-8 gap-1.5">
              <Rocket className="h-4 w-4" />
              Deploy
            </Button>
          </div>

          {/* Deployment Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 rounded-lg bg-background/50 border">
              <div className="flex items-center gap-2">
                <span className="text-sm">Network Ready</span>
              </div>
              <code className="text-xs font-mono text-muted-foreground">Network: testnet</code>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-background/50 border">
              <div className="flex items-center gap-2">
                <span className="text-sm">Estimated Gas</span>
              </div>
              <div className="text-sm">0.1 NEAR</div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: PlayCircle,
    title: 'Interactive Contract Testing',
    description: 'Execute contract methods, view transaction outputs, and monitor call history. Built-in NEAR account viewer and transaction explorer.',
    color: 'from-red-500/20 via-transparent to-transparent',
    preview: (
      <div className="relative overflow-hidden rounded-lg border bg-muted h-[200px]">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-background/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Braces className="h-4 w-4" />
            Contract Interface
          </div>
        </div>
        <div className="grid grid-rows-2 h-[calc(200px-34px)]">
          {[
            { name: 'increment', params: '()' },
            { name: 'get_count', params: '()' }
          ].map((method, i) => (
            <div 
              key={i} 
              className="flex items-center justify-between px-6 border-b last:border-b-0"
            >
              <code className="text-sm font-mono">
                <span>{method.name}</span>
                <span className="text-muted-foreground">{method.params}</span>
              </code>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
                <PlayCircle className="h-3.5 w-3.5" />
                Execute
              </Button>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: Share2,
    title: 'Share & Collaborate',
    description: 'Share your NEAR projects with read-only links. Invite team members to view and collaborate on your contracts.',
    color: 'from-pink-500/20 via-transparent to-transparent',
    preview: (
      <div className="relative overflow-hidden rounded-lg border bg-muted h-[200px]">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-background/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Share2 className="h-4 w-4" />
            Share Project
          </div>
        </div>
        <div className="p-6 space-y-4">
          {/* Share Link */}
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Project Link</span>
              <Badge variant="outline" className="bg-pink-500/10 text-pink-500">
                Read-only
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-md bg-background/50 p-2 text-xs font-mono text-muted-foreground truncate">
                https://nearplay.app/p/counter-xyz123
              </div>
              <Button size="sm" variant="outline" className="h-8">
                Copy
              </Button>
            </div>
          </div>

          {/* Share Info */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex -space-x-2">
              <Avatar className="h-6 w-6 border-2 border-background">
                <AvatarImage src="https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?&w=64&h=64&q=70&crop=faces&fit=crop" />
                <AvatarFallback>SC</AvatarFallback>
              </Avatar>
              <Avatar className="h-6 w-6 border-2 border-background">
                <AvatarImage src="https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?&w=64&h=64&q=70&crop=faces&fit=crop" />
                <AvatarFallback>AR</AvatarFallback>
              </Avatar>
            </div>
            <span>2 viewers</span>
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