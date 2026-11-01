import {afterEach,describe,it,expect} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyRuntimeFiles} from '../src/main/runtime-manager';
const dirs:string[]=[];
afterEach(async()=>{await Promise.all(dirs.splice(0).map(path=>rm(path,{recursive:true,force:true})));});
describe('local runtime integrity',()=>{
 it('detects model corruption rather than accepting only a file name',async()=>{
  const root=await mkdtemp(join(tmpdir(),'sales-agent-integrity-'));dirs.push(root);
  await writeFile(join(root,'model.bin'),'verified model fixture');
  const sha256=createHash('sha256').update('verified model fixture').digest('hex');
  await writeFile(join(root,'runtime-manifest.json'),JSON.stringify({version:1,files:[{path:'model.bin',sha256,version:'fixture'}]}));
  expect((await verifyRuntimeFiles(root))[0].ok).toBe(true);
  await writeFile(join(root,'model.bin'),'damaged');expect((await verifyRuntimeFiles(root))[0].ok).toBe(false);
 });
 it('rejects a manifest path that leaves the chosen runtime directory',async()=>{
  const root=await mkdtemp(join(tmpdir(),'sales-agent-integrity-'));dirs.push(root);
  await writeFile(join(root,'runtime-manifest.json'),JSON.stringify({version:1,files:[{path:'../outside.bin',sha256:'a'.repeat(64),version:'fixture'}]}));
  const result=await verifyRuntimeFiles(root);expect(result[0].ok).toBe(false);expect(result[0].detail).toContain('invalid path');
 });
});
