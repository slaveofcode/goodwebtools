import { useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { CopyButton } from '@/components/ui/CopyButton';
import { parseCidrAny, type CidrInfo, type Ipv6Info } from '@/tools/dev/cidr.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string;
  label: string;
  invalid: string;
  hosts: string;
  labels: Record<string, string>;
}> = {
  en: {
    intro: 'Enter an IPv4 or IPv6 address with a CIDR prefix (e.g. 192.168.1.0/24 or 2001:db8::/32) to see the network, range, mask and address count. Everything is computed in your browser.',
    label: 'IPv4 / IPv6 address / CIDR',
    invalid: 'Enter a valid IPv4 or IPv6 address and prefix, e.g. 10.0.0.0/24 or 2001:db8::/48.',
    hosts: 'hosts',
    labels: {
      address: 'Address', fullAddress: 'Expanded address', netmask: 'Netmask', wildcard: 'Wildcard mask',
      network: 'Network address', broadcast: 'Broadcast address', firstHost: 'First usable host',
      lastHost: 'Last usable host', firstAddress: 'First address', lastAddress: 'Last address',
      totalHosts: 'Total addresses', usableHosts: 'Usable hosts', totalAddresses: 'Total addresses',
      ipClass: 'Class', prefix: 'Prefix',
    },
  },
  id: {
    intro: 'Masukkan alamat IPv4 atau IPv6 dengan prefix CIDR (mis. 192.168.1.0/24 atau 2001:db8::/32) untuk melihat network, rentang, mask, dan jumlah alamat. Semua dihitung di browser Anda.',
    label: 'Alamat IPv4 / IPv6 / CIDR',
    invalid: 'Masukkan alamat IPv4 atau IPv6 dan prefix yang valid, mis. 10.0.0.0/24 atau 2001:db8::/48.',
    hosts: 'host',
    labels: {
      address: 'Alamat', fullAddress: 'Alamat lengkap', netmask: 'Netmask', wildcard: 'Wildcard mask',
      network: 'Alamat network', broadcast: 'Alamat broadcast', firstHost: 'Host pertama',
      lastHost: 'Host terakhir', firstAddress: 'Alamat pertama', lastAddress: 'Alamat terakhir',
      totalHosts: 'Total alamat', usableHosts: 'Host tersedia', totalAddresses: 'Total alamat',
      ipClass: 'Kelas', prefix: 'Prefix',
    },
  },
};

const V4_ORDER: (keyof CidrInfo)[] = [
  'address', 'network', 'broadcast', 'netmask', 'wildcard',
  'firstHost', 'lastHost', 'usableHosts', 'totalHosts', 'ipClass',
];
const V6_ORDER: (keyof Ipv6Info)[] = [
  'address', 'fullAddress', 'network', 'firstAddress', 'lastAddress', 'totalAddresses',
];

export default function CidrCalculator({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [value, setValue] = useState('192.168.1.0/24');

  const parsed = useMemo(() => {
    try {
      return { info: parseCidrAny(value) };
    } catch {
      return { error: true as const };
    }
  }, [value]);

  const info = 'info' in parsed ? parsed.info : undefined;
  const order = info ? (info.version === 6 ? V6_ORDER : V4_ORDER) : [];
  const rows = order.map(k => ({
    key: k as string,
    label: t.labels[k as string] ?? (k as string),
    value: String((info as unknown as Record<string, unknown>)[k as string]),
    suffix: (k === 'totalHosts' || k === 'usableHosts' || k === 'totalAddresses') ? ` ${t.hosts}` : '',
  }));
  const copyText = rows.map(r => `${r.label}: ${r.value}${r.suffix}`).join('\n');

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <label className="block space-y-1">
        <span className="block text-sm font-semibold">{t.label}</span>
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          spellCheck={false}
          className="w-full border-2 border-border bg-muted p-3 font-mono text-sm"
          placeholder="192.168.1.0/24 or 2001:db8::/32"
        />
      </label>

      {value.trim() && !info && <Alert variant="error">{t.invalid}</Alert>}

      {info && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">IPv{info.version} · /{info.prefix}</span>
            <CopyButton value={copyText} />
          </div>
          <div className="divide-y divide-border border-2 border-border">
            {rows.map(r => (
              <div key={r.key} className="flex flex-wrap items-baseline gap-x-3 px-3 py-2 text-sm">
                <span className="w-40 shrink-0 font-medium text-muted-foreground">{r.label}</span>
                <span className="break-all font-mono">{r.value}{r.suffix}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
