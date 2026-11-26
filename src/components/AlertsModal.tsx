import { useEffect, useState } from 'react';
import { Bell, BellRing, Check, Trash2, X } from 'lucide-react';
import type { AirQualitySnapshot, SmogAlertSubscription } from '@shared/types';

interface AlertsModalProps {
  open: boolean;
  airQuality: AirQualitySnapshot | null;
  alerts: SmogAlertSubscription[];
  onCreate: (input: {
    label: string;
    locationName: string;
    latitude: number;
    longitude: number;
    aqiThreshold: number;
    alertOnInversion: boolean;
    morningTime: string;
    channel: 'browser' | 'email_digest';
    contact?: string;
    enabled: boolean;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

export function AlertsModal({
  open,
  airQuality,
  alerts,
  onCreate,
  onDelete,
  onClose,
}: AlertsModalProps) {
  const [label, setLabel] = useState('Morning School Commute Alert');
  const [aqiThreshold, setAqiThreshold] = useState(150);
  const [alertOnInversion, setAlertOnInversion] = useState(true);
  const [morningTime, setMorningTime] = useState('07:00');
  const [channel, setChannel] = useState<'browser' | 'email_digest'>('browser');
  const [contact, setContact] = useState('');
  const [saving, setSaving] = useState(false);
  const [notifStatus, setNotifStatus] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const requestBrowserNotif = async () => {
    if (typeof Notification === 'undefined') {
      setNotifStatus('Browser notifications are not supported in this browser.');
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifStatus(
      perm === 'granted'
        ? 'Browser notifications enabled! Triggered smog alerts will notify you.'
        : `Notification permission: ${perm}`
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!airQuality || saving) return;
    setSaving(true);
    try {
      await onCreate({
        label,
        locationName: airQuality.locationName,
        latitude: airQuality.latitude,
        longitude: airQuality.longitude,
        aqiThreshold,
        alertOnInversion,
        morningTime,
        channel,
        contact: channel === 'email_digest' ? contact : undefined,
        enabled: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="alerts-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <BellRing className="h-4 w-4 text-amber-600" aria-hidden="true" />
            <h3 id="alerts-modal-title" className="text-base font-bold text-slate-900">
              Morning Smog & Inversion Alerts
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close morning alerts dialog"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-xs">
          <div className="rounded-xl bg-amber-50/80 px-3 py-2 text-amber-950">
            Subscribing for{' '}
            <strong>{airQuality?.locationName ?? 'selected city'}</strong> (Current AQI:{' '}
            <strong>{airQuality?.current.usAqi ?? '—'}</strong>, Inversion:{' '}
            <strong className="uppercase">{airQuality?.current.inversionRisk ?? '—'}</strong>)
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700">Alert Name</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">
                Trigger at US AQI &ge;
              </label>
              <select
                value={aqiThreshold}
                onChange={(e) => setAqiThreshold(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900"
              >
                <option value={100}>100 (Sensitive Groups)</option>
                <option value={150}>150 (Unhealthy)</option>
                <option value={200}>200 (Very Unhealthy)</option>
                <option value={250}>250 (Emergency Smog)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-700">
                Morning Briefing Time
              </label>
              <input
                type="time"
                value={morningTime}
                onChange={(e) => setMorningTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="font-medium text-slate-800">
              Also alert on High / Severe Thermal Inversion
            </span>
            <input
              type="checkbox"
              checked={alertOnInversion}
              onChange={(e) => setAlertOnInversion(e.target.checked)}
              className="h-4 w-4 accent-amber-600"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setChannel('browser')}
              className={`rounded-xl border px-3 py-2 font-semibold ${
                channel === 'browser'
                  ? 'border-sky-600 bg-sky-50 text-sky-900'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              Browser Notification
            </button>
            <button
              type="button"
              onClick={() => setChannel('email_digest')}
              className={`rounded-xl border px-3 py-2 font-semibold ${
                channel === 'email_digest'
                  ? 'border-sky-600 bg-sky-50 text-sky-900'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              School / Family Contact
            </button>
          </div>

          {channel === 'email_digest' ? (
            <input
              type="email"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="family-or-school@example.org"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900"
            />
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <span className="text-[11px] text-slate-600">
                {notifStatus || 'Grant browser permission for instant morning pop-up alerts.'}
              </span>
              <button
                type="button"
                onClick={requestBrowserNotif}
                className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
              >
                Enable Popups
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={!airQuality || saving}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            <Bell className="h-3.5 w-3.5" />
            {saving ? 'Saving Alert...' : 'Save Morning Alert Subscription'}
          </button>
        </form>

        {/* Saved Subscriptions */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Active Subscriptions ({alerts.length})
          </h4>
          {alerts.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              No morning alerts yet. Save one above to monitor AQI & thermal inversions.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      {a.label}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {a.locationName} • AQI &ge; {a.aqiThreshold}
                      {a.alertOnInversion ? ' or High Inversion' : ''} • {a.morningTime}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onDelete(a.id)}
                    title="Remove alert"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
