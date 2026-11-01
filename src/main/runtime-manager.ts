import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {resolve,sep,isAbsolute,relative} from 'node:path';
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
  let config:Record<string,unknown>;
  try{config=JSON.parse((await readFile(resolve(directory,'runtime-config.json'),'utf8')).replace(/^\uFEFF/,''));}
  catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')throw new Error('No runtime-config.json in this folder. Open the setup folder and run INSTALL-LOCAL-RUNTIME.cmd, or enter the executable/model paths manually.');throw new Error('The runtime-config.json file could not be read. Run local setup again.');}
  if(!config||typeof config!=='object'||Array.isArray(config))throw new Error('Invalid runtime configuration.');
  const values:Record<string,string>={};
  for(const key of ['whisperPath','whisperModel','piperPath','piperModel']){
    if(typeof config[key]!=='string')throw new Error('Incomplete runtime configuration: '+key);
    // Rebase older manifests copied from another PC and support new relative entries.
    const entry=config[key];const entryRelative=isAbsolute(entry)&&typeof config.runtimeDirectory==='string'?relative(resolve(config.runtimeDirectory),resolve(entry)):entry;
    const file=within(directory,entryRelative);
    values[key]=file;
  }
  return {runtimeDirectory:directory,...values};
}
