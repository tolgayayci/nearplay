<div align="center">
  <h1>
    NEAR Playground
  </h1>

  <p align="center">
    Write, compile, and deploy NEAR smart contracts using Rust directly in your browser.
  </p>

  <p align="center">
    <a href="https://nearplay.app">nearplay.app</a> &nbsp;|&nbsp; <a href="https://docs.nearplay.app">Documentation</a>
  </p>

  <br />

  <img src="public/images/main-light.png" alt="NEAR Playground Screenshot" width="80%" style="border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.1);" />
</div>

## 📚 Examples

Try these example contracts directly in NEAR Playground:

| Example | Description | Source | Try It |
|---------|-------------|--------|--------|
| **Counter** | The smart contract exposes methods to interact with a counter stored in the NEAR network | [GitHub](https://github.com/near-examples/counters/tree/main/contract-rs) | [![Open in NearPlay](https://img.shields.io/badge/Open%20in%20NearPlay-0d9488?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0ibTE4IDcgNCA0LTQgNE00IDEybDQgNC00LTQgNC00Ii8+PC9zdmc+&logoColor=white)](https://nearplay.app/embed/5c0c78df-e4fc-4f99-acbc-024a029a90b7) |
| **Hello World** | Simple Hello World smart contract in Rust | [GitHub](https://github.com/near-examples/hello-near-examples/tree/main/contract-rs) | [![Open in NearPlay](https://img.shields.io/badge/Open%20in%20NearPlay-0d9488?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0ibTE4IDcgNCA0LTQgNE00IDEybDQgNC00LTQgNC00Ii8+PC9zdmc+&logoColor=white)](https://nearplay.app/embed/c35d3827-3790-4fda-b173-3585b7fabed2) |
| **Non-Fungible Token** | NEP-171 token implementation for unique assets like collectibles (similar to ERC-721) | [GitHub](https://github.com/near-examples/NFT) | [![Open in NearPlay](https://img.shields.io/badge/Open%20in%20NearPlay-0d9488?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0ibTE4IDcgNCA0LTQgNE00IDEybDQgNC00LTQgNC00Ii8+PC9zdmc+&logoColor=white)](https://nearplay.app/embed/8ab30e17-d834-4e5a-9a67-96408bea0cdc) |
| **Fungible Token** | NEP-141 token implementation for money-like tokens (similar to ERC-20) | [GitHub](https://github.com/near-examples/FT) | [![Open in NearPlay](https://img.shields.io/badge/Open%20in%20NearPlay-0d9488?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0ibTE4IDcgNCA0LTQgNE00IDEybDQgNC00LTQgNC00Ii8+PC9zdmc+&logoColor=white)](https://nearplay.app/embed/507aec9e-25ee-4929-964a-fb98ea4a5d2e) |

*Examples sourced from [near-examples](https://github.com/near-examples)*

## ✨ Features

NEAR Playground is a browser-based development environment that makes NEAR smart contract development simple and accessible.

- **Multi-File Code Editor** - Professional IDE with file explorer, tabs, and cross-file search
- **Dependency Management** - Add crates from crates.io with one-click integration
- **Integrated Terminal** - Full NEAR CLI and Cargo access in browser
- **Instant Compilation** - Compile Rust to WASM using cargo-near in seconds
- **Multi-Network Deployment** - Deploy to testnet or mainnet with wallet integration
- **Smart Contract Testing** - Built-in test runner with output parsing
- **Contract Verification** - Verify source code for mainnet transparency
- **Deployment Dashboard** - Track all deployments across networks
- **GitHub Import/Export** - Import from GitHub or export as ZIP
- **Testnet Faucet** - Get test NEAR tokens instantly
- **Template Marketplace** - Discover and share community templates
- **Embeddable Buttons** - "Open in NearPlay" buttons for documentation

## 💫 NEAR Playground vs Traditional Setup

| Feature | Traditional Setup | NEAR Playground |
|---------|-------------------|-----------------|
| Initial Setup | 30+ minutes of installation & configuration | < 30 seconds - just open browser |
| Prerequisites | Rust toolchain, NEAR CLI, Node.js, VS Code | Modern web browser only |
| Development | Local machine setup with multiple tools | Fully browser-based IDE |
| Multi-File Projects | Standard local development | Full file explorer with multi-file editing |
| Dependencies | Manual Cargo.toml editing | Visual crate search & one-click add |
| Terminal Access | Local terminal required | Integrated browser terminal |
| Compilation | Local cargo-near setup and configuration | Instant cloud compilation |
| Testnet Deployment | Manual NEAR wallet & testnet configuration | One-click with pre-funded wallet |
| Mainnet Deployment | Complex wallet & key management | Seamless wallet selector integration |
| Testing | Local test environment setup | Integrated test runner with output parsing |
| Contract Verification | Manual verification process | Built-in verification workflow |
| GitHub Integration | Standard git workflow | One-click import & export |
| Updates | Manual toolchain updates | Always up-to-date platform |
| Collaboration | Complex environment sharing | Instant contract sharing |
