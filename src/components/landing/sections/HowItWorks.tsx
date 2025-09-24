import { ArrowRight, Github, Mail, FileText, FolderOpen, Code, Rocket, Wallet, MousePointer, Terminal, Zap, Globe, FolderTree, Layers, Server, Package } from 'lucide-react';

export function HowItWorks() {
  return (
    <section className="py-32 px-6 bg-white">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="text-center mb-20">
          <p className="text-sm font-medium text-teal-600 uppercase tracking-wider mb-3">How it works</p>
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            From idea to deployed contract in minutes
          </h2>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            Three simple steps. No installation. No configuration. Just results.
          </p>
        </div>

        {/* Step 1 */}
        <div className="mb-32">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-4 mb-6">
                <div className="text-6xl font-bold text-gray-100">1</div>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              <h3 className="text-3xl font-semibold text-gray-900 mb-4">
                Start Your Project
              </h3>
              <p className="text-lg text-gray-600 mb-8">
                Sign in with email in one click. Choose your starting point.
              </p>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FileText className="h-6 w-6 text-gray-600" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-900">Start fresh</div>
                    <div className="text-gray-600">Create a new NEAR contract from scratch</div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Code className="h-6 w-6 text-gray-600" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-900">Use templates</div>
                    <div className="text-gray-600">Start with NEP-141, NEP-171, or custom templates</div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FolderTree className="h-6 w-6 text-gray-600" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-900">Manage Multiple Projects</div>
                    <div className="text-gray-600">Many projects, many contracts as you wish</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative flex justify-center lg:justify-start">
              <div className="w-11/12 lg:w-10/12 rounded-lg overflow-hidden shadow-2xl bg-gray-100 p-8">
                <div className="bg-white rounded-lg p-8">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>

                  {/* Login form */}
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="text-sm font-medium text-gray-800">Email address</div>
                      <div className="h-10 bg-gray-100 rounded-lg border border-gray-200 flex items-center px-3">
                        <span className="text-gray-500 text-sm">your@email.com</span>
                      </div>
                      <div className="h-12 bg-teal-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-medium">Get started</span>
                      </div>
                    </div>

                    <div className="space-y-3 mt-6">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <FileText className="w-5 h-5 text-orange-500" />
                        <span className="text-sm text-gray-700">Counter</span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <Code className="w-5 h-5 text-blue-500" />
                        <span className="text-sm text-gray-700">Fungible Token</span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <Package className="w-5 h-5 text-purple-500" />
                        <span className="text-sm text-gray-700">Non Fungible Token</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="mb-32">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1">
              <div className="rounded-lg overflow-hidden shadow-2xl bg-gray-100 p-8">
                <div className="bg-white rounded-lg p-8">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>

                  {/* Code editor mockup */}
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-3 bg-gray-200 rounded" />
                        <div className="h-3 bg-blue-200 rounded w-20" />
                        <div className="h-3 bg-gray-200 rounded w-32" />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-3 bg-gray-200 rounded" />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-3 bg-gray-200 rounded" />
                        <div className="h-3 bg-purple-200 rounded w-24" />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-3 bg-gray-200 rounded" />
                        <div className="h-3 bg-blue-200 rounded w-16" />
                        <div className="h-3 bg-yellow-200 rounded w-20" />
                        <div className="h-3 bg-gray-200 rounded w-4" />
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <div className="w-6 h-3 bg-gray-200 rounded" />
                        <div className="h-3 bg-gray-200 rounded w-12" />
                        <div className="h-3 bg-blue-200 rounded w-8" />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-3 bg-gray-200 rounded" />
                        <div className="h-3 bg-gray-200 rounded w-4" />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-3 bg-gray-200 rounded" />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-3 bg-gray-200 rounded" />
                        <div className="h-3 bg-blue-200 rounded w-8" />
                        <div className="h-3 bg-gray-200 rounded w-16" />
                        <div className="h-3 bg-gray-200 rounded w-4" />
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <div className="w-6 h-3 bg-gray-200 rounded" />
                        <div className="h-3 bg-green-200 rounded w-14" />
                        <div className="h-3 bg-gray-200 rounded w-6" />
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <div className="w-6 h-3 bg-gray-200 rounded" />
                        <div className="h-3 bg-orange-200 rounded w-10" />
                        <div className="h-3 bg-gray-200 rounded w-8" />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-3 bg-gray-200 rounded" />
                        <div className="h-3 bg-gray-200 rounded w-4" />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200">
                      <div className="h-10 bg-teal-500 rounded-lg flex items-center justify-center">
                        <span className="text-white text-sm font-medium">Deploy to NEAR Testnet</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="flex items-center gap-4 mb-6">
                <div className="text-6xl font-bold text-gray-100">2</div>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              <h3 className="text-3xl font-semibold text-gray-900 mb-4">
                Build with Power
              </h3>
              <p className="text-lg text-gray-600 mb-8">
                Full-featured IDE in your browser. Edit, compile, and deploy with one click.
              </p>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FolderOpen className="h-6 w-6 text-gray-600" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-900">Monaco Editor</div>
                    <div className="text-gray-600">Professional code editor with Rust support</div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Rocket className="h-6 w-6 text-gray-600" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-900">One-Click Deploy</div>
                    <div className="text-gray-600">Deploy to NEAR testnet instantly</div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Wallet className="h-6 w-6 text-gray-600" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-900">Built-in Wallet</div>
                    <div className="text-gray-600">Auto-configured testnet account</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="mb-32">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center gap-4 mb-6">
                <div className="text-6xl font-bold text-gray-100">3</div>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
              <h3 className="text-3xl font-semibold text-gray-900 mb-4">
                Ship & Interact
              </h3>
              <p className="text-lg text-gray-600 mb-8">
                Your contract is live. Interact with it instantly, no ABI hassles.
              </p>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MousePointer className="h-6 w-6 text-gray-600" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-900">Visual Interface</div>
                    <div className="text-gray-600">Click to call methods, see results instantly</div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Zap className="h-6 w-6 text-gray-600" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-900">Transaction History</div>
                    <div className="text-gray-600">Monitor all contract calls and events</div>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Terminal className="h-6 w-6 text-gray-600" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-900">Console Output</div>
                    <div className="text-gray-600">See compilation logs and errors</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-lg overflow-hidden shadow-2xl bg-gray-100 p-8">
                <div className="bg-white rounded-lg p-8">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>

                  {/* Deployment success */}
                  <div className="space-y-6">
                    <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-teal-500 rounded-full" />
                        <span className="text-sm text-teal-700 font-medium">Contract deployed successfully</span>
                      </div>
                    </div>

                    {/* Contract interaction interface */}
                    <div className="space-y-4">
                      <div className="text-sm text-gray-600 font-medium">Contract Methods</div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <span className="text-sm text-gray-700">increment()</span>
                          <div className="w-16 h-6 bg-blue-500 rounded text-xs text-white flex items-center justify-center">Call</div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <span className="text-sm text-gray-700">get_count()</span>
                          <div className="w-16 h-6 bg-green-500 rounded text-xs text-white flex items-center justify-center">View</div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <span className="text-sm text-gray-700">reset()</span>
                          <div className="w-16 h-6 bg-orange-500 rounded text-xs text-white flex items-center justify-center">Call</div>
                        </div>
                      </div>
                    </div>

                    {/* Transaction result */}
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                          <span className="text-xs text-green-700 font-medium">Transaction successful</span>
                        </div>
                        <div className="text-xs text-green-600">Result: 42</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Core Features */}
        <div className="border-t border-gray-100 pt-20">
          <div className="text-center mb-16">
            <h3 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Everything you need, built-in
            </h3>
            <p className="text-lg text-gray-500 max-w-2xl mx-auto">
              Professional tools that work instantly, no setup required.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Globe className="h-6 w-6 text-teal-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Deploy to NEAR</h4>
              <p className="text-gray-600 leading-relaxed">
                Testnet deployment with<br />
                automatic account creation
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <FolderTree className="h-6 w-6 text-teal-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Project Management</h4>
              <p className="text-gray-600 leading-relaxed">
                Create, manage, and share<br />
                multiple NEAR projects
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Terminal className="h-6 w-6 text-teal-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">cargo-near Integration</h4>
              <p className="text-gray-600 leading-relaxed">
                Build and optimize<br />
                contracts with cargo-near
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Layers className="h-6 w-6 text-teal-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Smart Contract UI</h4>
              <p className="text-gray-600 leading-relaxed">
                Auto-generated interface to<br />
                interact with deployed contracts
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Server className="h-6 w-6 text-teal-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Cloud Infrastructure</h4>
              <p className="text-gray-600 leading-relaxed">
                Your code lives in the cloud,<br />
                accessible from anywhere
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Package className="h-6 w-6 text-teal-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Template Library</h4>
              <p className="text-gray-600 leading-relaxed">
                NEP-141 Token, NEP-171 NFT,<br />
                Counter, Voting - ready to use
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-32 pt-20 border-t border-gray-100">
          <div className="text-center">
            <h3 className="text-2xl font-semibold text-gray-900 mb-8">
              Ready to build something amazing on NEAR?
            </h3>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => {
                  const trigger = document.querySelector<HTMLButtonElement>('[data-signin-trigger]');
                  if (trigger) trigger.click();
                }}
                className="inline-flex items-center gap-2 bg-black text-white px-8 py-4 rounded-full font-medium hover:bg-gray-900 transition-colors group"
              >
                Get started
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <a
                href="https://docs.near.org/smart-contracts/what-is"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                View docs
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}