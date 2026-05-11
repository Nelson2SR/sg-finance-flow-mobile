# PRD 04: Spend Tracker & Analytics

## 1. The Big Idea
**"Conversational Analytics"**
Standard pie charts are boring and often unreadable. We integrate high-end fluid vector graphics with literal text translations of data. Rather than just showing a spike, we tell the user exactly *why* that spike exists.

## 2. Diagnostics (What Kills Standard Analytics?)
- **Clutter:** Too many legends, axes, and grids confusing the user.
- **Hidden Recurrence:** The user doesn't realize $15/month subscriptions are quietly draining their wealth.

## 3. Killer Interaction (The Signature)
**"Scrub over Glass"**
A smooth SVG path line chart mapping the spend. Dragging a finger across the glass chart scrubs back in time effortlessly, with the exact amount and top merchant for that specific day floating above your thumb, accompanied by precise haptic feedback.

## 4. Feature Requirements
- **Visual Forms:**
  - Daily/Monthly/Yearly scope pivoting.
  - Spend composition (Not just categories, but "Recurring vs Discretionary").
- **Recurrency Radar:**
  - Algorithmic detection of flat-rate recurring spends (Subscriptions, Bills).
  - Highlights a list of "Vampire Drains" to easily audit.
- **Comparison Views:**
  - "This month vs Last month".
  - "Your Family Vault vs Personal Vault".

## 5. Flow
1. Tap Analytics Tab.
2. Large SVG path renders dynamically.
3. User places finger on a peak -> Haptic bump -> Tooltip: "$450 (Mostly Apple Store)".
