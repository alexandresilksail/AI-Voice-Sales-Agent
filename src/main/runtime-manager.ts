import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,stat} from 'node:fs/promises';
import {resolve,sep,isAbsolute} from 'node:path';
import type {RuntimeCheck} from './local-runtime';

function within(directory:string,relative:string):string {
  const root=resolve(directory),file=resolve(root,relative);
  if(isAbsolute(relative)||!file.startsWith(root+sep))throw new Error('Runtime manifest contains an invalid path.');
  return file;
}
export async function verifyRuntimeFiles(directory:string):Promise<RuntimeCheck[]> {
  if(!directory)return [{name:'Runtime manifest',ok:false,detail:'Choose a runtime directory to verify downloaded model hashes.'}];
  try {
    const manifest=JSON.parse((await readFile(resolve(directory,'runtime-manifest.json'),'utf8')).replace(/^\uFEFF/,'')) as {version:number;files:Array<{path:string;sha256:string;version:string}>};
    if(manifest.version!==1||!Array.isArray(manifest.files)||!manifest.files.length||manifest.files.length>1000)throw new Error('Invalid runtime manifest.');
    const checks:RuntimeCheck[]=[];
    for(const entry of manifest.files){
      if(typeof entry.path!=='string'||!/^[a-f0-9]{64}$/i.test(entry.sha256))throw new Error('Invalid runtime checksum.');
      const file=within(directory,entry.path);
      const digest=createHash('sha256');
      try {for await(const chunk of createReadStream(file))digest.update(chunk);checks.push({name:entry.path,ok:digest.digest('hex')===entry.sha256.toLowerCase(),detail:'SHA-256 · '+entry.version});}
      catch{checks.push({name:entry.path,ok:false,detail:'Missing or unreadable runtime file.'});}
    }
    return checks;
  }catch(error){return [{name:'Runtime manifest',ok:false,detail:error instanceof Error?error.message:'Cannot read runtime manifest.'}];}
}
export async function loadRuntimeDirectory(directory:string){
  if(typeof directory!=='string'||!isAbsolute(directory)||directory.length>500)throw new Error('Choose an absolute local runtime directory.');
  const config=JSON.parse((await readFile(resolve(directory,'runtime-config.json'),'utf8')).replace(/^\uFEFF/,'')) as Record<string,unknown>;
  const values:Record<string,string>={};
  for(const key of ['whisperPath','whisperModel','piperPath','piperModel']){
    if(typeof config[key]!=='string')throw new Error('Incomplete runtime configuration: '+key);
    const file=resolve(config[key]);if(!file.startsWith(resolve(directory)+sep)||!(await stat(file)).isFile())throw new Error('Runtime file is outside the chosen directory or missing: '+key);
    values[key]=file;
  }
  return {runtimeDirectory:directory,...values};
}
