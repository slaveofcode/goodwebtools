import { useMemo, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { CopyButton } from '@/components/ui/CopyButton';
import { parseCidr, type CidrInfo } from '@/tools/dev/cidr.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, {
  intro: string;
  label: string;
  invalid: string;
  rows: Record<keyof Omit<CidrInfo, 'prefix'>, string>;
  hosts: string;
}> = {
  en: {
    intro: 'Enter an IPv4 address with a CIDR prefix (e.g. 192.168.1.0/24) to see the network, broadcast, mask, host range and count. Everything is computed in your browser.',
    label: 'IPv4 address / CIDR',
    invalid: 'Enter a valid IPv4 address and prefix, e.g. 10.0.0.0/24.',
    rows: {
      address: 'Address', netmask: 'Netmask', wildcard: 'Wildcard mask', network: 'Network address',
      broadcast: 'Broadcast address', firstHost: 'First usable host', lastHost: 'Last usable host',
      totalHosts: 'Total addresses', usableHosts: 'Usable hosts', ipClass: 'Class',
    },
    hosts: 'hosts',
  },
  id: {
    intro: 'Masukkan alamat IPv4 dengan prefix CIDR (mis. 192.168.1.0/24) untuk melihat network, broadcast, mask, rentang host, dan jumlahnya. Semua dihitung di browser Anda.',
    label: 'Alamat IPv4 / CIDR',
    invalid: 'Masukkan alamat IPv4 dan prefix yang valid, mis. 10.0.0.0/24.',
    rows: {
      address: 'Alamat', netmask: 'Netmask', wildcard: 'Wildcard mask', network: 'Alamat network',
      broadcast: 'Alamat broadcast', firstHost: 'Host pertama', lastHost: 'Host terakhir',
      totalHosts: 'Total alamat', usableHosts: 'Host tersedia', ipClass: 'Kelas',
    },
    hosts: 'host',
  },
};

const ORDER: (keyof Omit<CidrInfo, 'prefix'>)[] = [
  'address', 'network', 'broadcast', 'netmask', 'wildcard',
  'firstHost', 'lastHost', 'usableHosts', 'totalHosts', 'ipClass',
];

export default function CidrCalculator({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [value, setValue] = useState('192.168.1.0/24');

  const parsed = useMemo(() => {
    try {
      return { info: parseCidr(value) };
    } catch {
      return { error: true as const };
    }
  }, [value]);

  const info = 'info' in parsed ? parsed.info : undefined;
  const copyText = info
    ? ORDER.map(k => `${t.rows[k]}: ${info[k]}`).join('\n')
    : '';

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
          placeholder="192.168.1.0/24"
        />
      </label>

      {value.trim() && !info && <Alert variant="error">{t.invalid}</Alert>}

      {info && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">/{info.prefix}</span>
            <CopyButton value={copyText} />
          </div>
          <div className="divide-y divide-border border-2 border-border">
            {ORDER.map(k => (
              <div key={k} className="flex flex-wrap items-baseline gap-x-3 px-3 py-2 text-sm">
                <span className="w-40 shrink-0 font-medium text-muted-foreground">{t.rows[k]}</span>
                <span className="break-all font-mono">
                  {info[k]}{(k === 'totalHosts' || k === 'usableHosts') ? ` ${t.hosts}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
