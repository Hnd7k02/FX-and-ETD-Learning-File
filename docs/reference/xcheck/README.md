# Independent cross-checks of the calculation core

These scripts were written by a verification agent that did not write `src/lib/fx`. They use
deliberately different formulations, so agreement is meaningful.

| Script | What it checks | How to run |
|---|---|---|
| `../gk_reference.py` | Running example (forward, Garman-Kohlhagen, Greeks) | `python3 -I docs/reference/gk_reference.py` |
| `dump-exotics.ts` | Dumps TS prices for 2’960 exotic cases to JSON | `npx tsx docs/reference/xcheck/dump-exotics.ts /tmp/ts.json` |
| `exotics_xcheck.py` | Barriers via the method of images, touch via first-passage quadrature, DNT via image sum (stdlib only) | `python3 -I docs/reference/xcheck/exotics_xcheck.py /tmp/ts.json` |
| `pde_check.py` | Finite-difference PDE check of barrier and touch prices (needs numpy) | `python3 -I docs/reference/xcheck/pde_check.py` |
| `dnt_grid_check.py` | Exact daily-monitored double no-touch of module 07 (probability grid, daily Gaussian transitions, needs numpy); the reference of the Monte Carlo tests | `python3 -I docs/reference/xcheck/dnt_grid_check.py` |
| `tpf_grid_check.py` | Fair TPF / RTPF coupons without random numbers: probability mass of ln S on a grid, state = coupons paid, exact Gaussian transitions per fixing (needs numpy) | `python3 -I docs/reference/xcheck/tpf_grid_check.py` |

Result on 22.10.2026: max difference 1.8e-13 (barriers), 1.3e-14 (DNT series), 6e-13 (touch), 1.1e-16 (digital).

## Fair coupons of TPF and RTPF: grid against Monte Carlo (24.10.2026, Version 7)

Grid: step ≤ 0.0002 in ln S (second run ≤ 0.0001), cell edges exactly on ln K (TPF 0.7800) and on
ln L, ln U (RTPF 0.7720 / 0.8280), ±1.0 in ln S around the spot (lost mass ≤ 3e-16), fixing days
30, 61, …, 365, leverage 2, product ends after the sixth coupon, rd = 0. Fair coupon =
E[PV of the leveraged losses] / E[number of coupons paid]. Pips per fixing on 1 USD.

| Product | Grid, h ≤ 0.0002 | Grid, h ≤ 0.0001 | Stored MC, 4 Mio. paths, seed 20261022 | MC − grid | Stored MC of Version 6, 1 Mio. paths |
|---|---|---|---|---|---|
| TPF | 772.912 | 772.909 | 773.72 ± 0.49 | +0.81 (1.7 SE) | 775.37 ± 0.97 (+2.46, 2.5 SE) |
| RTPF | 806.858 | 806.854 | 808.15 ± 0.80 | +1.29 (1.6 SE) | 810.54 ± 1.61 (+3.68, 2.3 SE) |

Control without target (13 coupons, never reached): grid 554.684 / 697.556 pips against the closed
form of the strip 554.682 / 697.551 (differences 0.002 and 0.005 pips). The grid also gives
P(target) 0.5783 / 0.5143 and E[fixings] 9.031 / 9.722; the stored run has 0.5781 / 0.5142 and
9.032 / 9.723. Engine control by Monte Carlo (targetCoupons = 12, seed 20261022): 1 Mio. paths
555.79 ± 0.49 / 700.34 ± 1.31 pips (+2.3 / +2.1 SE against the closed form), 4 Mio. paths
555.10 ± 0.24 / 698.55 ± 0.65 pips (+1.7 / +1.5 SE): the same upward noise of this seed, no bias.

The other products of the 4 Mio. run against their independent references (exact or 16 Mio.
paths): accumulator strike 0.773980 ± 0.11 pips (reference 0.773992, −1.1 SE), decumulator
0.816949 ± 0.13 (0.816928, +1.7 SE), TARF 0.751812 ± 0.25 (0.751839, −1.1 SE), pivot TARF
half-width 0.049679 ± 0.34 (0.049658, +0.6 SE), window barrier CHF 8’609.05 ± 6.40 (8’611,
−0.3 SE), double no-touch CHF 41’846.33 ± 30.19 (41’824, +0.7 SE). On fresh paths (seed 7031989,
2 Mio.) the PV of every zero-cost product with its contractual parameters (strikes as stored,
coupons rounded to 0.1 pip) is zero within 2 standard errors (largest: decumulator +1.9 SE).

## Daily double no-touch: grid against Monte Carlo and BGK (24.10.2026, Version 7)

`dnt_grid_check.py`: step h ≤ 0.0002 / 0.0001 / 0.00005 in ln S gives CHF 41’818.23 / 41’823.01 /
41’824.21; the error is O(h²), Richardson limit CHF 41’824.6. Stored Monte Carlo (4 Mio. paths,
seed 20261022): CHF 41’846.33 ± 30.19, +0.7 standard errors. The Broadie-Glasserman-Kou shifted
closed form (CHF 41’953.09) is +0.31 % above the exact daily value; at 1 Mio. paths that gap was
hidden inside the standard error (CHF 60), at 4 Mio. paths it is 3.5 standard errors, so the unit
tests compare the Monte Carlo against the exact daily value (3 SE) and only require the BGK form to
lie within 0.5 % of it.
