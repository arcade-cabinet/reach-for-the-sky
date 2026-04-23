import { ErrorBoundary } from 'solid-js';
import { render } from 'solid-js/web';
import { App } from './App';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown runtime error';
}

function CrashFallback(props: { error: unknown; reset: () => void }) {
  return (
    <main class="crash-screen">
      <section>
        <p class="eyebrow">Local diagnostics</p>
        <h1>Reach for the Sky stopped safely</h1>
        <p>
          The renderer or simulation hit an unexpected state. Reloading keeps saves intact because
          durable game state lives in SQLite and lightweight settings live in Preferences.
        </p>
        <pre>{errorMessage(props.error)}</pre>
        <div>
          <button type="button" onClick={props.reset}>
            Try Again
          </button>
          <button type="button" onClick={() => window.location.reload()}>
            Reload App
          </button>
        </div>
      </section>
    </main>
  );
}

render(
  () => (
    <ErrorBoundary fallback={(error, reset) => <CrashFallback error={error} reset={reset} />}>
      <App />
    </ErrorBoundary>
  ),
  root,
);
