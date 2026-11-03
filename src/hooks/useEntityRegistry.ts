import { useEffect, useState } from 'react';
import {
  ENTITY_REGISTRY_EVENT,
  getEntityRegistry,
  type EntityRegistry,
} from '../utils/entityRegistry';

/**
 * Profil entitas usaha untuk layar. Berubah sendiri bila perangkat lain
 * menyimpan perubahan entitas.
 */
export function useEntityRegistry(): EntityRegistry {
  const [registry, setRegistry] = useState<EntityRegistry>(() => getEntityRegistry());

  useEffect(() => {
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<EntityRegistry>).detail;
      setRegistry(detail || getEntityRegistry());
    };
    window.addEventListener(ENTITY_REGISTRY_EVENT, onUpdated);
    setRegistry(getEntityRegistry());
    return () => window.removeEventListener(ENTITY_REGISTRY_EVENT, onUpdated);
  }, []);

  return registry;
}
