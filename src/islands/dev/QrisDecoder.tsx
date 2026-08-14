import { useMemo, useState } from 'react';
import { decodeQrFromFile } from '@/tools/image/qr-decode.lib';
import { Dropzone } from '@/components/ui/Dropzone';
import { TextArea } from '@/components/ui/TextArea';
import { Alert } from '@/components/ui/Alert';
import { CopyButton } from '@/components/ui/CopyButton';
import { usePasteImage } from '@/hooks/usePasteImage';
import { parseQris, crc16, type Tlv, type QrisResult } from '@/tools/dev/qris.lib';
import type { Lang } from '@/i18n/config';

// A syntactically valid sample QRIS with a correct trailing CRC.
const EXAMPLE_BASE =
  '000201' +
  '010211' +
  '2644' + '0014ID.CO.QRIS.WWW' + '0215ID1020012345678' + '0303UMI' +
  '52045411' +
  '5303360' +
  '540512345' +
  '5802ID' +
  '5909TOKO BUDI' +
  '6007JAKARTA' +
  '610512190' +
  '62070703A01' +
  '6304';
const EXAMPLE = EXAMPLE_BASE + crc16(EXAMPLE_BASE);

const TR: Record<Lang, {
  intro: string;
  dropPrompt: string;
  dropSub: string;
  payload: string;
  placeholder: string;
  loadExample: string;
  noQrFound: string;
  cannotRead: string;
  summary: string;
  merchant: string;
  nmid: string;
  city: string;
  amount: string;
  currency: string;
  mcc: string;
  type: string;
  staticL: string;
  dynamicL: string;
  unknownL: string;
  acquirer: string;
  criteria: string;
  postal: string;
  country: string;
  crc: string;
  valid: string;
  invalid: string;
  breakdown: string;
  parseError: string;
}> = {
  en: {
    intro: 'Decode an Indonesian QRIS code: paste the payload text or drop a QR image, and see the merchant, NMID, city, amount and every EMVCo field. Everything runs in your browser — nothing is uploaded.',
    dropPrompt: 'Drop a QRIS image or click to browse',
    dropSub: 'Decoded on your device · or paste an image (⌘V)',
    payload: 'QRIS payload',
    placeholder: 'Paste the QRIS string (starts with 00020101…) or drop an image above',
    loadExample: 'Load example',
    noQrFound: 'No QR code found in this image.',
    cannotRead: 'Could not read the image file.',
    summary: 'Summary',
    merchant: 'Merchant name',
    nmid: 'NMID',
    city: 'Merchant city',
    amount: 'Amount',
    currency: 'Currency',
    mcc: 'Category (MCC)',
    type: 'Type',
    staticL: 'Static',
    dynamicL: 'Dynamic',
    unknownL: 'Unknown',
    acquirer: 'Acquirer / GUI',
    criteria: 'Merchant criteria',
    postal: 'Postal code',
    country: 'Country',
    crc: 'Checksum (CRC)',
    valid: 'Valid',
    invalid: 'Invalid',
    breakdown: 'Full TLV breakdown',
    parseError: 'This does not look like a valid QRIS / EMVCo payload.',
  },
  id: {
    intro: 'Dekode kode QRIS Indonesia: tempel teks payload atau letakkan gambar QR, lalu lihat merchant, NMID, kota, nominal, dan seluruh field EMVCo. Semuanya berjalan di browser Anda — tidak ada yang diunggah.',
    dropPrompt: 'Letakkan gambar QRIS atau klik untuk memilih',
    dropSub: 'Didekode di perangkat Anda · atau tempel gambar (⌘V)',
    payload: 'Payload QRIS',
    placeholder: 'Tempel teks QRIS (diawali 00020101…) atau letakkan gambar di atas',
    loadExample: 'Muat contoh',
    noQrFound: 'Tidak ada kode QR yang ditemukan pada gambar ini.',
    cannotRead: 'Tidak dapat membaca file gambar.',
    summary: 'Ringkasan',
    merchant: 'Nama merchant',
    nmid: 'NMID',
    city: 'Kota merchant',
    amount: 'Nominal',
    currency: 'Mata uang',
    mcc: 'Kategori (MCC)',
    type: 'Tipe',
    staticL: 'Statis',
    dynamicL: 'Dinamis',
    unknownL: 'Tidak diketahui',
    acquirer: 'Acquirer / GUI',
    criteria: 'Kriteria merchant',
    postal: 'Kode pos',
    country: 'Negara',
    crc: 'Checksum (CRC)',
    valid: 'Valid',
    invalid: 'Tidak valid',
    breakdown: 'Rincian TLV lengkap',
    parseError: 'Ini sepertinya bukan payload QRIS / EMVCo yang valid.',
  },
};

function TlvRows({ nodes, depth = 0 }: { nodes: Tlv[]; depth?: number }) {
  return (
    <>
      {nodes.map((n, i) => (
        <div key={`${depth}-${i}-${n.id}`}>
          <div
            className="flex flex-wrap items-baseline gap-x-2 border-b border-border py-1 text-sm"
            style={{ paddingLeft: `${depth * 1.25}rem` }}
          >
            <span className="font-mono font-bold">{n.id}</span>
            <span className="text-muted-foreground">{n.name}</span>
            {!n.children && <span className="ml-auto break-all font-mono">{n.value || '∅'}</span>}
          </div>
          {n.children && <TlvRows nodes={n.children} depth={depth + 1} />}
        </div>
      ))}
    </>
  );
}

export default function QrisDecoder({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [payload, setPayload] = useState('');
  const [imgError, setImgError] = useState('');

  const parsed = useMemo<{ result?: QrisResult; error?: boolean }>(() => {
    const clean = payload.trim();
    if (!clean) return {};
    try {
      return { result: parseQris(clean) };
    } catch {
      return { error: true };
    }
  }, [payload]);

  const handleFile = async (files: File[]) => {
    setImgError('');
    if (files.length === 0) return;
    try {
      const decoded = await decodeQrFromFile(files[0]);
      if (decoded) setPayload(decoded);
      else setImgError(t.noQrFound);
    } catch {
      setImgError(t.cannotRead);
    }
  };

  usePasteImage(file => handleFile([file]));

  const s = parsed.result?.summary;
  const typeLabel = s
    ? s.initiationMethod === 'static' ? t.staticL : s.initiationMethod === 'dynamic' ? t.dynamicL : t.unknownL
    : '';

  const rows: { label: string; value?: string }[] = s
    ? [
        { label: t.merchant, value: s.merchantName },
        { label: t.nmid, value: s.nmid },
        { label: t.city, value: s.merchantCity },
        { label: t.amount, value: s.amount },
        { label: t.currency, value: s.currency },
        { label: t.mcc, value: s.mcc },
        { label: t.acquirer, value: s.acquirer },
        { label: t.criteria, value: s.merchantCriteria },
        { label: t.postal, value: s.postalCode },
        { label: t.country, value: s.countryCode },
        { label: t.type, value: typeLabel },
      ].filter(r => r.value)
    : [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <Dropzone onDrop={handleFile} accept="image/*" multiple={false}>
        <div className="space-y-1">
          <p className="text-lg font-bold">{t.dropPrompt}</p>
          <p className="text-sm text-muted-foreground">{t.dropSub}</p>
        </div>
      </Dropzone>

      {imgError && <Alert variant="error">{imgError}</Alert>}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{t.payload}</span>
          <button
            type="button"
            onClick={() => setPayload(EXAMPLE)}
            className="text-sm text-accent underline"
          >
            {t.loadExample}
          </button>
        </div>
        <TextArea
          value={payload}
          onChange={e => setPayload(e.target.value)}
          rows={4}
          spellCheck={false}
          placeholder={t.placeholder}
        />
      </div>

      {parsed.error && <Alert variant="error">{t.parseError}</Alert>}

      {s && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{t.summary}</span>
              <CopyButton value={payload.trim()} />
            </div>
            <div className="divide-y divide-border border-2 border-border">
              {rows.map(r => (
                <div key={r.label} className="flex flex-wrap items-baseline gap-x-3 px-3 py-2 text-sm">
                  <span className="w-40 shrink-0 font-medium text-muted-foreground">{r.label}</span>
                  <span className="break-all font-mono">{r.value}</span>
                </div>
              ))}
              <div className="flex items-center gap-x-3 px-3 py-2 text-sm">
                <span className="w-40 shrink-0 font-medium text-muted-foreground">{t.crc}</span>
                <span className="font-mono">{s.crc}</span>
                <span
                  className={`ml-1 border-2 px-2 py-0.5 text-xs font-bold ${
                    s.crcValid
                      ? 'border-green-600 text-green-700 dark:border-green-400 dark:text-green-400'
                      : 'border-red-500 text-red-600 dark:text-red-400'
                  }`}
                >
                  {s.crcValid ? t.valid : t.invalid}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-sm font-semibold">{t.breakdown}</span>
            <div className="border-2 border-border px-3 py-1">
              <TlvRows nodes={parsed.result!.tree} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
