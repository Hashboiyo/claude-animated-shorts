"""Mix original score beneath narration and copy the completed visual stream unchanged."""
import hashlib,json,re,subprocess
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.ndimage import uniform_filter1d,maximum_filter1d

P=json.loads(Path('audio-plan.json').read_text());SR=P['sample_rate'];OUT=Path('output');OUT.mkdir(exist_ok=True)
def run(args):
    r=subprocess.run(args,capture_output=True,text=True)
    if r.returncode:raise RuntimeError(r.stderr)
    return r

voice,rate=sf.read(OUT/'voice.wav',dtype='float32');music,mrate=sf.read(OUT/'music.wav',dtype='float32')
expected=round(P['duration']*SR)
if rate!=SR or mrate!=SR or len(voice)!=expected or len(music)!=expected:raise RuntimeError('Audio duration/sample-rate mismatch')
if voice.ndim!=1 or music.shape!=(expected,2):raise RuntimeError('Unexpected stem channel layout')
power=uniform_filter1d(voice.astype(np.float64)**2,size=round(.03*SR))
active=power>max(1e-7,float(power.max())*.014)
if active.mean()<.2:raise RuntimeError('Narration mostly silent')
voice_rms=float(np.sqrt(np.mean(voice[active]**2)));music_rms=float(np.sqrt(np.mean(music**2)))
if music_rms<1e-6:raise RuntimeError('Empty music stem')
base_gain=voice_rms*10**(-13/20)/music_rms
music_setting=10**(3/20)
duck=maximum_filter1d(active.astype(float),size=round(.12*SR))
duck=uniform_filter1d(duck,size=round(.06*SR))
duck_gain=10**((-3*duck)/20)
bed=music*base_gain*music_setting*duck_gain[:,None]
raw=np.stack([voice,voice],axis=1)+bed
sf.write(OUT/'mix-premaster.wav',raw,SR,subtype='FLOAT')
sf.write(OUT/'music-at-mix.wav',bed,SR,subtype='PCM_24')

# Two-pass whole-mix loudness calibration; the voice stem itself receives no EQ or pitch shift.
measurement=run(['ffmpeg','-hide_banner','-i',str(OUT/'mix-premaster.wav'),'-af','loudnorm=I=-15:TP=-1.5:LRA=6:print_format=json','-f','null','-'])
found=re.findall(r'\{\s*"input_i".*?\}',measurement.stderr,re.S)
if not found:raise RuntimeError('No loudness measurements')
stats=json.loads(found[-1])
if not np.isfinite(float(stats['input_i'])):raise RuntimeError('Invalid loudness')
normalizer=f'loudnorm=I=-15:TP=-1.5:LRA=6:measured_I={stats["input_i"]}:measured_TP={stats["input_tp"]}:measured_LRA={stats["input_lra"]}:measured_thresh={stats["input_thresh"]}:offset={stats["target_offset"]}:linear=true:print_format=json'
run(['ffmpeg','-v','error','-y','-i',str(OUT/'mix-premaster.wav'),'-af',normalizer,'-ar',str(SR),'-t',str(P['duration']),'-c:a','pcm_s24le',str(OUT/'mix.wav')])
mix,mixrate=sf.read(OUT/'mix.wav',dtype='float32')
if len(mix)!=expected or mixrate!=SR or not np.isfinite(mix).all():raise RuntimeError('Invalid mastered mix')
if np.max(np.abs(mix))>=1:raise RuntimeError('Clipping in mastered mix')

visual=Path('work/visual/xerxes-ocean-visual-master-1440x2560.mp4')
if not visual.is_file():raise RuntimeError('Completed visual master not downloaded')
final=OUT/'xerxes-ocean-final-1440x2560.mp4'
run(['ffmpeg','-v','error','-y','-i',str(visual),'-i',str(OUT/'mix.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','256k','-ar',str(SR),'-ac','2','-t',str(P['duration']),'-movflags','+faststart',str(final)])
def video_hash(file):return run(['ffmpeg','-v','error','-i',str(file),'-map','0:v:0','-c:v','copy','-f','hash','-hash','sha256','-']).stdout.strip()
before,after=video_hash(visual),video_hash(final)
if before!=after:raise RuntimeError('Video stream changed during audio mux')
probe=json.loads(run(['ffprobe','-v','error','-count_packets','-show_entries','stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,nb_read_packets,sample_rate,channels:format=duration','-of','json',str(final)]).stdout)
v=next(s for s in probe['streams'] if s['codec_type']=='video');a=next(s for s in probe['streams'] if s['codec_type']=='audio')
if (v['width'],v['height'],v['r_frame_rate'],int(v['nb_read_packets']))!=(1440,2560,'30/1',2055):raise RuntimeError('Final video specs differ')
if a['codec_name']!='aac' or int(a['sample_rate'])!=SR or a['channels']!=2:raise RuntimeError('Final audio specs differ')
if abs(float(probe['format']['duration'])-P['duration'])>.05:raise RuntimeError('Final audiovisual duration mismatch')
audiorun=run(['ffmpeg','-hide_banner','-i',str(final),'-map','0:a:0','-af','ebur128=peak=true','-f','null','-'])
summary=audiorun.stderr[audiorun.stderr.rfind('Summary:'):]
integrated=float(re.search(r'I:\s*([+-]?[\d.]+)\s*LUFS',summary).group(1))
peak=float(re.search(r'Peak:\s*([+-]?[\d.]+)\s*dBFS',summary).group(1))
if not -18<=integrated<=-12 or peak>-.3:raise RuntimeError(f'Unexpected final audio levels {integrated}LUFS / {peak}dBTP')
words=json.loads((OUT/'words.json').read_text())['words']
if len(words)!=P['word_count'] or words[-1]['end']>P['duration']:raise RuntimeError('Incomplete narration word timeline')
for name in ['mix','music']:
    run(['ffmpeg','-v','error','-y','-i',str(OUT/f'{name}.wav'),'-c:a','libmp3lame','-b:a','192k',str(OUT/f'{name}-preview.mp3')])
report={'status':'passed','video_stream_unchanged':True,'video_stream_sha256':after,'re_rendered_video_frames':0,'width':1440,'height':2560,'fps':30,'frames':2055,'duration_seconds':float(probe['format']['duration']),'bytes':final.stat().st_size,'audio_codec':'aac','audio_sample_rate':SR,'audio_channels':2,'integrated_lufs':integrated,'true_peak_dbfs':peak,'narration_voice':P['voice'],'narration_language':P['language'],'narrated_words':len(words),'narration_timing':'neural phoneme durations, aligned to source words; fitted to the sixteen existing shots','music_original':True,'music_setting_db':3,'speech_duck_db':-3,'master':'two-pass loudness normalization of whole mix; voice stem un-EQd; pitch preserved','final_file':str(final)}
(OUT/'audio-video-qa.json').write_text(json.dumps(report,indent=2))
(OUT/'audio-rights.md').write_text('Original approved narration text and original synthesized score.\n\nNarration generated with Kokoro-82M v1.0, bm_george English preset. Kokoro model: Apache-2.0; kokoro-onnx engine: MIT, per publisher https://github.com/thewh1teagle/kokoro-onnx . Official model and voice-pack downloads are hash-verified. Model files are not redistributed in these artifacts.\n\nMusic composed for this production with original synthesized plucked strings, mallets and percussion. Instrument/DSP helpers derive from the MIT-licensed animated-shorts templates; see LICENSE.template. No stock music recordings or reference audio used.\n')
Path('FINAL_REPORT.txt').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2),flush=True)
