import { createRoot } from 'react-dom/client';
import { App } from '../app/App';
import { installBrainSelector } from '../core/brainEngine';

// Select the chat brain (on-device WebLLM vs Gemini) from persisted settings
// before the first generation. Fire-and-forget: getSharedBrain awaits the
// factory this installs.
void installBrainSelector();

// No StrictMode here: the chat streams a reasoning turn via setInterval inside
// an effect, and StrictMode's intentional double-mount (dev only) would
// double-start / prematurely clear it. The effect is otherwise idempotent.
createRoot(document.getElementById('root')!).render(<App />);
