import { Component, type ReactNode } from 'react';
import { useAppStore } from '../store/useAppStore';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

/** Turns a render crash into a recoverable screen instead of a blank page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  // Data is only cleared after the player confirms.
  private startOver = () => {
    if (!window.confirm('Start over? This deletes every profile and saved game on this device.')) return;
    try {
      useAppStore.setState({ profiles: {}, currentProfileKey: null });
    } catch {
      // Storage failed; the screen still resets below.
    }
    this.setState({ failed: false });
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="grid min-h-dvh place-items-center p-4">
        <div role="alert" className="flex max-w-sm flex-col items-center gap-3 text-center">
          <h1 className="text-lg font-bold">Something went wrong</h1>
          <p className="text-sm text-muted">Your saved progress is still on this device unless you start over.</p>
          <button
            type="button"
            onClick={() => this.setState({ failed: false })}
            className="min-h-11 w-full rounded-xl bg-accent px-5 font-bold text-accent-fg shadow-sm"
          >
            Reload this screen
          </button>
          <button
            type="button"
            onClick={this.startOver}
            className="min-h-11 w-full rounded-xl border border-wrong px-5 font-semibold text-wrong"
          >
            Start over
          </button>
        </div>
      </main>
    );
  }
}
