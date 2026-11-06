import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {bundle} from '@remotion/bundler';
import {openBrowser,renderStill,renderMedia,selectComposition} from '@remotion/renderer';

const config=JSON.parse(fs.readFileSync('render-manifest.json','utf8'));
const mode=process.argv[2];
const matrix=Array.from({length:config.chunks},(_,index)=>({index,start:Math.floor(index*config.frames/config.chunks),end:Math.floor((index+1)*config.frames/config.chunks)-1}));
if(mode==='plan'){process.stdout.write(JSON.stringify({include:matrix}));process.exit(0);}
if(!['preflight','chunk'].includes(mode))throw new Error('Expected plan, preflight, or chunk');
const part=matrix[Number(process.argv[3]??0)];
if(!part)throw new Error('Invalid chunk index');
// Chrome's Unix-domain SingletonSocket must remain under the 108-byte path limit.
const tmp=fs.mkdtempSync('/tmp/xerxes-');process.env.TMPDIR=tmp;
fs.mkdirSync('public/xerxes-ocean',{recursive:true});fs.mkdirSync('work/chunks',{recursive:true});
const serveUrl=await bundle({entryPoint:path.resolve('src/index.tsx'),publicDir:path.resolve('public')});
const browserExecutable=process.env.CHROME_PATH||undefined;
const chromiumOptions={gl:'swangle',enableMultiProcessOnLinux:true};
const browser=await openBrowser('chrome',{browserExecutable,chromiumOptions});
const inputProps={post:{dpr:mode==='preflight'?.25:config.scale}};
try{
 const composition=await selectComposition({serveUrl,id:config.composition,inputProps,puppeteerInstance:browser,browserExecutable,chromiumOptions,timeoutInMilliseconds:180000});
 for(const [key,expected] of Object.entries({durationInFrames:config.frames,fps:config.fps,width:config.source_width,height:config.source_height}))if(composition[key]!==expected)throw new Error(`Composition ${key}: ${composition[key]} != ${expected}`);
 if(mode==='preflight'){
  await renderStill({serveUrl,composition,inputProps,frame:0,scale:.25,output:'work/preflight.png',imageFormat:'png',puppeteerInstance:browser,browserExecutable,chromiumOptions,timeoutInMilliseconds:180000});
  const raw=spawnSync('ffmpeg',['-v','error','-i','work/preflight.png','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{maxBuffer:20*1024*1024});
  if(raw.status!==0)throw new Error(raw.stderr.toString());
  const data=raw.stdout;let sum=0,sum2=0;for(const x of data){sum+=x;sum2+=x*x;}const std=Math.sqrt(sum2/data.length-(sum/data.length)**2);
  if(!data.length||std<10)throw new Error(`Initial frame blank: std ${std}`);
  console.log(`Preflight passed: frame zero visible, std ${std.toFixed(2)}; ${config.frames} frames at ${config.fps}fps.`);
 }else{
  const name=`chunk-${String(part.index).padStart(2,'0')}`,output=`work/chunks/${name}.mp4`;let last=-1;
  await renderMedia({serveUrl,composition,inputProps,codec:'h264',crf:16,x264Preset:'fast',pixelFormat:'yuv420p',outputLocation:output,frameRange:[part.start,part.end],scale:config.scale,concurrency:1,imageFormat:'png',muted:true,enforceAudioTrack:false,puppeteerInstance:browser,browserExecutable,chromiumOptions,timeoutInMilliseconds:180000,onProgress:p=>{const n=Math.floor(p.progress*20);if(n!==last){last=n;console.log(`${name} ${n*5}% f${part.start}–${part.end}`);}},onBrowserLog:l=>{if(l.type==='error')console.error(l.text.slice(0,500));}});
  const bytes=fs.statSync(output).size;if(!bytes)throw new Error('Empty chunk');
  const sha256=crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex');
  fs.writeFileSync(`work/chunks/${name}.json`,JSON.stringify({...part,frames:part.end-part.start+1,bytes,sha256,width:config.width,height:config.height,fps:config.fps,commit:process.env.GITHUB_SHA??'local'},null,2));
  console.log(`${name} complete: ${bytes} bytes`);
 }
}finally{await browser.close({silent:true});}
