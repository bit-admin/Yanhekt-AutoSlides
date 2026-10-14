// The network route of one run: external unless `--intranet`. The app's own
// connection mode is deliberately ignored, so a command behaves the same
// whatever the app happens to be set to. Nothing is saved.
import os from 'node:os';
import { CliError } from './errors';
import { findInterfaceByAddress, resolveCliInterface } from './networkInterface';
import { info } from './terminal';
import type { CliContext } from './types';

export interface RouteOptions {
  intranet: boolean;
  /** Interface name or local IPv4 address; the one saved in the app when absent. */
  interface?: string;
}

/**
 * Fix this run's route in the route service, so every API call and download
 * takes it, and say which interface an intranet run leaves by.
 */
export async function pinRoute(options: RouteOptions, ctx: CliContext): Promise<void> {
  const mapping = ctx.intranetMappingService;
  if (!options.intranet) {
    mapping.pinForThisProcess('external');
    return;
  }

  const interfaces = os.networkInterfaces();
  if (options.interface !== undefined) {
    const choice = resolveCliInterface(options.interface, interfaces);
    if (!choice.ok) throw new CliError('usage', choice.message);
    mapping.pinForThisProcess('internal', choice.iface.address);
    info(`Intranet route via ${choice.iface.name} (${choice.iface.address}).`);
  } else {
    mapping.pinForThisProcess('internal');
    const saved = mapping.getInterfaceIp();
    const iface = saved ? findInterfaceByAddress(saved, interfaces) : null;
    if (iface) {
      info(`Intranet route via ${iface.name} (${iface.address}), the interface set in AutoSlides.`);
    } else if (saved) {
      info(`Intranet route via the default interface: the address set in AutoSlides (${saved}) is not on any interface now. Use --interface to pick one.`);
    } else {
      info('Intranet route via the default interface. Use --interface to pick another.');
    }
  }

  // Ask the campus resolver for the current addresses; the built-in table
  // stands in when it does not answer.
  await mapping.refresh();
  if (!mapping.getNetworkStatus().reachable) {
    info('The campus intranet did not answer from here, so this run may fail. Without --intranet it uses the public network.');
  }
}
