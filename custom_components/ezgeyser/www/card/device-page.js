// The integration publishes this root URL in the device registry. Never infer an address from a name or entity ID.

const isOctet = (part) => /^(0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255;

function isPrivateIpv4(host) {
  const octets = host.split('.');
  if (octets.length !== 4 || !octets.every(isOctet)) return false;
  const [a, b] = octets.map(Number);
  return (
    a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)
  );
}

const isMdnsName = (host) => host.length <= 253 && /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+local$/.test(host);

// {url, host} for a plain http:// root on the local network; null for anything else.
export function devicePage(device) {
  const match = /^http:\/\/([^/?#@:]+)\/$/.exec(device?.configuration_url || '');
  if (!match) return null;
  const host = match[1];
  return isPrivateIpv4(host) || isMdnsName(host) ? { url: match[0], host } : null;
}
