// Official NEAR Example Templates
// These templates are seeded on backend startup and cannot be deleted

export interface OfficialTemplateConfig {
  id: string;
  name: string;
  description: string;
  github_url: string;
  github_branch: string;
  github_path: string | null;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  icon: string;
  tags: string[];
}

export const OFFICIAL_TEMPLATES: OfficialTemplateConfig[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Counter',
    description: 'A simple counter contract demonstrating state management and basic NEAR SDK patterns. Perfect for learning the fundamentals.',
    github_url: 'https://github.com/near-examples/counters',
    github_branch: 'main',
    github_path: 'contract-rs',
    category: 'Basic',
    difficulty: 'Beginner',
    icon: 'Code2',
    tags: ['counter', 'beginner', 'state-management'],
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Hello World',
    description: 'The classic Hello World contract that stores and retrieves a greeting message. Great starting point for NEAR development.',
    github_url: 'https://github.com/near-examples/hello-near-examples',
    github_branch: 'main',
    github_path: 'contract-rs',
    category: 'Basic',
    difficulty: 'Beginner',
    icon: 'MessageCircle',
    tags: ['hello-world', 'beginner', 'greeting'],
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Fungible Token',
    description: 'NEP-141 compliant fungible token implementation. Create your own token with transfer, storage management, and metadata support.',
    github_url: 'https://github.com/near-examples/FT',
    github_branch: 'main',
    github_path: null,
    category: 'Token',
    difficulty: 'Intermediate',
    icon: 'Coins',
    tags: ['nep-141', 'fungible-token', 'token', 'defi'],
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    name: 'Non-Fungible Token',
    description: 'NEP-171 compliant NFT implementation with minting, transfers, approvals, and enumeration. Build your own NFT collection.',
    github_url: 'https://github.com/near-examples/NFT',
    github_branch: 'main',
    github_path: null,
    category: 'Token',
    difficulty: 'Intermediate',
    icon: 'Image',
    tags: ['nep-171', 'nft', 'collectibles', 'digital-assets'],
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    name: 'Cross Contract Calls',
    description: 'Learn how to make cross-contract calls between NEAR smart contracts. Essential pattern for building composable applications.',
    github_url: 'https://github.com/near-examples/cross-contract-calls',
    github_branch: 'main',
    github_path: 'contract-simple-rs',
    category: 'Advanced',
    difficulty: 'Advanced',
    icon: 'Link2',
    tags: ['cross-contract', 'promises', 'callbacks', 'composability'],
  },
];
