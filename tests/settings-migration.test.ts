import {afterEach,describe,it,expect} from 'vitest';
import {mkdtempSync,readFileSync,writeFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {SettingsService} from '../src/main/settings';
const dirs:string[]=[];afterEach(()=>{for(const dir of dirs.splice(0))rmSync(dir,{recursive:true,force:true});});
function setup(){const dir=mkdtempSync(join(tmpdir(),'sales-agent-migration-'));dirs.push(dir);return dir;}
describe('cloud settings upgrade',()=>{
 it('migrates a credential-only Gemini file once without changing orders',()=>{
  const dir=setup();writeFileSync(join(dir,'settings.json'),JSON.stringify({encryptedGeminiKey:'encrypted-fixture'}));writeFileSync(join(dir,'orders.json'),'[]');
  const settings=new SettingsService(dir);expect(settings.public().mode).toBe('LOCAL_OFFLINE');expect(settings.notice).toContain('migrated');expect(settings.notice).not.toContain('corrupt');
  expect(readFileSync(join(dir,'orders.json'),'utf8')).toBe('[]');expect(readFileSync(join(dir,'settings.json'),'utf8')).not.toContain('encryptedGeminiKey');
  expect(readdirSync(dir).filter(name=>name.includes('.legacy-'))).toHaveLength(1);expect(new SettingsService(dir).notice).toBeNull();expect(readdirSync(dir).some(name=>name.includes('.corrupt-'))).toBe(false);
 });
 it('reports invalid settings without claiming the order history is damaged',()=>{
  const dir=setup();writeFileSync(join(dir,'settings.json'),'{broken');const settings=new SettingsService(dir);expect(settings.notice).toContain('settings');expect(settings.notice).not.toContain('order history');expect(readdirSync(dir).some(name=>name.includes('.corrupt-'))).toBe(true);
 });
});
