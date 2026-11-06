import json, sys
from pathlib import Path
meta=json.loads(Path(sys.argv[1]).read_text())
v=next(s for s in meta['streams'] if s['codec_type']=='video')
a=next(s for s in meta['streams'] if s['codec_type']=='audio')
assert (v['width'],v['height'])==(1080,1920),v
assert int(v['nb_read_frames'])==1157,v
assert v['r_frame_rate']=='30/1',v
assert abs(float(meta['format']['duration'])-1157/30)<.08,meta
assert int(a['sample_rate'])==48000 and a['channels']==2,a
assert int(meta['format']['size'])>100000,meta
print('PASS: 1157 frames, native 1080x1920 at 30fps, 38.5667s, 48k stereo audio')
