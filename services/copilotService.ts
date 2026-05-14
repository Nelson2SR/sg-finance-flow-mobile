import { CopilotPersona, ChatMessage } from '../store/useCopilotStore';
import {
  copilotApi,
  CopilotActionResponseDto,
  CopilotMessageDto,
  CopilotSnapshotDto,
  CopilotToolCallDto,
} from './apiClient';

/**
 * Snapshot of the user's current finance state, sent with each turn so
 * the backend can ground the LLM in real numbers even when the server's
 * own DB doesn't yet hold the user's local-only state (dev auth bypass).
 */
export interface FinanceSnapshot {
  wallets: { name: string; type: string; currency: string; balance: number }[];
  recentTransactions: {
    /** Backend transaction id — needed for UPDATE / DELETE proposals. */
    id?: number;
    merchant: string;
    category: string;
    amount: number;
    type: 'INCOME' | 'EXPENSE';
    date: string;
  }[];
}

export interface CopilotReply {
  text: string;
  /** True when the backend served a canned phrase (LLM unavailable). */
  fallback: boolean;
  /** Optional record-manipulating action the LLM proposed. Render as a
   *  Confirm card; execute via executeCopilotAction() on accept. */
  toolCall?: CopilotToolCallDto | null;
}

// Per-persona client-side fallbacks — used only when the backend itself
// is unreachable (no network, server down). When the backend is up but
// the LLM errored, the backend returns its own canned phrase with
// fallback=true.
const CLIENT_FALLBACKS: Record<CopilotPersona, string[]> = {
  advisor: [
    "I can't reach the server right now. From your local snapshot: keep an eye on Dining if it's been ticking up.",
    "Server didn't pick up — offline tip: route any surplus from this month into a long-horizon vault.",
  ],
  friend: [
    "I'm having trouble connecting, but I'm still here. What's on your mind?",
    "Network's a bit off, but you've got me. Want to just talk for a bit?",
  ],
};

const pickClientFallback = (persona: CopilotPersona): string => {
  const pool = CLIENT_FALLBACKS[persona];
  return pool[Math.floor(Math.random() * pool.length)];
};

/**
 * Filter the global thread to the per-persona view (user messages + that
 * persona's past replies), and convert to the wire format expected by
 * the backend. The backend's Gemini call wants `role: 'user' | 'model'`.
 */
const buildHistoryWire = (
  messages: ChatMessage[],
  persona: CopilotPersona,
): CopilotMessageDto[] => {
  const out: CopilotMessageDto[] = [];
  for (const msg of messages) {
    if (msg.sender === 'user') {
      out.push({ role: 'user', text: msg.text });
    } else if (msg.persona === persona) {
      out.push({ role: 'model', text: msg.text });
    }
  }
  return out;
};

const buildSnapshotWire = (snapshot: FinanceSnapshot): CopilotSnapshotDto => ({
  wallets: snapshot.wallets,
  // Explicit mapping so the id field is guaranteed to make it on to
  // the wire (the LLM needs it to propose UPDATE_TRANSACTION_CATEGORY
  // and DELETE_TRANSACTION on previously-logged rows).
  recent_transactions: snapshot.recentTransactions.map(t => ({
    id: t.id,
    merchant: t.merchant,
    category: t.category,
    amount: t.amount,
    type: t.type,
    date: t.date,
  })),
});

/**
 * Send one user turn to the backend's `/copilot/chat` endpoint as
 * `persona`, with the per-persona-filtered history + finance snapshot.
 * The Gemini call happens server-side; this function just shapes the
 * payload and falls back to a canned phrase if the request fails.
 */
export async function chatWithCopilot({
  persona,
  message,
  history,
  snapshot,
}: {
  persona: CopilotPersona;
  message: string;
  history: ChatMessage[];
  snapshot: FinanceSnapshot;
}): Promise<CopilotReply> {
  try {
    const res = await copilotApi.chat({
      persona,
      message,
      history: buildHistoryWire(history, persona),
      snapshot: buildSnapshotWire(snapshot),
    });
    return {
      text: res.data.text,
      fallback: res.data.fallback,
      toolCall: res.data.tool_call ?? null,
    };
  } catch (err) {
    // Warn (not error) so RN's LogBox doesn't pop a red banner. The
    // call fails for the usual reasons in dev — backend offline,
    // unreachable LAN IP, 401 with a fake token under DEV_DISABLE_AUTH.
    console.warn(`Copilot (${persona}) chat failed`, err);
    return { text: pickClientFallback(persona), fallback: true, toolCall: null };
  }
}

/**
 * Execute a Copilot-proposed action after the user confirms in the UI.
 * Writes the domain change AND appends to the 3-day rollback log.
 */
export async function executeCopilotAction(toolCall: CopilotToolCallDto): Promise<CopilotActionResponseDto> {
  const res = await copilotApi.executeAction({
    type: toolCall.type,
    payload: toolCall.payload ?? {},
    summary: toolCall.summary ?? '',
  });
  return res.data;
}

/**
 * Undo a previously-executed Copilot action. Backend enforces the 3-day
 * retention window and rejects double-rollbacks with 409.
 */
export async function rollbackCopilotAction(actionId: number): Promise<CopilotActionResponseDto> {
  const res = await copilotApi.rollbackAction(actionId);
  return res.data;
}
