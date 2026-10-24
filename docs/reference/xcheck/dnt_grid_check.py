"""
Exact value of the daily-monitored double no-touch of module 07 (no random numbers).

Written as a cross-check of the Monte Carlo value in src/data/fx/mc-products.json
(products.doubleNoTouch, daily fixings) and of the Broadie-Glasserman-Kou shifted closed form
stored next to it (compare.continuousBgk). Contract as in src/lib/fx/mc/products.ts: payout
CHF 100'000 on day 91 if every daily fixing S_1 ... S_91 stays strictly inside (L, U) with
L = 0.768 and U = 0.832 (spot 0.8, rd = 0, rf = 3.5 %, sigma = 8 %).

Method (as in tpf_grid_check.py): probability mass of x = ln S on a uniform grid between ln L
and ln U, one exact Gaussian transition per day with drift (rd - rf - sigma^2/2) dt and variance
sigma^2 dt as a translation-invariant kernel (np.convolve); mass that leaves (L, U) after a step
is knocked out and never comes back. The first step starts from the exact point ln(spot). The
error is O(h^2) in the grid step, so the three steps below give a Richardson limit. Needs numpy.

    python3 -I docs/reference/xcheck/dnt_grid_check.py
"""
import numpy as np
from math import log, exp, sqrt, erfc

SPOT, RD, RF, VOL = 0.8, 0.0, 0.035, 0.08
L, U, DAYS, PAYOUT = 0.768, 0.832, 91, 100000.0


def ncdf(u):
    return 0.5 * erfc(-u / sqrt(2.0))


def dnt_daily(h_max):
    """PV of the daily-monitored DNT with a grid step <= h_max in ln S."""
    xl, xu = log(L), log(U)
    m = int(np.ceil((xu - xl) / h_max))
    h = (xu - xl) / m
    edges = xl + h * np.arange(m + 1)
    dt = 1 / 365
    mu = (RD - RF - 0.5 * VOL * VOL) * dt
    s = VOL * sqrt(dt)
    reach = int(np.ceil((9 * s + abs(mu)) / h))
    d = np.arange(-reach, reach + 1)
    cdf = np.vectorize(ncdf)
    kern = cdf(((d + 0.5) * h - mu) / s) - cdf(((d - 0.5) * h - mu) / s)
    x0 = log(SPOT)
    mass = cdf((edges[1:] - x0 - mu) / s) - cdf((edges[:-1] - x0 - mu) / s)  # day 1
    for _ in range(DAYS - 1):
        mass = np.convolve(mass, kern, mode='same')  # outside (L, U) is dropped: knocked out
    return PAYOUT * exp(-RD * DAYS / 365) * mass.sum()


if __name__ == '__main__':
    steps = (0.0002, 0.0001, 0.00005)
    values = [dnt_daily(h) for h in steps]
    for h, v in zip(steps, values):
        print('h <= %.5f  DNT daily = %.2f CHF' % (h, v))
    # O(h^2): limit = v(h/2) + (v(h/2) - v(h)) / 3
    limit = values[-1] + (values[-1] - values[-2]) / 3
    print('Richardson limit   = %.2f CHF' % limit)
