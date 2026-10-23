import { defineDict } from '../types';

/**
 * Building blocks of structured products (StructureBlocks island, module 08). Numbers are
 * placeholders filled from src/lib/structures.ts and formatted with src/lib/format.ts.
 */
export const structureblocks = defineDict({
  de: {
    'sb.title': 'Wie ein besserer Kurs entsteht',
    'sb.titleBlocks': 'Bausteine: {product}',
    'sb.sub': 'Auszahlung eines Fixings · N = {n} · {label}',
    'sb.products': 'Produkt',
    'sb.p.accumulator': 'Accumulator',
    'sb.p.decumulator': 'Decumulator',
    'sb.p.tarf': 'TARF',
    'sb.p.pivotTarf': 'Pivot TARF',
    'sb.p.tpf': 'TPF',
    'sb.p.rtpf': 'RTPF',
    'sb.steps': 'Schritte',
    'sb.step.forward': 'Forward',
    'sb.step.leveraged': 'Doppelte Menge',
    'sb.step.full.ko': 'Knock-out',
    'sb.step.full.target': 'Target',
    'sb.play': 'Abspielen',
    'sb.pause': 'Pause',
    'sb.blocks': 'Bausteine zeigen',
    'sb.text.forward.buy':
      'Ein Forward: Du kaufst {n} zu {f}. Gewinn und Verlust sind gleich gross, es gibt keine Prämie. In Bausteinen: ein gekaufter Call und ein verkaufter Put zum selben Strike.',
    'sb.text.forward.sell':
      'Ein Forward: Du verkaufst {n} zu {f}. Gewinn und Verlust sind gleich gross, es gibt keine Prämie. In Bausteinen: ein gekaufter Put und ein verkaufter Call zum selben Strike.',
    'sb.text.leveraged.buy':
      'Du verkaufst einen zweiten Put. Seine Prämie bezahlt einen besseren Strike: {k}, {d} Pips unter dem Forward. Dafür kaufst du unter dem Strike die doppelte Menge.',
    'sb.text.leveraged.sell':
      'Du verkaufst einen zweiten Call. Seine Prämie bezahlt einen besseren Strike: {k}, {d} Pips über dem Forward. Dafür verkaufst du über dem Strike die doppelte Menge.',
    'sb.text.full.ko':
      'Dazu ein Knock-out bei {b}: Erreicht der Kurs die Barriere, endet alles. Du verzichtest auf die besten Szenarien, der Strike wird nochmals besser: {k} (Monte Carlo, ± {se} Pips).',
    'sb.text.full.target':
      'Dazu ein Target von {target} Pips: Sind die Gewinne so gross, endet alles. Der Gewinn ist begrenzt, der Verlust nicht. Der Strike wird nochmals besser: {k} (Monte Carlo, ± {se} Pips).',
    'sb.text.pivotTarf':
      'Gekaufter Call {k1}, zwei verkaufte Calls zum Pivot {p}, ein verkaufter Call {k2} und zwei verkaufte Puts {k1}. Zwischen den Strikes ein Zelt aus Gewinnen, oben gekappt beim Target von {target} Pips. Ausserhalb doppelte Verluste.',
    'sb.text.tpf':
      'Ein gekaufter Digital-Call zahlt den Coupon von {c} Pips, solange das Fixing auf oder über {k} liegt. Bezahlt wird er mit zwei verkauften Puts zum selben Strike: darunter doppelte Verluste.',
    'sb.text.rtpf':
      'Ein gekauftes Range-Digital zahlt den Coupon von {c} Pips in der Range {l} bis {u}. Bezahlt wird es mit zwei verkauften Puts zu {l} und zwei verkauften Calls zu {u}: ausserhalb doppelte Verluste.',
    'sb.ladder': 'Strike im Vergleich',
    'sb.ladder.forward': 'Forward',
    'sb.ladder.leveraged': '+ 2. Option',
    'sb.ladder.full.ko': '+ Knock-out',
    'sb.ladder.full.target': '+ Target',
    'sb.y': 'G&V eines Fixings in CHF',
    'sb.x': '{pair} beim Fixing',
    'sb.lg.product': 'Produkt (Summe)',
    'sb.lg.forward': 'Forward',
    'sb.lg.bought': 'gekaufte Option',
    'sb.lg.sold': 'verkaufte Option',
    'sb.b.longCall': 'Call gekauft',
    'sb.b.shortCall': 'Call verkauft',
    'sb.b.longPut': 'Put gekauft',
    'sb.b.shortPut': 'Put verkauft',
    'sb.b.longDigitalCall': 'Digital-Call gekauft',
    'sb.b.longRangeDigital': 'Range-Digital gekauft',
    'sb.ratio': '{r} × {name}',
    'sb.pipsDiff': '{v} Pips',
    'sb.ko': 'Knock-out: alles endet',
    'sb.koShort': 'Knock-out',
    'sb.targetLine': 'Target: Gewinn gekappt',
    'sb.fixing': 'Fixing',
    'sb.readout': 'Fixing {s}: Forward {f}, {product} {p}.',
    'sb.readoutNoFwd': 'Fixing {s}: {product} {p}.',
    'sb.readoutKo': 'Fixing {s}: Knock-out, der {product} endet ohne Zahlung.',
    'sb.dragHint': 'Zieh das Fixing entlang der Achse',
    'sb.aria':
      'Auszahlung eines Fixings in CHF für {product}, Schritt {step}: Strike {k}. Bei {s}: {p}.',
  },
  en: {
    'sb.title': 'How a better rate is built',
    'sb.titleBlocks': 'Building blocks: {product}',
    'sb.sub': 'Payoff of one fixing · N = {n} · {label}',
    'sb.products': 'Product',
    'sb.p.accumulator': 'Accumulator',
    'sb.p.decumulator': 'Decumulator',
    'sb.p.tarf': 'TARF',
    'sb.p.pivotTarf': 'Pivot TARF',
    'sb.p.tpf': 'TPF',
    'sb.p.rtpf': 'RTPF',
    'sb.steps': 'Steps',
    'sb.step.forward': 'Forward',
    'sb.step.leveraged': 'Double amount',
    'sb.step.full.ko': 'Knock-out',
    'sb.step.full.target': 'Target',
    'sb.play': 'Play',
    'sb.pause': 'Pause',
    'sb.blocks': 'Show building blocks',
    'sb.text.forward.buy':
      'A forward: you buy {n} at {f}. Gain and loss are equally large and there is no premium. In building blocks: a bought call and a sold put at the same strike.',
    'sb.text.forward.sell':
      'A forward: you sell {n} at {f}. Gain and loss are equally large and there is no premium. In building blocks: a bought put and a sold call at the same strike.',
    'sb.text.leveraged.buy':
      'You sell a second put. Its premium pays for a better strike: {k}, {d} pips below the forward. In return you buy twice the amount below the strike.',
    'sb.text.leveraged.sell':
      'You sell a second call. Its premium pays for a better strike: {k}, {d} pips above the forward. In return you sell twice the amount above the strike.',
    'sb.text.full.ko':
      'Add a knock-out at {b}: if the rate reaches the barrier, everything ends. You give up the best scenarios and the strike improves again: {k} (Monte Carlo, ± {se} pips).',
    'sb.text.full.target':
      'Add a target of {target} pips: once the gains are that large, everything ends. The gain is capped, the loss is not. The strike improves again: {k} (Monte Carlo, ± {se} pips).',
    'sb.text.pivotTarf':
      'A bought call at {k1}, two sold calls at the pivot {p}, a sold call at {k2} and two sold puts at {k1}. Between the strikes a tent of gains, capped at the target of {target} pips. Outside, double losses.',
    'sb.text.tpf':
      'A bought digital call pays the coupon of {c} pips as long as the fixing is at or above {k}. It is paid for with two sold puts at the same strike: below it, double losses.',
    'sb.text.rtpf':
      'A bought range digital pays the coupon of {c} pips in the range {l} to {u}. It is paid for with two sold puts at {l} and two sold calls at {u}: outside, double losses.',
    'sb.ladder': 'Strike compared',
    'sb.ladder.forward': 'Forward',
    'sb.ladder.leveraged': '+ 2nd option',
    'sb.ladder.full.ko': '+ knock-out',
    'sb.ladder.full.target': '+ target',
    'sb.y': 'P&L of one fixing in CHF',
    'sb.x': '{pair} at the fixing',
    'sb.lg.product': 'Product (sum)',
    'sb.lg.forward': 'Forward',
    'sb.lg.bought': 'bought option',
    'sb.lg.sold': 'sold option',
    'sb.b.longCall': 'call bought',
    'sb.b.shortCall': 'call sold',
    'sb.b.longPut': 'put bought',
    'sb.b.shortPut': 'put sold',
    'sb.b.longDigitalCall': 'digital call bought',
    'sb.b.longRangeDigital': 'range digital bought',
    'sb.ratio': '{r} × {name}',
    'sb.pipsDiff': '{v} pips',
    'sb.ko': 'Knock-out: everything ends',
    'sb.koShort': 'Knock-out',
    'sb.targetLine': 'Target: gain capped',
    'sb.fixing': 'Fixing',
    'sb.readout': 'Fixing {s}: forward {f}, {product} {p}.',
    'sb.readoutNoFwd': 'Fixing {s}: {product} {p}.',
    'sb.readoutKo': 'Fixing {s}: knock-out, the {product} ends without payment.',
    'sb.dragHint': 'Drag the fixing along the axis',
    'sb.aria': 'Payoff of one fixing in CHF for {product}, step {step}: strike {k}. At {s}: {p}.',
  },
});
