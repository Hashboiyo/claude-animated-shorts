import React from 'react';
import {Composition} from 'remotion';
import {ErfurtV2} from './videos/erfurt-v2/Erfurt';
export const Root:React.FC=()=> <Composition id="ErfurtV2" component={ErfurtV2} durationInFrames={1157} fps={30} width={1080} height={1920} defaultProps={{preview:false}}/>;
