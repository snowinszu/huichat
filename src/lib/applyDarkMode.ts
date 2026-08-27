const THEME_ATTR = 'data-theme';

/**
 * Toggles `data-theme="dark"` on <html>, which `tokens.css`'s
 * `:root[data-theme='dark']` block hooks into. A direct DOM mutation
 * (not React state) so it applies instantly and globally regardless of
 * which screen is currently mounted — this app renders exactly one screen
 * at a time, so "the whole app re-themes immediately" only works if the
 * theme lives outside any single screen's component tree.
 */
export function applyDarkModeAttribute(dark: boolean): void {
  if (dark) {
    document.documentElement.setAttribute(THEME_ATTR, 'dark');
  } else {
    document.documentElement.removeAttribute(THEME_ATTR);
  }
}
