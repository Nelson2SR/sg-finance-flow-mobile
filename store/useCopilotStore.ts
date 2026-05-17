import { create } from 'zustand';

export type CopilotPersona = 'advisor' | 'friend';

export interface WidgetPayload {
  type: 'TRANSFER_CONFIRM' | 'BUDGET_ADJUST';
  amount: number;
  category?: string;
  sourceWallet?: string;
  targetWallet?: string;
}

/**
 * Lifecycle of a record-manipulating action the LLM proposed inside a
 * chat bubble. Drives the in-bubble confirmation card UI.
 */
export type ToolCallStatus =
  | 'proposed'   // LLM proposed it; show Confirm + Dismiss
  | 'executing'  // POST in flight; disable buttons
  | 'executed'   // server returned an action id; show "Done • Undo"
  | 'rolling_back' // rollback in flight
  | 'rolled_back'  // server confirmed rollback
  | 'dismissed'  // user tapped Dismiss
  | 'failed';    // server rejected; show error + retry

export interface ToolCall {
  /** Backend action type — CREATE_TRANSACTION, etc. ROLLBACK_ACTION is
   *  also accepted; the chat handler dispatches it to the rollback API. */
  type: string;
  payload: Record<string, any>;
  summary: string;
  status: ToolCallStatus;
  /** Populated once the server executes the action; needed for undo. */
  executedActionId?: number;
  /** Populated when status is 'failed'; human-readable. */
  error?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  /**
   * The persona that authored this message. Bot bubbles use it to pick
   * their avatar + bubble tint. User bubbles are coral regardless — we
   * stamp the active "primary" persona here for analytics symmetry.
   */
  persona: CopilotPersona;
  widget?: WidgetPayload;
  /** Set when the LLM appended an [[ACTION:...]] proposal to this turn. */
  toolCall?: ToolCall;
}

interface CopilotState {
  messages: ChatMessage[];
  /**
   * Personas currently composing a reply — drives the typing indicator
   * bubble in the chat. Each persona's LLM call sets+unsets its own
   * entry, so the user sees who is thinking when both personas are on.
   */
  typingPersonas: CopilotPersona[];
  /**
   * Personas the user has invited into the chat. All enabled personas
   * reply to each user message in the same thread — this is a group
   * chat, not separate channels. `advisor` is on by default; the user
   * adds/removes personas from Settings.
   */
  enabledPersonas: CopilotPersona[];
  addMessage: (
    msg: Omit<ChatMessage, 'id' | 'timestamp' | 'persona'> & { persona?: CopilotPersona },
  ) => string;
  /**
   * Patch the toolCall on a specific message — used by the confirmation
   * card to flip status from proposed → executing → executed → rolled_back.
   */
  updateToolCall: (messageId: string, patch: Partial<ToolCall>) => void;
  setPersonaTyping: (persona: CopilotPersona, isTyping: boolean) => void;
  togglePersona: (persona: CopilotPersona) => void;
  clearChat: () => void;
  /**
   * Seed a persona's opening message. Idempotent — if a welcome bubble
   * for this persona is already present, this is a no-op. The chat
   * screen calls this on mount with a text derived from the user's
   * actual finance data so the advisor never fabricates numbers.
   */
  seedWelcomeMessage: (persona: CopilotPersona, text: string) => void;
}

// Static welcome text for personas whose opener doesn't depend on
// finance data. The `advisor` persona is intentionally absent — its
// opener is data-derived by `buildAdvisorGreeting` and seeded from
// the chat screen at mount.
const STATIC_WELCOME: Partial<Record<CopilotPersona, string>> = {
  friend:
    "Hey — I'm here whenever you want to talk. Money stuff, day stuff, anything. No pressure.",
};

const nextId = () =>
  Date.now().toString() + Math.random().toString(36).slice(2, 6);

const staticSeedMessage = (persona: CopilotPersona): ChatMessage | null => {
  const text = STATIC_WELCOME[persona];
  if (!text) return null;
  return {
    id: `welcome:${persona}:${nextId()}`,
    sender: 'bot',
    persona,
    text,
    timestamp: new Date(),
  };
};

export const useCopilotStore = create<CopilotState>(set => ({
  // No advisor seed at module init — the chat screen seeds a
  // data-derived greeting once the finance store has hydrated.
  messages: [],
  typingPersonas: [],
  enabledPersonas: ['advisor'],

  addMessage: msg => {
    const id = nextId();
    set(state => ({
      messages: [
        ...state.messages,
        {
          ...msg,
          id,
          timestamp: new Date(),
          // Default to the first enabled persona (advisor by default).
          // Callers that care about which persona authored — bot replies —
          // pass it explicitly.
          persona: msg.persona ?? state.enabledPersonas[0] ?? 'advisor',
        },
      ],
    }));
    return id;
  },

  updateToolCall: (messageId, patch) =>
    set(state => ({
      messages: state.messages.map(m =>
        m.id === messageId && m.toolCall
          ? { ...m, toolCall: { ...m.toolCall, ...patch } }
          : m,
      ),
    })),

  setPersonaTyping: (persona, isTyping) =>
    set(state => {
      const isPresent = state.typingPersonas.includes(persona);
      if (isTyping && !isPresent) {
        return { typingPersonas: [...state.typingPersonas, persona] };
      }
      if (!isTyping && isPresent) {
        return { typingPersonas: state.typingPersonas.filter(p => p !== persona) };
      }
      return state;
    }),

  togglePersona: persona =>
    set(state => {
      const present = state.enabledPersonas.includes(persona);
      if (present) {
        // Don't allow removing the last persona — without one the chat
        // has no one to reply.
        if (state.enabledPersonas.length === 1) return state;
        return {
          enabledPersonas: state.enabledPersonas.filter(p => p !== persona),
        };
      }
      // Adding a persona — drop a static welcome where one exists. The
      // advisor opener is data-derived and seeded by the chat screen
      // instead, so adding/re-adding advisor here just enables it.
      const seed = staticSeedMessage(persona);
      return {
        enabledPersonas: [...state.enabledPersonas, persona],
        messages: seed ? [...state.messages, seed] : state.messages,
      };
    }),

  clearChat: () =>
    // Reset to empty; the chat screen's effect re-seeds the advisor
    // welcome from the latest finance snapshot, and static personas
    // (friend) get a fresh hello if they're enabled.
    set(state => ({
      messages: state.enabledPersonas
        .map(staticSeedMessage)
        .filter((m): m is ChatMessage => m !== null),
    })),

  seedWelcomeMessage: (persona, text) =>
    set(state => {
      const alreadySeeded = state.messages.some(
        m => m.persona === persona && m.id.startsWith(`welcome:${persona}`),
      );
      if (alreadySeeded) return state;
      return {
        messages: [
          ...state.messages,
          {
            id: `welcome:${persona}:${nextId()}`,
            sender: 'bot',
            persona,
            text,
            timestamp: new Date(),
          },
        ],
      };
    }),
}));
