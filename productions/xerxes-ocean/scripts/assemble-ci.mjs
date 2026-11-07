import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const config=JSON.parse(fs.readFileSync('render-manifest.json','utf8'));
fs.mkdirSync('output',{recursive:true});
let next=0;const paths=[];
for(let index=0;index<config.chunks;index++){
 const name=`chunk-${String(index).padStart(2,'0')}`,file=path.resolve(`work/chunks/${name}.mp4`),meta=JSON.parse(fs.readFileSync(`work/chunks/${name}.json`,'utf8'));
 if(meta.index!==index||meta.start!==next||meta.end<meta.start||meta.frames!==meta.end-meta.start+1)throw new Error(`Gap/overlap or wrong manifest at ${name}`);
 if(meta.commit!==process.env.GITHUB_SHA)throw new Error(`Source commit mismatch: ${name}`);
 if(meta.sha256!==crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'))throw new Error(`Damaged chunk ${name}`);
 for(const k of ['width','height','fps'])if(meta[k]!==config[k])throw new Error(`Mismatched ${k}: ${name}`);
 next=meta.end+1;paths.push(file);
}
if(next!==config.frames)throw new Error(`Coverage ${next} != ${config.frames}`);
fs.writeFileSync('work/concat.txt',paths.map(p=>`file '${p.replaceAll("'","'\\''")}'`).join('\n')+'\n');
const output='output/xerxes-ocean-visual-master-1440x2560.mp4';
const result=spawnSync('ffmpeg',['-hide_banner','-loglevel','warning','-y','-f','concat','-safe','0','-i','work/concat.txt','-c','copy','-an','-movflags','+faststart',output],{stdio:'inherit'});
if(result.status!==0)throw new Error('FFmpeg lossless assembly failed');
const probe=spawnSync('ffprobe',['-v','error','-count_frames','-show_entries','stream=codec_type,codec_name,width,height,r_frame_rate,nb_read_frames:format=duration','-of','json',output],{encoding:'utf8'});
if(probe.status!==0)throw new Error(probe.stderr);const metadata=JSON.parse(probe.stdout),v=metadata.streams.find(s=>s.codec_type==='video');
if(v.width!==config.width||v.height!==config.height||Number(v.nb_read_frames)!==config.frames||v.r_frame_rate!==`${config.fps}/1`||Math.abs(Number(metadata.format.duration)-config.duration_seconds)>.04)throw new Error(`Unexpected assembled specs: ${probe.stdout}`);
const report={composition:config.composition,commit:process.env.GITHUB_SHA,frames:Number(v.nb_read_frames),width:v.width,height:v.height,fps:config.fps,duration_seconds:Number(metadata.format.duration),bytes:fs.statSync(output).size,audio:config.audio,assembly:'lossless concat; all eight contiguous chunks verified by SHA-256'};
fs.writeFileSync('output/render-manifest.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`## Xerxes visual master\n\n${report.width} × ${report.height}, ${report.fps} fps, ${report.frames} frames, ${report.duration_seconds}s.\n\nEight chunks assembled without re-rendering. Audio: **not supplied — silent visual master**.\n`);
