# Independent cross-checks of the calculation core

These scripts were written by a verification agent that did not write `src/lib/fx`. They use
deliberately different formulations, so agreement is meaningful.

| Script | What it checks | How to run |
|---|---|---|
| `../gk_reference.py` | Running example (forward, Garman-Kohlhagen, Greeks) | `python3 -I docs/reference/gk_reference.py` |
| `dump-exotics.ts` | Dumps TS prices for 2’960 exotic cases to JSON | `npx tsx docs/reference/xcheck/dump-exotics.ts /tmp/ts.json` |
| `exotics_xcheck.py` | Barriers via the method of images, touch via first-passage quadrature, DNT via image sum (stdlib only) | `python3 -I docs/reference/xcheck/exotics_xcheck.py /tmp/ts.json` |
| `pde_check.py` | Finite-difference PDE check of barrier and touch prices (needs numpy) | `python3 -I docs/reference/xcheck/pde_check.py` |

Result on 22.10.2026: max difference 1.8e-13 (barriers), 1.3e-14 (DNT series), 6e-13 (touch), 1.1e-16 (digital).
