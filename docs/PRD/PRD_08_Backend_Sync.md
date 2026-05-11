# PRD 08: Backend Synchronization & Security Architecture

## 1. Overview
Liquid Glass is no longer a local-only demo. It is a full-stack financial application synchronized with a high-performance FastAPI/PostgreSQL backend. This document defines the standards for data persistence, security, and real-time state synchronization.

## 2. Authentication Flow
- **Standard Auth**: Uses OAuth2 with JWT (JSON Web Tokens). Tokens are strictly handled via a `Bearer` authorization scheme.
- **Persistence**: JWT tokens and user metadata are stored in the device's **Hardware-Backed Secure Store** (iOS Keychain / Android Keystore).
- **Session Lifecycle**: Tokens have a 60-minute expiry (standard) with sliding window refreshes handled by Axios interceptors.

## 3. The Biometric Vault Model (Privacy First)
To maintain the "No Cloud Lock-in" and "Privacy-First" mission, the app implements a **Biometric Vault Entry** pattern:
- **Master Passphrase**: A user-defined 16+ character string that derives the backend encryption keys.
- **Hardware Lock**: The passphrase is encrypted and stored in `Expo SecureStore`.
- **Daily Unlock**: Access to the local vault and sensitive API operations is guarded by **FaceID / TouchID / Biometric PIN**.
- **Transient Memory**: The passphrase is held in a secure, non-persistent memory buffer during an active session and wiped upon app termination.

## 4. Data Synchronization Logic
- **Hydration on Mount**: The app executes a parallel sync upon user authentication to populate the `FinanceStore`:
  - `GET /api/v1/accounts` ➔ Populates Wallets/Vaults.
  - `GET /api/v1/transactions` ➔ Populates Activity feed.
- **Optimistic Magic Scan**:
  - Results from the Gemini Vision Engine are first displayed in a Review Modal.
  - Upon user confirmation, data is immediately added to the local store for instant UX feedback.
  - A background `POST /api/v1/upload/confirm` request synchronizes the transactions to the persistent PostgreSQL database.
- **Conflict Resolution**: The backend acts as the source of truth. Local IDs are temporary; server-assigned IDs replace them upon successful sync.

## 5. Security Standards
- **Transport**: All communications must occur over TLS 1.3 (HTTPS).
- **Encryption at Rest**:
  - Server: PostgreSQL data is encrypted using AES-256 (via SQLCipher/Transparent Data Encryption).
  - Client: SecureStore handles hardware-level encryption for sensitive tokens and passphrases.
- **Anonymization**: During "Magic Scan" fallback, PII (Names, Account Numbers) is stripped locally before transmission to the Gemini API.

## 6. Offline Capabilities
- **Read-Only Mode**: The app should cache the last synced state to allow viewing activity without a connection.
- **Pending Sync Buffer**: Transactions created while offline are queued and marked with a "Pending" icon until a connection is restored.

## 7. Implementation Rules
Any modification to the networking layer (`apiClient.ts`) or the state management (`useFinanceStore.ts`) must respect the hardware-backed security constraints defined here. No sensitive credentials (JWT or Passphrase) should ever be logged to the console or stored in unencrypted `AsyncStorage`.
