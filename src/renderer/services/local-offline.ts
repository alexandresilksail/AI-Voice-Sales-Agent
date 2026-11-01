import type {ConnectionState,Order,Product,SalesSnapshot,TranscriptEntry,VoiceState} from '../../shared/types';
import {explicitPrices} from '../../main/negotiation';
import type {MicVAD} from '@ricky0123/vad-web';

interface Callbacks {
  connection(value:ConnectionState):void; state(value:VoiceState):void;
  transcript(entry:TranscriptEntry):void; snapshot(value:SalesSnapshot):void;
  order(value:Order):void; error(value:string):void; audioBlocked(value:boolean):void;
}
function encode(samples:Int16Array):string {
  const bytes=new Uint8Array(samples.buffer,samples.byteOffset,samples.byteLength);
  let result=''; for(let i=0;i<bytes.length;i+=0x8000)result+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  return btoa(result);
}
function decode(value:string):ArrayBuffer {
  const raw=atob(value);const bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return bytes.buffer;
}
export function friendlyError(error:unknown):string {
  return (error instanceof Error?error.message:'Unexpected local runtime error').replace(/^Error invoking remote method '[^']+': Error: /,'');
}
export function quotedOffer(text:string):number|undefined {
  const match=text.match(/(?:\$\s*|\b(?:for|offer|pay|do|how about|can you do)\s+\$?\s*)(\d{1,5}(?:\.\d{1,2})?)\b/i);
  if(match)return Number(match[1]);
  const prices=explicitPrices(text);
  return prices.length?prices[0]/100:undefined;
}
export function acceptsOffer(text:string):boolean {
  return /\b(?:deal|i(?:'ll| will) take (?:it|them|one)|let's proceed|i accept (?:the |your )?(?:price|offer))\b/i.test(text) && !/\b(?:not|don't|maybe|if|cancel)\b/i.test(text);
}

export class LocalOfflineConversation {
  private ctx:AudioContext|null=null; private mic:MediaStream|null=null;
  private micSource:MediaStreamAudioSourceNode|null=null; private vad:MicVAD|null=null;
  private inputMeter:AnalyserNode|null=null; private outputMeter:AnalyserNode|null=null;
  private output:GainNode|null=null; private playing:AudioBufferSourceNode|null=null;
  private activeTurn:string|null=null; private running=false; private starting=false;
  private muted=false; private speechStartAt=0; private splitting=false;
  private turnReady:Promise<void>=Promise.resolve();
  private messages:Array<{role:string;content:string}>=[]; private catalog:Product[]=[];
  private productId:string|null=null; private sessionId:string|null=null;
  private lastText=''; private lastAt=0;
  constructor(private cb:Callbacks){}
  get connected(){return this.running;}
  get isMuted(){return this.muted;}
  async start(productId?:string,welcome=true){
    if(this.running||this.starting)return;this.starting=true;this.cb.connection('connecting');this.cb.error('');
    try {
      const checks=await window.salesAgent.checkLocalRuntime();const missing=checks.filter(item=>!item.ok);
      if(missing.length)throw new Error('LOCAL_OFFLINE blocked: '+missing.map(item=>item.name+' ('+item.detail+')').join('; '));
      const boot=await window.salesAgent.bootstrap();this.catalog=boot.catalog;this.productId=productId??boot.snapshot.productId;
      this.ctx=new AudioContext({sampleRate:48000});if(boot.settings.outputId!=='default'){const audio=this.ctx as AudioContext & {setSinkId?:(device:string)=>Promise<void>};if(!audio.setSinkId)throw new Error('Speaker selection is unavailable in this Electron version. Choose system default.');await audio.setSinkId(boot.settings.outputId);}await this.ctx.resume();
      this.cb.audioBlocked(this.ctx.state!=='running');
      this.ctx.onstatechange=()=>this.cb.audioBlocked(!!this.ctx&&this.ctx.state!=='running');
      this.output=this.ctx.createGain();this.output.connect(this.ctx.destination);
      this.outputMeter=this.ctx.createAnalyser();this.outputMeter.fftSize=256;this.output.connect(this.outputMeter);
      const microphoneId=boot.settings.microphoneId;
      this.mic=await navigator.mediaDevices.getUserMedia({audio:{deviceId:microphoneId==='default'?undefined:{exact:microphoneId},echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
      this.mic.getAudioTracks().forEach(track=>{track.enabled=!this.muted;track.onended=()=>{this.cb.error('Microphone disconnected. Reconnect it, then start a new conversation.');this.stop();};});
      this.micSource=this.ctx.createMediaStreamSource(this.mic);
      this.inputMeter=this.ctx.createAnalyser();this.inputMeter.fftSize=256;this.micSource.connect(this.inputMeter);
      const {MicVAD}=await import('@ricky0123/vad-web');
      const assets=new URL('/vad/',location.href).toString();
      this.vad=await MicVAD.new({model:'v5',baseAssetPath:assets,onnxWASMBasePath:assets,
        audioContext:this.ctx,getStream:async()=>this.mic!,pauseStream:async()=>{},resumeStream:async()=>this.mic!,
        startOnLoad:false,processorType:'AudioWorklet',positiveSpeechThreshold:0.6,negativeSpeechThreshold:0.35,
        redemptionMs:480,preSpeechPadMs:240,minSpeechMs:96,submitUserSpeechOnPause:true,
        ortConfig:ort=>{ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;ort.env.logLevel='error';},
        onSpeechStart:()=>{if(!this.running||this.muted)return;this.speechStartAt=Date.now();void this.newTurn().catch(error=>this.cb.error(friendlyError(error)));},
        onSpeechEnd:audio=>{this.speechStartAt=0;const turn=this.activeTurn;if(!turn||this.muted||!this.running)return;const pcm=new Int16Array(audio.length);for(let i=0;i<audio.length;i++){const value=Math.max(-1,Math.min(1,audio[i]));pcm[i]=Math.round(value*(value<0?32768:32767));}void this.transcribe(pcm,turn);},
        onVADMisfire:()=>{this.speechStartAt=0;if(this.running)this.cb.state('LISTENING');},
        onFrameProcessed:async()=>{if(this.splitting||!this.speechStartAt||Date.now()-this.speechStartAt<15000)return;this.splitting=true;try{await this.vad?.pause();if(this.running)await this.vad?.start();}finally{this.splitting=false;}}
      });
      const session=await window.salesAgent.startSession(this.productId||undefined);this.sessionId=session.sessionId;this.cb.snapshot(session);this.messages=[];this.lastText='';this.lastAt=0;
      this.running=true;this.cb.connection('connected');this.cb.state('LISTENING');
      await this.vad.start();
      if(welcome){const turn=await this.newTurn();const greeting="Hello! Welcome to our store. I'm your AI sales assistant. How can I help you today?";this.cb.transcript({id:crypto.randomUUID(),role:'assistant',text:greeting,time:Date.now()});await this.speak(greeting,turn);}
    }catch(error){this.stop();this.cb.error(friendlyError(error));}
    finally{this.starting=false;}
  }
  private async newTurn():Promise<string>{
    const previous=this.activeTurn;const turn=crypto.randomUUID();this.activeTurn=turn;
    if(this.playing){this.playing.stop();this.playing.disconnect();this.playing=null;this.cb.state('INTERRUPTED');}
    if(previous)void window.salesAgent.cancelLocalTurn(previous).catch(()=>{});
    this.turnReady=window.salesAgent.beginLocalTurn(turn);await this.turnReady;
    if(this.current(turn))this.cb.state('LISTENING');return turn;
  }
  private current(turn:string){return this.running&&this.activeTurn===turn;}
  private async transcribe(pcm:Int16Array,turn:string){
    if(!this.current(turn))return;
    this.cb.state('THINKING');
    try{
      await this.turnReady;if(!this.current(turn))return;
      const text=(await window.salesAgent.localTranscribe(turn,encode(pcm),16000)).trim();
      if(!this.current(turn))return;if(!text){this.cb.state('LISTENING');return;}
      if(text===this.lastText&&Date.now()-this.lastAt<5000){this.cb.state('LISTENING');return;}
      this.lastText=text;this.lastAt=Date.now();await this.customer(text,turn);
    }catch(error){if(this.current(turn)){this.cb.error(friendlyError(error));this.cb.state('LISTENING');}}
  }
  sendText(text:string){
    const clean=text.trim();if(!this.running)throw new Error('Start the local conversation first.');
    if(!clean||clean.length>4000)throw new Error('Enter a message of at most 4,000 characters.');
    void this.newTurn().then(turn=>this.customer(clean,turn)).catch(error=>this.cb.error(friendlyError(error)));
  }
  private async customer(text:string,turn:string){
    if(!this.current(turn))return;
    this.cb.transcript({id:turn,role:'customer',text,time:Date.now()});
    this.messages.push({role:'user',content:text});this.messages=this.messages.slice(-18);
    const match=this.catalog.find(item=>text.toLowerCase().includes(item.category.toLowerCase())||text.toLowerCase().includes(item.name.toLowerCase()));
    try{
      await window.salesAgent.beginTurn(this.sessionId!,turn);await window.salesAgent.completeTurn(this.sessionId!,turn,text);
      if(!this.current(turn))return;
      if(match&&match.id!==this.productId){this.productId=match.id;this.cb.snapshot(await window.salesAgent.selectProduct(match.id));}
      const product=this.catalog.find(item=>item.id===this.productId);
      const offer=quotedOffer(text);
      let deterministic:string|null=null;
      if(product&&(offer!==undefined||/\b(?:better price|discount|cheaper|lower price|best price)\b/i.test(text))){const result=await window.salesAgent.tool({sessionId:this.sessionId!,turnId:turn,callId:crypto.randomUUID(),name:'negotiate_price',arguments:{product_id:product.id,...(offer!==undefined?{offer}:{})}});if(!this.current(turn))return;this.cb.snapshot(result.snapshot);deterministic=String(result.result.message);}
      else if(product&&acceptsOffer(text)){
        const result=await window.salesAgent.tool({sessionId:this.sessionId!,turnId:turn,callId:crypto.randomUUID(),name:'prepare_order',arguments:{product_id:product.id,quantity:1}});
        const order=result.order;if(!order)throw new Error('No simulated order was prepared.');this.cb.order(order);
        deterministic='Thank you! Your simulated order '+order.id+' is prepared at $'+(order.finalUnitPriceCents/100).toFixed(2)+'. It is pending and unpaid.';
      }
      if(!this.current(turn))return;
      const assistantId=crypto.randomUUID();let answer='';
      if(deterministic){answer=deterministic;this.cb.transcript({id:assistantId,role:'assistant',text:answer,time:Date.now()});}
      else{
        this.cb.state('THINKING');const response=await window.salesAgent.localChat(turn,this.messages,token=>{if(this.current(turn)){answer+=token;this.cb.transcript({id:assistantId,role:'assistant',text:answer,time:Date.now()});}});
        answer=response.text||answer;
      }
      if(!this.current(turn)||!answer)return;
      this.messages.push({role:'assistant',content:answer});await this.speak(answer,turn);
    }catch(error){if(this.current(turn)){this.cb.error(friendlyError(error));this.cb.state('LISTENING');}}
  }
  private async speak(text:string,turn:string){
    const segments=(text.match(/[^.!?。！？]+[.!?。！？]?/g)?.map(s=>s.trim()).filter(Boolean)??[text]).flatMap(sentence=>sentence.length<=1000?[sentence]:sentence.match(/.{1,1000}/g)??[]);
    for(const segment of segments){
      if(!this.current(turn))return;
      const audio=await window.salesAgent.localSpeak(turn,segment);
      if(!this.current(turn)||!this.ctx||!this.output)return;
      const buffer=await this.ctx.decodeAudioData(decode(audio));
      if(!this.current(turn))return;
      await new Promise<void>(resolve=>{
        const source=this.ctx!.createBufferSource();this.playing=source;source.buffer=buffer;source.connect(this.output!);
        source.onended=()=>{if(this.playing===source)this.playing=null;source.disconnect();resolve();};
        source.start();this.cb.state('SPEAKING');
      });
    }
    if(this.current(turn))this.cb.state('LISTENING');
  }
  mute(value:boolean){this.muted=value;this.mic?.getAudioTracks().forEach(track=>track.enabled=!value);}
  async resumeAudio(){await this.ctx?.resume();this.cb.audioBlocked(!!this.ctx&&this.ctx.state!=='running');}
  stop(){
    this.running=false;if(this.activeTurn)void window.salesAgent.cancelLocalTurn(this.activeTurn).catch(()=>{});
    this.activeTurn=null;if(this.playing){try{this.playing.stop();}catch{}this.playing.disconnect();this.playing=null;}
    const vad=this.vad;this.vad=null;if(vad)void vad.destroy().catch(()=>{});
    this.micSource?.disconnect();this.inputMeter?.disconnect();this.outputMeter?.disconnect();this.output?.disconnect();
    this.mic?.getTracks().forEach(track=>{track.onended=null;track.stop();});this.mic=null;this.micSource=null;
    this.ctx?.close().catch(()=>{});this.ctx=null;this.output=null;this.inputMeter=null;this.outputMeter=null;
    this.speechStartAt=0;this.cb.connection('disconnected');this.cb.state('DISCONNECTED');
    if(this.sessionId)void window.salesAgent.stopSession(this.sessionId).catch(()=>{});this.sessionId=null;
  }
  sample(){
    const meter=(analyser:AnalyserNode|null)=>{if(!analyser)return 0;const values=new Uint8Array(analyser.fftSize);analyser.getByteTimeDomainData(values);let sum=0;for(const x of values)sum+=((x-128)/128)**2;return Math.min(1,Math.sqrt(sum/values.length)*4);};
    const input=meter(this.inputMeter),output=meter(this.outputMeter);
    return {input,output,bars:Array.from({length:40},()=>Math.max(input,output))};
  }
}
