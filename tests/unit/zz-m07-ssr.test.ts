import { it } from 'vitest';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import BarrierPaths from '@/components/islands/BarrierPaths';
import BarrierLab from '@/components/islands/BarrierLab';
import TouchLab from '@/components/islands/TouchLab';
it('ssr', () => {
  for (const [n, c, p] of [['bp', BarrierPaths, {}], ['bl', BarrierLab, {}], ['tl', TouchLab, { mc: { pv: 1, stdErr: 1, bgk: 1, lower: 0.768, upper: 0.832, vol: 0.08 } }]] as const) {
    try {
      console.log(n, renderToString(h(c as never, { lang: 'en', ...p })).length);
    } catch (e) {
      console.log('ERR', n, (e as Error).stack?.split('\n').slice(0, 3).join(' | '));
    }
  }
});
