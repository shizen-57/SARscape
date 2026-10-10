import {useState} from 'react'
import NisarExperience from './NisarExperience'
import AnnualExperience from './AnnualExperience'
import type {StudyOverlay} from './RadarStudy'
export default function SimulationWorkspace({onExit,onExplore}:{onExit:()=>void;onExplore:(overlay:StudyOverlay,component:'alongTrack'|'slantRange')=>void}){
 const [mode,setMode]=useState<'annual'|'radar'>('annual')
 return mode==='annual'?<AnnualExperience onExit={onExit} onMode={setMode}/>:<NisarExperience onExit={onExit} onExplore={onExplore} onMode={setMode}/>
}
