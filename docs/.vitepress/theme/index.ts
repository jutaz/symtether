import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import './style.css';

// Extend the default theme with our tokens + style overrides. Slot
// injection (e.g. rendering the SVG wordmark inside the nav) can be
// added here with layout-slots when a Vue component is worth the cost;
// for now the CSS override + siteTitle in config carry the identity.
const theme: Theme = {
  extends: DefaultTheme,
};

export default theme;
