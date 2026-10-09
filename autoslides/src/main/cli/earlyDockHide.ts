// macOS: take a command line run out of the Dock as early as JavaScript can.
//
// Imported for its side effect as the FIRST import of `main.ts`. Module bodies
// run in import order, so this runs before the rest of the app's modules are
// evaluated — hiding from the body of `main.ts` came after all of them, and
// the icon sat in the Dock for that long. It cannot remove the icon entirely:
// AppKit registers the app with the Dock before any script runs.
import { app } from 'electron';
import { parseCliInvocation } from './invocation';

if (process.platform === 'darwin' && parseCliInvocation(process.argv)) {
  app.dock?.hide();
}
