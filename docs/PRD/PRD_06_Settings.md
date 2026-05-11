# PRD 06: Settings & Gamification

## 1. The Big Idea
**"Control Room & Trophy Case"**
Settings shouldn't just be an endless list of boring toggles. It serves as both the operational command center (managing privacy boundaries, currencies, static structures) and the historical reward center (gamified habits).

## 2. Diagnostics (What Kills Settings Pages?)
- **Information Architecture Mess:** Finding how to change a currency takes 4 taps.
- **Sterile:** It offers zero engagement for the user.

## 3. Killer Interaction (The Signature)
**"The Local-Only Vault Switch"**
A massive, satisfying toggle that visualizes the privacy of the app. Tapping "Purge Local Keychain" physically shakes the UI and clears biometric data, reaffirming our "Privacy First" mantra to the user unlike typical cloud apps.

## 4. Feature Requirements
- **Technical Configuration:**
  - Custom Category Builder (Define label, pick icon, pick color).
  - Currency Defaults (Base currency selection).
  - Listed Bank Accounts (Reference list for manual entries, not OAuth-connected).
- **User Profile Extensibility:**
  - Standardized User Profile container inside Settings.
  - Required Fields: Avatar (generates an abbreviation bubble like "SG" if absent), Full Legal/Preferred Name, Gender declaration, and Date of Birth mapping.
- **Gamification & Badging:**
  - Profiles with dynamic ranks based on consistency (e.g., "Budget Master").
  - Badges unlocked for positive streaks.
- **System Administration:**
  - Logout and session clearing.
  - Biometric enforcement locks (FaceID/TouchID).
  - Dark Mode / Light Mode forcing.

## 5. Flow
1. Tap User Avatar on Dashboard -> Opens Control Room.
2. User browses "Your Trophies" at the top.
3. User scrolls down and customizes the "Categories" configuration by assigning emojis to tracking labels.
