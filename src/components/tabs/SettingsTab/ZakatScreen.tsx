import { useMemo, useState, type ReactNode } from 'react';
import { Coins, Gem, HandCoins, Pencil, PiggyBank, Plus, Scale, Trash2, TrendingUp, Wallet, Wheat, type LucideIcon } from 'lucide-react';
import FullScreenPage from '../../common/FullScreenPage';
import SkeletonLoader from '../../common/SkeletonLoader';
import Card from '../../common/Card';
import DateInput from '../../common/DateInput';
import { TintIcon, type Tint } from './MenuParts';
import ZakatAssetSheet from './ZakatAssetSheet';
import ZakatPaymentSheet from './ZakatPaymentSheet';
import {
  useAccountBalances,
  useAccounts,
  useDebts,
  useFunds,
  useHomeDeposits,
  useInvestments,
  useSettings,
  useZakatAssets,
  useZakatPayments,
} from '../../../hooks/useData';
import type { LiveState } from '../../../hooks/useLiveQuery';
import { updateSettings } from '../../../data/settingsRepo';
import { deleteZakatAsset, deleteZakatPayment } from '../../../data/zakatRepo';
import { settleOrPending } from '../../../lib/async';
import { calcZakat, nisabMinorFor, valueFromWeightMinor, NISAB_GOLD_GRAMS, NISAB_SILVER_GRAMS, type NisabStandard, type ZakatResult } from '../../../lib/zakatCalc';
import { daysToAnniversary } from '../../../lib/zakatDate';
import { latestBalanceByAccount, liveBasisDate } from '../../../lib/netWorthCalc';
import { toDhakaDate, formatDisplayDate } from '../../../lib/date';
import { formatTakaWhole } from '../../../lib/format';
import { minorToInput, parseAmountToMinor } from '../../../lib/money';
import type { Settings } from '../../../validation/settingsSchema';
import type { Account } from '../../../validation/accountSchema';
import type { AccountBalance } from '../../../validation/netWorthSchema';
import type { Debt } from '../../../validation/debtSchema';
import type { Investment } from '../../../validation/investmentSchema';
import type { Fund, HomeDepositEntry } from '../../../validation/homeDepositSchema';
import type { ZakatAsset, ZakatPayment } from '../../../validation/zakatSchema';

const dataOf = <T,>(q: { state: LiveState<T> }): T | null => (q.state.status === 'ready' ? q.state.data : null);

const CATEGORY_LABEL: Record<ZakatAsset['category'], string> = {
  goldJewelry: 'Gold',
  silverJewelry: 'Silver',
  agriculturalProduce: 'Crop',
  other: 'Other',
};
const CATEGORY_ICON: Record<ZakatAsset['category'], LucideIcon> = { goldJewelry: Gem, silverJewelry: Gem, agriculturalProduce: Wheat, other: Coins };
const CATEGORY_TINT: Record<ZakatAsset['category'], Tint> = { goldJewelry: 'c5', silverJewelry: 'c1', agriculturalProduce: 'c2', other: 'c6' };

function assetValueMinor(a: ZakatAsset, s: Settings): number | null {
  if (a.category === 'goldJewelry' || a.category === 'silverJewelry') {
    const price = a.category === 'goldJewelry' ? s.zakatGoldPriceMinor : s.zakatSilverPriceMinor;
    if (a.weightGrams != null && a.weightGrams > 0 && price != null && price > 0) return valueFromWeightMinor(a.weightGrams, price);
    if ((a.weightGrams == null || a.weightGrams <= 0) && a.valueMinor != null) return a.valueMinor;
    return null;
  }
  return a.valueMinor;
}

// ───────── Hero: যাকাতের অবস্থা + Nisab gauge ─────────
function Hero({ r, asOfLabel }: { r: ZakatResult; asOfLabel: string }) {
  const std = r.nisabStandard === 'gold' ? 'Gold' : 'Silver';
  const scaleMax = Math.max(r.netMinor, r.nisabMinor ?? 0, 1) * 1.15;
  const fill = Math.min(100, Math.max(0, (r.netMinor / scaleMax) * 100));
  const mark = r.nisabMinor != null ? Math.min(100, (r.nisabMinor / scaleMax) * 100) : null;
  const pill = r.status === 'due' ? 'Zakat due' : r.status === 'below_nisab' ? 'Below Nisab' : 'Price needed';
  const amount = r.status === 'needs_price' ? '—' : formatTakaWhole(r.zakatMinor);
  const sub =
    r.status === 'due'
      ? `2.5% of ${formatTakaWhole(r.netMinor)} net zakatable wealth`
      : r.status === 'below_nisab'
        ? 'Your net wealth is under the Nisab, so Zakat is not due now.'
        : `Set the ${std.toLowerCase()} price per gram below to see your Nisab.`;

  return (
    <section aria-label="Zakat summary" className="rounded-3xl bg-primary p-5 text-canvas shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span aria-hidden className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-canvas/20">
          <Scale size={20} />
        </span>
        <span className="rounded-full bg-canvas/20 px-3 py-1 text-sm font-medium">{pill}</span>
      </div>
      <p className="mt-5 text-sm text-canvas/80">Zakat al-Mal</p>
      <p className="mt-0.5 text-4xl font-semibold tabular-nums leading-tight">{amount}</p>
      <p className="mt-1 text-sm text-canvas/80">{sub}</p>

      <div className="mt-6">
        <div className="relative h-2.5 rounded-full bg-canvas/25" role="img" aria-label={r.nisabMinor != null ? `Net wealth ${formatTakaWhole(r.netMinor)} against Nisab ${formatTakaWhole(r.nisabMinor)}` : 'Nisab not set'}>
          <div className="h-full rounded-full bg-canvas/90" style={{ width: `${fill}%` }} />
          {mark !== null && <span className="absolute -top-1 h-[18px] w-1.5 rounded-full bg-primary ring-2 ring-canvas" style={{ left: `calc(${mark}% - 3px)` }} />}
        </div>
        <div className="mt-2 flex justify-between gap-3 text-xs tabular-nums text-canvas/80">
          <span>Net wealth {formatTakaWhole(Math.max(0, r.netMinor))}</span>
          <span>{r.nisabMinor != null ? `Nisab (${std}) ${formatTakaWhole(r.nisabMinor)}` : `Nisab (${std})`}</span>
        </div>
      </div>
      <p className="mt-4 text-xs text-canvas/70">{asOfLabel}</p>
    </section>
  );
}

// ───────── কোন সম্পদ কত ধরা হলো ─────────
function Line({ icon, tint, label, sub, value }: { icon: LucideIcon; tint: Tint; label: string; sub: string; value: number }) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
      <TintIcon icon={icon} tint={tint} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-fg">{label}</p>
        <p className="truncate text-xs text-muted">{sub}</p>
      </div>
      <p className={`shrink-0 font-medium tabular-nums ${value === 0 ? 'text-muted' : 'text-fg'}`}>{formatTakaWhole(value)}</p>
    </div>
  );
}

function Breakdown({ r }: { r: ZakatResult }) {
  const left = [
    r.doubtfulReceivableMinor > 0 ? `${formatTakaWhole(r.doubtfulReceivableMinor)} doubtful receivable` : '',
    r.doubtfulInvestmentMinor > 0 ? `${formatTakaWhole(r.doubtfulInvestmentMinor)} doubtful investment` : '',
  ].filter(Boolean);
  return (
    <Card className="overflow-hidden">
      <div className="divide-y divide-muted/10">
        <Line icon={Wallet} tint="c1" label="Accounts" sub="Zakatable accounts, last balance update" value={r.accountsMinor} />
        <Line icon={HandCoins} tint="c4" label="Receivable" sub="Active loans, unpaid part" value={r.receivableMinor} />
        <Line icon={TrendingUp} tint="c2" label="Investments" sub="Principal not yet returned" value={r.investmentMinor} />
        <Line icon={PiggyBank} tint="c3" label="Home deposit" sub="Zakatable funds, net" value={r.homeDepositMinor} />
        {r.jewelryMinor > 0 && <Line icon={Gem} tint="c5" label="Jewelry" sub="Weight × price per gram" value={r.jewelryMinor} />}
        {r.otherAssetsMinor > 0 && <Line icon={Coins} tint="c6" label="Other assets" sub="Added by you" value={r.otherAssetsMinor} />}
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-muted">Total</span>
          <span className="font-medium tabular-nums text-fg">{formatTakaWhole(r.grossMinor)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-muted">Less: debts I owe</span>
          <span className="font-medium tabular-nums text-expense">{r.iOweMinor > 0 ? `− ${formatTakaWhole(r.iOweMinor)}` : formatTakaWhole(0)}</span>
        </div>
        <div className="flex items-center justify-between bg-surface px-4 py-3.5">
          <span className="font-medium text-fg">Net zakatable wealth</span>
          <span className="text-lg font-semibold tabular-nums text-fg">{formatTakaWhole(r.netMinor)}</span>
        </div>
      </div>
      <p className="border-t border-muted/10 px-4 py-3 text-xs text-muted">
        GPF is not included.{left.length > 0 && ` Left out: ${left.join(', ')}.`}
      </p>
    </Card>
  );
}

// ───────── Nisab, দাম ও বার্ষিক তারিখ ─────────
function PriceCard({ uid, settings, today }: { uid: string; settings: Settings; today: string }) {
  const std: NisabStandard = settings.zakatNisabStandard ?? 'silver';
  const [silver, setSilver] = useState(settings.zakatSilverPriceMinor != null ? minorToInput(settings.zakatSilverPriceMinor) : '');
  const [gold, setGold] = useState(settings.zakatGoldPriceMinor != null ? minorToInput(settings.zakatGoldPriceMinor) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const silverMinor = silver.trim() === '' ? null : parseAmountToMinor(silver);
  const goldMinor = gold.trim() === '' ? null : parseAmountToMinor(gold);
  const invalid = (silver.trim() !== '' && silverMinor === null) || (gold.trim() !== '' && goldMinor === null);
  const dirty = silverMinor !== settings.zakatSilverPriceMinor || goldMinor !== settings.zakatGoldPriceMinor;
  const nisab = nisabMinorFor(std, { nisabStandard: std, goldPriceMinor: settings.zakatGoldPriceMinor, silverPriceMinor: settings.zakatSilverPriceMinor });
  const anniversary = settings.zakatCalculationDate != null ? daysToAnniversary(settings.zakatCalculationDate, today) : null;

  async function savePrices() {
    if (busy || invalid) return;
    setBusy(true);
    setError('');
    try {
      await settleOrPending(updateSettings(uid, { zakatSilverPriceMinor: silverMinor, zakatGoldPriceMinor: goldMinor }), 3000);
    } catch {
      setError('Could not save. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const seg = (on: boolean) => `min-h-11 flex-1 rounded-lg text-sm ${on ? 'bg-canvas font-medium text-primary shadow-sm' : 'text-muted'}`;
  const field = 'min-h-11 w-full rounded-lg border border-muted/40 bg-surface px-3 text-fg outline-none';

  return (
    <Card className="p-4">
      <div role="group" aria-label="Nisab standard" className="flex gap-1 rounded-xl bg-surface p-1">
        {(['silver', 'gold'] as const).map((k) => (
          <button key={k} type="button" aria-pressed={std === k} onClick={() => void updateSettings(uid, { zakatNisabStandard: k })} className={seg(std === k)}>
            {k === 'silver' ? `Silver · ${NISAB_SILVER_GRAMS} g` : `Gold · ${NISAB_GOLD_GRAMS} g`}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        {std === 'silver' ? 'Silver is the usual standard in Bangladesh.' : 'Gold standard selected.'} {nisab != null ? `Nisab today: ${formatTakaWhole(nisab)}.` : 'Add the price to see the Nisab.'}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="zk-silver" className="mb-1 block text-sm text-muted">
            Silver, per gram
          </label>
          <input id="zk-silver" inputMode="decimal" value={silver} onChange={(e) => setSilver(e.target.value.replace(/[^0-9.,]/g, ''))} className={field} />
        </div>
        <div>
          <label htmlFor="zk-gold" className="mb-1 block text-sm text-muted">
            Gold, per gram
          </label>
          <input id="zk-gold" inputMode="decimal" value={gold} onChange={(e) => setGold(e.target.value.replace(/[^0-9.,]/g, ''))} className={field} />
        </div>
      </div>
      {dirty && (
        <button type="button" onClick={() => void savePrices()} disabled={busy || invalid} className="mt-3 min-h-11 w-full rounded-lg bg-primary px-4 text-sm font-medium text-canvas disabled:opacity-60">
          {busy ? 'Saving…' : 'Save prices'}
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-expense">
          {error}
        </p>
      )}

      <div className="mt-4 border-t border-muted/10 pt-4">
        <label htmlFor="zk-date" className="mb-1 block text-sm text-muted">
          Zakat anniversary (reminder only)
        </label>
        <DateInput
          uid={uid}
          id="zk-date"
          value={settings.zakatCalculationDate ?? ''}
          onChange={(v) => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(v)) void updateSettings(uid, { zakatCalculationDate: v });
          }}
          variant="box"
        />
        <p className="mt-1 text-xs text-muted">
          {anniversary === null ? 'Pick the date your Zakat year completes.' : anniversary === 0 ? 'Your Zakat anniversary is today.' : `Next anniversary in ${anniversary} day${anniversary === 1 ? '' : 's'}.`}{' '}
          The app does not track Hawl — confirm your wealth stayed above Nisab for the full year.
        </p>
        {settings.zakatCalculationDate != null && (
          <button type="button" onClick={() => void updateSettings(uid, { zakatCalculationDate: null })} className="mt-1 min-h-11 text-sm text-muted underline">
            Clear date
          </button>
        )}
      </div>
    </Card>
  );
}

// ───────── ছোট সাধারণ অংশ ─────────
function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between px-1">
      <h2 className="text-sm font-medium text-fg">{title}</h2>
      {action}
    </div>
  );
}
function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-primary">
      <Plus aria-hidden size={16} />
      {label}
    </button>
  );
}

// ───────── মূল বডি (সব ডেটা লোড হওয়ার পর) ─────────
interface BodyProps {
  uid: string;
  settings: Settings;
  accounts: Account[];
  balances: AccountBalance[];
  debts: Debt[];
  investments: Investment[];
  funds: Fund[];
  deposits: HomeDepositEntry[];
  assets: ZakatAsset[];
  payments: ZakatPayment[];
}

function ZakatBody({ uid, settings, accounts, balances, debts, investments, funds, deposits, assets, payments }: BodyProps) {
  const today = toDhakaDate(new Date());
  const asOf = liveBasisDate(balances, today);
  const [assetSheet, setAssetSheet] = useState<{ editing?: ZakatAsset } | null>(null);
  const [paySheet, setPaySheet] = useState<{ editing?: ZakatPayment } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const result = useMemo(() => {
    const latest = latestBalanceByAccount(balances);
    return calcZakat({
      asOf,
      settings: { nisabStandard: settings.zakatNisabStandard, goldPriceMinor: settings.zakatGoldPriceMinor, silverPriceMinor: settings.zakatSilverPriceMinor },
      accounts: accounts.map((a) => ({ zakatable: a.zakatable, balanceMinor: latest.get(a.id) ?? 0 })),
      debts,
      investments,
      funds,
      deposits,
      assets,
    });
  }, [asOf, settings, accounts, balances, debts, investments, funds, deposits, assets]);

  const paidTotal = payments.reduce((s, p) => s + p.amountMinor, 0);
  const crops = assets.filter((a) => a.category === 'agriculturalProduce' && a.zakatable);

  async function remove(kind: 'asset' | 'payment', id: string) {
    const p = kind === 'asset' ? deleteZakatAsset(uid, id) : deleteZakatPayment(uid, id);
    await settleOrPending(p, 3000).catch(() => {});
    setConfirmId(null);
  }

  const confirmRow = (kind: 'asset' | 'payment', id: string) => (
    <div className="flex items-center gap-2 px-4 pb-3 text-sm">
      <span className="flex-1 text-muted">Delete this entry?</span>
      <button type="button" onClick={() => setConfirmId(null)} className="min-h-11 rounded-lg border border-muted/40 px-3">
        No
      </button>
      <button type="button" onClick={() => void remove(kind, id)} className="min-h-11 rounded-lg bg-expense px-3 font-medium text-canvas">
        Delete
      </button>
    </div>
  );

  return (
    <>
      <Hero r={result} asOfLabel={`Counted as of ${formatDisplayDate(asOf, settings.dateFormat)} — the date of your last balance update.`} />

      <SectionHead title="What is counted" />
      <Breakdown r={result} />

      <SectionHead title="Nisab & prices" />
      <PriceCard uid={uid} settings={settings} today={today} />

      <SectionHead title="Other assets" action={<AddButton label="Add" onClick={() => setAssetSheet({})} />} />
      <Card className="overflow-hidden">
        {assets.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted">Jewelry, crops or anything the app does not track. Add them here to include them.</p>
        ) : (
          <ul className="divide-y divide-muted/10">
            {assets.map((a) => {
              const v = assetValueMinor(a, settings);
              const detail =
                a.category === 'agriculturalProduce'
                  ? a.irrigationMethod === 'rainfed'
                    ? 'Crop · Ushr 10%'
                    : 'Crop · Ushr 5%'
                  : a.weightGrams != null
                    ? `${CATEGORY_LABEL[a.category]} · ${a.weightGrams} g`
                    : CATEGORY_LABEL[a.category];
              return (
                <li key={a.id}>
                  <div className={`flex min-h-14 items-center gap-3 px-4 py-2.5 ${a.zakatable ? '' : 'opacity-60'}`}>
                    <TintIcon icon={CATEGORY_ICON[a.category]} tint={CATEGORY_TINT[a.category]} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-fg">{a.name}</p>
                      <p className="truncate text-xs text-muted">
                        {detail}
                        {!a.zakatable && ' · Excluded'}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-medium tabular-nums text-fg">{v != null ? formatTakaWhole(v) : 'Needs price'}</p>
                    <button type="button" aria-label={`Edit ${a.name}`} onClick={() => setAssetSheet({ editing: a })} className="flex h-11 w-9 shrink-0 items-center justify-center text-muted">
                      <Pencil aria-hidden size={17} />
                    </button>
                    <button type="button" aria-label={`Delete ${a.name}`} onClick={() => setConfirmId(`a:${a.id}`)} className="flex h-11 w-9 shrink-0 items-center justify-center text-muted">
                      <Trash2 aria-hidden size={17} />
                    </button>
                  </div>
                  {confirmId === `a:${a.id}` && confirmRow('asset', a.id)}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {result.missingPriceCount > 0 && (
        <p role="status" className="mt-2 px-1 text-xs text-warning">
          {result.missingPriceCount} jewelry item{result.missingPriceCount === 1 ? '' : 's'} not counted — set the gold/silver price above.
        </p>
      )}

      {crops.length > 0 && (
        <>
          <SectionHead title="Ushr on crops" />
          <Card className="p-4">
            <p className="text-sm text-muted">Separate from Zakat al-Mal. No Nisab or Hawl applies; it is due when the crop is harvested.</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-fg">{formatTakaWhole(result.ushrMinor)}</p>
            {result.ushrMissingMethodCount > 0 && (
              <p role="status" className="mt-1 text-xs text-warning">
                {result.ushrMissingMethodCount} crop not counted — choose rain-fed or irrigated.
              </p>
            )}
          </Card>
        </>
      )}

      <SectionHead title="Payments" action={<AddButton label="Record" onClick={() => setPaySheet({})} />} />
      <Card className="overflow-hidden">
        {payments.length === 0 ? (
          <p className="px-4 py-5 text-sm text-muted">Keep a record of the Zakat you have paid. It does not change the amount above.</p>
        ) : (
          <>
            <ul className="divide-y divide-muted/10">
              {payments.map((p) => (
                <li key={p.id}>
                  <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="tabular-nums text-fg">{formatDisplayDate(p.date, settings.dateFormat)}</p>
                      {p.note && <p className="truncate text-xs text-muted">{p.note}</p>}
                    </div>
                    <p className="shrink-0 font-medium tabular-nums text-fg">{formatTakaWhole(p.amountMinor)}</p>
                    <button type="button" aria-label="Edit payment" onClick={() => setPaySheet({ editing: p })} className="flex h-11 w-9 shrink-0 items-center justify-center text-muted">
                      <Pencil aria-hidden size={17} />
                    </button>
                    <button type="button" aria-label="Delete payment" onClick={() => setConfirmId(`p:${p.id}`)} className="flex h-11 w-9 shrink-0 items-center justify-center text-muted">
                      <Trash2 aria-hidden size={17} />
                    </button>
                  </div>
                  {confirmId === `p:${p.id}` && confirmRow('payment', p.id)}
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-muted/10 bg-surface px-4 py-3 text-sm">
              <span className="text-muted">Total paid</span>
              <span className="font-semibold tabular-nums text-fg">{formatTakaWhole(paidTotal)}</span>
            </div>
          </>
        )}
      </Card>

      {assetSheet && <ZakatAssetSheet uid={uid} editing={assetSheet.editing} onClose={() => setAssetSheet(null)} />}
      {paySheet && <ZakatPaymentSheet uid={uid} editing={paySheet.editing} onClose={() => setPaySheet(null)} />}
    </>
  );
}

export default function ZakatScreen({ uid, onClose }: { uid: string; onClose: () => void }) {
  const settings = useSettings(uid);
  const accounts = useAccounts(uid);
  const balances = useAccountBalances(uid);
  const debts = useDebts(uid);
  const investments = useInvestments(uid);
  const funds = useFunds(uid);
  const deposits = useHomeDeposits(uid);
  const assets = useZakatAssets(uid);
  const payments = useZakatPayments(uid);
  const all = [settings, accounts, balances, debts, investments, funds, deposits, assets, payments];

  const s = dataOf(settings);
  const acc = dataOf(accounts);
  const bal = dataOf(balances);
  const dbt = dataOf(debts);
  const inv = dataOf(investments);
  const fnd = dataOf(funds);
  const dep = dataOf(deposits);
  const ast = dataOf(assets);
  const pay = dataOf(payments);
  const errored = all.some((q) => q.state.status === 'error');

  return (
    <FullScreenPage title="Zakat Calculator" onBack={onClose}>
      {errored ? (
        <div role="alert" className="rounded-lg bg-surface p-4 text-center">
          <p className="text-sm text-fg">Couldn’t load your data.</p>
          <button type="button" onClick={() => all.forEach((q) => q.retry())} className="mt-2 min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-canvas">
            Retry
          </button>
        </div>
      ) : s && acc && bal && dbt && inv && fnd && dep && ast && pay ? (
        <ZakatBody uid={uid} settings={s} accounts={acc} balances={bal} debts={dbt} investments={inv} funds={fnd} deposits={dep} assets={ast} payments={pay} />
      ) : (
        <SkeletonLoader />
      )}
    </FullScreenPage>
  );
}
