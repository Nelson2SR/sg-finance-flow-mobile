# PRD 03: Budgets Tracker

## 1. The Big Idea
**"Ambient Accountability"**
Most budgeting apps require you to feel guilty to check your budget. We shift from a punitive model to an "ambient" model. Budgets are colorful, visually rewarding progress limits that build financial habits through positive reinforcement. 

## 2. Diagnostics (What Kills Standard Budgets?)
- **Rigidity:** Users fail one day, and the whole month turns red.
- **Invisibility:** Budgets are hidden behind 3 menu taps.
- **Lack of Advice:** Telling someone they have $5 left for "Dining" is useless if you don't tell them how to fix it.

## 3. Killer Interaction (The Signature)
**"The Smart Safe-to-Spend Aura"**
Instead of showing "100/500 Dining", we calculate an aggregate "Safe to Spend Today" metric spanning all budgets. It's represented as a glowing orb on the home screen. A green pulse means you can buy that coffee. A red rigid pulse means the user is statistically over-burn across their limits.

## 4. Feature Requirements
- **Budget Engine Matrix:**
  - Budgets are dynamically generated objects containing: `Name`, `Amount`, `Currency`, `Mapped Wallets (Configurable array or ALL)`, and `Recurrence interval (Daily, Monthly, Custom)`.
  - Active Budgets are mathematically aggregated for contextual evaluation mapped across multiple isolated Vaults depending on setup.
- **Analytics Visualization:**
  - The Analytics screen physically plots Active Budgets into visual trackers (e.g. dynamic `<Svg>` progress arches or comparative arrays mapping tracked spend against budget limits).
  - Explicit multi-graph rendering for core insights: Cashflow disparity (Income vs Spend mapping), Subscriptions tracking (Vampire Drains), and Category momentum.
- **Habit Formation:**
  - Push notifications on milestones ("You've been under budget 3 weeks in a row!").

## 5. Flow
1. User taps Analytics -> Budgets.
2. Card displaying "Dining - $200/$500".
3. Dynamic suggestion generated via AI: "You are spending 15% slower than last month. Good job."
