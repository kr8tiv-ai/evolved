"""
Original lofi hip-hop track for the 'Evolved' demo video.
100% synthesized here = original composition, released CC0 / public domain.
No samples, no third-party audio. numpy + scipy only.
"""
import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
BPM = 78.0
BEAT = 60.0 / BPM
BAR = BEAT * 4.0
STEP = BEAT / 4.0            # 16th note
DUR = 86.0                   # match video length exactly
N = int(SR * DUR)
rng = np.random.default_rng(7)

def m2f(m):
    return 440.0 * 2.0 ** ((np.asarray(m, dtype=float) - 69.0) / 12.0)

def env_adsr(n, a, d, s, r, sr=SR):
    a_n = max(1, int(a*sr)); d_n = max(1, int(d*sr)); r_n = max(1, int(r*sr))
    sus_n = max(1, n - a_n - d_n - r_n)
    e = np.concatenate([
        np.linspace(0, 1, a_n, endpoint=False),
        np.linspace(1, s, d_n, endpoint=False),
        np.full(sus_n, s),
        np.linspace(s, 0, r_n),
    ])
    if len(e) < n:
        e = np.concatenate([e, np.zeros(n-len(e))])
    return e[:n]

def add(buf, sig, at):
    i = int(at*SR)
    j = min(len(buf), i+len(sig))
    if i < len(buf):
        buf[i:j] += sig[:j-i]

# ---- instrument voices -------------------------------------------------
def rhodes(freq, dur, gain=0.2, pan=0.0):
    n = int(dur*SR)
    t = np.arange(n)/SR
    # additive electric-piano-ish: fundamental + gentle partials, slight inharmonic bell on attack
    sig = (np.sin(2*np.pi*freq*t)
           + 0.5*np.sin(2*np.pi*2*freq*t)
           + 0.18*np.sin(2*np.pi*3*freq*t)
           + 0.08*np.sin(2*np.pi*4.01*freq*t))
    # soft tine attack
    atk = np.exp(-t*22)*np.sin(2*np.pi*freq*6*t)*0.15
    sig = sig + atk
    # tremolo
    sig *= (1.0 + 0.05*np.sin(2*np.pi*4.5*t))
    e = env_adsr(n, 0.010, 0.25, 0.62, 0.55)
    sig *= e*gain
    l = sig*np.sqrt((1-pan)/2 if pan>=0 else 1.0)
    r = sig*np.sqrt((1+pan)/2 if pan<=0 else 1.0)
    # simpler equal-power pan
    lp = np.cos((pan+1)*np.pi/4); rp = np.sin((pan+1)*np.pi/4)
    return np.stack([sig*lp, sig*rp], axis=1)

def pluck(freq, dur, gain=0.16, pan=0.0):
    n = int(dur*SR)
    t = np.arange(n)/SR
    sig = (np.sin(2*np.pi*freq*t) + 0.35*np.sin(2*np.pi*2*freq*t)
           + 0.12*np.sin(2*np.pi*3*freq*t))
    e = env_adsr(n, 0.006, 0.12, 0.35, 0.30)
    sig *= e*gain
    lp = np.cos((pan+1)*np.pi/4); rp = np.sin((pan+1)*np.pi/4)
    return np.stack([sig*lp, sig*rp], axis=1)

def bass(freq, dur, gain=0.33):
    n = int(dur*SR)
    t = np.arange(n)/SR
    sig = np.sin(2*np.pi*freq*t) + 0.25*np.sin(2*np.pi*2*freq*t)
    sig += 0.08*np.tanh(3*np.sin(2*np.pi*freq*t))  # a touch of warmth
    e = env_adsr(n, 0.012, 0.10, 0.8, 0.12)
    sig *= e*gain
    return np.stack([sig, sig], axis=1)

def kick(gain=0.9):
    dur=0.42; n=int(dur*SR); t=np.arange(n)/SR
    f = 115*np.exp(-t*30)+48
    sig = np.sin(2*np.pi*np.cumsum(f)/SR)
    sig *= np.exp(-t*7.5)
    sig += 0.6*np.exp(-t*55)*np.sin(2*np.pi*95*t)  # click/body
    sig *= gain
    return np.stack([sig, sig], axis=1)

def snare(gain=0.5):
    dur=0.30; n=int(dur*SR); t=np.arange(n)/SR
    noise = rng.standard_normal(n)
    sos = butter(4, [1400, 6500], btype='band', fs=SR, output='sos')
    noise = sosfilt(sos, noise)*np.exp(-t*18)
    tone = 0.4*np.sin(2*np.pi*185*t)*np.exp(-t*24)
    sig = (noise*0.9 + tone)*gain
    return np.stack([sig, sig], axis=1)

def hat(gain=0.22, open=False):
    dur=0.14 if open else 0.05; n=int(dur*SR); t=np.arange(n)/SR
    noise = rng.standard_normal(n)
    sos = butter(6, 8000, btype='high', fs=SR, output='sos')
    noise = sosfilt(sos, noise)
    noise *= np.exp(-t*(38 if open else 130))
    sig = noise*gain
    return np.stack([sig, sig], axis=1)

# ---- arrangement -------------------------------------------------------
buf = np.zeros((N, 2))

# vi ii V I in C: Am7, Dm7, G7, Cmaj7
chords = {
    'Am7':  [57,60,64,67],
    'Dm7':  [50,57,60,65],
    'G7':   [55,59,62,65],
    'Cmaj7':[52,55,60,64],
}
bass_notes = {'Am7':45, 'Dm7':38, 'G7':43, 'Cmaj7':36}
prog = ['Am7','Dm7','G7','Cmaj7']

n_bars = int(np.ceil(DUR / BAR)) + 1
for b in range(n_bars):
    ch = prog[b % 4]
    t0 = b*BAR
    if t0 >= DUR: break
    # pads: strike on beat 1, small re-voice on beat 3
    for mi, midi in enumerate(chords[ch]):
        pan = -0.35 + 0.7*(mi/3)
        add(buf, rhodes(m2f(midi), BAR*0.98, gain=0.16, pan=pan), t0 + rng.uniform(0,0.008))
    # soft second hit on beat 3 (upper two voices)
    for midi in chords[ch][2:]:
        add(buf, rhodes(m2f(midi), BEAT*2*0.9, gain=0.10, pan=0.2), t0+2*BEAT)
    # bass: root on 1, root/5th walk on 3
    add(buf, bass(m2f(bass_notes[ch]), BEAT*1.9), t0)
    add(buf, bass(m2f(bass_notes[ch]+ (7 if b%2 else 12)), BEAT*1.6), t0+2*BEAT)

# drums (skip first bar for a soft intro, drop out feel near end)
for b in range(n_bars):
    t0 = b*BAR
    if t0 >= DUR-0.5: break
    intro = b < 1
    outro = t0 > DUR-BAR*1.5
    if not intro:
        add(buf, kick(0.95), t0+0*STEP)
        add(buf, kick(0.7),  t0+6*STEP)
        add(buf, kick(0.85), t0+10*STEP)
        add(buf, snare(0.5), t0+4*STEP)
        add(buf, snare(0.5), t0+12*STEP)
    # hats: 8th notes with swing, always (quieter in intro)
    for s in range(8):
        step = s*2
        swing = STEP*0.32 if (s % 2 == 1) else 0.0
        g = (0.10 if intro else 0.20) * (0.7 if s%2 else 1.0)
        if outro and s>4: g*=0.5
        add(buf, hat(g, open=(s==7 and b%4==3)), t0 + step*STEP + swing)

# melody: sparse pentatonic motif over some bars (C D E G A, octave 5)
penta = [72,74,76,79,81]
motif_bars = [1,2,5,6,9,10,13,14,17,18,21]
for b in motif_bars:
    t0 = b*BAR
    if t0 >= DUR-1.0: continue
    seq = rng.choice(penta, size=3, replace=True)
    onsets = [0, 1.5, 3.0] if b%2==0 else [0.5, 2.0, 3.0]
    for k, midi in enumerate(seq):
        pan = rng.uniform(-0.3,0.3)
        add(buf, pluck(m2f(int(midi)), BEAT*1.1, gain=0.12, pan=pan), t0+onsets[k]*BEAT)
        # soft echo
        add(buf, pluck(m2f(int(midi)), BEAT*0.8, gain=0.05, pan=-pan), t0+onsets[k]*BEAT+BEAT*0.5)

# ---- lofi glue ---------------------------------------------------------
# sidechain duck keyed to kick pattern
duck = np.ones(N)
for b in range(n_bars):
    t0=b*BAR
    if b<1: continue
    for stp in (0,6,10):
        i=int((t0+stp*STEP)*SR)
        if i<N:
            L=int(0.18*SR)
            seg=np.linspace(0.62,1.0,min(L,N-i))
            duck[i:i+len(seg)]=np.minimum(duck[i:i+len(seg)],seg)
buf *= duck[:,None]

# vinyl hiss + crackle
hiss = rng.standard_normal((N,2))
sosh = butter(2, 5200, btype='low', fs=SR, output='sos')
hiss = sosfilt(sosh, hiss, axis=0)*0.010
crackle = np.zeros((N,2))
n_pops = int(DUR*7)
idx = rng.integers(0, N-50, n_pops)
for i in idx:
    a = rng.uniform(0.02,0.09)
    crackle[i:i+3,:] += a*rng.standard_normal((3,2))
buf += hiss + crackle

# master lowpass for the warm lofi tone + gentle high shelf tame
sosm = butter(4, 3600, btype='low', fs=SR, output='sos')
buf = sosfilt(sosm, buf, axis=0)

# subtle stereo widen (haas on a copy already via pans); light bus compression
peak = np.max(np.abs(buf))
buf = buf / (peak+1e-9)
# soft knee limiter
buf = np.tanh(buf*1.15)/np.tanh(1.15)
buf *= 0.92

# fades
fi = int(1.4*SR); fo = int(5.0*SR)
buf[:fi] *= np.linspace(0,1,fi)[:,None]
buf[-fo:] *= np.linspace(1,0,fo)[:,None]

# write wav
buf16 = np.clip(buf, -1, 1)
buf16 = (buf16*32767).astype(np.int16)
import wave, os, sys
path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "evolved_lofi.wav")
with wave.open(path,'w') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(buf16.tobytes())
print("wrote", path, "dur", DUR, "s")
