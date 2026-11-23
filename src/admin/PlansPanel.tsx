import { Plus, Tags } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { EmptyState } from '../components/ui/EmptyState';
import { btnSecondary, helperText } from '../components/ui/styles';
import { t } from '../i18n';
import { savePlan, type PlanDef } from './api';
import { blankPlanDraft, byOrder, moveSort, planPayload, toPlanDraft, type PlanDraft } from './editing';
import { errorText, isAuthError } from './errors';
import { PlanCard } from './PlanCard';
import { PlanSheet } from './PlanSheet';
import { PanelHead } from './ui';

interface Props {
  plans: PlanDef[];
  onChanged: () => Promise<void>;
  onError: (e: unknown) => Promise<void>;
}
/** Which plan the sheet edits; `n` remounts the sheet so every opening starts from the saved values. */
type Open = { plan: PlanDef | null; n: number };

/** Plans (ADR-014, ADR-024): read-only cards; editing happens in a sheet with constrained fields. */
export function PlansPanel({ plans, onChanged, onError }: Props) {
  const [open, setOpen] = useState<Open | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(0);
  const list = byOrder(plans);
  const nextSort = (plans.reduce((m, p) => Math.max(m, p.sort), 0) || 0) + 10;

  const show = (plan: PlanDef | null) => {
    setCount((c) => c + 1);
    setOpen({ plan, n: count + 1 });
    setIsOpen(true);
  };
  const fail = async (e: unknown) => {
    if (isAuthError(e)) await onError(e);
    else toast.error(errorText(e));
  };
  const save = async (d: PlanDraft) => {
    const isNew = !open?.plan;
    setBusy(true);
    try {
      await savePlan(planPayload(d, isNew));
      toast.success(t('Paket "{0}" tersimpan.', d.name.trim()));
      setIsOpen(false);
      await onChanged();
    } catch (e) {
      await fail(e);
    } finally {
      setBusy(false);
    }
  };
  const move = async (i: number, by: -1 | 1) => {
    setBusy(true);
    try {
      for (const p of moveSort(plans, i, by)) await savePlan({ ...p, isNew: false });
    } catch (e) {
      await fail(e);
    } finally {
      await onChanged();
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="plans-title">
      <PanelHead
        title={t('Paket harga')}
        hint={t('Tersimpan = langsung dipakai di halaman depan (±1 menit) dan aplikasi.')}
        actions={
          <button type="button" className={btnSecondary} onClick={() => show(null)}>
            <Plus aria-hidden size={18} />
            {t('Tambah paket')}
          </button>
        }
      />
      {list.length === 0 ? (
        <EmptyState icon={Tags} title={t('Belum ada paket')} description={t('Tambah paket agar tampil di halaman depan.')} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((p, i) => (
            <PlanCard key={p.id} plan={p} isFirst={i === 0} isLast={i === list.length - 1} busy={busy} onEdit={() => show(p)} onMove={(by) => void move(i, by)} />
          ))}
        </div>
      )}
      <p className={`${helperText} mt-4`}>{t('Paket tidak dihapus agar kodenya tetap. Matikan "Dijual" untuk menyembunyikannya. Semua paket membuka semua fitur; baris fitur hanya untuk tampilan.')}</p>
      {open && (
        <PlanSheet
          key={open.n}
          isOpen={isOpen}
          isNew={!open.plan}
          start={open.plan ? toPlanDraft(open.plan) : blankPlanDraft(nextSort)}
          otherIds={plans.map((p) => p.id)}
          busy={busy}
          onClose={() => setIsOpen(false)}
          onSave={(d) => void save(d)}
        />
      )}
    </section>
  );
}
