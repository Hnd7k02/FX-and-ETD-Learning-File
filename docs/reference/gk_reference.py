"""Forward First – Referenzwerte für das durchgehende Beispiel.

Unabhängige Python-Referenz (nur Standardbibliothek) für die Unit-Tests des
TypeScript-Rechenkerns. Aufruf: python3 gk_reference.py

Beispiel: Schweizer Importeur, USD 1 Mio. in 3 Monaten.
USD/CHF Spot 0.8000, Zins CHF (domestic, Quote-Währung) 0.0 %,
Zins USD (foreign, Base-Währung) 3.5 %, stetig; T = 0.25; Vola 8 %;
Strike = ATMF, auf 4 Stellen gerundet 0.7930. Long USD Call / CHF Put.
"""
from math import erf, exp, log, pi, sqrt

S, T, RD, RF, VOL = 0.8000, 0.25, 0.0, 0.035, 0.08
NOTIONAL = 1_000_000  # USD


def N(x: float) -> float:
    return 0.5 * (1 + erf(x / sqrt(2)))


def n(x: float) -> float:
    return exp(-x * x / 2) / sqrt(2 * pi)


def d1d2(s, k, t, v, rd, rf):
    f = s * exp((rd - rf) * t)
    d1 = (log(f / k) + 0.5 * v * v * t) / (v * sqrt(t))
    return f, d1, d1 - v * sqrt(t)


def gk(s, k, t, v, rd, rf, call=True):
    """Garman-Kohlhagen, Preis in Quote-Währung (CHF) pro 1 Einheit Base (USD)."""
    if t <= 0:
        return max(s - k, 0) if call else max(k - s, 0)
    f, d1, d2 = d1d2(s, k, t, v, rd, rf)
    dd = exp(-rd * t)
    if call:
        return dd * (f * N(d1) - k * N(d2))
    return dd * (k * N(-d2) - f * N(-d1))


def b76(f, k, t, v):
    """Black-76 auf den Forward, ohne Diskontierung (rd = 0)."""
    if t <= 0:
        return max(f - k, 0)
    d1 = (log(f / k) + 0.5 * v * v * t) / (v * sqrt(t))
    return f * N(d1) - k * N(d1 - v * sqrt(t))


F = S * exp((RD - RF) * T)
K = round(F, 4)
_, D1, D2 = d1d2(S, K, T, VOL, RD, RF)
DF = exp(-RF * T)

call = gk(S, K, T, VOL, RD, RF)
put = gk(S, K, T, VOL, RD, RF, call=False)
delta = DF * N(D1)
gamma = DF * n(D1) / (S * VOL * sqrt(T))
vega = S * DF * n(D1) * sqrt(T)                      # pro 1.00 Vola
theta_fd = gk(S, K, T - 1 / 365, VOL, RD, RF) - call # 1 Kalendertag Zeitverfall
theta_an = (-S * DF * n(D1) * VOL / (2 * sqrt(T))
            + RF * S * DF * N(D1)
            - RD * K * exp(-RD * T) * N(D2)) / 365   # analytisch, pro Kalendertag
rho_d = K * T * exp(-RD * T) * N(D2)                 # pro 1.00 Zins
rho_f = -S * T * DF * N(D1)
h = 1e-4
gamma_fd = (DF * N(d1d2(S + h, K, T, VOL, RD, RF)[1])
            - DF * N(d1d2(S - h, K, T, VOL, RD, RF)[1])) / (2 * h)
delta_up = DF * N(d1d2(S + 0.01, K, T, VOL, RD, RF)[1])
fwd_mm_90 = S * (1 + RD * 90 / 360) / (1 + RF * 90 / 360)  # Geldmarkt-Konvention Act/360, 90 Tage

rows = [
    ("Forward stetig (T = 0.25)", f"{F:.5f}", "Forward Points stetig", f"{(F - S) * 1e4:.1f} Pips"),
    ("Forward Geldmarkt Act/360, 90 Tage", f"{fwd_mm_90:.5f}", "Forward Points", f"{(fwd_mm_90 - S) * 1e4:.1f} Pips"),
    ("Strike ATMF (gerundet)", f"{K:.4f}", "d1 / d2", f"{D1:.4f} / {D2:.4f}"),
    ("Call", f"{call * 1e4:.2f} Pips", "auf USD 1 Mio.", f"CHF {call * NOTIONAL:,.0f}"),
    ("Put", f"{put * 1e4:.2f} Pips", "Parität C - P = DF_d (F - K)", f"{(call - put):.8f} = {exp(-RD * T) * (F - K):.8f}"),
    ("Delta (Spot)", f"{delta:.4f}", "Delta bei S = 0.8100", f"{delta_up:.4f}"),
    ("Gamma", f"{gamma:.4f}", "Gamma numerisch (h = 1 Pip)", f"{gamma_fd:.4f}"),
    ("Gamma je Big Figure (0.01)", f"{gamma * 0.01:+.4f} Delta", "", ""),
    ("Vega je Vola-Punkt", f"CHF {vega / 100 * NOTIONAL:,.0f}", "", ""),
    ("Theta pro Tag (1 Kalendertag)", f"CHF {theta_fd * NOTIONAL:,.1f}", "Theta analytisch / 365", f"CHF {theta_an * NOTIONAL:,.1f}"),
    ("Rho CHF je +1 %", f"CHF {rho_d / 100 * NOTIONAL:+,.0f}", "Rho USD je +1 %", f"CHF {rho_f / 100 * NOTIONAL:+,.0f}"),
    ("Zeitwert ATMF Black-76, 3M", f"{b76(K, K, 0.25, VOL) * 1e4:.1f} Pips", "1Y", f"{b76(K, K, 1.0, VOL) * 1e4:.1f} Pips"),
    ("Break-even Tagesbewegung S*vol/sqrt(365)", f"{S * VOL / sqrt(365) * 1e4:.1f} Pips", "", ""),
]
for r in rows:
    print(" | ".join(x for x in r if x))
