// Demo entry for the AutoSlides Index (the apex site). Installs the fetch stub
// and the two demo hooks, then boots the real app untouched.
import { installDemo } from './bootstrap';

await installDemo();
await import('../apex/main');
