import { useEffect, useState } from 'react';
import {
  ACCOUNT_CHART_EVENT,
  getAccountChart,
  type AccountChart,
} from '../utils/accountChart';

/**
 * Bagan akun per entitas untuk layar. Ikut berubah bila perangkat lain
 * menyimpan perubahan akun.
 */
export function useAccountChart(): AccountChart {
  const [chart, setChart] = useState<AccountChart>(() => getAccountChart());

  useEffect(() => {
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<AccountChart>).detail;
      setChart(detail || getAccountChart());
    };
    window.addEventListener(ACCOUNT_CHART_EVENT, onUpdated);
    setChart(getAccountChart());
    return () => window.removeEventListener(ACCOUNT_CHART_EVENT, onUpdated);
  }, []);

  return chart;
}
