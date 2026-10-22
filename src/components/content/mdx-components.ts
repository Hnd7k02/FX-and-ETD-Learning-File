/**
 * Components available in every module MDX file without an import.
 * Interactive figures (islands) are imported explicitly from '@/components/figures/…'.
 */
import Num from './Num.astro';
import Fact from './Fact.astro';
import Formula from './Formula.astro';
import Desk from './Desk.astro';
import Derivation from './Derivation.astro';
import Takeaway from './Takeaway.astro';
import Figure from './Figure.astro';
import Callout from './Callout.astro';

export const mdxComponents = { Num, Fact, Formula, Desk, Derivation, Takeaway, Figure, Callout };
