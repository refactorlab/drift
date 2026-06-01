import { createRoot } from 'react-dom/client';
import { App } from '../app/App';

// No StrictMode here: the chat streams a reasoning turn via setInterval inside
// an effect, and StrictMode's intentional double-mount (dev only) would
// double-start / prematurely clear it. The effect is otherwise idempotent.
createRoot(document.getElementById('root')!).render(<App />);
