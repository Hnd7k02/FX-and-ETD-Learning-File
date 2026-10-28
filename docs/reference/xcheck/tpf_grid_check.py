"""
Independent grid computation of the fair TPF and RTPF coupons (no random numbers).

Written as a cross-check of src/data/fx/mc-products.json (Monte Carlo, src/lib/fx/mc). The
payoff rules are those of src/lib/fx/mc/payoffs.ts and products.ts, read off the code:
  TPF   per fixing S: S >= K  -> one coupon c*N;        S <  K -> pays 2*(K - S)*N
  RTPF  per fixing S: L <= S <= U -> one coupon c*N;    S <  L -> pays 2*(L - S)*N,
                                                        S >  U -> pays 2*(S - U)*N
  the product ends after the fixing that pays coupon number 6 (losses never count),
  every cash flow settles on its fixing day, discounted with e^(-rd t) (rd = 0 here).
The PV is linear in c, so the fair coupon is E[PV losses] / E[PV of the coupon count].

Method: probability mass of x = ln S on a uniform grid (step <= 0.0002) whose cell edges lie
exactly on ln K (TPF) and on ln L and ln U (RTPF); the mass of a cell sits at its centre. State
= coupons paid so far (0 ... 5); mass that pays the sixth coupon leaves the system. Per fixing
one exact Gaussian transition with drift (rd - rf - sigma^2/2) dt and variance sigma^2 dt, as a
translation-invariant kernel (np.convolve). Control: with the target out of reach (13 coupons)
the grid must give the closed form of the strip (Garman-Kohlhagen puts/calls over a digital
strip, couponWithoutTarget in src/lib/nums/m08.ts) to 0.01 pip. Needs numpy.

    python3 -I docs/reference/xcheck/tpf_grid_check.py
"""
import numpy as np
from math import log, exp, sqrt, erfc, pi

SPOT, RD, RF, VOL = 0.8, 0.0, 0.035, 0.08
DAYS = [30, 61, 91, 122, 152, 183, 213, 243, 274, 304, 335, 365]  # round(i * 365 / 12)
LEVERAGE, TARGET = 2, 6
TPF_K = 0.78                   # spot * 0.975
RTPF_L, RTPF_U = 0.772, 0.828  # spot * (1 -/+ 0.035)
PIP = 1e-4


def ncdf(u):
    return 0.5 * erfc(-u / sqrt(2.0))


def gk(S, K, T, vol, rd, rf, kind):
    d1 = (log(S / K) + (rd - rf + 0.5 * vol * vol) * T) / (vol * sqrt(T))
    d2 = d1 - vol * sqrt(T)
    if kind == 'call':
        return S * exp(-rf * T) * ncdf(d1) - K * exp(-rd * T) * ncdf(d2)
    return K * exp(-rd * T) * ncdf(-d2) - S * exp(-rf * T) * ncdf(-d1)


def digital_call(S, K, T, vol, rd, rf):
    d2 = (log(S / K) + (rd - rf - 0.5 * vol * vol) * T) / (vol * sqrt(T))
    return exp(-rd * T) * ncdf(d2)


def closed_form(kind):
    """Fair coupon of the strip without target (same formula as couponWithoutTarget)."""
    sold = digital = 0.0
    for d in DAYS:
        T = d / 365
        if kind == 'tpf':
            sold += LEVERAGE * gk(SPOT, TPF_K, T, VOL, RD, RF, 'put')
            digital += digital_call(SPOT, TPF_K, T, VOL, RD, RF)
        else:
            sold += LEVERAGE * (gk(SPOT, RTPF_L, T, VOL, RD, RF, 'put') + gk(SPOT, RTPF_U, T, VOL, RD, RF, 'call'))
            digital += digital_call(SPOT, RTPF_L, T, VOL, RD, RF) - digital_call(SPOT, RTPF_U, T, VOL, RD, RF)
    return sold / digital


def make_grid(edges, h_max, half_width):
    """Uniform grid of cell edges with step <= h_max, passing exactly through `edges`
    (one or two log levels), covering ln(spot) +/- half_width. Returns (edges, centres, h)."""
    x0 = log(SPOT)
    if len(edges) == 2:
        m = int(np.ceil((edges[1] - edges[0]) / h_max))
        h = (edges[1] - edges[0]) / m
    else:
        h = h_max
    anchor = edges[0]
    j_lo = int(np.floor((x0 - half_width - anchor) / h))
    j_hi = int(np.ceil((x0 + half_width - anchor) / h))
    e = anchor + h * np.arange(j_lo, j_hi + 1)
    return e, 0.5 * (e[:-1] + e[1:]), h


def kernel(h, dt, n_sd=9.0):
    """P(move by d cells) for d = -D ... D: exact Gaussian mass of the target cell seen from the
    source cell centre, drift (rd - rf - vol^2/2) dt, standard deviation vol sqrt(dt)."""
    mu = (RD - RF - 0.5 * VOL * VOL) * dt
    s = VOL * sqrt(dt)
    D = int(np.ceil((n_sd * s + abs(mu)) / h))
    d = np.arange(-D, D + 1)
    upper = ((d + 0.5) * h - mu) / s
    lower = ((d - 0.5) * h - mu) / s
    cdf = np.vectorize(ncdf)
    return cdf(upper) - cdf(lower)


def edge_index(edges, x):
    j = int(np.argmin(np.abs(edges - x)))
    assert abs(edges[j] - x) < 1e-12, 'level is not on a cell edge'
    return j


def grid_coupon(kind, h_max=0.0002, half_width=1.0, target=TARGET):
    """Returns (fair coupon per 1 USD, E[PV losses], E[PV coupon count], P(target), E[fixings],
    lost mass) on the grid. target = 13 switches the target off (12 fixings)."""
    if kind == 'tpf':
        levels = [log(TPF_K)]
    else:
        levels = [log(RTPF_L), log(RTPF_U)]
    edges, centres, h = make_grid(levels, h_max, half_width)
    S = np.exp(centres)
    n = len(centres)
    if kind == 'tpf':
        k = edge_index(edges, levels[0])
        coupon_zone = np.zeros(n, bool)
        coupon_zone[k:] = True            # S >= K (edge exactly at K)
        loss = LEVERAGE * np.where(coupon_zone, 0.0, TPF_K - S)
    else:
        kl, ku = edge_index(edges, levels[0]), edge_index(edges, levels[1])
        coupon_zone = np.zeros(n, bool)
        coupon_zone[kl:ku] = True         # L <= S <= U (both edges exact)
        loss = LEVERAGE * np.where(S < RTPF_L, RTPF_L - S, np.where(S > RTPF_U, S - RTPF_U, 0.0))
    # start: all mass in the cell that contains ln(spot); the first transition is exact from
    # the true start point, so shift the first kernel's drift by (x0 - centre) instead.
    x0 = log(SPOT)
    j0 = int(np.searchsorted(edges, x0) - 1)
    offset = x0 - centres[j0]
    states = [np.zeros(n) for _ in range(target)]
    states[0][j0] = 1.0
    e_loss = e_count = e_fix = p_target = 0.0
    kernels = {}
    prev = 0
    for i, day in enumerate(DAYS):
        dt = (day - prev) / 365
        prev = day
        df = exp(-RD * day / 365)
        key = (dt, i == 0)
        if key not in kernels:
            kern = kernel(h, dt)
            if i == 0 and offset != 0.0:
                # exact start point: kernel from x0 instead of the cell centre
                mu = (RD - RF - 0.5 * VOL * VOL) * dt + offset
                s = VOL * sqrt(dt)
                D = (len(kern) - 1) // 2
                d = np.arange(-D, D + 1)
                cdf = np.vectorize(ncdf)
                kern = cdf(((d + 0.5) * h - mu) / s) - cdf(((d - 0.5) * h - mu) / s)
            kernels[key] = kern
        kern = kernels[key]
        alive_before = sum(float(m.sum()) for m in states)
        new_states = [np.zeros(n) for _ in range(target)]
        ended_now = 0.0
        for c in range(target):
            m = states[c]
            if not m.any():
                continue
            m = np.convolve(m, kern, mode='same')
            e_loss += df * float((m * loss).sum())
            paid = m * coupon_zone
            e_count += df * float(paid.sum())
            new_states[c] += m * ~coupon_zone
            if c + 1 < target:
                new_states[c + 1] += paid
            else:
                ended_now += float(paid.sum())     # sixth coupon: product ends
        states = new_states
        p_target += ended_now
        # paths ending at this fixing (target), or at the last fixing whatever happens
        e_fix += (i + 1) * (ended_now if i + 1 < len(DAYS) else alive_before)
    lost = 1.0 - p_target - sum(float(m.sum()) for m in states)
    return e_loss / e_count, e_loss, e_count, p_target, e_fix, lost


if __name__ == '__main__':
    print('grid check of the fair TPF / RTPF coupons (pips per fixing, per 1 USD notional)')
    print('spot %.4f rd %.3f rf %.3f vol %.2f, fixing days %s' % (SPOT, RD, RF, VOL, DAYS))
    for kind in ('tpf', 'rtpf'):
        cf = closed_form(kind) / PIP
        ctrl = grid_coupon(kind, target=13)[0] / PIP
        print('%-4s control without target: grid %.4f  closed form %.4f  diff %+.4f pips %s'
              % (kind.upper(), ctrl, cf, ctrl - cf, 'OK' if abs(ctrl - cf) <= 0.01 else 'FAIL'))
        for h_max in (0.0002, 0.0001):
            c, el, ec, pt, ef, lost = grid_coupon(kind, h_max=h_max)
            print('%-4s target 6, h <= %.4f: fair coupon %.3f pips  (E[PV losses] %.6f, '
                  'E[coupons] %.6f, P(target) %.4f, E[fixings] %.3f, lost mass %.1e)'
                  % (kind.upper(), h_max, c / PIP, el, ec, pt, ef, lost))
