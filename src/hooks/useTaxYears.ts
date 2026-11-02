/**
 * Coded by Langgo Bramandityo.
 * Daftar tahun pajak aktif, ikut berubah saat perangkat lain menyetel ulang tahunnya.
 */
import { useEffect, useState } from 'react';
import { getTaxYears, TAX_YEARS_EVENT } from '../utils/taxYears';

export function useTaxYears(): number[] {
  const [years, setYears] = useState<number[]>(() => getTaxYears());

  useEffect(() => {
    const onYearsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<number[]>).detail;
      setYears(Array.isArray(detail) && detail.length > 0 ? detail : getTaxYears());
    };
    window.addEventListener(TAX_YEARS_EVENT, onYearsUpdated);
    setYears(getTaxYears());
    return () => window.removeEventListener(TAX_YEARS_EVENT, onYearsUpdated);
  }, []);

  return years;
}
