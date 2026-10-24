"""Independent cross-check of the TS exotics (stdlib only).

Different formulations from the TS code on purpose:
- Single barriers: method of images on the restricted European payoff,
  V_out(S) = V0(S) - (H/S)^(2 nu / sigma^2) * V0(H^2/S), nu = rd - rf - sigma^2/2,
  V0 = European with the payoff cut to the alive side, written with vanillas and cash digitals.
  Knock-in = vanilla - knock-out. Rebates: knock-in at expiry = no-touch (images),
  knock-out at hit = quadrature of the first-passage density (log-time Simpson).
- One-touch at hit: same quadrature; at expiry: e^(-rd T) - no-touch.
- Double no-touch: image sum (Kunitomo-Ikeda style) in log space with a Girsanov factor,
  NOT Hui's sine series.
- Cash digital: closed form with erfc, plus a quadrature over the lognormal density.

Usage: python3 -I xcheck.py ts.json
"""
import json
import math
import sys

SQ2 = math.sqrt(2.0)
LOG_SQRT_2PI = 0.5 * math.log(2 * math.pi)


def N(x):
    return 0.5 * math.erfc(-x / SQ2)


def logN(x):
    if x > -30:
        return math.log(N(x))
    r = 1 / (x * x)
    series = 1 - r * (1 - r * (3 - r * (15 - r * 105)))
    return -0.5 * x * x - math.log(-x) - LOG_SQRT_2PI + math.log(series)


def log_ndiff(a, b):
    """log(N(b) - N(a)) for a < b, robust in both tails."""
    if b <= a:
        return -math.inf
    if b <= 0:
        la, lb = logN(a), logN(b)
        return lb + math.log1p(-math.exp(la - lb))
    if a >= 0:
        qa, qb = logN(-a), logN(-b)
        return qa + math.log1p(-math.exp(qb - qa))
    return math.log(N(b) - N(a))


def gk(S, K, T, v, rd, rf, call):
    F = S * math.exp((rd - rf) * T)
    sd = v * math.sqrt(T)
    d1 = (math.log(F / K) + 0.5 * sd * sd) / sd
    d2 = d1 - sd
    df = math.exp(-rd * T)
    if call:
        return df * (F * N(d1) - K * N(d2))
    return df * (K * N(-d2) - F * N(-d1))


def dig(S, K, T, v, rd, rf, call):
    F = S * math.exp((rd - rf) * T)
    sd = v * math.sqrt(T)
    d2 = (math.log(F / K) - 0.5 * sd * sd) / sd
    return math.exp(-rd * T) * N(d2 if call else -d2)


def dig_quad(S, K, T, v, rd, rf, call, n=4000):
    """Cash digital by integrating the normal density of ln S_T (Simpson, +-12 sd)."""
    m = math.log(S) + (rd - rf - 0.5 * v * v) * T
    sd = v * math.sqrt(T)
    k = math.log(K)
    lo, hi = (k, m + 12 * sd) if call else (m - 12 * sd, k)
    if hi <= lo:
        return 0.0
    h = (hi - lo) / n
    f = lambda y: math.exp(-0.5 * ((y - m) / sd) ** 2) / (sd * math.sqrt(2 * math.pi))
    s = f(lo) + f(hi) + sum((4 if i % 2 else 2) * f(lo + i * h) for i in range(1, n))
    return math.exp(-rd * T) * s * h / 3


def ndiff(a, b):
    """N(a) - N(b) for a >= b, accurate in both tails (upper tails when b >= 0)."""
    if b >= 0:
        return N(-b) - N(-a)
    return N(a) - N(b)


def v0(kind_down, call, X, K, H, T, v, rd, rf):
    """European payoff restricted to the alive side of H, from spot X:
    phi * e^(-rd T) * [F * (N(d1(lo)) - N(d1(hi))) - K * (N(d2(lo)) - N(d2(hi)))]
    for the payoff phi*(S_T - K) on the interval lo < S_T < hi (tail-accurate)."""
    if kind_down:  # alive S_T > H
        lo, hi = (max(K, H), math.inf) if call else (H, K)
    else:  # alive S_T < H
        lo, hi = (K, H) if call else (0.0, min(K, H))
    if hi <= lo:
        return 0.0
    phi = 1.0 if call else -1.0
    F = X * math.exp((rd - rf) * T)
    sd = v * math.sqrt(T)

    def d1(x):
        if x == 0.0:
            return math.inf
        if x == math.inf:
            return -math.inf
        return (math.log(F / x) + 0.5 * sd * sd) / sd

    def d2(x):
        return d1(x) - sd

    return phi * math.exp(-rd * T) * (F * ndiff(d1(lo), d1(hi)) - K * ndiff(d2(lo), d2(hi)))


def image_weight(S, H, v, rd, rf):
    nu = rd - rf - 0.5 * v * v
    return (H / S) ** (2 * nu / (v * v))


def knock_out_norebate(down, call, S, K, H, T, v, rd, rf):
    w = image_weight(S, H, v, rd, rf)
    return v0(down, call, S, K, H, T, v, rd, rf) - w * v0(down, call, H * H / S, K, H, T, v, rd, rf)


def no_touch(down, S, H, T, v, rd, rf):
    """Discounted no-touch, by images on the digital."""
    w = image_weight(S, H, v, rd, rf)
    if down:
        return dig(S, H, T, v, rd, rf, True) - w * dig(H * H / S, H, T, v, rd, rf, True)
    return dig(S, H, T, v, rd, rf, False) - w * dig(H * H / S, H, T, v, rd, rf, False)


def hit_df(S, H, T, v, rd, rf, n=40000):
    """E[e^(-rd tau) 1{tau <= T}] from the first-passage density, Simpson in w = ln t."""
    nu = rd - rf - 0.5 * v * v
    d = math.log(H / S)
    ad = abs(d)

    def g(w):
        t = math.exp(w)
        ex = -((d - nu * t) ** 2) / (2 * v * v * t) - rd * t
        if ex < -745:
            return 0.0
        return ad / (v * math.sqrt(2 * math.pi * t)) * math.exp(ex)  # f(t)*t, t^(-3/2)*t

    lo, hi = math.log(T) - 40, math.log(T)
    h = (hi - lo) / n
    s = g(lo) + g(hi) + sum((4 if i % 2 else 2) * g(lo + i * h) for i in range(1, n))
    return s * h / 3


def barrier(row):
    S, K, H, T, v, rd, rf = (row[k] for k in ("S", "K", "H", "T", "vol", "rd", "rf"))
    kind, call, R = row["kind"], row["type"] == "call", row["rebate"]
    down = kind.startswith("down")
    ko = knock_out_norebate(down, call, S, K, H, T, v, rd, rf)
    if kind.endswith("out"):
        return ko + (R * hit_df(S, H, T, v, rd, rf) if R else 0.0)
    van = gk(S, K, T, v, rd, rf, call)
    return van - ko + (R * no_touch(down, S, H, T, v, rd, rf) if R else 0.0)


def dnt(S, L, U, T, v, rd, rf, M=200):
    """Image sum: e^(-rd T) * sum_n [J(x + 2nW) - J(2a - x + 2nW)], log space."""
    a, b, x = math.log(L), math.log(U), math.log(S)
    W = b - a
    nu = rd - rf - 0.5 * v * v
    k = nu / (v * v)
    s = v * math.sqrt(T)
    s2 = s * s

    def logJ(m):
        A = (a - m - k * s2) / s
        B = (b - m - k * s2) / s
        return k * (m - x) + log_ndiff(A, B)

    total = 0.0
    for n in range(-M, M + 1):
        for m, sgn in ((x + 2 * n * W, 1.0), (2 * a - x + 2 * n * W, -1.0)):
            lj = logJ(m)
            if lj > -745:
                total += sgn * math.exp(lj)
    return math.exp(-rd * T) * total


def main(path):
    rows = json.load(open(path))
    worst = {}
    for r in rows:
        fn = r["fn"]
        S, T, v, rd, rf = r["S"], r["T"], r["vol"], r["rd"], r["rf"]
        if fn == "barrier":
            ref, scale = barrier(r), S
        elif fn == "digital":
            ref = dig(S, r["K"], T, v, rd, rf, r["type"] == "call")
            q = dig_quad(S, r["K"], T, v, rd, rf, r["type"] == "call")
            assert abs(q - ref) < 1e-10, (r, q, ref)
            scale = 1.0
        elif fn == "vanilla":
            ref, scale = gk(S, r["K"], T, v, rd, rf, r["type"] == "call"), S
        elif fn == "noTouch":
            ref, scale = no_touch(r["H"] < S, S, r["H"], T, v, rd, rf), 1.0
        elif fn == "oneTouchExpiry":
            ref = math.exp(-rd * T) - no_touch(r["H"] < S, S, r["H"], T, v, rd, rf)
            scale = 1.0
        elif fn == "oneTouchHit":
            ref, scale = hit_df(S, r["H"], T, v, rd, rf), 1.0
        elif fn == "dnt":
            ref, scale = dnt(S, r["L"], r["U"], T, v, rd, rf), 1.0
            fn = f"dnt[{r['method']}]"
        else:
            continue
        err = abs(r["v"] - ref) / scale  # barrier/vanilla relative to spot, others per unit payout
        if fn not in worst or err > worst[fn][0]:
            worst[fn] = (err, r, ref)
    for fn, (err, r, ref) in sorted(worst.items()):
        ctx = {k: r[k] for k in r if k not in ("fn", "v")}
        print(f"{fn:20s} max |diff| = {err:.3e}   ts={r['v']:.12g} py={ref:.12g}  at {ctx}")


if __name__ == "__main__":
    main(sys.argv[1])
