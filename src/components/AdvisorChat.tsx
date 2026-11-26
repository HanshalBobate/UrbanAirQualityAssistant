import { useState } from 'react';
import { Bot, Send, User } from 'lucide-react';
import type { AirQualitySnapshot, ChatMessage, LifestyleProfile } from '@shared/types';
import { sendAdvisorChat } from '../api';

interface AdvisorChatProps {
  airQuality: AirQualitySnapshot | null;
  profile: LifestyleProfile;
  adoptedTitles: string[];
  apiKey?: string;
}

const STARTER_PROMPTS = [
  'Is it safe to open windows for 15 minutes today?',
  'How do I build a $50 DIY Corsi-Rosenthal box purifier?',
  'What is the safest school commute plan with asthma?',
  'How does woodsmoke vs gas cooking affect indoor air?',
];

export function AdvisorChat({
  airQuality,
  profile,
  adoptedTitles,
  apiKey,
}: AdvisorChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const handleAsk = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || !airQuality || sending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setSending(true);

    try {
      const res = await sendAdvisorChat({
        question: trimmed,
        airQuality,
        profile,
        adoptedTitles,
        history: messages,
        apiKey,
      });

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toISOString(),
      };
      setMessages([...nextHistory, assistantMsg]);
    } catch {
      setMessages([
        ...nextHistory,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Unable to reach the advisor right now. Please try again in a moment.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Ask ClearAir GenAI Advisor</h2>
            <p className="text-xs text-slate-500">
              Context-aware Q&A for {airQuality?.locationName ?? 'your city'} (AQI{' '}
              {airQuality?.current.usAqi ?? '—'}) and your household profile
            </p>
          </div>
        </div>
      </div>

      {/* Starter Prompt Chips */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {STARTER_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={!airQuality || sending}
            onClick={() => handleAsk(prompt)}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-900 disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Log */}
      {messages.length > 0 && (
        <div className="scrollbar-thin mt-4 max-h-80 space-y-3 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-800'
                }`}
              >
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="text-xs italic text-slate-500">Advisor is analyzing local conditions...</div>
          )}
        </div>
      )}

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleAsk(input);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about masks, kids' sports, stove emissions, neighborhood pledges..."
          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20"
        />
        <button
          type="submit"
          disabled={!input.trim() || !airQuality || sending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          Ask
        </button>
      </form>
    </section>
  );
}
