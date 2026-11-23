import type { ReactNode } from 'react';
import { TIERS, TIER_ORDER } from '../../engine/tierConfig';
import { showNumberBank, useAppStore, type Settings } from '../../store/useAppStore';
import { useGame, useProfile } from '../storeTypes';
import { Modal } from './Modal';

interface Props {
  onClose: () => void;
}

const DANGER = 'min-h-11 w-full rounded-xl border border-wrong px-4 font-semibold text-wrong hover:bg-surface-2';

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-surface-2">
      <input type="checkbox" className="size-5 accent-accent" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Choice({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <fieldset className="flex flex-col">
      <legend className="mb-1 text-sm font-semibold text-muted">{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-surface-2">
          <input
            type="radio"
            name={name}
            className="size-5 accent-accent"
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5 flex flex-col gap-2">
      <h3 className="text-sm font-bold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

export function SettingsModal({ onClose }: Props) {
  const settings = useAppStore((s) => s.settings);
  const profile = useProfile();
  const tier = useGame()?.puzzle.tier ?? 'junior';
  const set = (patch: Partial<Settings>) => useAppStore.getState().setSettings(patch);
  const bankOn = showNumberBank(settings, tier);

  const onReset = () => {
    if (window.confirm('Reset all statistics? Streaks and best times will be erased.')) {
      useAppStore.getState().resetStats();
    }
  };
  const onClear = () => {
    if (!profile) return;
    if (window.confirm(`Clear the profile for ${profile.name}? Their saved game and statistics will be deleted.`)) {
      onClose();
      useAppStore.getState().clearProfile();
    }
  };

  return (
    <Modal title="Settings" onClose={onClose} drawer>
      <Section title="Difficulty">
        <Choice
          legend="Level"
          name="difficulty"
          value={settings.difficultyOverride}
          onChange={(v) => set({ difficultyOverride: v as Settings['difficultyOverride'] })}
          options={[{ value: 'auto', label: 'Auto (by age)' }, ...TIER_ORDER.map((id) => ({ value: id, label: TIERS[id].label }))]}
        />
      </Section>

      <Section title="Assists">
        <Check label="Auto-check mistakes" checked={settings.autoCheck} onChange={(v) => set({ autoCheck: v })} />
        <Check label="Mistake limit (3 strikes)" checked={settings.mistakeLimit} onChange={(v) => set({ mistakeLimit: v })} />
        {settings.mistakeLimit && (
          <Choice
            legend="When the limit is reached"
            name="mistakeMode"
            value={settings.mistakeMode}
            onChange={(v) => set({ mistakeMode: v as Settings['mistakeMode'] })}
            options={[
              { value: 'gameover', label: 'Game over (restart allowed)' },
              { value: 'warning', label: 'Warning only' },
              { value: 'streak', label: 'Lose streak only' },
            ]}
          />
        )}
        <Choice
          legend="Hints"
          name="hintMode"
          value={settings.hintMode}
          onChange={(v) => set({ hintMode: v as Settings['hintMode'] })}
          options={[
            { value: '3', label: '3 per game' },
            { value: 'tier', label: 'Based on level (Junior 5, Elementary 3, Middle 2, Adult 1)' },
            { value: 'unlimited', label: 'Unlimited' },
          ]}
        />
        <Check label="Highlight intersecting equations" checked={settings.highlightEquations} onChange={(v) => set({ highlightEquations: v })} />
        <Check label="Show number bank" checked={bankOn} onChange={(v) => set({ showNumberBankOverride: v })} />
        <Check label="Show timer" checked={settings.timerVisible} onChange={(v) => set({ timerVisible: v })} />
      </Section>

      <Section title="Accessibility and theme">
        <Choice
          legend="Theme"
          name="theme"
          value={settings.theme}
          onChange={(v) => set({ theme: v as Settings['theme'] })}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
        <Check label="Sound effects" checked={settings.sound} onChange={(v) => set({ sound: v })} />
        <Check label="Large font (kid-friendly)" checked={settings.largeFont} onChange={(v) => set({ largeFont: v })} />
      </Section>

      <Section title="Danger zone">
        <button type="button" className={DANGER} onClick={onReset}>
          Reset Statistics
        </button>
        <button type="button" className={DANGER} onClick={onClear}>
          Logout / Clear Profile
        </button>
      </Section>
    </Modal>
  );
}
