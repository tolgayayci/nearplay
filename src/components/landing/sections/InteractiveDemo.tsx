import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Play,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Code2,
  Sparkles,
  Users,
  MousePointer
} from 'lucide-react';
import Editor from '@monaco-editor/react';

const demoCode = {
  simple: `#[near_bindgen]
pub struct Greeting {
    message: String,
}

#[near_bindgen]
impl Greeting {
    #[init]
    pub fn new() -> Self {
        Self {
            message: "Hello NEAR!".to_string()
        }
    }

    pub fn get_greeting(&self) -> String {
        self.message.clone()
    }
}`,
  challenge: `#[near_bindgen]
pub struct Counter {
    value: i32,
}

#[near_bindgen]
impl Counter {
    pub fn increment(&mut self) {
        // FIX ME: Increment the value
        self.value = self.value; // Bug here!
    }

    pub fn get_value(&self) -> i32 {
        self.value
    }
}`,
  fixed: `#[near_bindgen]
pub struct Counter {
    value: i32,
}

#[near_bindgen]
impl Counter {
    pub fn increment(&mut self) {
        self.value += 1; // Fixed!
    }

    pub fn get_value(&self) -> i32 {
        self.value
    }
}`
};

export function InteractiveDemo() {
  const [code, setCode] = useState(demoCode.simple);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compilationResult, setCompilationResult] = useState<'success' | 'error' | null>(null);
  const [activeTab, setActiveTab] = useState('playground');
  const [activeCursors, setActiveCursors] = useState([
    { id: 1, name: 'Alice', x: 120, y: 80, color: 'text-pink-400' },
    { id: 2, name: 'Bob', x: 240, y: 120, color: 'text-blue-400' },
    { id: 3, name: 'Carol', x: 360, y: 100, color: 'text-green-400' }
  ]);

  const handleCompile = () => {
    setIsCompiling(true);
    setTimeout(() => {
      setIsCompiling(false);
      setCompilationResult(code.includes('self.value = self.value') ? 'error' : 'success');
    }, 2000);
  };

  const handleChallenge = (challenge: 'simple' | 'challenge') => {
    setCode(demoCode[challenge]);
    setCompilationResult(null);
  };

  const fixBug = () => {
    setCode(demoCode.fixed);
    setCompilationResult(null);
  };

  return (
    <section id="demo" className="relative py-24 px-6">
      <div className="container mx-auto max-w-7xl">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 px-4 py-2 mb-4">
            <Sparkles className="h-4 w-4 mr-2" />
            Try Before You Sign In
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Experience the Magic
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Write, compile, and test NEAR smart contracts right here. No account needed.
          </p>
        </motion.div>

        {/* Interactive Playground */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <Card className="bg-gray-800/50 backdrop-blur-sm border-gray-700">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="border-b border-gray-700">
                <TabsList className="bg-transparent w-full justify-start rounded-none h-12 px-4">
                  <TabsTrigger
                    value="playground"
                    className="data-[state=active]:bg-gray-700/50 gap-2"
                  >
                    <Code2 className="h-4 w-4" />
                    Playground
                  </TabsTrigger>
                  <TabsTrigger
                    value="challenges"
                    className="data-[state=active]:bg-gray-700/50 gap-2"
                  >
                    <AlertCircle className="h-4 w-4" />
                    Challenges
                  </TabsTrigger>
                  <TabsTrigger
                    value="collaboration"
                    className="data-[state=active]:bg-gray-700/50 gap-2"
                  >
                    <Users className="h-4 w-4" />
                    Live Collaboration
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="playground" className="p-0">
                <div className="grid lg:grid-cols-2 divide-x divide-gray-700">
                  {/* Code Editor */}
                  <div className="relative">
                    <div className="absolute top-4 right-4 z-10">
                      <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
                        NEAR SDK v4.0
                      </Badge>
                    </div>
                    <Editor
                      height="500px"
                      language="rust"
                      theme="vs-dark"
                      value={code}
                      onChange={(value) => setCode(value || '')}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                      }}
                    />
                  </div>

                  {/* Output Panel */}
                  <div className="flex flex-col">
                    <div className="flex-1 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                          <Terminal className="h-5 w-5" />
                          Compilation Output
                        </h3>
                        <Button
                          onClick={handleCompile}
                          disabled={isCompiling}
                          className="bg-teal-500 hover:bg-teal-600 text-white"
                        >
                          {isCompiling ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                              Compiling...
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Compile
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="bg-gray-900/50 rounded-lg p-4 font-mono text-sm min-h-[400px]">
                        {!compilationResult && !isCompiling && (
                          <p className="text-gray-500">Click 'Compile' to build your contract...</p>
                        )}

                        {isCompiling && (
                          <div className="space-y-2">
                            <p className="text-blue-400">→ Parsing NEAR SDK attributes...</p>
                            <p className="text-blue-400">→ Compiling to WebAssembly...</p>
                            <p className="text-blue-400">→ Optimizing contract size...</p>
                          </div>
                        )}

                        {compilationResult === 'success' && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-green-400">
                              <CheckCircle2 className="h-5 w-5" />
                              <span className="font-semibold">Compilation Successful!</span>
                            </div>
                            <p className="text-gray-400">Contract size: 14.2 KB</p>
                            <p className="text-gray-400">Gas estimation: ~2.5 TGas</p>
                            <p className="text-gray-400">Ready for deployment to NEAR testnet</p>

                            <div className="mt-4 p-3 bg-gray-800/50 rounded">
                              <p className="text-gray-300 mb-2">Available methods:</p>
                              <ul className="text-teal-400 space-y-1">
                                <li>• get_greeting() → String</li>
                                <li>• new() → Self</li>
                              </ul>
                            </div>
                          </div>
                        )}

                        {compilationResult === 'error' && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-red-400">
                              <AlertCircle className="h-5 w-5" />
                              <span className="font-semibold">Compilation Error</span>
                            </div>
                            <p className="text-red-300">Line 8: Logic error detected</p>
                            <p className="text-gray-400">The increment function doesn't modify the value.</p>
                            <Button
                              onClick={fixBug}
                              variant="outline"
                              size="sm"
                              className="mt-3 border-red-500/50 text-red-400 hover:bg-red-500/10"
                            >
                              Show Fix
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="challenges" className="p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="bg-gray-700/30 border-gray-600 p-6">
                    <h3 className="text-xl font-semibold text-white mb-3">
                      Challenge 1: Hello NEAR
                    </h3>
                    <p className="text-gray-400 mb-4">
                      Create a simple greeting contract that stores and returns a message.
                    </p>
                    <Button
                      onClick={() => handleChallenge('simple')}
                      variant="outline"
                      className="border-teal-500/50 text-teal-400 hover:bg-teal-500/10"
                    >
                      Start Challenge
                    </Button>
                  </Card>

                  <Card className="bg-gray-700/30 border-gray-600 p-6">
                    <h3 className="text-xl font-semibold text-white mb-3">
                      Challenge 2: Fix the Counter
                    </h3>
                    <p className="text-gray-400 mb-4">
                      There's a bug in this counter contract. Can you find and fix it?
                    </p>
                    <Button
                      onClick={() => handleChallenge('challenge')}
                      variant="outline"
                      className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                    >
                      Start Challenge
                    </Button>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="collaboration" className="p-6">
                <div className="relative h-[400px] bg-gray-900/30 rounded-lg overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-gray-500">Live collaboration preview</p>
                  </div>

                  {/* Simulated Cursors */}
                  {activeCursors.map((cursor) => (
                    <motion.div
                      key={cursor.id}
                      className="absolute flex items-start gap-1"
                      animate={{
                        x: [cursor.x, cursor.x + 100, cursor.x],
                        y: [cursor.y, cursor.y + 50, cursor.y],
                      }}
                      transition={{
                        duration: 5,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    >
                      <MousePointer className={`h-4 w-4 ${cursor.color}`} />
                      <span className={`text-xs ${cursor.color}`}>{cursor.name}</span>
                    </motion.div>
                  ))}

                  <div className="absolute bottom-4 left-4">
                    <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                      <Users className="h-3 w-3 mr-1" />
                      3 developers coding together
                    </Badge>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </Card>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8"
        >
          {[
            { label: 'Compilation Time', value: '<2s', color: 'text-teal-400' },
            { label: 'Success Rate', value: '99.9%', color: 'text-green-400' },
            { label: 'No Downloads', value: '0 MB', color: 'text-purple-400' },
            { label: 'Templates', value: '10+', color: 'text-orange-400' },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}