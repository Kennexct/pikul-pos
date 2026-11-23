interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  /** "danger" paints the "on" state red (e.g. a menu marked sold out). */
  tone?: 'brand' | 'danger';
}

/** Toggle row: label + optional description on the left, switch on the right (48px row). */
export function Switch({ checked, onChange, label, description, disabled = false, tone = 'brand' }: SwitchProps) {
  return (
    <label className={`relative flex min-h-12 items-center gap-4 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-ink">{label}</span>
        {description && <span className="block text-[13px] text-muted">{description}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 ${
          checked ? (tone === 'danger' ? 'bg-danger-600' : 'bg-brand-600') : 'bg-line-strong'
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-xs transition-transform duration-200 ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
        />
      </span>
    </label>
  );
}
