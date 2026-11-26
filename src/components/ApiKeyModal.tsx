import { useEffect, useState } from 'react';
import { KeyRound, X } from 'lucide-react';

interface ApiKeyModalProps {
  open: boolean;
  currentKey: string;
  serverConfigured: boolean;
  onSave: (key: string) => void;
  onClose: () => void;
}

export function ApiKeyModal({
  open,
  currentKey,
  serverConfigured,
  onSave,
  onClose,
}: ApiKeyModalProps) {
  const [draft, setDraft] = useState(currentKey);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gemini-settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-sky-600" aria-hidden="true" />
            <h3 id="gemini-settings-title" className="text-base font-bold text-slate-900">
              Gemini GenAI Settings
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close Gemini settings dialog"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3 text-xs text-slate-600">
          <p className="leading-relaxed">
            ClearAir AI works out-of-the-box using its built-in exposure & local rule engine. To
            enable <strong>Live Gemini GenAI</strong> synthesis and unrestricted Q&A, supply a
            Gemini API key below (or set <code className="rounded bg-slate-100 px-1">GEMINI_API_KEY</code> in{' '}
            <code className="rounded bg-slate-100 px-1">.env</code>).
          </p>

          {serverConfigured && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
              A server-side <code className="font-mono">GEMINI_API_KEY</code> is already configured.
            </div>
          )}

          <div>
            <label className="mb-1 block font-semibold text-slate-700">
              Browser Session Gemini API Key (Optional)
            </label>
            <input
              type="password"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="AIza..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Stored only in your browser localStorage and sent per-request over local API headers.
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setDraft('');
              onSave('');
              onClose();
            }}
            className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Clear Key
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(draft.trim());
              onClose();
            }}
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            Save & Apply
          </button>
        </div>
      </div>
    </div>
  );
}
