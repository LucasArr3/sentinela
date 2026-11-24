#!/usr/bin/env python3
"""Gera a biblioteca de sons de alarme do Sentinela (WAV 16-bit mono 22,05 kHz, prontos para loop).

Tudo é sintetizado por código (sem direitos autorais). Uso:  python3 tools/gen_sounds.py [pasta_saida]
"""
import sys, wave, os
import numpy as np

SR = 22050
rng = np.random.default_rng(7)


def t_axis(dur):
    return np.arange(int(SR * dur)) / SR


def phase_from_freq(f):
    return 2 * np.pi * np.cumsum(f) / SR


def additive(phase, weights):
    """Soma de harmônicos: weights[k] é o peso do harmônico k+1."""
    out = np.zeros_like(phase)
    for k, w in enumerate(weights, start=1):
        if w:
            out += w * np.sin(k * phase)
    return out / sum(abs(w) for w in weights)


def env_adsr(n, a=0.01, d=0.05, s=0.8, r=0.05):
    e = np.ones(n)
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    na, nr = max(na, 1), max(nr, 1)
    e[:na] = np.linspace(0, 1, na)
    if nd:
        e[na:na + nd] = np.linspace(1, s, nd)
        e[na + nd:] = s
    else:
        e[na:] = 1
    e[-nr:] *= np.linspace(1, 0, nr)
    return e


def silence(dur):
    return np.zeros(int(SR * dur))


def smooth_noise(n, width):
    x = rng.standard_normal(n + width)
    k = np.ones(width) / width
    return np.convolve(x, k, mode="valid")[:n]


ODD = [1, 0, 1 / 3, 0, 1 / 5, 0, 1 / 7]


def sirene_lamento():
    # Sirene "wail": sobe e desce suave (6 s por ciclo), dois ciclos.
    dur = 12.0
    t = t_axis(dur)
    f = 640 + 760 * (1 - np.cos(2 * np.pi * t / 6.0)) / 2
    return additive(phase_from_freq(f), [1, 0.55, 0.35, 0.22, 0.12])


def sirene_rapida():
    # "Yelp": varredura rápida, muito urgente.
    dur = 3.84
    t = t_axis(dur)
    p = (t % 0.32) / 0.32
    f = 620 + 1050 * p
    return additive(phase_from_freq(f), [1, 0.5, 0.3, 0.2])


def sirene_europeia():
    # Duas notas alternadas (hi-lo), som de viatura europeia.
    seg = []
    for i in range(8):
        f = 960 if i % 2 == 0 else 770
        n = int(SR * 0.45)
        ph = 2 * np.pi * f * np.arange(n) / SR
        w = additive(ph, ODD) * env_adsr(n, 0.01, 0.0, 1.0, 0.02)
        seg.append(w)
    return np.concatenate(seg)


def alerta_aereo():
    # Sirene de alerta aéreo: lenta, grave, longa.
    dur = 12.0
    t = t_axis(dur)
    base = (1 - np.cos(2 * np.pi * t / 12.0)) / 2
    f = 320 + 760 * base
    vib = 1 + 0.015 * np.sin(2 * np.pi * 5.5 * t)
    return additive(phase_from_freq(f * vib), [1, 0.7, 0.5, 0.35, 0.25, 0.15, 0.1])


def klaxon():
    # Klaxon de emergência: pulsos graves e "sujos".
    out = []
    for _ in range(5):
        n = int(SR * 0.55)
        t = np.arange(n) / SR
        a = additive(2 * np.pi * 415 * t, ODD)
        b = additive(2 * np.pi * 440 * t, ODD)
        w = (a + b) / 2 * env_adsr(n, 0.015, 0.0, 1.0, 0.04)
        out += [w, silence(0.22)]
    return np.concatenate(out)


def clarim():
    # Toque de clarim (Alvorada): metais com harmônicos ricos e leve vibrato.
    notes = [(392.00, 0.28), (523.25, 0.28), (659.25, 0.28), (783.99, 0.28), (659.25, 0.28), (783.99, 0.95)]
    out = []
    for f, d in notes:
        n = int(SR * d)
        t = np.arange(n) / SR
        vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t)
        w = additive(2 * np.pi * f * np.cumsum(vib) / SR, [1, 0.85, 0.65, 0.5, 0.35, 0.22, 0.14, 0.08])
        out.append(w * env_adsr(n, 0.025, 0.06, 0.85, 0.07))
        out.append(silence(0.03))
    out.append(silence(0.9))
    return np.concatenate(out)


def sonar():
    # Ping de sonar com eco.
    n = int(SR * 3.0)
    out = np.zeros(n)
    ping_len = int(SR * 1.4)
    t = np.arange(ping_len) / SR
    ping = (np.sin(2 * np.pi * 1000 * t) + 0.25 * np.sin(2 * np.pi * 2000 * t)) * np.exp(-t * 3.2)
    for delay, amp in [(0.0, 1.0), (0.55, 0.45), (1.1, 0.2)]:
        s = int(SR * delay)
        out[s:s + ping_len] += ping[: n - s][: ping_len] * amp if s + ping_len <= n else ping[: n - s] * amp
    return out


def radio():
    # Rádio HT: chiado de squelch + dois tons de chamada, repetido.
    def burst():
        sq = smooth_noise(int(SR * 0.09), 3) * 0.5
        sq *= np.hanning(len(sq))
        n = int(SR * 0.13)
        t = np.arange(n) / SR
        a = additive(2 * np.pi * 1200 * t, ODD) * env_adsr(n, 0.005, 0, 1, 0.01)
        b = additive(2 * np.pi * 1700 * t, ODD) * env_adsr(n, 0.005, 0, 1, 0.01)
        tail = smooth_noise(int(SR * 0.12), 2) * 0.35 * np.linspace(1, 0, int(SR * 0.12))
        return np.concatenate([sq, silence(0.02), a, silence(0.03), b, tail, silence(0.5)])
    return np.concatenate([burst(), burst(), burst()])


def bipes_digitais():
    out = []
    for _ in range(3):
        n = int(SR * 0.13)
        t = np.arange(n) / SR
        out += [additive(2 * np.pi * 880 * t, ODD) * env_adsr(n, 0.004, 0, 1, 0.01), silence(0.11)]
    out.append(silence(0.7))
    return np.concatenate(out * 2)


def alarme_tatico():
    # Três pulsos fortes, pausa, repete: padrão de evacuação.
    out = []
    for _ in range(2):
        for _ in range(3):
            n = int(SR * 0.34)
            t = np.arange(n) / SR
            f = 1000 + 120 * np.sin(2 * np.pi * 14 * t)
            w = additive(phase_from_freq(f), [1, 0.4, 0.5, 0.2, 0.3, 0.1]) * env_adsr(n, 0.01, 0.0, 1.0, 0.03)
            out += [w, silence(0.14)]
        out.append(silence(0.8))
    return np.concatenate(out)


def buzina_naval():
    out = []
    for _ in range(2):
        n = int(SR * 1.9)
        t = np.arange(n) / SR
        a = additive(2 * np.pi * 140 * t, [1, 0.8, 0.6, 0.5, 0.4, 0.3, 0.22, 0.15, 0.1, 0.06])
        b = additive(2 * np.pi * 175 * t, [1, 0.7, 0.5, 0.35, 0.25, 0.15])
        out += [(a + 0.7 * b) / 1.7 * env_adsr(n, 0.12, 0.1, 0.9, 0.25), silence(1.1)]
    return np.concatenate(out)


def despertador():
    # Despertador clássico de sino duplo: "trrrring".
    out = []
    for _ in range(3):
        n = int(SR * 0.9)
        t = np.arange(n) / SR
        trem = 0.55 + 0.45 * (np.sin(2 * np.pi * 22 * t) > 0)
        a = np.sin(2 * np.pi * 1760 * t) + 0.6 * np.sin(2 * np.pi * 2637 * t) + 0.3 * np.sin(2 * np.pi * 3520 * t)
        out += [a / 1.9 * trem * env_adsr(n, 0.004, 0.05, 0.9, 0.06), silence(0.45)]
    return np.concatenate(out)


def carrilhao():
    # Carrilhão suave (opção calma): arpejo de sinos com decaimento.
    notes = [1046.5, 1318.5, 1568.0, 2093.0]
    n_total = int(SR * 4.0)
    out = np.zeros(n_total)
    for i, f in enumerate(notes * 2):
        s = int(SR * 0.3 * i)
        ln = int(SR * 1.3)
        t = np.arange(ln) / SR
        bell = (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t) + 0.2 * np.sin(2 * np.pi * f * 5.4 * t)) * np.exp(-t * 3.0)
        end = min(s + ln, n_total)
        out[s:end] += bell[: end - s] * 0.6
    return out


SOUNDS = {
    "sirene_lamento": sirene_lamento,
    "sirene_rapida": sirene_rapida,
    "sirene_europeia": sirene_europeia,
    "alerta_aereo": alerta_aereo,
    "klaxon": klaxon,
    "alarme_tatico": alarme_tatico,
    "buzina_naval": buzina_naval,
    "clarim": clarim,
    "radio": radio,
    "sonar": sonar,
    "bipes_digitais": bipes_digitais,
    "despertador": despertador,
    "carrilhao": carrilhao,
}


def finish(x, peak=0.89):
    x = x - np.mean(x)
    fade = int(SR * 0.006)
    x[:fade] *= np.linspace(0, 1, fade)
    x[-fade:] *= np.linspace(1, 0, fade)
    # Equaliza o volume percebido (RMS alvo -9 dBFS) e limita picos com saturação suave.
    rms = np.sqrt(np.mean(x ** 2)) or 1.0
    x = x * (10 ** (-9.0 / 20) / rms)
    x = np.tanh(x * 1.1) / np.tanh(1.1)
    m = np.max(np.abs(x)) or 1.0
    if m > peak:
        x = x / m * peak
    return x


def write_wav(path, x):
    pcm = np.clip(x * 32767, -32768, 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == "__main__":
    out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "sounds")
    os.makedirs(out_dir, exist_ok=True)
    for name, fn in SOUNDS.items():
        x = finish(fn())
        write_wav(os.path.join(out_dir, name + ".wav"), x)
        print(f"{name}.wav  {len(x) / SR:5.2f}s  {os.path.getsize(os.path.join(out_dir, name + '.wav')) // 1024} KB")
