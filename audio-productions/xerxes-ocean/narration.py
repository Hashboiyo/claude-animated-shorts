"""Original script narration, neural phoneme timings, and pitch-preserving shot fitting."""
import hashlib, json, subprocess, urllib.request
from difflib import SequenceMatcher
from pathlib import Path
import numpy as np
import onnxruntime as ort
import soundfile as sf
from kokoro_onnx import Kokoro

P=json.loads(Path('audio-plan.json').read_text());SR=P['sample_rate']
OUT=Path('output');OUT.mkdir(exist_ok=True);WORK=Path('work/voice');WORK.mkdir(parents=True,exist_ok=True)
MODELS=Path('work/models');MODELS.mkdir(parents=True,exist_ok=True)
for name,url_key,hash_key in [('kokoro.onnx','model_url','model_sha256'),('voices.bin','voices_url','voices_sha256')]:
    path=MODELS/name
    if not path.exists():urllib.request.urlretrieve(P[url_key],path)
    if hashlib.sha256(path.read_bytes()).hexdigest()!=P[hash_key]:raise RuntimeError(f'Invalid model checksum: {name}')
options=ort.SessionOptions();options.intra_op_num_threads=2;options.inter_op_num_threads=1
session=ort.InferenceSession(str(MODELS/'kokoro.onnx'),sess_options=options,providers=['CPUExecutionProvider'])
engine=Kokoro.from_session(session,str(MODELS/'voices.bin'))
if not engine.has_timings:raise RuntimeError('Voice model lacks real duration outputs')
if P['voice'] not in engine.voices.files:raise RuntimeError('Requested voice unavailable')

def run(args):
    r=subprocess.run(args,capture_output=True,text=True)
    if r.returncode:raise RuntimeError(r.stderr)
    return r

def keep(c):return not c.isspace() and c not in '.,!?;:—–-()[]\"'

def align_words(text,spoken):
    """Map each source word to actual model phoneme durations; no uniform word spacing."""
    actual=[t for t in spoken if keep(t.phoneme) and t.end>=t.start]
    expected=[];bounds=[]
    for word in text.split():
        phonemes=engine.tokenizer.known(engine.tokenizer.phonemize(word,lang=P['language']))
        chars=[c for c in phonemes if keep(c)]
        if not chars:raise RuntimeError(f'No phonemes for {word!r}')
        start=len(expected);expected.extend(chars);bounds.append((word,start,len(expected)))
    target=''.join(t.phoneme for t in actual)
    matcher=SequenceMatcher(None,''.join(expected),target,autojunk=False)
    ratio=matcher.ratio()
    if ratio<.72:raise RuntimeError(f'Unreliable word/phoneme alignment {ratio:.3f}: {text}')
    matched={}
    for a,b,n in matcher.get_matching_blocks():
        for j in range(n):matched[a+j]=b+j
    xp=np.array(sorted(matched));fp=np.array([matched[k] for k in xp])
    words=[]
    for word,a,b in bounds:
        first=int(round(float(np.interp(a,xp,fp))));last=int(round(float(np.interp(b-1,xp,fp))))
        first=max(0,min(len(actual)-1,first));last=max(first,min(len(actual)-1,last))
        words.append({'word':word,'start':float(actual[first].start),'end':float(actual[last].end)})
    return words,ratio

voice=np.zeros(round(P['duration']*SR),np.float32);words=[];segments=[];phonemes=[]
for cue in P['segments']:
    start=cue['a']+.065;end=cue['b']-.065;available=end-start
    raw,rate,spoken=engine.create_timed(cue['text'],voice=P['voice'],speed=P['native_speed'],lang=P['language'],sentence_pause=.12,clause_pause=.055,trim=True)
    if rate!=24000 or len(raw)==0 or not spoken:raise RuntimeError('Invalid synthesized speech or missing timings')
    source_duration=len(raw)/rate;tempo=max(.80,source_duration/max(.1,available-.035))
    # Very fast fitting is resynthesized at the appropriate speaking rate first.
    if tempo>1.45:
        speed=min(1.65,P['native_speed']*tempo/1.18)
        raw,rate,spoken=engine.create_timed(cue['text'],voice=P['voice'],speed=speed,lang=P['language'],sentence_pause=.10,clause_pause=.04,trim=True)
        source_duration=len(raw)/rate;tempo=max(.80,source_duration/max(.1,available-.035))
    if tempo>1.65:raise RuntimeError(f'Narration too long for cue {cue["id"]}; do not truncate speech')
    native=WORK/f'{cue["id"]:02d}-native.wav';fitted=WORK/f'{cue["id"]:02d}-fit.wav'
    sf.write(native,raw,rate,subtype='FLOAT')
    run(['ffmpeg','-v','error','-y','-i',str(native),'-af',f'atempo={tempo:.9f},aresample={SR}','-c:a','pcm_f32le',str(fitted)])
    audio,actual_rate=sf.read(fitted,dtype='float32');duration=len(audio)/actual_rate
    if duration>available+.025:raise RuntimeError(f'Fitted speech exceeds cue {cue["id"]}: {duration} > {available}')
    offset=round(start*SR)
    if offset+len(audio)>len(voice):raise RuntimeError('Narration exceeds picture')
    voice[offset:offset+len(audio)]+=audio
    local_words,confidence=align_words(cue['text'],spoken)
    scale=duration/source_duration
    for word in local_words:
        words.append({'word':word['word'],'start':round(start+word['start']*scale,4),'end':round(min(end,start+word['end']*scale),4),'cue':cue['id']})
    phonemes.extend({'phoneme':t.phoneme,'start':round(start+t.start*scale,5),'end':round(start+t.end*scale,5),'cue':cue['id']} for t in spoken)
    segments.append({**cue,'speech_start':start,'speech_end':start+duration,'native_duration':source_duration,'fitted_duration':duration,'tempo':tempo,'phoneme_match_ratio':confidence})
    print(f'Cue {cue["id"]:02d}: {duration:.2f}s, tempo {tempo:.3f}, phoneme match {confidence:.3f}',flush=True)
if len(words)!=P['word_count']:raise RuntimeError('Narration word count differs from approved script')
if any(w['end']<w['start'] or w['end']>P['duration'] for w in words):raise RuntimeError('Invalid word boundaries')
sf.write(OUT/'voice.wav',voice,SR,subtype='PCM_24')
(OUT/'words.json').write_text(json.dumps({'method':'Kokoro neural phoneme durations aligned to source words; scaled by measured pitch-preserving time-fit','voice':P['voice'],'language':P['language'],'words':words},indent=2))
(OUT/'phonemes.json').write_text(json.dumps(phonemes,indent=2))
(OUT/'narration-cues.json').write_text(json.dumps(segments,indent=2))
run(['ffmpeg','-v','error','-y','-i',str(OUT/'voice.wav'),'-c:a','libmp3lame','-b:a','192k',str(OUT/'narration-preview.mp3')])
print('Narration generated:',len(words),'words; exact approved text; 68.5s timeline.',flush=True)
