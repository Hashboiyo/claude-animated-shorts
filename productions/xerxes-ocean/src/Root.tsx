import React from 'react';
import {Composition, Sequence} from 'remotion';
import {XerxesOcean} from './videos/xerxes-ocean/XerxesOcean';
import {TOTAL} from './videos/xerxes-ocean/story';
const MOTION_WINDOWS=[580,672,434,1680,1950];
const MotionReview:React.FC=()=> <>{MOTION_WINDOWS.map((start,i)=><Sequence key={start} from={i*60} durationInFrames={60}><Sequence from={-start}><XerxesOcean/></Sequence></Sequence>)}</>;
export const Root:React.FC=()=> <><Composition id="XerxesOcean" component={XerxesOcean} fps={30} durationInFrames={TOTAL} width={1080} height={1920}/><Composition id="XerxesMotionReview" component={MotionReview} fps={30} durationInFrames={MOTION_WINDOWS.length*60} width={1080} height={1920}/></>;
