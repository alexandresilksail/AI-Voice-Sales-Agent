import {spawn} from 'node:child_process';
import {stat, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {net} from 'electron';

export interface LocalRuntimeConfig {
  ollamaUrl: string; ollamaModel: string; whisperPath: string; whisperModel: string;
  piperPath: string; piperModel: string; language: 'auto' | 'en' | 'zh';
}
export interface RuntimeCheck { name: string; ok: boolean; detail: string; }

export function localOllamaUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.port !== '11434' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Ollama must use http://127.0.0.1:11434. Cloud and proxy URLs are disabled.');
  }
  return url.origin;
}

async function requireLocalModel(c:LocalRuntimeConfig,signal?:AbortSignal):Promise<void>{
  if(/cloud/i.test(c.ollamaModel))throw new Error('Cloud models are disabled in LOCAL_OFFLINE.');
  const response=await net.fetch(localOllamaUrl(c.ollamaUrl)+'/api/show',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:c.ollamaModel}),redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10000)]):AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('The selected model is not installed locally. Run ollama pull '+c.ollamaModel+' during setup.');
  const value=await response.json() as {remote_model?:string;remote_host?:string;details?:{family?:string}};
  if(value.remote_model||value.remote_host||value.details?.family==='cloud')throw new Error('Ollama remote models are disabled. Install a local Qwen model.');
}

async function fileCheck(name: string, path: string): Promise<RuntimeCheck> {
  try { const info = await stat(path); if (info.isFile() && info.size > 1024) return {name, ok: true, detail: path + ' (' + info.size + ' bytes)'}; }
  catch { /* A missing file is reported below. */ }
  return {name, ok: false, detail: 'Missing or empty: ' + path};
}

function run(exe: string, args: string[], input?: string, signal?: AbortSignal, ms = 120000): Promise<{code: number | null; stdout: Buffer; stderr: string}> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Local task was cancelled.')); return; }
    const child = spawn(exe, args, {windowsHide: true, stdio: ['pipe','pipe','pipe']});
    const output: Buffer[] = []; const errors: Buffer[] = []; let settled = false;let failure:Error|undefined;
    const finish = (error?: Error, code: number | null = null) => {
      if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve({code, stdout: Buffer.concat(output), stderr: Buffer.concat(errors).toString('utf8')});
    };
    const abort = () => { failure=new Error('Local task was cancelled.');child.kill(); };
    const timer = setTimeout(() => {failure=new Error('Local process timed out.');child.kill();}, ms);
    signal?.addEventListener('abort', abort, {once: true});
    child.stdout.on('data', (data: Buffer) => output.push(Buffer.from(data)));
    child.stderr.on('data', (data: Buffer) => errors.push(Buffer.from(data)));
    child.on('error', (error: Error) => finish(error));
    child.on('close', code => finish(failure, code));
    child.stdin.on('error', () => {});
    child.stdin.end(input ?? '');
  });
}

async function executableCheck(name: string, path: string): Promise<RuntimeCheck> {
  try {const result = await run(path, ['--help'], undefined, undefined, 5000); return {name, ok: result.code === 0 || result.stdout.length > 0 || result.stderr.length > 0, detail: path};}
  catch {return {name, ok: false, detail: 'Executable unavailable: ' + path};}
}

export async function checkRuntime(c: LocalRuntimeConfig): Promise<RuntimeCheck[]> {
  const checks: RuntimeCheck[] = [];
  try {
    const response = await net.fetch(localOllamaUrl(c.ollamaUrl) + '/api/tags', {signal: AbortSignal.timeout(3000), redirect: 'error'});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const value = await response.json() as {models?: Array<{name?: string;remote_model?:string;remote_host?:string}>};
    const models = (value.models ?? []).filter(model=>!model.remote_model&&!model.remote_host).map(model => model.name ?? '');
    checks.push({name:'Ollama', ok:true, detail:'Local service is running'});
    checks.push({name:'Ollama model', ok:models.includes(c.ollamaModel), detail:models.includes(c.ollamaModel) ? c.ollamaModel : 'Install locally: ollama pull ' + c.ollamaModel});
    if(models.includes(c.ollamaModel)){await requireLocalModel(c);}
  } catch (error) {
    checks.push({name:'Ollama',ok:false,detail:'Cannot reach the local service. Install Ollama and start "ollama serve" at 127.0.0.1:11434. '+(error instanceof Error?error.message:'')});
    checks.push({name:'Ollama model',ok:false,detail:'After starting Ollama, install the local model: ollama pull '+c.ollamaModel});
  }
  checks.push(await executableCheck('whisper.cpp', c.whisperPath));
  checks.push(await fileCheck('Whisper model', c.whisperModel));
  checks.push(await executableCheck('Piper', c.piperPath));
  checks.push(await fileCheck('Piper voice', c.piperModel));
  checks.push(await fileCheck('Piper voice config', c.piperModel + '.json'));
  return checks;
}

export async function localChat(c: LocalRuntimeConfig, messages: Array<{role:string;content:string}>, onToken: (token: string) => void, signal?: AbortSignal): Promise<string> {
  await requireLocalModel(c,signal);
  const response = await net.fetch(localOllamaUrl(c.ollamaUrl) + '/api/chat', {
    method:'POST',headers:{'content-type':'application/json'},redirect:'error',
    body:JSON.stringify({model:c.ollamaModel,messages,stream:true,options:{temperature:0.3,num_ctx:4096,num_predict:500}}), signal: signal ? AbortSignal.any([signal,AbortSignal.timeout(120000)]) : AbortSignal.timeout(120000)
  });
  if (!response.ok) throw new Error('Local Ollama returned HTTP ' + response.status + '. Check installed model ' + c.ollamaModel + '.');
  if (!response.body) throw new Error('Ollama returned an empty stream.');
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let carry = ''; let answer = '';
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      carry += decoder.decode(part.value, {stream:true});
      const lines = carry.split('\n'); carry = lines.pop() ?? '';
      for (const line of lines) {if (!line.trim()) continue; const item = JSON.parse(line) as {message?:{content?:string};error?:string};
        if (item.error) throw new Error(item.error); const token = item.message?.content ?? ''; answer += token; if (token) onToken(token);}
    }
    if (carry.trim()) {const item = JSON.parse(carry) as {message?:{content?:string};error?:string};if(item.error)throw new Error(item.error);const token=item.message?.content??'';answer+=token;if(token)onToken(token);}
    return answer.trim();
  } finally {reader.releaseLock();}
}

export async function localTranscribe(c: LocalRuntimeConfig, pcm: Buffer, sampleRate = 16000, signal?: AbortSignal): Promise<string> {
  if (sampleRate !== 16000 || pcm.length < 6400 || pcm.length > 16000 * 2 * 20 || pcm.length % 2) throw new Error('Expected 16 kHz mono PCM16 speech (0.2-20 seconds).');
  const directory = await mkdtemp(join(tmpdir(),'sales-agent-whisper-')); const wav = join(directory,'speech.wav');
  const header = Buffer.alloc(44); header.write('RIFF',0); header.writeUInt32LE(36 + pcm.length,4); header.write('WAVEfmt ',8);
  header.writeUInt32LE(16,16); header.writeUInt16LE(1,20); header.writeUInt16LE(1,22); header.writeUInt32LE(sampleRate,24);
  header.writeUInt32LE(sampleRate * 2,28); header.writeUInt16LE(2,32); header.writeUInt16LE(16,34);
  header.write('data',36); header.writeUInt32LE(pcm.length,40);
  await writeFile(wav,Buffer.concat([header,pcm]));
  try {
    // Continuous Silero ONNX VAD already segments speech locally in the audio renderer.
    const args = ['-m',c.whisperModel,'-f',wav,'--output-txt','-l',c.language,'--no-gpu'];
    const result = await run(c.whisperPath,args,undefined,signal);
    if (result.code !== 0) throw new Error('Local Whisper/Silero failed: ' + result.stderr.slice(-400));
    const text = await readFile(wav + '.txt','utf8').catch(() => result.stdout.toString('utf8'));
    return text.trim();
  } finally {await rm(directory,{recursive:true,force:true});}
}

export async function localSpeak(c: LocalRuntimeConfig, text: string, signal?: AbortSignal): Promise<string> {
  if (!text.trim() || text.length > 1200) throw new Error('Piper text must contain 1-1200 characters.');
  const directory = await mkdtemp(join(tmpdir(),'sales-agent-piper-')); const wav = join(directory,'speech.wav');
  try {
    const result = await run(c.piperPath,['--model',c.piperModel,'--output_file',wav],text,signal);
    if (result.code !== 0) throw new Error('Local Piper failed: ' + result.stderr.slice(-400));
    return (await readFile(wav)).toString('base64');
  } finally {await rm(directory,{recursive:true,force:true});}
}
