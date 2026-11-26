import { LogoMark } from '../Brand/Logo';
import { t } from '../../i18n';

export function LoadingScreen({ message = t('Memuat…') }: { message?: string }) {
  return (
    <div role="status" className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-[14px] text-muted">
      <LogoMark size={36} />
      {message}
    </div>
  );
}
