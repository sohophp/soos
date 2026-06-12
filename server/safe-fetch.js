import dns from "node:dns/promises";
import net from "node:net";
import { Agent } from "undici";

const blocked = new net.BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
]) blocked.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
]) blocked.addSubnet(address, prefix, "ipv6");

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
]);

function mappedIpv4(address) {
  const match = String(address).toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return match ? match[1] : "";
}

function normalizeHostname(hostname) {
  return String(hostname || "").toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
}

export function isPublicIp(address) {
  const mapped = mappedIpv4(address);
  if (mapped) return isPublicIp(mapped);
  const family = net.isIP(address);
  if (!family) return false;
  return !blocked.check(address, family === 4 ? "ipv4" : "ipv6");
}

export function isBlockedHostname(hostname) {
  const normalized = normalizeHostname(hostname);
  return BLOCKED_HOSTNAMES.has(normalized)
    || normalized.endsWith(".localhost")
    || normalized.endsWith(".local")
    || normalized.endsWith(".internal");
}

export async function resolvePublicHttpTarget(value, options = {}) {
  const url = value instanceof URL ? value : new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP(S) URLs can be fetched.");
  if (url.username || url.password) throw new Error("URLs with embedded credentials are not allowed.");
  if (isBlockedHostname(url.hostname)) throw new Error("Local or internal hostnames are not allowed.");

  const hostname = normalizeHostname(url.hostname);
  const literalFamily = net.isIP(hostname);
  const lookup = options.lookup || dns.lookup;
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length) throw new Error("The target hostname did not resolve.");
  const unsafe = addresses.find((item) => !isPublicIp(item.address));
  if (unsafe) throw new Error(`The target resolves to a non-public IP address (${unsafe.address}).`);
  return {
    url,
    addresses: addresses.map((item) => ({ address: item.address, family: Number(item.family) || net.isIP(item.address) })),
    selected: {
      address: addresses[0].address,
      family: Number(addresses[0].family) || net.isIP(addresses[0].address),
    },
  };
}

export async function createPinnedDispatcher(value, options = {}) {
  const target = await resolvePublicHttpTarget(value, options);
  const selected = target.selected;
  const dispatcher = new Agent({
    connect: {
      lookup(hostname, lookupOptions, callback) {
        if (normalizeHostname(hostname) !== normalizeHostname(target.url.hostname)) {
          callback(new Error("Unexpected hostname during pinned request."));
          return;
        }
        if (lookupOptions?.all) {
          callback(null, [selected]);
          return;
        }
        callback(null, selected.address, selected.family);
      },
    },
  });
  return { ...target, dispatcher };
}
