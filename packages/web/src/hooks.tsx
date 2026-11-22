import { DEFAULT_CARD_STYLE, type CardStyle } from '@shadow-court/protocol';
import { createContext, useContext, useId, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { AppController, AppState } from './controller';
import { makeT, type TFn } from './i18n';

const AppContext = createContext<AppController | null>(null);

export function AppProvider({ app, children }: { app: AppController; children: ReactNode }) {
  return <AppContext.Provider value={app}>{children}</AppContext.Provider>;
}

export function useController(): AppController {
  const app = useContext(AppContext);
  if (!app) throw new Error('AppProvider is missing');
  return app;
}

/** Subscribes to a slice of the state. The selector must return a stable value (no fresh objects). */
export function useApp<T>(selector: (state: AppState) => T): T {
  const { store } = useController();
  return useSyncExternalStore(store.subscribe, () => selector(store.get()));
}

export function useT(): TFn {
  const lang = useApp((s) => s.lang);
  return useMemo(() => makeT(lang), [lang]);
}

/** Card design chosen for the current room (the default one outside a room). */
export function useCardStyle(): CardStyle {
  return useApp((s) => s.room?.settings.cardStyle ?? DEFAULT_CARD_STYLE);
}

/** A per-instance id that is safe inside SVG `url(#...)` references. */
export function useSvgId(): string {
  return `s${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}
