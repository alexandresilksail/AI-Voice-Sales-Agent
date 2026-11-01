import {join} from 'node:path';
import {existsSync,readFileSync,copyFileSync} from 'node:fs';
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
  private migrationNotice:string|null=null;
  constructor(directory:string){
    const file=join(directory,'settings.json');this.store=new JsonStore(file,defaults,valid);
    if(existsSync(file)){
      let legacy:Record<string,unknown>|null=null;
      try{const value=JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/,''));if(value&&typeof value==='object'&&!Array.isArray(value)&&!valid(value)&&(['GEMINI_LIVE','GEMINI','OPENAI_REALTIME','LOCAL','MOCK'].includes(value.mode)||['encryptedGeminiKey','encryptedOpenAIKey','encryptedApiKey'].some(key=>typeof value[key]==='string')))legacy=value;}catch{/* JsonStore reports unreadable files. */}
      if(legacy){
        const next=defaults();for(const key of ['microphoneId','outputId'] as const)if(typeof legacy[key]==='string'&&legacy[key].length>0&&legacy[key].length<=500)next[key]=legacy[key];
        if(['auto','en','zh'].includes(String(legacy.language)))next.language=legacy.language as LocalRuntimeSettings['language'];
        copyFileSync(file,file+'.legacy-'+Date.now());this.store.write(next);this.migrationNotice='Previous voice settings were migrated to LOCAL_OFFLINE. Configure local runtimes in Settings. Order history was not changed.';
      }
    }
    const saved=this.store.read();this.settings=defaults();for(const key of Object.keys(this.settings) as Array<keyof LocalRuntimeSettings>){if(saved[key]!==undefined)(this.settings as any)[key]=saved[key];}
  }
  get notice(){return this.migrationNotice||this.store.notice;}
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
