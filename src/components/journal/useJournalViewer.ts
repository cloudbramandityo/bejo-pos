import { useCallback, useEffect, useRef, useState } from 'react';

export function useJournalViewer() {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false);
  const refreshTimer = useRef<number | null>(null);
  const isFullscreen = nativeFullscreen || fallbackFullscreen;

  const handleRefresh = useCallback(() => {
    setIframeKey((key) => key + 1);
    setRefreshing(true);
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => setRefreshing(false), 900);
  }, []);

  const handleFullscreen = useCallback(() => {
    const shell = shellRef.current;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (fallbackFullscreen) {
      setFallbackFullscreen(false);
      return;
    }
    if (shell && typeof shell.requestFullscreen === 'function') {
      void shell.requestFullscreen().catch(() => setFallbackFullscreen(true));
      return;
    }
    setFallbackFullscreen(true);
  }, [fallbackFullscreen]);

  useEffect(() => {
    const onChange = () => setNativeFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (!fallbackFullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [fallbackFullscreen]);

  useEffect(() => {
    if (!fallbackFullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFallbackFullscreen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fallbackFullscreen]);

  useEffect(
    () => () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    },
    []
  );

  return {
    shellRef,
    iframeKey,
    refreshing,
    isFullscreen,
    fallbackFullscreen,
    setFallbackFullscreen,
    handleRefresh,
    handleFullscreen,
  };
}
