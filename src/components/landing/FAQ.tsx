import { motion } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { HelpCircle, Sparkles, Rocket, Code2, Coins, Blocks } from 'lucide-react';

const FAQ_ITEMS = [
  {
    question: "What is NEAR Protocol?",
    answer: "NEAR is a high-performance blockchain designed for usability and scalability. It features low transaction fees, fast finality, and developer-friendly tools. NEAR uses a Proof-of-Stake consensus mechanism and sharding technology to achieve high throughput while maintaining decentralization.",
    icon: Blocks,
  },
  {
    question: "What is NEAR Playground?",
    answer: "NEAR Playground is a browser-based development environment for NEAR smart contracts. It provides everything you need to write, compile, test, and deploy Rust contracts to NEAR testnet - all without setting up a local development environment or managing wallets.",
    icon: Sparkles,
  },
  {
    question: "Do I need a NEAR account or testnet tokens?",
    answer: "No! NEAR Playground handles account creation and provides testnet tokens automatically. You can start developing immediately without setting up wallets, requesting testnet funds, or managing account keys. We handle all the blockchain interactions for you.",
    icon: Rocket,
  },
  {
    question: "What programming languages does NEAR support?",
    answer: "NEAR primarily supports Rust and JavaScript/TypeScript for smart contract development. Rust contracts are compiled to WebAssembly (WASM) for optimal performance, while JavaScript contracts run in a QuickJS environment. NEAR Playground focuses on Rust development with the NEAR SDK.",
    icon: Code2,
  },
  {
    question: "How much does it cost to use NEAR Playground?",
    answer: "NEAR Playground is completely free to use! All development costs including compilation, deployment, and contract interactions on NEAR testnet are covered. You can develop and test your contracts without worrying about gas fees or account management.",
    icon: Coins,
  },
];

export function FAQ() {
  return (
    <section id="faq" className="container mx-auto py-24 lg:py-32">
      <motion.div 
        className="text-center max-w-2xl mx-auto mb-12"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        viewport={{ once: true }}
      >
        <div className="flex items-center justify-center gap-2 mb-3">
          <HelpCircle className="h-5 w-5 text-primary" />
          <h2 className="text-3xl font-bold tracking-tight">
            Frequently Asked Questions
          </h2>
        </div>
        <p className="text-lg text-muted-foreground">
          Everything you need to know about NEAR development with NEAR Playground
        </p>
      </motion.div>

      <div className="max-w-3xl mx-auto">
        <Accordion type="single" collapsible className="w-full">
          {FAQ_ITEMS.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <AccordionItem value={`item-${index}`}>
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10">
                      <item.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-left text-base font-medium">{item.question}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pl-12 pr-4 pb-4">
                    <p className="text-base text-muted-foreground">
                      {item.answer}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </motion.div>
          ))}
        </Accordion>
      </div>
    </section>
  );
}