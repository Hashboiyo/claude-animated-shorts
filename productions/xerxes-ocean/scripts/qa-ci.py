"""Stream decoded final frames for QA; visual generation happens only in Remotion."""
import json, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

config=json.loads(Path('render-manifest.json').read_text())
video=Path('output/xerxes-ocean-visual-master-1440x2560.mp4')
width,height=180,320
process=subprocess.Popen(['ffmpeg','-v','error','-i',str(video),'-vf',f'scale={width}:{height}:flags=area','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
previous=None;diffs=[];black=[];white=[];frozen=[];freeze_start=None;frame=0
sheet=Image.new('RGB',(width*4,height*4),'#171e2b');draw=ImageDraw.Draw(sheet)
review={f:i for i,f in enumerate(config['review_frames'])}
while True:
    data=process.stdout.read(width*height*3)
    if not data:break
    if len(data)!=width*height*3:raise RuntimeError('Truncated decoded frame')
    rgb=np.frombuffer(data,np.uint8).reshape(height,width,3)
    luma=(rgb.astype(np.float32)@np.array([.2126,.7152,.0722],np.float32))/255
    if luma.mean()<.025:black.append(frame)
    if luma.mean()>.95 and frame not in config['planned_lightning']:white.append(frame)
    if previous is not None:
        difference=float(np.abs(rgb.astype(np.int16)-previous).mean());diffs.append(difference)
        if difference<.025:
            if freeze_start is None:freeze_start=frame-1
        elif freeze_start is not None:
            if frame-freeze_start>=12:frozen.append([freeze_start,frame-1])
            freeze_start=None
    if frame in review:
        i=review[frame];x=(i%4)*width;y=(i//4)*height
        sheet.paste(Image.fromarray(rgb),(x,y));draw.rectangle((x,y,x+72,y+14),fill='#171e2b');draw.text((x+3,y+2),f'{frame/30:.1f}s',fill='white')
    previous=rgb.astype(np.int16);frame+=1
if freeze_start is not None and frame-freeze_start>=12:frozen.append([freeze_start,frame-1])
error=process.stderr.read().decode();status=process.wait()
if status:raise RuntimeError(f'Decode failed: {error}')
if frame!=config['frames']:raise RuntimeError(f'Decoded {frame} instead of {config["frames"]}')
planned=set(config['shots'])|set(config['planned_lightning'])
pops=[]
for i,d in enumerate(diffs):
    local=float(np.median(diffs[max(0,i-8):i+9]))
    if d>3*local+1 and i+1 not in planned:pops.append(i+1)
report={'decoded_frames':frame,'decode_ok':True,'black_frames':black,'unplanned_white_frames':white,'frozen_spans_12_frames_or_more':frozen,'pop_candidates_for_review':pops,'mean_frame_difference':float(np.mean(diffs)),'audio':'not supplied — silent visual master','full_narration_sync':'not checked — no narration','status':'passed' if not (black or white or frozen) else 'needs review'}
Path('output/qa.json').write_text(json.dumps(report,indent=2))
sheet.save('output/rendered-contact-sheet.jpg',quality=92)
print(json.dumps(report,indent=2))
if black or white or frozen:sys.exit(1)
