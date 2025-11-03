# Encrypted Lucky Draw Frontend

Next.js 15 + RainbowKit dashboard for the encrypted raffle dApp. The UI mirrors the on-chain flow: register an encrypted participant ID, trigger the draw as an administrator, and decrypt results privately with the Zama FHEVM SDK.

## Stack

- **Next.js 15 / React 19** – App Router
- **RainbowKit + wagmi + viem** – Wallet connectivity (Rainbow, MetaMask, WalletConnect)
- **Tailwind CSS** – Utility styling
- **@zama-fhe/relayer-sdk** – Browser FHE operations

## Prerequisites

- Node.js ≥ 20
- Backend contract deployed locally (see `../README.md`)
- Optional: WalletConnect Cloud project ID

## Install & Run

```bash
npm install

# Sync ABI + addresses from ../deployments
npm run genabi

# Start dev server
npm run dev
```

The app listens on `http://localhost:3000`. Connect a wallet via the top-right RainbowKit button and follow the guided flow.

## Environment Variables

Create `.env.local` when you need custom RPC endpoints:

```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_LOCAL_RPC=http://127.0.0.1:8545
```

The fallback RPC points to Hardhat (`http://127.0.0.1:8545`). When targeting Sepolia, populate the addresses file by deploying to Sepolia and re-running `npm run genabi`.

## Available Scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Launch Next.js in development mode |
| `npm run build` | Create a production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint checks |
| `npm run genabi` | Pull ABI + addresses from Hardhat deployments |

## Key Files

- `app/layout.tsx` – Global shell with RainbowKit connect button
- `app/page.tsx` – Landing page rendering `LuckyDrawDashboard`
- `components/LuckyDrawDashboard.tsx` – Main UI experience
- `hooks/useLuckyDraw.tsx` – Contract integration/ACL handling
- `hooks/useBrowserEthers.ts` – Converts wagmi wallet client → `ethers` signer
- `lib/wagmi.ts` – RainbowKit + wagmi configuration
- `public/lucky-draw-logo.svg` – Brand assets

## Styling Notes

Global styles (`app/globals.css`) import RainbowKit CSS and declare helper classes (`app-gradient`, `card-surface`). Tailwind is configured via `tailwind.config.ts`.

## Troubleshooting

- Ensure the Hardhat node stays alive while interacting locally.
- If a wallet rejects FHE decryptions, confirm the backend granted ACLs (re-register and redraw).
- Clear RainbowKit/WalletConnect cache if wallet selection behaves unexpectedly.

## License

BSD-3-Clause-Clear – see the root repository `LICENSE`.*** End Patch
