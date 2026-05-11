# PRD 02: Multi-Wallet Architecture

## 1. The Big Idea
**"Silos With Glass Doors"**
People don't have one pool of money; they have logical silos. A checking account, a shared fund with their spouse, a dedicated "Japan Trip" pool, and crypto holdings. We treat every wallet as a distinct visual universe, all rolling up to a Master Net Worth.

## 2. Diagnostics (What Kills Standard Wallets?)
- **Isolation:** Usually, shared wallets require connecting bank APIs (plaid), risking privacy.
- **Currency Friction:** App requires a single base currency, breaking global trips.
- **Complexity:** Navigating between wallets requires entering deep hidden menus.

## 3. Killer Interaction (The Signature)
**"The Neumorphic Carousel"**
On the Dashboard, the Hero Balance isn't static. It's a Carousel. Swiping left/right shifts the entire app context (color accents, transactions) from "Personal Account" to "Family Vault" instantly. The transition is mathematically smooth, mapping state changes in the background seamlessly.

## 4. Feature Requirements
- **Wallet Types Supported:**
  - Bank Account (Manual/Statement tracking, no live API connect).
  - Family Wallet (Admin invites via deep link; syncs via Neon Postgres).
  - Trip Wallet (Distinct currency mapping, e.g., JPY, isolated from domestic budget).
  - Crypto/Investment Wallet (Manual holding trackers).
- **Vault Generation Configurator:**
  - The system defaults to standard `Bank Account` logic globally.
  - The Carousel includes an appendable tail `<Create Vault>` card supporting dynamic provisioning of custom Vault interfaces directly into active memory states.
- **Vault Visualizers:** Every vault card features a floating top-right Avatar Circle Stack. This maps out visually who has access to the vault. Includes an appending "+" label to instantly ping network partners.
  - **Dual Metrics (Personal Vault Override):** When querying the Personal logic (unconnected vaults), it hides un-synced balances entirely. Instead, the UI mathematically overrides to display dual aggregate Cashflow (e.g., "+$Income / -$Spend" for the tracked period).
  - Inter-wallet transfers (e.g., Moving $500 from Personal -> Trip).
  - Share feature logic: Allows RBAC (Role-Based Access Control) where members can view full transaction histories in the vault they are invited to.
  - Multi-currency support (configured globally or isolated per vault).

  - **Real-Time Hydration:** Upon app launch, the `useFinanceStore` executes a parallel fetch from `/api/v1/accounts` and `/api/v1/transactions` to ensure the local state is identical to the backend PostgreSQL source of truth.

## 5. Flow
1. Dashboard -> Swipe Wallet Carousel -> Context changes.
2. Tap "Wallet Options" -> Share Wallet.
3. Generate Invite Code/QR -> Spouse scans.
4. Spouse instantly sees synchronized pool inside their own app instance (synced via shared database records).

