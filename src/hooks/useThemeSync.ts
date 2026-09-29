import { useEffect } from 'react';
import { applyTheme } from '../theme/applyTheme';
import { useSettings } from './useData';

/** settings.displayMode/themeColor বদলালেই (এই বা অন্য ডিভাইসে) theme প্রয়োগ */
export function useThemeSync(uid: string): void {
  const s = useSettings(uid);
  const mode = s.state.status === 'ready' ? s.state.data.displayMode : null;
  const accent = s.state.status === 'ready' ? s.state.data.themeColor : null;
  useEffect(() => {
    if (mode && accent) applyTheme(mode, accent);
  }, [mode, accent]);
}
