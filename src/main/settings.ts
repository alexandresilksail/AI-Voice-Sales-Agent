import {join} from 'node:path';
import {localOllamaUrl} from './local-runtime';
import {JsonStore} from './store';
import type {LocalRuntimeSettings,PublicSettings,SettingsUpdate} from '../shared/types';
const defaults=():LocalRuntimeSettings=>({mode:'LOCAL_OFFLINE',runtimeDirectory:'',ollamaUrl:'http://127.0.0.1:11434',ollamaModel:'qwen2.5:3b',whisperPath:'whisper-cli.exe',whisperModel:'models/ggml-base.bin',piperPath:'piper.exe',piperModel:'models/en_US-lessac-medium.onnx',language:'auto',microphoneId:'default',outputId:'default'});
const valid=(value:unknown):value is LocalRuntimeSettings=>{
  if(!value||typeof value!=='object')return false;
  const v=value as LocalRuntimeSettings;
  return v.mode==='LOCAL_OFFLINE'&&['ollamaUrl','ollamaModel','whisperPath','whisperModel','piperPath','piperModel'].every(key=>typeof v[key as keyof LocalRuntimeSettings]==='string')&&['auto','en','zh'].includes(v.language);
};
export class SettingsService {
  private store:JsonStore<LocalRuntimeSettings>;private settings:LocalRuntimeSettings;
  constructor(directory:string){this.store=new JsonStore(join(directory,'settings.json'),defaults,valid);const saved=this.store.read();this.settings=defaults();for(const key of Object.keys(this.settings) as Array<keyof LocalRuntimeSettings>){if(saved[key]!==undefined)(this.settings as any)[key]=saved[key];}}
  get notice(){return this.store.notice;}
  public():PublicSettings{return {...this.settings,hasApiKey:false,keyHint:'',encryptionAvailable:true};}
  config(){return {...this.settings};}
  update(update:SettingsUpdate):PublicSettings{
    if(!update||typeof update!=='object')throw new Error('Invalid local settings.');
    const next={...this.settings};
    for(const key of ['runtimeDirectory','ollamaUrl','ollamaModel','whisperPath','whisperModel','piperPath','piperModel','microphoneId','outputId'] as const){
      const value=update[key];if(value!==undefined){if(typeof value!=='string'||(!value&&key!=='runtimeDirectory')||value.length>500)throw new Error('Invalid '+key+'.');next[key]=value;}
    }
    if(update.language!==undefined){if(!['auto','en','zh'].includes(update.language))throw new Error('Invalid language.');next.language=update.language;}
    localOllamaUrl(next.ollamaUrl);
    if(/cloud/i.test(next.ollamaModel))throw new Error('Cloud model identifiers are disabled. Choose an installed local model.');
    this.store.write(next);this.settings=next;return this.public();
  }
}
