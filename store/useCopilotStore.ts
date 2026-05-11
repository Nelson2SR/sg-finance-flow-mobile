import { create } from 'zustand';

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
  widget?: WidgetPayload; // If the bot proposes an actionable UI widget
}

interface CopilotState {
  messages: ChatMessage[];
  isTyping: boolean;
  addMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  setTyping: (status: boolean) => void;
  clearChat: () => void;
}

export const useCopilotStore = create<CopilotState>((set) => ({
  messages: [
    {
      id: 'welcome',
      sender: 'bot',
      text: 'Hello! I noticed you have been spending 20% more on Transport this week. Would you like me to analyze your Grab receipts?',
      timestamp: new Date()
    }
  ],
  isTyping: false,

  addMessage: (msg) => set((state) => ({
    messages: [...state.messages, { ...msg, id: Date.now().toString(), timestamp: new Date() }]
  })),

  setTyping: (status) => set({ isTyping: status }),

  clearChat: () => set({ 
    messages: [{
      id: 'welcome:reset',
      sender: 'bot',
      text: 'Memory cleared. How can I help you manage your finances today?',
      timestamp: new Date()
    }] 
  })
}));
