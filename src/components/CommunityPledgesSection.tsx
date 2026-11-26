import { useState } from 'react';
import { Check, Copy, Plus, Share2, Users } from 'lucide-react';
import type { CommunityPledge, PledgeCategory } from '@shared/types';
import type { TranslationStrings } from '../i18n/translations';

interface CommunityPledgesSectionProps {
  pledges: CommunityPledge[];
  currentCity: string;
  highlightedPledgeId?: string | null;
  joinedPledgeIds: string[];
  onJoin: (id: string) => Promise<void>;
  onCreate: (input: {
    category: PledgeCategory;
    title: string;
    description: string;
    city: string;
    organizer: string;
    targetHouseholds: number;
  }) => Promise<void>;
  t: TranslationStrings;
}

const CATEGORY_LABELS: Record<PledgeCategory, string> = {
  no_idling_school: 'School No-Idling',
  merv13_coop: 'MERV-13 Filter Co-op',
  zero_burning: 'Zero Leaf/Waste Burning',
  clean_air_refuge: 'Clean-Air Refuge Room',
};

export function CommunityPledgesSection({
  pledges,
  currentCity,
  highlightedPledgeId,
  joinedPledgeIds,
  onJoin,
  onCreate,
  t,
}: CommunityPledgesSectionProps) {
  const [creating, setCreating] = useState(false);
  const [category, setCategory] = useState<PledgeCategory>('no_idling_school');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [targetHouseholds, setTargetHouseholds] = useState(100);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCopyShareLink = async (pledge: CommunityPledge) => {
    const url = new URL(window.location.href);
    url.searchParams.set('pledge', pledge.id);
    url.searchParams.set('city', pledge.city);
    try {
      await navigator.clipboard.writeText(url.toString());
    } catch {
      // Fallback ignored in headless environments
    }
    setCopiedId(pledge.id);
    setTimeout(() => setCopiedId((prev) => (prev === pledge.id ? null : prev)), 2000);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onCreate({
        category,
        title: title.trim(),
        description: description.trim(),
        city: currentCity || 'Local Neighborhood',
        organizer: organizer.trim() || 'Neighborhood Volunteer',
        targetHouseholds,
      });
      setTitle('');
      setDescription('');
      setCreating(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{t.communityPledgesTitle}</h2>
            <p className="text-xs text-slate-500">{t.communityPledgesSubtitle}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
        >
          <Plus className="h-3.5 w-3.5" />
          Launch New Pledge
        </button>
      </div>

      {creating && (
        <form
          onSubmit={handleCreate}
          className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 text-xs"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Pledge Type</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PledgeCategory)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900"
              >
                <option value="no_idling_school">School No-Idling Drop-Off Lane</option>
                <option value="merv13_coop">Bulk MERV-13 Filter Co-op</option>
                <option value="zero_burning">Zero Leaf & Trash Burning Street</option>
                <option value="clean_air_refuge">Community Clean-Air Refuge Room</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">
                Organizer / School / Group
              </label>
              <input
                type="text"
                value={organizer}
                onChange={(e) => setOrganizer(e.target.value)}
                placeholder="e.g., Oakwood PTA or Ward 4 Neighbors"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block font-semibold text-slate-700">Pledge Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`e.g., ${currentCity} School Gate Zero-Idling Week`}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Target Households</label>
              <input
                type="number"
                min={10}
                max={5000}
                value={targetHouseholds}
                onChange={(e) => setTargetHouseholds(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700">Commitment Details</label>
            <textarea
              rows={2}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain what participating families or schools commit to do this winter..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-emerald-600 px-4 py-1.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? 'Publishing...' : 'Publish Shareable Pledge'}
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {pledges.map((pledge) => {
          const pct = Math.min(
            100,
            Math.round((pledge.joinedHouseholds / Math.max(1, pledge.targetHouseholds)) * 100)
          );
          const joined = joinedPledgeIds.includes(pledge.id);
          const highlighted = highlightedPledgeId === pledge.id;
          const monthlyPollutantsKg =
            Math.round(
              ((pledge.noxPmSavedGPerHouseholdDay * 30 * pledge.joinedHouseholds) / 1000) * 10
            ) / 10;

          return (
            <div
              key={pledge.id}
              className={`flex flex-col justify-between rounded-xl border p-4 transition ${
                highlighted
                  ? 'border-sky-500 bg-sky-50/40 ring-2 ring-sky-500/20'
                  : 'border-slate-200 bg-slate-50/50'
              }`}
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                    {CATEGORY_LABELS[pledge.category]}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">{pledge.city}</span>
                </div>

                <h3 className="mt-2 text-sm font-bold text-slate-900">{pledge.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {pledge.description}
                </p>
                <div className="mt-1.5 text-[11px] text-slate-500">
                  Organizer: <span className="font-medium text-slate-700">{pledge.organizer}</span>
                </div>
              </div>

              <div className="mt-3 border-t border-slate-200/70 pt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    {pledge.joinedHouseholds} / {pledge.targetHouseholds} households
                  </span>
                  <span className="text-[11px] font-medium text-emerald-700">
                    ~{monthlyPollutantsKg} kg/mo NOₓ+PM cut
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    style={{ width: `${pct}%` }}
                    className="h-full rounded-full bg-emerald-500 transition-all"
                  />
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={joined}
                    onClick={() => void onJoin(pledge.id)}
                    className={`flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                      joined
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {joined ? 'Joined (+1 Household)' : 'Join Pledge'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyShareLink(pledge)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {copiedId === pledge.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Share2 className="h-3.5 w-3.5" />
                        <Copy className="h-3 w-3 hidden" />
                        Share
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
