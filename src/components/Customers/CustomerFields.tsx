import { helperText, inputBase, labelBase } from '../ui/styles';
import { t } from '../../i18n';

export interface CustomerDraft {
  name: string;
  phone: string;
  email: string;
  note: string;
}

interface CustomerFieldsProps {
  idPrefix: string;
  value: CustomerDraft;
  onChange: (patch: Partial<CustomerDraft>) => void;
  hasNote?: boolean;
  hasEmail?: boolean;
  autoFocusName?: boolean;
}

/** Name / phone / email / note fields shared by the customer form and the POS quick-add. */
export function CustomerFields({ idPrefix, value, onChange, hasNote = true, hasEmail = true, autoFocusName = false }: CustomerFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor={`${idPrefix}-name`} className={labelBase}>{t('Nama')}</label>
        <input id={`${idPrefix}-name`} autoFocus={autoFocusName} value={value.name} maxLength={80} autoComplete="off" placeholder={t('Contoh: Bu Sari')} onChange={(e) => onChange({ name: e.target.value })} className={inputBase} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-phone`} className={labelBase}>
          {t('No. HP / WhatsApp')} <span className="font-normal text-muted">{t('(opsional)')}</span>
        </label>
        <input id={`${idPrefix}-phone`} type="tel" inputMode="tel" value={value.phone} autoComplete="off" placeholder="0812-3456-7890" onChange={(e) => onChange({ phone: e.target.value })} className={`${inputBase} num`} />
        <p className={helperText}>{t('Dipakai untuk mengirim struk lewat WhatsApp.')}</p>
      </div>
      {hasEmail && (
        <div>
          <label htmlFor={`${idPrefix}-email`} className={labelBase}>
            {t('Email')} <span className="font-normal text-muted">{t('(opsional)')}</span>
          </label>
          <input id={`${idPrefix}-email`} type="email" inputMode="email" value={value.email} maxLength={254} autoComplete="off" placeholder="nama@email.com" onChange={(e) => onChange({ email: e.target.value })} className={inputBase} />
        </div>
      )}
      {hasNote && (
        <div>
          <label htmlFor={`${idPrefix}-note`} className={labelBase}>
            {t('Catatan')} <span className="font-normal text-muted">{t('(opsional)')}</span>
          </label>
          <input id={`${idPrefix}-note`} value={value.note} maxLength={200} placeholder={t('Contoh: tidak pedas, langganan Jumat')} onChange={(e) => onChange({ note: e.target.value })} className={inputBase} />
        </div>
      )}
    </div>
  );
}
