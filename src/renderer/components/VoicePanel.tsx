import {useEffect,useRef} from 'react';
import type {ConnectionState,VoiceState} from '../../shared/types';
import type {LocalOfflineConversation} from '../services/local-offline';
export function VoicePanel({service,state,connection,muted,onMute,onStart,onStop,audioBlocked,onResume}:{service:LocalOfflineConversation|null;state:VoiceState;connection:ConnectionState;muted:boolean;onMute:()=>void;onStart:()=>void;onStop:()=>void;audioBlocked:boolean;onResume:()=>void}) {
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{let frame=0;const paint=()=>{const el=canvas.current;if(!el)return;const context=el.getContext('2d');if(!context)return;const width=el.clientWidth,height=el.clientHeight,dpr=window.devicePixelRatio||1;if(el.width!==width*dpr||el.height!==height*dpr){el.width=width*dpr;el.height=height*dpr;}context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,width,height);const sample=service?.sample();const bars=sample?.bars||new Array(40).fill(0);const gap=5;const barWidth=Math.max(2,(width-gap*39)/40);bars.forEach((value,index)=>{const h=3+value*(height-12);context.fillStyle=value>0.03?'#75b8ff':'#384353';context.beginPath();context.roundRect(index*(barWidth+gap),(height-h)/2,barWidth,h,barWidth/2);context.fill();});frame=requestAnimationFrame(paint);};frame=requestAnimationFrame(paint);return()=>cancelAnimationFrame(frame);},[service]);
 const connected=connection==='connected';const busy=connection==='connecting'||connection==='reconnecting';
 return <section className="voice-panel" aria-label="Voice controls">
  <div className="eyebrow">REALTIME VOICE EXPERIENCE</div>
  <div className={'voice-orb '+(state==='SPEAKING'?'speaking':'')}><div className="orb-ring"/><div className="orb-core"><svg viewBox="0 0 80 80" aria-hidden="true"><path d="M18 36v8m11-20v32m11-43v54m11-43v32m11-20v8"/></svg></div><span className="orb-dot"/></div>
  <div className={'state-badge state-'+state.toLowerCase()} aria-live="polite"><i/>{busy?connection.toUpperCase():state}</div>
  <h1>{connected?'A conversation that flows.':'Meet your AI sales assistant.'}</h1>
  <p className="voice-description">{state==='SPEAKING'?'You can interrupt Avery at any time.':state==='THINKING'?'Avery is preparing a response.':state==='INTERRUPTED'?'Avery stopped speaking and is listening to you.':connected?'Speak naturally. Avery is listening.':'Natural English conversations. Product advice. A better deal.'}</p>
  <canvas ref={canvas} className="waveform" aria-label="Live microphone and assistant audio levels"/>
  <div className="voice-actions"><button className={'mic-button '+(muted?'muted':'')} onClick={onMute} disabled={!connected} aria-label={muted?'Unmute microphone':'Mute microphone'} aria-pressed={muted}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>{muted&&<path d="m3 3 18 18"/>}</svg></button><button className={connected?'button stop':'button primary'} onClick={connected||busy?onStop:onStart}>{connected||busy?'End Conversation':'Start Conversation'}<span aria-hidden="true">{connected?'■':'↗'}</span></button></div>
  {audioBlocked&&<div className="audio-alert" role="alert"><b>Audio needs your permission.</b><p>Press the button to enable speakers and hear Avery.</p><button className="button primary" onClick={onResume}>Enable audio · Start Conversation</button></div>}
  <div className="voice-footnote"><span className="tiny-dot"/>{connected?(muted?'Microphone muted':'LOCAL_OFFLINE · Whisper + Ollama + Piper'):'Check local runtime to begin'}<span>English · AI voice</span></div>
 </section>;
}
