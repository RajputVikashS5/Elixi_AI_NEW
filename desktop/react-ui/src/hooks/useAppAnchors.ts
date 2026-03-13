import { useEffect, useMemo, useState } from 'react';

type Anchor = {
  x: number;
  y: number;
  source: 'app-window' | 'main-window';
};

type AnchorMap = Record<string, Anchor>;

function areAnchorsEqual(a: AnchorMap, b: AnchorMap): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (!b[key]) return false;
    if (
      a[key].x !== b[key].x ||
      a[key].y !== b[key].y ||
      a[key].source !== b[key].source
    ) {
      return false;
    }
  }

  return true;
}

export function useAppAnchors(appNames: string[], preset: 'hud' | 'widget' = 'hud') {
  const [anchors, setAnchors] = useState<AnchorMap>({});
  const namesKey = appNames.map((name) => name.trim()).join('||');

  const uniqueApps = useMemo(() => {
    return [...new Set(appNames.map((name) => name.trim()).filter(Boolean))];
  }, [namesKey]);

  useEffect(() => {
    let disposed = false;

    const fallbackAnchors = () => {
      const next: AnchorMap = {};
      uniqueApps.forEach((appName, index) => {
        const baseX = Math.max(24, window.innerWidth - 440);
        const baseY = preset === 'widget'
          ? 72
          : 128 + index * 124;
        next[appName] = { x: baseX, y: baseY, source: 'main-window' };
      });
      if (!disposed) {
        setAnchors((prev) => (areAnchorsEqual(prev, next) ? prev : next));
      }
    };

    const loadAnchors = async () => {
      if (!uniqueApps.length) {
        setAnchors((prev) => (Object.keys(prev).length === 0 ? prev : {}));
        return;
      }

      if (!window.electronAPI?.getAppAnchor) {
        fallbackAnchors();
        return;
      }

      try {
        const results = await Promise.all(
          uniqueApps.map(async (appName) => {
            const data = await window.electronAPI?.getAppAnchor({ appName, preset });
            return [appName, data] as const;
          })
        );

        if (disposed) return;

        const next: AnchorMap = {};
        results.forEach(([appName, data], index) => {
          if (!data) return;
          next[appName] = {
            x: data.x,
            y: data.y + (preset === 'hud' ? index * 120 : 0),
            source: data.source,
          };
        });

        setAnchors((prev) => (areAnchorsEqual(prev, next) ? prev : next));
      } catch {
        fallbackAnchors();
      }
    };

    loadAnchors();
    const poll = window.setInterval(loadAnchors, 2200);
    const onResize = () => loadAnchors();
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      window.clearInterval(poll);
      window.removeEventListener('resize', onResize);
    };
  }, [uniqueApps, preset]);

  return anchors;
}
