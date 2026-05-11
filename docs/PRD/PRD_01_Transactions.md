# PRD 01: Transaction Module (Adder & eStatement Editor)

## 1. The Big Idea
**"Omni-Channel Frictionless Capture"**
Tracking expenses manually is the #1 reason users abandon budgeting apps. We remove friction entirely by allowing 3 input channels:
1. **Magic Upload:** Drag & drop eStatements (PDFs) directly.
2. **Copilot Voice/Text:** "I just bought a $4 coffee at Starbucks."
3. **Manual Entry:** A highly polished, single-screen modal optimized for 3-second completion.

## 2. Diagnostics (What Kills Standard Transaction Forms?)
- **Too Many Taps:** Forcing users to select Date, Time, Category, Wallet on separate screens.
- **Cognitive Load:** Asking users to parse messy bank statements line-by-line.
- **The Receipt Problem:** Losing context of what the purchase actually looked like.

## 3. Killer Interaction (The Signature)
**"The Pre-Import Swiper"**
When an eStatement is uploaded, instead of just dumping 100 transactions into the ledger, the user enters "Tinder-style" or "Swipe-to-Categorize" preview mode. The FastAPI backend pre-fills categories via AI. The user swipes right to confirm the categorization or taps to edit. 

## 4. Feature Requirements
- **Manual Adder Modal:**
  - Full-screen glassmorphic overlay.
  - Giant numeric keypad (calculator integrated).
  - Tappable tags for Category, Wallet, and Labels with highly polished vector icons.
  - Camera attachment for receipts (auto-cropping).
  - Recurrence toggle (e.g., "Repeat every month").
- **eStatement Flow (Same as sg-finance-flow backend):**
  - Dropzone for local PDF upload.
  - In-memory Swift/Keychain password retrieval.
  - Post-preview screen specifically listing "Pending Imports".
  - **Cloud Persistence:** All confirmed imports are synchronized with the FastAPI backend using a unique `file_hash` to prevent duplicates across devices.
  - **Auto-Categorization:** Uses a dual-layered approach: local Gemini extraction logic mirrored by server-side rule engine verification.

## 5. Flow
1. Tap global `+` FAB or trigger "Magic Scan".
2. App detects transaction intent (Image or PDF).
3. If Manual: Modal slides up. User types `45`, taps `Food`, taps `Submit` ➔ POSTs to `/transactions`.
4. If Statement: Gemini Extraction ➔ Preview list ➔ Bulk Approve ➔ POSTs to `/upload/confirm`.

