// Turning `--interface <name|address>` into a local IPv4 address to bind to.
// Pure (the interface table is passed in), so it is unit-tested.
import type { NetworkInterfaceInfo } from 'node:os';

type InterfaceTable = NodeJS.Dict<NetworkInterfaceInfo[]>;

export interface LocalInterface {
  name: string;
  address: string;
}

export type InterfaceChoice =
  | { ok: true; iface: LocalInterface }
  | { ok: false; message: string };

function ipv4Interfaces(table: InterfaceTable): LocalInterface[] {
  const found: LocalInterface[] = [];
  for (const [name, addrs] of Object.entries(table)) {
    for (const addr of addrs ?? []) {
      if (!addr.internal && addr.family === 'IPv4') found.push({ name, address: addr.address });
    }
  }
  return found;
}

/** The interface that currently holds `address`, if any. */
export function findInterfaceByAddress(address: string, table: InterfaceTable): LocalInterface | null {
  return ipv4Interfaces(table).find((iface) => iface.address === address) ?? null;
}

/**
 * Resolve what the user typed: an interface name (`en1`, `Wi-Fi`) or one of
 * this machine's IPv4 addresses. A name is the durable choice, since the
 * address behind it changes with every DHCP lease.
 */
export function resolveCliInterface(value: string, table: InterfaceTable): InterfaceChoice {
  const all = ipv4Interfaces(table);
  const match = all.find((iface) => iface.name === value) ?? all.find((iface) => iface.address === value);
  if (match) return { ok: true, iface: match };

  const available = all.map((iface) => `${iface.name} (${iface.address})`).join(', ') || 'none';
  const reason = table[value]
    ? `interface ${value} has no IPv4 address`
    : `no network interface is named or has the address ${value}`;
  return { ok: false, message: `${reason}. Available: ${available}` };
}
