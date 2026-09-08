// Demo entry for the v1 slides viewer. Installs the fetch stub and the two demo
// hooks, then boots the real viewer untouched — plus a seeded fragment: the
// viewer reads `location.hash` on mount, and a bare `/demo/v1/` would otherwise
// render "This link has no share data."
import { installDemo } from '../bootstrap';
import { fragmentFor, LANDING_SHARE_ID } from '../demoData';

await installDemo();
if (location.hash.length <= 1) {
  history.replaceState(null, '', `${location.pathname}#${fragmentFor(LANDING_SHARE_ID)}`);
}
await import('../../src/main');
