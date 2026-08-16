import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/Button';
import { buildCardText, type MedCardData, type MedContact } from '@/tools/dev/medcard.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Make an emergency medical card for your wallet or bag. Fill in your details and a QR code is generated with everything — allergies, blood type, contacts. It works with no signal and no account; nothing is uploaded.',
    name: 'Full name', dob: 'Date of birth', blood: 'Blood type', allergies: 'Allergies',
    conditions: 'Medical conditions', medications: 'Medications', organ: 'Organ donor',
    notes: 'Notes', contacts: 'Emergency contacts', cname: 'Name', relation: 'Relation', phone: 'Phone',
    addContact: 'Add contact', print: 'Print / Save as PDF', scan: 'Scan for full details', title: 'EMERGENCY MEDICAL CARD',
  },
  id: {
    intro: 'Buat kartu medis darurat untuk dompet atau tas Anda. Isi detail Anda dan QR code dibuat berisi semuanya — alergi, golongan darah, kontak. Bekerja tanpa sinyal dan tanpa akun; tidak ada yang diunggah.',
    name: 'Nama lengkap', dob: 'Tanggal lahir', blood: 'Golongan darah', allergies: 'Alergi',
    conditions: 'Kondisi medis', medications: 'Obat-obatan', organ: 'Pendonor organ',
    notes: 'Catatan', contacts: 'Kontak darurat', cname: 'Nama', relation: 'Hubungan', phone: 'Telepon',
    addContact: 'Tambah kontak', print: 'Cetak / Simpan PDF', scan: 'Pindai untuk detail lengkap', title: 'KARTU MEDIS DARURAT',
  },
};

const BLOOD = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export default function EmergencyCard({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [d, setD] = useState<MedCardData>({
    name: '', dob: '', bloodType: '', allergies: '', conditions: '', medications: '',
    organDonor: false, notes: '', contacts: [{ name: '', relation: '', phone: '' }],
  });
  const [qr, setQr] = useState('');

  const set = <K extends keyof MedCardData>(key: K, value: MedCardData[K]) => setD(p => ({ ...p, [key]: value }));
  const setContact = (i: number, key: keyof MedContact, value: string) =>
    setD(p => ({ ...p, contacts: p.contacts.map((c, idx) => (idx === i ? { ...c, [key]: value } : c)) }));
  const addContact = () => setD(p => ({ ...p, contacts: [...p.contacts, { name: '', relation: '', phone: '' }] }));

  const text = buildCardText(d);

  useEffect(() => {
    QRCode.toDataURL(text, { margin: 1, width: 320 }).then(setQr).catch(() => setQr(''));
  }, [text]);

  const print = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const rows = text.split('\n').slice(1).map(l => `<div>${esc(l)}</div>`).join('');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(t.title)}</title>
<style>*{box-sizing:border-box}body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:24px}
.card{border:2px solid #b91c1c;border-radius:10px;max-width:420px;padding:16px;display:flex;gap:16px}
.info{flex:1;font-size:12px;line-height:1.5} h1{color:#b91c1c;font-size:15px;margin:0 0 8px} img{width:120px;height:120px}
.scan{font-size:10px;color:#666;text-align:center;margin-top:4px}</style></head><body>
<div class="card"><div class="info"><h1>🚑 ${esc(t.title)}</h1>${rows}</div>
<div><img src="${qr}" alt="QR"/><div class="scan">${esc(t.scan)}</div></div></div>
</body></html>`);
    w.document.close(); w.focus();
    setTimeout(() => w.print(), 300);
  };

  const input = 'w-full border-2 border-border bg-muted p-2 text-sm';

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="col-span-2 space-y-1 text-xs"><span className="font-semibold">{t.name}</span>
              <input value={d.name} onChange={e => set('name', e.target.value)} className={input} /></label>
            <label className="space-y-1 text-xs"><span className="font-semibold">{t.dob}</span>
              <input type="date" value={d.dob} onChange={e => set('dob', e.target.value)} className={input} /></label>
            <label className="space-y-1 text-xs"><span className="font-semibold">{t.blood}</span>
              <select value={d.bloodType} onChange={e => set('bloodType', e.target.value)} className={input}>
                {BLOOD.map(b => <option key={b} value={b}>{b || '—'}</option>)}
              </select></label>
          </div>
          <label className="space-y-1 text-xs block"><span className="font-semibold">{t.allergies}</span>
            <input value={d.allergies} onChange={e => set('allergies', e.target.value)} className={input} /></label>
          <label className="space-y-1 text-xs block"><span className="font-semibold">{t.conditions}</span>
            <input value={d.conditions} onChange={e => set('conditions', e.target.value)} className={input} /></label>
          <label className="space-y-1 text-xs block"><span className="font-semibold">{t.medications}</span>
            <input value={d.medications} onChange={e => set('medications', e.target.value)} className={input} /></label>

          <div className="space-y-2">
            <span className="text-xs font-semibold">{t.contacts}</span>
            {d.contacts.map((c, i) => (
              <div key={i} className="grid grid-cols-3 gap-1">
                <input value={c.name} onChange={e => setContact(i, 'name', e.target.value)} placeholder={t.cname} className={input} />
                <input value={c.relation} onChange={e => setContact(i, 'relation', e.target.value)} placeholder={t.relation} className={input} />
                <input value={c.phone} onChange={e => setContact(i, 'phone', e.target.value)} placeholder={t.phone} inputMode="tel" className={input} />
              </div>
            ))}
            <Button variant="secondary" onClick={addContact} className="text-xs">+ {t.addContact}</Button>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={d.organDonor} onChange={e => set('organDonor', e.target.checked)} />
            <span>{t.organ}</span>
          </label>
          <label className="space-y-1 text-xs block"><span className="font-semibold">{t.notes}</span>
            <textarea value={d.notes} onChange={e => set('notes', e.target.value)} rows={2} className={input} /></label>
        </div>

        <div className="space-y-3">
          <div className="flex gap-4 rounded-lg border-2 border-red-600 p-4">
            <div className="flex-1 text-xs leading-relaxed">
              <div className="mb-2 font-black text-red-600">🚑 {t.title}</div>
              {text.split('\n').slice(1).map((l, i) => <div key={i} className="break-words">{l}</div>)}
            </div>
            {qr && <div className="text-center"><img src={qr} alt="QR" className="h-28 w-28" /><div className="mt-1 text-[10px] text-muted-foreground">{t.scan}</div></div>}
          </div>
          <Button onClick={print}>{t.print}</Button>
        </div>
      </div>
    </div>
  );
}
