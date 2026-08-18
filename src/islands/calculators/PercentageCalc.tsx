import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { percentOf, whatPercent, percentChange, tip, discount } from '@/tools/calculators/percentage.lib';
import type { Lang } from '@/i18n/config';

type Tab = 'tip' | 'discount' | 'percent';

const TR: Record<Lang, {
  intro: string; tabs: Record<Tab, string>;
  bill: string; tipPct: string; people: string; tipAmt: string; total: string; perPerson: string;
  price: string; off: string; saved: string; final: string;
  xOfY: string; aOfB: string; change: string; is: string; result: string; from: string; to: string;
}> = {
  en: {
    intro: 'Work out percentages, tips and discounts fast — “what is 15% off 340,000”, split a bill, or find a percentage change. Runs in your browser.',
    tabs: { tip: 'Tip & split', discount: 'Discount', percent: 'Percentage' },
    bill: 'Bill amount', tipPct: 'Tip %', people: 'Split between', tipAmt: 'Tip', total: 'Total', perPerson: 'Per person',
    price: 'Original price', off: 'Discount %', saved: 'You save', final: 'Final price',
    xOfY: 'What is', aOfB: 'is what % of', change: '% change from', is: 'of', result: 'Result', from: 'from', to: 'to',
  },
  id: {
    intro: 'Hitung persentase, tip, dan diskon dengan cepat — “berapa 15% dari 340.000”, bagi tagihan, atau cari perubahan persen. Berjalan di browser Anda.',
    tabs: { tip: 'Tip & bagi', discount: 'Diskon', percent: 'Persentase' },
    bill: 'Jumlah tagihan', tipPct: 'Tip %', people: 'Dibagi untuk', tipAmt: 'Tip', total: 'Total', perPerson: 'Per orang',
    price: 'Harga awal', off: 'Diskon %', saved: 'Hemat', final: 'Harga akhir',
    xOfY: 'Berapa', aOfB: 'itu berapa % dari', change: '% perubahan dari', is: 'dari', result: 'Hasil', from: 'dari', to: 'ke',
  },
};

const fmt = (n: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
const num = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(/[^0-9.-]/g, '')));

function Field({ label, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <input value={value} onChange={e => onChange(e.target.value)} inputMode="decimal"
          className="w-full rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-sm outline-none focus:border-accent" />
        {suffix && <span className="text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between border-t border-border py-1.5 text-sm first:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? 'text-lg font-bold' : 'font-semibold'}>{value}</span>
    </div>
  );
}

export default function PercentageCalc({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [tab, setTab] = useState<Tab>('tip');

  // Tip
  const [bill, setBill] = useState('100000');
  const [tipPct, setTipPct] = useState('10');
  const [people, setPeople] = useState('2');
  const tr = tip(num(bill) || 0, num(tipPct) || 0, num(people) || 1);

  // Discount
  const [price, setPrice] = useState('340000');
  const [off, setOff] = useState('15');
  const dr = discount(num(price) || 0, num(off) || 0);

  // Percentage
  const [x, setX] = useState('15');
  const [y, setY] = useState('340000');
  const [a, setA] = useState('50');
  const [b, setB] = useState('200');
  const [c1, setC1] = useState('100');
  const [c2, setC2] = useState('150');

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(t.tabs) as Tab[]).map(k => (
          <Button key={k} variant={tab === k ? 'primary' : 'secondary'} onClick={() => setTab(k)}>{t.tabs[k]}</Button>
        ))}
      </div>

      {tab === 'tip' && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t.bill} value={bill} onChange={setBill} />
            <Field label={t.tipPct} value={tipPct} onChange={setTipPct} suffix="%" />
            <Field label={t.people} value={people} onChange={setPeople} />
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <Row label={t.tipAmt} value={fmt(tr.tip)} />
            <Row label={t.total} value={fmt(tr.total)} />
            <Row label={t.perPerson} value={fmt(tr.perPerson)} strong />
          </div>
        </div>
      )}

      {tab === 'discount' && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.price} value={price} onChange={setPrice} />
            <Field label={t.off} value={off} onChange={setOff} suffix="%" />
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <Row label={t.saved} value={fmt(dr.saved)} />
            <Row label={t.final} value={fmt(dr.final)} strong />
          </div>
        </div>
      )}

      {tab === 'percent' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex flex-wrap items-end gap-2 text-sm">
              <span>{t.xOfY}</span>
              <input value={x} onChange={e => setX(e.target.value)} inputMode="decimal" className="w-20 rounded border border-border bg-background px-2 py-1 outline-none focus:border-accent" />
              <span>% {t.is}</span>
              <input value={y} onChange={e => setY(e.target.value)} inputMode="decimal" className="w-28 rounded border border-border bg-background px-2 py-1 outline-none focus:border-accent" />
              <span className="font-bold">= {fmt(percentOf(num(x) || 0, num(y) || 0))}</span>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex flex-wrap items-end gap-2 text-sm">
              <input value={a} onChange={e => setA(e.target.value)} inputMode="decimal" className="w-24 rounded border border-border bg-background px-2 py-1 outline-none focus:border-accent" />
              <span>{t.aOfB}</span>
              <input value={b} onChange={e => setB(e.target.value)} inputMode="decimal" className="w-24 rounded border border-border bg-background px-2 py-1 outline-none focus:border-accent" />
              <span className="font-bold">= {fmt(whatPercent(num(a) || 0, num(b) || 0))}%</span>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <div className="flex flex-wrap items-end gap-2 text-sm">
              <span>{t.change}</span>
              <input value={c1} onChange={e => setC1(e.target.value)} inputMode="decimal" className="w-24 rounded border border-border bg-background px-2 py-1 outline-none focus:border-accent" />
              <span>{t.to}</span>
              <input value={c2} onChange={e => setC2(e.target.value)} inputMode="decimal" className="w-24 rounded border border-border bg-background px-2 py-1 outline-none focus:border-accent" />
              <span className="font-bold">= {fmt(percentChange(num(c1) || 0, num(c2) || 0))}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
