# VaultWise Mobile - Universal App

## Context

This is the Universal frontend (iOS + Web) for the VaultWise project, built with Expo (React Native) and Expo Router. The app connects to a Python backend (FastAPI) and a Neon Serverless Postgres database to offer privacy-focused finance tracking and "Family Sharing".

## Tech Stack

- **Framework:** Expo (React Native) + Expo Router
- **Styling:** NativeWind v4 (Tailwind CSS)
- **State Management:** Zustand (Client) + Tanstack Query (Server state)
- **Deployment:** Web on Vercel, iOS on App Store

## Code Conventions

- **Mobile First / Universal:** All code must run on Web and iOS. Use cross-platform libraries and always import primitives from `react-native` (View, Text).
- **Styling:** _Extreme Apple-Level Polish_. Zero magic numbers. Use Tailwind utility classes via `className`. Avoid using StyleSheet unless strictly necessary.
- **Typography:** Follow the defined design system scales.
- **Backend Integration:** Every API call must be secure, typed, and use Tanstack Query for caching and automatic refetching.

## Folder Structure (Expo Router Pattern)

- `/app`: Application routes (e.g., `/`, `/transactions`, `/analytics`, `/chat`, `/family`).
- `/components/ui`: Highly polished generic UI components (Shadcn-like for React Native).
- `/components/features`: Domain components (e.g., Transaction forms).
- `/lib`: Utilities (such as `cn` for Tailwind class merges).
- `/store`: Zustand stores.

## Critical Rules

1. **Zero Cloud Lock-in KeyChain:** Bank PDF passwords MUST NOT be hardcoded or retained in remote memory. Always design _Secure Enclave / iOS Keychain_ flows to transact encrypted payloads.
2. **"Swipe-to-Categorize":** The core interaction for the transactions app. Focus on fluid animations (use `react-native-reanimated`).
3. **Empty States & Skeletons:** Never use blocking spinners. Always use Skeleton Screens during fetching.

## Essential Scripts

- `npm run start` - Starts dev server
- `npm run ios` - Starts iOS simulator
- `npm run web` - Starts Web Server (Vercel testing)

## Workflows and Skills

The AI development lifecycle for this project follows this exact pipeline: 0. Design (@frontend-design): Intentional Aesthetic Direction A named, explicit design stance ，using Figma for prototype

1. **Plan** (`@brainstorming`): Research roadmaps, define feature scope, and propose a market-winning project plan.
2. **TDD** (`@test-driven-development`): Test-driven development. Write tests first, then write code to pass the tests.
3. **Implementation** (`@claude-code-expert`): Write robust code, respecting framework rules (e.g., Expo, NativeWind).
4. **Code Review** (`@code-review-ai-ai-review`): Proactively audit codebase logic to fix potential risks and bugs before shipping.
5. **Doc** (`@code-documentation`): Document the code, following the project's documentation standards.
6. **Security** (`@ethical-hacking-methodology`): Ensure the application is secure and follows best practices.
