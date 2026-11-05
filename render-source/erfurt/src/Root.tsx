import React from 'react';
import {Composition} from 'remotion';
import {ErfurtShort} from './videos/erfurt/Erfurt';
export const Root:React.FC=()=> <Composition id="ErfurtShort" component={ErfurtShort} durationInFrames={1800} fps={30} width={1080} height={1920}/>;
