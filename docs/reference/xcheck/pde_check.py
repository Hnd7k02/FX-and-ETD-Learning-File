import numpy as np, sys
from math import log, exp, sqrt

def solve_tridiag(a, b, c, d):
    n = len(d); cp = np.zeros(n); dp = np.zeros(n)
    cp[0] = c[0]/b[0]; dp[0] = d[0]/b[0]
    for i in range(1, n):
        m = b[i] - a[i]*cp[i-1]
        cp[i] = c[i]/m if i < n-1 else 0
        dp[i] = (d[i] - a[i]*dp[i-1])/m
    x = np.zeros(n); x[-1] = dp[-1]
    for i in range(n-2, -1, -1): x[i] = dp[i] - cp[i]*x[i+1]
    return x

def dnt_pde(S, L, U, T, vol, rd, rf, nx=1600, nt=4000):
    xL, xU = log(L), log(U)
    x = np.linspace(xL, xU, nx+1); h = x[1]-x[0]
    dt = T/nt
    nu = rd - rf - 0.5*vol*vol
    a = 0.5*vol*vol/h**2 - nu/(2*h)
    c = 0.5*vol*vol/h**2 + nu/(2*h)
    bb = -vol*vol/h**2 - rd
    V = np.ones(nx+1); V[0] = 0; V[-1] = 0
    n = nx-1
    for k in range(nt):
        theta = 1.0 if k < 4 else 0.5  # Rannacher
        rhs = V[1:-1] + (1-theta)*dt*(a*V[:-2] + bb*V[1:-1] + c*V[2:])
        A = np.full(n, -theta*dt*a); B = np.full(n, 1 - theta*dt*bb); C = np.full(n, -theta*dt*c)
        V[1:-1] = solve_tridiag(A, B, C, rhs)
    return np.interp(log(S), x, V)

def onetouch_hit_pde(S, H, T, vol, rd, rf, nx=2000, nt=4000):
    # up or down barrier, far boundary at 6 sd
    sd = vol*sqrt(T)
    if H > S:
        lo, hi = log(S) - 10*sd - abs(log(H/S)), log(H)
        V = np.zeros(nx+1); bL, bU = 0.0, 1.0
    else:
        lo, hi = log(H), log(S) + 10*sd + abs(log(H/S))
        bL, bU = 1.0, 0.0
    x = np.linspace(lo, hi, nx+1); h = x[1]-x[0]; dt = T/nt
    nu = rd - rf - 0.5*vol*vol
    a = 0.5*vol*vol/h**2 - nu/(2*h); c = 0.5*vol*vol/h**2 + nu/(2*h); bb = -vol*vol/h**2 - rd
    V = np.zeros(nx+1); V[0] = bL; V[-1] = bU
    n = nx-1
    for k in range(nt):
        theta = 1.0 if k < 4 else 0.5
        rhs = V[1:-1] + (1-theta)*dt*(a*V[:-2] + bb*V[1:-1] + c*V[2:])
        rhs[0] += theta*dt*a*V[0]; rhs[-1] += theta*dt*c*V[-1]
        A = np.full(n, -theta*dt*a); B = np.full(n, 1 - theta*dt*bb); C = np.full(n, -theta*dt*c)
        V[1:-1] = solve_tridiag(A, B, C, rhs)
    return np.interp(log(S), x, V)

if __name__ == '__main__':
    cases = [
        (0.80, 0.76, 0.84, 0.25, 0.08, 0.0, 0.035),
        (0.80, 0.75, 0.85, 0.5, 0.08, 0.0, 0.035),
        (100, 90, 110, 0.5, 0.25, 0.08, 0.04),
        (1.10, 1.05, 1.20, 1.0, 0.10, 0.02, 0.01),
        (0.80, 0.70, 0.90, 0.1, 0.08, 0.0, 0.035),
    ]
    for c in cases:
        print('DNT', c, '%.6f' % dnt_pde(*c))
    tcases = [
        (0.80, 0.84, 0.25, 0.08, 0.0, 0.035),
        (0.80, 0.76, 0.25, 0.08, 0.0, 0.035),
        (100, 105, 0.5, 0.25, 0.08, 0.04),
        (100, 95, 0.5, 0.25, 0.08, 0.04),
        (1.0, 0.95, 1.0, 0.10, -0.0075, -0.002),
    ]
    for c in tcases:
        print('OTH', c, '%.6f' % onetouch_hit_pde(*c))
