import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts';
import { card } from '../../components/ui/styles';
import { formatRupiah } from '../../lib/money';
import { niceTicks } from '../../lib/niceTicks';
import { DATE_LOCALE, t } from '../../i18n';

export interface BarDatum {
  label: string;
  /** Long label for the tooltip (e.g. "11.00–11.59", "Senin, 17 Nov"). */
  detail: string;
  value: number;
  /** Transactions behind the value; left out when the bar is itself a count. */
  count?: number;
  /** The value is a plain count (sign-ups), not Rupiah. */
  isCount?: boolean;
}

interface BarChartCardProps {
  title: string;
  subtitle?: string;
  data: BarDatum[];
  /** Accessible summary: charts are images to screen readers. */
  summary: string;
}

/* dataviz spec: single series = one brand hue, no legend; bars ≤ 24px with 4px rounded data-end;
   hairline solid grid; text in text tokens; hover tooltip. Tokens mirrored from index.css. */
const BRAND = '#0b7a5a';
const GRID = '#e2e7e4';
const MUTED = '#5e6a65';
const compact = new Intl.NumberFormat(DATE_LOCALE, { notation: 'compact', maximumFractionDigits: 1 });

function ChartTooltip({ active, payload }: Pick<TooltipContentProps, 'active' | 'payload'>) {
  const datum = payload?.[0]?.payload as BarDatum | undefined;
  if (!active || !datum) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] shadow-pop">
      <p className="font-semibold text-ink">{datum.detail}</p>
      <p className="num text-ink-soft">{datum.isCount ? compact.format(datum.value) : formatRupiah(datum.value)}</p>
      {datum.count !== undefined && <p className="num text-muted">{t('{0} transaksi', datum.count)}</p>}
    </div>
  );
}

export function BarChartCard({ title, subtitle, data, summary }: BarChartCardProps) {
  const ticks = niceTicks(Math.max(0, ...data.map((d) => d.value)));
  return (
    <section className={`${card} p-4 md:p-5`}>
      <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
      <p className="mb-3 min-h-[1px] text-[13px] text-muted">{subtitle}</p>
      <div role="img" aria-label={summary} className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: MUTED, fontSize: 12 }} interval="preserveStartEnd" minTickGap={8} />
            <YAxis width={44} tickLine={false} axisLine={false} tick={{ fill: MUTED, fontSize: 12 }} tickFormatter={(v: number) => compact.format(v)} allowDecimals={false} ticks={ticks} domain={[0, ticks[ticks.length - 1] ?? 1]} />
            <Tooltip cursor={{ fill: 'rgb(20 32 27 / 0.05)' }} content={(props) => <ChartTooltip active={props.active} payload={props.payload} />} />
            <Bar dataKey="value" fill={BRAND} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
