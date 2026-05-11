# PRD 07: The Financy Aesthetic System

## 1. The Core Philosophy
The entire application operates identically to the "Financy - Fintech App Community Template" from Figma. We completely drop standard OS primitives and thick brutalist UI borders in favor of the Financy soft-bubble logic.

## 2. Global Typography
- **Mandatory Font:** `Plus Jakarta Sans` is strictly enforced everywhere. Avoid native Apple system fonts except in deep system settings lists if performance falls.
- **Weights:** Use `300` for huge balances, `400` for standard text, and `700` densely. Avoid mixed mid-weights.

## 3. The Explicit Identity Palette
Tailwind is hard-configured with these explicit hex replacements overriding default generic shades:
- **Primary / Brand Action (`#E0533D`):** A warm coral-red. Used for the main `+` buttons, major alerts, and active selector bars. Replaces all instances of traditional "Indigo" or "Blue" branding.
- **Secondary Bubble (`#9DA7D0`):** A lavender/periwinkle logic shade used for muted pill buttons, background tags, and neutral active states.
- **Income / Success (`#469B88`):** A darker, refined teal replacing harsh emerald-greens for all income arrays and success toasts.
- **Trust Context (`#377CC8`):** A deep blue strictly reserved for explicit linking semantics or partner additions.
- **Dark Text (`#242424`):** Never pure black.

## 4. Geometric & Architecture Constraints
- **Rectangular Structural Philosophy:** Bubbly pills are prohibited. Modern Financy demands clean rectangles. Everything must rigidly adhere to tight `12px` or `16px` border radii natively.
- **Header Discipline:** Top margins must remain extremely tight. Do not render redundant "Page Title" strings if the layout contextually implies the location securely.
- **Topographical Routing:** The Tab Application must center around the Agentic AI. The `Copilot` tab executes physically dead-center inside the Layout, elevated as a physically floating Action Button intercepting the user's focus continuously.

## 5. Apple Liquid Glass Design System
- **Translucency:** Every primary surface (Tab Bar, Activity Header, Dashboard Cards) must utilize `BlurView` with `80%-95%` intensity.
- **Surface Layering:** Use `bg-white/70` (light) and `bg-black/40` (dark) to create depth. Add 1px `border-white/10` to simulate glass edge highlights.
- **Iconography:** Strictly use minimalist, geometric, thin-stroke icons (Ionicons-outline variant). The Copilot icon must be a "Sparkles" AI-style symbol (e.g., `sparkles-sharp`).

## 6. Navigational Hierarchy
- **Priority Routing:** The Agentic AI (Copilot) is the physical center of the app. It must be a floating action button that breaks the tab bar's top plane.
- **Order:** Home ➔ Insights (Analytics) ➔ **Copilot** ➔ Activity (Transactions) ➔ Profile (Settings).

## 7. Implementation Validation
Any future UI engineers or AI nodes operating on this App must adhere strictly to these glassmorphism tokens, hex keys, and corner radii before compiling their PR additions.
