import { create } from 'zustand';

export type CopilotPersona = 'advisor' | 'friend';

export interface WidgetPayload {
  type: 'TRANSFER_CONFIRM' | 'BUDGET_ADJUST';
  amount: number;
  category?: string;
  sourceWallet?: string;
  targetWallet?: string;
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
  ) => void;
  setPersonaTyping: (persona: CopilotPersona, isTyping: boolean) => void;
  togglePersona: (persona: CopilotPersona) => void;
  clearChat: () => void;
}

const WELCOME: Record<CopilotPersona, string> = {
  advisor:
    'Hello! I noticed your Transport spend is up 20% this week. Want me to break down your Grab receipts?',
  friend:
    "Hey — I'm here whenever you want to talk. Money stuff, day stuff, anything. No pressure.",
};

const seedMessage = (persona: CopilotPersona): ChatMessage => ({
  id: `welcome:${persona}`,
  sender: 'bot',
  persona,
  text: WELCOME[persona],
  timestamp: new Date(),
});

const nextId = () =>
  Date.now().toString() + Math.random().toString(36).slice(2, 6);

export const useCopilotStore = create<CopilotState>(set => ({
  messages: [seedMessage('advisor')],
  typingPersonas: [],
  enabledPersonas: ['advisor'],

  addMessage: msg =>
    set(state => ({
      messages: [
        ...state.messages,
        {
          ...msg,
          id: nextId(),
          timestamp: new Date(),
          // Default to the first enabled persona (advisor by default).
          // Callers that care about which persona authored — bot replies —
          // pass it explicitly.
          persona: msg.persona ?? state.enabledPersonas[0] ?? 'advisor',
        },
      ],
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
      // Adding a persona — also drop their welcome message so the user
      // sees the new voice introduce itself.
      return {
        enabledPersonas: [...state.enabledPersonas, persona],
        messages: [
          ...state.messages,
          { ...seedMessage(persona), id: `welcome:${persona}:${nextId()}` },
        ],
      };
    }),

  clearChat: () =>
    set(state => ({
      messages: state.enabledPersonas.map(seedMessage),
    })),
}));
