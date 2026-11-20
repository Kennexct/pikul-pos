interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface TabsProps<T extends string> {
  label: string;
  items: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Underline tabs that scroll horizontally on small screens (categories, settings sections). */
export function Tabs<T extends string>({ label, items, value, onChange }: TabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className="scroll-x -mb-px flex gap-1">
      {items.map((item) => {
        const isActive = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.value)}
            className={`relative flex h-11 shrink-0 items-center gap-1.5 px-3 text-[14px] font-semibold transition-colors ${
              isActive ? 'text-brand-700' : 'text-muted hover:text-ink'
            }`}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={`num rounded px-1.5 text-[12px] ${isActive ? 'bg-brand-50 text-brand-700' : 'bg-subtle text-muted'}`}>
                {item.count}
              </span>
            )}
            <span
              aria-hidden
              className={`absolute inset-x-2 bottom-0 h-[2px] rounded-full transition-colors ${isActive ? 'bg-brand-600' : 'bg-transparent'}`}
            />
          </button>
        );
      })}
    </div>
  );
}
