import { useState, type FormEvent } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Modal } from './Modal';

const INPUT = 'min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-base';

export function OnboardingModal() {
  const onboard = useAppStore((s) => s.onboard);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    const years = Number(age);
    if (trimmed.length < 2 || trimmed.length > 20) {
      setError('Name must be 2 to 20 characters.');
      return;
    }
    if (!Number.isInteger(years) || years < 5 || years > 120) {
      setError('Age must be a whole number from 5 to 120.');
      return;
    }
    setError(onboard(trimmed, years));
  };

  return (
    <Modal title="Welcome to Math CrossWord">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Tell us who is playing. Your age picks a starting level. Everything stays on this device.
        </p>
        <label className="flex flex-col gap-1 font-semibold">
          Player name
          <input
            className={INPUT}
            value={name}
            maxLength={20}
            autoComplete="given-name"
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 font-semibold">
          Player age
          <input
            className={INPUT}
            type="number"
            inputMode="numeric"
            min={5}
            max={120}
            value={age}
            onChange={(e) => setAge(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm font-semibold text-wrong">
            {error}
          </p>
        )}
        <button type="submit" className="min-h-11 rounded-xl bg-accent font-bold text-accent-fg shadow-sm active:scale-95">
          Start playing
        </button>
      </form>
    </Modal>
  );
}
