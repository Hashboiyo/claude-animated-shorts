"""An original small plucked-string/mallet score, composed for the Xerxes timeline."""
import json,sys
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.ndimage import uniform_filter1d
sys.path.insert(0,str(Path(__file__).parent/'tools'))
import instruments as I
from dsp import SR,pan,place,rng,fades,lp

P=json.loads(Path('audio-plan.json').read_text());N=round(P['duration']*SR)
OUT=Path('output');OUT.mkdir(exist_ok=True);music=np.zeros((2,N),np.float64);random=rng(480674)
def add(x,t,gain=.3,p=0):place(music,pan(x,p),t,gain)
def hz(note):return 440*2**((note-69)/12)
def pluck(note,t,duration=.7,level=.3,p=0):add(I.pluck(hz(note),vel=.62,r=random,dur=duration,bright=.25),t,level,p)

# New eight-beat melody, distinct from the bridge example's march.
theme=[(0,74,.7),(1.5,69,.3),(2.5,72,.3),(3.5,77,.7),(5,76,.3),(6,73,.3),(7,74,.5)]
chords=[[50,57,65],[46,53,62],[55,62,65],[45,52,61]]
sections=[('hook',0,4.4,1),('planning',4.4,13.8,.65),('first storm',13.8,18.7,.42),('royal reaction',18.7,22.1,.4),('punishment',22.1,33.4,.68),('curse',33.4,38.2,.45),('unbothered ocean',38.2,41.2,.19),('engineers',41.2,44.8,.28),('construction',44.8,54.5,.72),('march',54.5,59,.88),('return storm',59,63.5,.42),('boat callback',63.5,68.5,.48)]
Q=.4
for bar,start in enumerate(np.arange(0,P['duration'],8*Q)):
    section=next(s for s in sections if s[1]<=start<s[2]);name,_,_,gain=section
    chord=chords[bar%4]
    if name in ['first storm','return storm']:
        for beat in [0,2,4,6]:
            pluck(chord[0]-12,start+beat*Q,.85,.17*gain,-.15)
            add(I.timpani(hz(chord[0]-12),vel=.3,r=random,dur=1.3),start+beat*Q,.07)
        continue
    if name=='boat callback':chord=[50,57,66]
    for beat in [0,2,4,6]:pluck(chord[0],start+beat*Q,.5,.22*gain,-.18)
    for beat in [1,3,5,7]:
        for j,note in enumerate(chord[1:]):pluck(note+12,start+beat*Q+j*.025,.45,.13*gain,.15+j*.12)
    if name not in ['engineers','unbothered ocean','royal reaction']:
        for beat,note,duration in theme:
            if name=='boat callback' and note==77:note=78
            add(I.vibes(hz(note),vel=.38,r=random,dur=max(.45,duration),damp=duration),start+beat*Q,.095*gain,.12)
    for beat in [1,3,5,7]:add(I.brush(vel=.16,r=random,dur=.12),start+beat*Q,.035*gain,-.25)

# Boot-compatible quarter notes at 150 bpm, matched to the 12-frame planted-step grid.
for t in np.arange(54.8,59,.4):
    add(I.snare(vel=.24,r=random,dur=.15,snappy=.4),float(t),.065,-.1)
    pluck(38,float(t),.25,.11,.05)
for t in [14.0,59.15]:add(I.timpani(hz(38),vel=.45,r=random,dur=1.8),t,.16)
for t in [18.75,41.25]:pluck(37,t,.9,.18,-.1)
for note in [50,57,66,74]:pluck(note,67.8,.7,.10,.1)

# Smooth scene rides preserve lightness under the dry narration.
rides=np.ones(N)
for _,a,b,gain in sections:
    i,j=round(a*SR),min(N,round(b*SR));rides[i:j]=gain
rides=uniform_filter1d(rides,size=round(.07*SR),mode='nearest')
music*=rides
music[:, :round(.08*SR)]*=np.linspace(0,1,round(.08*SR))
music[:, -round(.12*SR):]*=np.linspace(1,0,round(.12*SR))
peak=float(np.max(np.abs(music)));music/=max(1,peak/.65)
sf.write(OUT/'music.wav',music.T.astype(np.float32),SR,subtype='PCM_24')
(OUT/'music-cues.json').write_text(json.dumps({'original_composition':True,'style':'light plucked strings, muted mallets, soft percussion; D minor with a dry major-key boat callback','tempo_bpm':150,'sections':[{'name':n,'a':a,'b':b,'relative_level':v} for n,a,b,v in sections],'mix_rule':'base bed calibrated to narration; +3 dB music setting and speech duck applied in final mix'},indent=2))
print('Original music composed:',N,'samples at',SR,'Hz.',flush=True)
