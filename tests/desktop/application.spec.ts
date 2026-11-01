import {test,expect,_electron as electron} from '@playwright/test';
import {mkdtemp,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const desktopArgs=()=>process.env.SALES_AGENT_PACKAGED_EXE?{executablePath:process.env.SALES_AGENT_PACKAGED_EXE,args:['--test-mode']}:{args:[resolve('.'),'--test-mode']};

test('offline desktop catalog, price protection and persisted orders',async()=>{
  const data=await mkdtemp(join(tmpdir(),'sales-agent-qa-'));
  const env={...process.env,SALES_AGENT_TEST_USER_DATA:data,SALES_AGENT_DEV:'0'};
  const launch=()=>electron.launch({...desktopArgs(),env});
  let app=await launch();
  try{
    let page=await app.firstWindow();
    await expect(page.getByRole('button',{name:'Start Conversation',exact:true})).toBeVisible();
    const checks=await page.evaluate(()=>window.salesAgent.checkLocalRuntime());
    expect(checks.map(check=>check.name)).toContain('Ollama model');
    for(const name of ['Smartphone','Laptop','Wireless Headphones','Smartwatch','Bluetooth Speaker']){
      await page.getByRole('button',{name,exact:true}).click();
      await expect(page.locator('.product-image img')).toBeVisible();
    }
    await page.getByRole('button',{name:'Wireless Headphones',exact:true}).click();
    await page.getByLabel('Local price check').fill('85');await page.getByRole('button',{name:'Check offer'}).click();
    await expect(page.locator('.current-price strong')).toHaveText('$85.00');
    await page.getByLabel('Local price check').fill('65');await page.getByRole('button',{name:'Check offer'}).click();
    await expect(page.locator('.quote-status')).toHaveText('OFFER REJECTED');
    await page.getByLabel('Local price check').fill('85');await page.getByRole('button',{name:'Check offer'}).click();
    await page.getByRole('button',{name:/Accept.*prepare order/}).click();
    const orders=JSON.parse(await readFile(join(data,'orders.json'),'utf8'));
    expect(orders).toHaveLength(1);expect(orders[0]).toMatchObject({finalUnitPriceCents:8500,status:'PENDING',paymentStatus:'UNPAID'});
    await app.close();app=await launch();page=await app.firstWindow();
    await page.getByRole('button',{name:/^Orders/}).click();
    await expect(page.getByRole('heading',{name:orders[0].id})).toBeVisible();
    await page.screenshot({path:'outputs/desktop-orders.png'});
  }finally{await app.close();}
});

test('bundled Silero model and WASM process local silent audio without a microphone',async()=>{
  const data=await mkdtemp(join(tmpdir(),'sales-agent-qa-'));
  const app=await electron.launch({...desktopArgs(),env:{...process.env,SALES_AGENT_TEST_USER_DATA:data,SALES_AGENT_DEV:'0'}});
  try{
    const page=await app.firstWindow();
    await expect(page.getByRole('button',{name:'Start Conversation',exact:true})).toBeVisible();
    const asset=(await readdir(resolve('dist/renderer/assets'))).find(name=>/^dist-.*\.js$/.test(name));
    expect(asset).toBeTruthy();
    const result=await page.evaluate(async asset=>{
      const {default:module}=await import('/assets/'+asset);
      const context=new AudioContext({sampleRate:48000});await context.resume();
      const destination=context.createMediaStreamDestination();const silence=context.createConstantSource();silence.offset.value=0;silence.connect(destination);silence.start();
      let frames=0,maxSpeech=0,starts=0;
      const vad=await module.MicVAD.new({model:'v5',audioContext:context,startOnLoad:false,baseAssetPath:new URL('/vad/',location.href).toString(),onnxWASMBasePath:new URL('/vad/',location.href).toString(),getStream:async()=>destination.stream,pauseStream:async()=>{},resumeStream:async()=>destination.stream,ortConfig:(ort:any)=>{ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;},onFrameProcessed:(p:any)=>{frames++;maxSpeech=Math.max(maxSpeech,p.isSpeech);},onSpeechStart:()=>{starts++;}});
      try{await vad.start();await new Promise<void>((resolve,reject)=>{const deadline=Date.now()+8000;const poll=()=>{if(frames>=15)resolve();else if(Date.now()>deadline)reject(new Error('Silero received no local audio frames.'));else setTimeout(poll,50);};poll();});return {frames,maxSpeech,starts};}
      finally{await vad.destroy();silence.stop();destination.stream.getTracks().forEach(track=>track.stop());await context.close();}
    },asset!);
    expect(result.frames).toBeGreaterThanOrEqual(15);expect(result.starts).toBe(0);expect(result.maxSpeech).toBeLessThan(0.6);
  }finally{await app.close();}
});

test.skip('Real offline microphone, Silero/Whisper, Ollama, Piper and interruption require installed local models and hardware',()=>{});
