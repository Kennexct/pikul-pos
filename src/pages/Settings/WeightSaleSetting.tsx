import toast from 'react-hot-toast';
import { Switch } from '../../components/ui/Switch';
import { t } from '../../i18n';
import { updateStore } from '../../services/bootstrap';
import type { Store } from '../../types';
import { SettingsSection } from './SettingsSection';

/** ADR-011 switch, moved to Mode Penjualan (Kenny): how goods are sold sits next to how they are priced. Saves on tap. */
export function WeightSaleSetting({ store }: { store: Store }) {
  const toggle = async (isWeightSaleEnabled: boolean) => {
    try {
      await updateStore({ ...store, settings: { ...store.settings, isWeightSaleEnabled } });
      toast.success(isWeightSaleEnabled ? t('Satuan berat dan ukuran aktif') : t('Satuan berat dan ukuran nonaktif'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Gagal menyimpan.'));
    }
  };
  return (
    <SettingsSection title={t('Jual per berat atau ukuran')} description={t('Untuk pedagang pasar yang menjual per kilo, ons, liter, atau meter.')}>
      <Switch
        checked={store.settings.isWeightSaleEnabled === true}
        onChange={(isOn) => void toggle(isOn)}
        label={t('Aktifkan satuan berat dan ukuran')}
        description={t('Di halaman Produk muncul pilihan "Dijual per". Di kasir, berat atau nominal diketik saat menjual.')}
      />
    </SettingsSection>
  );
}
