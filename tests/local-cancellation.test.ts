import {afterEach,describe,it,expect,vi} from 'vitest';
import {LocalOfflineConversation} from '../src/renderer/services/local-offline';
const deferred=<T>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};};
afterEach(()=>vi.unstubAllGlobals());
function setup(){
 const callbacks={connection:vi.fn(),state:vi.fn(),transcript:vi.fn(),snapshot:vi.fn(),order:vi.fn(),error:vi.fn(),audioBlocked:vi.fn()};
 const bridge={beginLocalTurn:vi.fn(async()=>{}),cancelLocalTurn:vi.fn(async()=>{})};
 vi.stubGlobal('window',{salesAgent:bridge});
 const service=new LocalOfflineConversation(callbacks) as any;service.running=true;service.activeTurn='old';
 return {service,callbacks,bridge};
}
describe('local interruption turn isolation (controlled asynchronous tests)',()=>{
 it('stops the playing source and cancels the superseded server task',async()=>{
  const {service,bridge}=setup();const source={stop:vi.fn(),disconnect:vi.fn()};service.playing=source;
  await service.newTurn();expect(source.stop).toHaveBeenCalledOnce();expect(source.disconnect).toHaveBeenCalledOnce();expect(bridge.cancelLocalTurn).toHaveBeenCalledWith('old');expect(service.playing).toBeNull();expect(service.activeTurn).not.toBe('old');
 });
 it('discards a Piper result that completes after the customer interrupts',async()=>{
  const {service,bridge}=setup();const pending=deferred<string>();Object.assign(bridge,{localSpeak:vi.fn(()=>pending.promise)});const decodeAudioData=vi.fn();service.ctx={decodeAudioData};service.output={};
  const speaking=service.speak('An old response.','old');await service.newTurn();pending.resolve('UklGRg==');await speaking;expect(decodeAudioData).not.toHaveBeenCalled();
 });
 it('discards old Whisper text rather than sending it to the new turn',async()=>{
  const {service,bridge,callbacks}=setup();const pending=deferred<string>();Object.assign(bridge,{localTranscribe:vi.fn(()=>pending.promise)});service.customer=vi.fn();
  const transcribing=service.transcribe(new Int16Array(6400),'old');await Promise.resolve();await service.newTurn();pending.resolve('Deal!');await transcribing;expect(service.customer).not.toHaveBeenCalled();expect(callbacks.order).not.toHaveBeenCalled();
 });
 it('does not synthesize an LLM response that completes after interruption',async()=>{
  const {service,bridge}=setup();const pending=deferred<{text:string}>();
  Object.assign(bridge,{beginTurn:vi.fn(async()=>{}),completeTurn:vi.fn(async()=>{}),localChat:vi.fn(()=>pending.promise)});
  service.sessionId='session';service.speak=vi.fn();const chatting=service.customer('Tell me about the catalog.','old');
  await vi.waitFor(()=>expect((bridge as any).localChat).toHaveBeenCalled());await service.newTurn();pending.resolve({text:'A stale response.'});await chatting;expect(service.speak).not.toHaveBeenCalled();
 });
});
