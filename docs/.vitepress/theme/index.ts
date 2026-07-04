import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import { h } from 'vue';
import Wordmark from './Wordmark.vue';
import './style.css';

// Slot the #sym:tether wordmark in as the hero H1 replacement. The
// accompanying CSS hides the default `.VPHero .name` so we own the
// primary mark treatment instead of doubling up with plain text.
const theme: Theme = {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      'home-hero-info-before': () => h(Wordmark),
    }),
};

export default theme;
