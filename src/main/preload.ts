import {contextBridge,ipcRenderer} from 'electron';
import type { SalesBridge } from '../shared/types';
const bridge: SalesBridge = {
 bootstrap:()=>ipcRenderer.invoke('app:bootstrap'),
 saveSettings:update=>ipcRenderer.invoke('settings:save',update),
 testConnection:()=>ipcRenderer.invoke('local:check').then((checks:any[])=>({ok:checks.every(x=>x.ok),message:checks.map(x=>(x.ok?'PASS ':'BLOCKED ')+x.name+': '+x.detail).join('\n')})),
 checkLocalRuntime:()=>ipcRenderer.invoke('local:check'),
 loadRuntimeDirectory:directory=>ipcRenderer.invoke('local:load-directory',directory),
 chooseRuntimeDirectory:()=>ipcRenderer.invoke('local:choose-directory'),
 openLocalSetup:()=>ipcRenderer.invoke('local:open-setup'),
 verifyRuntimeFiles:()=>ipcRenderer.invoke('local:verify'),
 beginLocalTurn:turnId=>ipcRenderer.invoke('local:begin',turnId),
 cancelLocalTurn:turnId=>ipcRenderer.invoke('local:cancel',turnId),
 localChat:async(turnId,messages,onToken)=>{const listener=(_event:Electron.IpcRendererEvent,value:{turnId:string;token:string})=>{if(value.turnId===turnId)onToken(value.token);};ipcRenderer.on('local:token',listener);try{return await ipcRenderer.invoke('local:chat',turnId,messages);}finally{ipcRenderer.removeListener('local:token',listener);}},
 localTranscribe:(turnId,pcmBase64,sampleRate)=>ipcRenderer.invoke('local:transcribe',turnId,pcmBase64,sampleRate),
 localSpeak:(turnId,text)=>ipcRenderer.invoke('local:speak',turnId,text),
 startSession:productId=>ipcRenderer.invoke('sales:start',productId),
 stopSession:sessionId=>ipcRenderer.invoke('sales:stop',sessionId),
 beginTurn:(sessionId,turnId)=>ipcRenderer.invoke('sales:begin',sessionId,turnId),
 completeTurn:(sessionId,turnId,text)=>ipcRenderer.invoke('sales:complete',sessionId,turnId,text),
 tool:request=>ipcRenderer.invoke('sales:tool',request),
 selectProduct:productId=>ipcRenderer.invoke('sales:select',productId),
 checkOffer:(productId,dollars)=>ipcRenderer.invoke('sales:offer',productId,dollars),
 acceptOffer:(productId,quantity)=>ipcRenderer.invoke('sales:accept',productId,quantity),
 orders:()=>ipcRenderer.invoke('sales:orders'),
};
contextBridge.exposeInMainWorld('salesAgent',bridge);
