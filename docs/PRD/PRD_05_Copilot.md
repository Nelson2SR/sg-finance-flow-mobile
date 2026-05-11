# PRD 05: Agentic AI Chat Copilot

## 1. The Big Idea
**"The Financial Concierge"**
Bots that just query FAQs are useless. We are building an *Agentic AI*. The Chat Copilot has RAG (Retrieval-Augmented Generation) access to the user's localized transaction database, and Function-Calling access to the backend's CRUD operations.

## 2. Diagnostics (What Kills Generic AI Features?)
- **Read-Only:** AI tells you what you spent, but can't help you modify it.
- **Generic Responses:** "I am an AI and cannot give financial advice."
- **High Formatting Friction:** Making users type perfectly to get a script to execute.

## 3. Killer Interaction (The Signature)
**"The Floating Action Widget"**
When the AI generates a solution, it doesn't just print text. It injects a native UI `<Widget>` directly into the chat stream. 
*Example:* User: "Move $50 from my Checking to my Vacation Wallet." -> AI returns a neat Card Widget with a "Confirm $50 Transfer" button.

## 4. Feature Requirements
- **Intents Supported:**
  - Ask for insights ("Why am I broke this month?", "Show me my top 3 expenses").
  - CRUD operations ("Delete the transaction at Walmart", "Add a $12 expense for Netflix").
  - Budget adjustments ("Remind me to spend less on Food", "Increase Shopping budget by $50").
- **Context Injection:**
  - The chat context auto-loads the user's exact current balances so the AI never hallucinates limits.
  - Multi-modal support (Typing or Voice-to-Text).

## 5. Flow
1. Tab to Copilot.
2. Say: "We went to hawker center, cost me $12 from my personal wallet."
3. AI streams response -> Renders a Widget showing Category: Food, Price: $12.
4. User taps "Confirm", backend syncs.
