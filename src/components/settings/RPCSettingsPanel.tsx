import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Check, X, Trash2, Plus, Server } from 'lucide-react';
import { useRPC, RPCProvider, ConnectionStatus } from '@/contexts/RPCContext';
import { useWallet, Network } from '@/contexts/WalletContext';
import { cn } from '@/lib/utils';

interface RPCSettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ConnectionStatusIndicator({
  status,
  testing,
}: {
  status?: ConnectionStatus;
  testing?: boolean;
}) {
  if (testing) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  if (!status || !status.lastChecked) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        <span className="text-xs text-muted-foreground">Not tested</span>
      </div>
    );
  }

  if (status.connected) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-green-500" />
        <span className="text-xs text-green-600">{status.latency}ms</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 w-2 rounded-full bg-red-500" />
      <span className="text-xs text-red-500">Failed</span>
    </div>
  );
}

export function RPCSettingsPanel({ open, onOpenChange }: RPCSettingsPanelProps) {
  const {
    providers,
    customProviders,
    selectedTestnetProvider,
    selectedMainnetProvider,
    connectionStatus,
    setProvider,
    addCustomProvider,
    removeCustomProvider,
    testConnection,
    testAllConnections,
  } = useRPC();

  const { network } = useWallet();

  const [activeNetwork, setActiveNetwork] = useState<Network>(network);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testingAll, setTestingAll] = useState(false);

  // Custom provider form
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customTestnetUrl, setCustomTestnetUrl] = useState('');
  const [customMainnetUrl, setCustomMainnetUrl] = useState('');
  const [addingCustom, setAddingCustom] = useState(false);
  const [testingCustom, setTestingCustom] = useState(false);
  const [customTestResult, setCustomTestResult] = useState<{
    testnet?: boolean;
    mainnet?: boolean;
  } | null>(null);

  // Sync active network with wallet network
  useEffect(() => {
    setActiveNetwork(network);
  }, [network]);

  const currentProvider = activeNetwork === 'testnet' ? selectedTestnetProvider : selectedMainnetProvider;

  const handleProviderChange = (providerId: string) => {
    setProvider(activeNetwork, providerId);
  };

  const handleTestSingle = async (providerId: string) => {
    setTestingProvider(providerId);
    await testConnection(providerId, activeNetwork);
    setTestingProvider(null);
  };

  const handleTestAll = async () => {
    setTestingAll(true);
    await testAllConnections(activeNetwork);
    setTestingAll(false);
  };

  const handleTestCustomUrls = async () => {
    setTestingCustom(true);
    setCustomTestResult(null);

    const results: { testnet?: boolean; mainnet?: boolean } = {};

    // Test testnet URL
    if (customTestnetUrl) {
      try {
        const response = await fetch(customTestnetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'test',
            method: 'status',
            params: [],
          }),
        });
        results.testnet = response.ok;
      } catch {
        results.testnet = false;
      }
    }

    // Test mainnet URL
    if (customMainnetUrl) {
      try {
        const response = await fetch(customMainnetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'test',
            method: 'status',
            params: [],
          }),
        });
        results.mainnet = response.ok;
      } catch {
        results.mainnet = false;
      }
    }

    setCustomTestResult(results);
    setTestingCustom(false);
  };

  const handleAddCustom = async () => {
    if (!customName || (!customTestnetUrl && !customMainnetUrl)) return;

    setAddingCustom(true);

    addCustomProvider({
      name: customName,
      testnetUrl: customTestnetUrl || 'https://rpc.testnet.near.org',
      mainnetUrl: customMainnetUrl || 'https://rpc.mainnet.near.org',
    });

    // Reset form
    setCustomName('');
    setCustomTestnetUrl('');
    setCustomMainnetUrl('');
    setCustomTestResult(null);
    setShowAddCustom(false);
    setAddingCustom(false);
  };

  const getProviderUrl = (provider: RPCProvider) => {
    return activeNetwork === 'testnet' ? provider.testnetUrl : provider.mainnetUrl;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            RPC Configuration
          </DialogTitle>
          <DialogDescription>
            Configure RPC providers for optimal performance and reliability
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Network Toggle */}
          <div className="flex items-center justify-between">
            <Tabs
              value={activeNetwork}
              onValueChange={(v) => setActiveNetwork(v as Network)}
            >
              <TabsList className="grid w-full grid-cols-2 max-w-[200px]">
                <TabsTrigger value="testnet">Testnet</TabsTrigger>
                <TabsTrigger value="mainnet">Mainnet</TabsTrigger>
              </TabsList>
            </Tabs>

            <Button
              variant="outline"
              size="sm"
              onClick={handleTestAll}
              disabled={testingAll}
            >
              {testingAll ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Test All
            </Button>
          </div>

          {/* Provider List */}
          <RadioGroup value={currentProvider} onValueChange={handleProviderChange}>
            <div className="space-y-2">
              {providers.map((provider) => {
                const statusKey = `${provider.id}-${activeNetwork}`;
                const status = connectionStatus[statusKey];
                const isTesting = testingProvider === provider.id;

                return (
                  <div
                    key={provider.id}
                    className={cn(
                      'flex items-center gap-3 p-3 border rounded-lg transition-colors',
                      currentProvider === provider.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <RadioGroupItem value={provider.id} id={provider.id} />
                    <div className="flex-1 min-w-0">
                      <Label
                        htmlFor={provider.id}
                        className="font-medium cursor-pointer"
                      >
                        {provider.name}
                        {provider.isCustom && (
                          <span className="text-xs text-muted-foreground ml-2">
                            (Custom)
                          </span>
                        )}
                      </Label>
                      <p className="text-xs text-muted-foreground truncate">
                        {getProviderUrl(provider)}
                      </p>
                    </div>
                    <ConnectionStatusIndicator
                      status={status}
                      testing={isTesting}
                    />
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleTestSingle(provider.id)}
                        disabled={isTesting}
                      >
                        {isTesting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      {provider.isCustom && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          onClick={() => removeCustomProvider(provider.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </RadioGroup>

          {/* Add Custom Provider */}
          {!showAddCustom ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowAddCustom(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Custom Provider
            </Button>
          ) : (
            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Add Custom Provider</Label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setShowAddCustom(false);
                    setCustomName('');
                    setCustomTestnetUrl('');
                    setCustomMainnetUrl('');
                    setCustomTestResult(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <div>
                  <Label htmlFor="customName" className="text-xs">
                    Provider Name
                  </Label>
                  <Input
                    id="customName"
                    placeholder="My RPC Provider"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="customTestnet" className="text-xs flex items-center gap-2">
                    Testnet URL
                    {customTestResult?.testnet !== undefined && (
                      customTestResult.testnet ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <X className="h-3 w-3 text-red-500" />
                      )
                    )}
                  </Label>
                  <Input
                    id="customTestnet"
                    placeholder="https://..."
                    value={customTestnetUrl}
                    onChange={(e) => setCustomTestnetUrl(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="customMainnet" className="text-xs flex items-center gap-2">
                    Mainnet URL
                    {customTestResult?.mainnet !== undefined && (
                      customTestResult.mainnet ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <X className="h-3 w-3 text-red-500" />
                      )
                    )}
                  </Label>
                  <Input
                    id="customMainnet"
                    placeholder="https://..."
                    value={customMainnetUrl}
                    onChange={(e) => setCustomMainnetUrl(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestCustomUrls}
                  disabled={testingCustom || (!customTestnetUrl && !customMainnetUrl)}
                  className="flex-1"
                >
                  {testingCustom ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Test
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddCustom}
                  disabled={addingCustom || !customName || (!customTestnetUrl && !customMainnetUrl)}
                  className="flex-1"
                >
                  {addingCustom ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Add
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
