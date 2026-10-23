import { test } from 'vitest';
import { nums, M06 } from '@/lib/nums/m06';
import { formatNum } from '@/lib/nums/format';
test('dump', () => {
  for (const [k, d] of Object.entries(nums)) {
    console.log(k.padEnd(28), String(d.value).padEnd(24), formatNum(d, 'de'), '|', formatNum(d, 'en'));
  }
  console.log(JSON.stringify(M06, null, 1));
});
