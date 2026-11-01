import {app,BrowserWindow,ipcMain,protocol,net,session,shell,dialog} from 'electron';
import {join,resolve,sep,basename,dirname} from 'node:path';
import {mkdirSync,existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {SettingsService} from './settings';
import {SalesService} from './sales';
import {publicCatalog} from './products';
import {checkRuntime,localChat,localSpeak,localTranscribe} from './local-runtime';
import {loadRuntimeDirectory,verifyRuntimeFiles} from './runtime-manager';
import type {SettingsUpdate,ToolRequest} from '../shared/types';
protocol.registerSchemesAsPrivileged([{scheme:'app',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
app.setName('AI Voice Sales Agent');
const testMode=process.argv.includes('--test-mode');
if(testMode && process.env.SALES_AGENT_TEST_USER_DATA) {
 const directory=resolve(process.env.SALES_AGENT_TEST_USER_DATA);
 if(!directory.startsWith(resolve(tmpdir())+sep)||!basename(directory).startsWith('sales-agent-qa-')) throw new Error('Invalid isolated test data directory.');
 mkdirSync(directory,{recursive:true});app.setPath('userData',directory);app.disableHardwareAcceleration();
} else {
 const executableDirectory=dirname(app.getPath('exe'));
 const portableRoot=app.isPackaged?(process.env.PORTABLE_EXECUTABLE_DIR||(existsSync(join(executableDirectory,'portable.flag'))?executableDirectory:null)):null;
 const directory=portableRoot?join(portableRoot,'AI Voice Sales Agent Data'):join(app.getPath('appData'),'AI Voice Sales Agent');
 mkdirSync(directory,{recursive:true});app.setPath('userData',directory);
}
const devUrl=!app.isPackaged && process.env.SALES_AGENT_DEV === '1' ? 'http://127.0.0.1:5173' : null;
let window: BrowserWindow | null=null;
const allowedUrl=(value:string)=> { try {const url=new URL(value);return devUrl ? url.origin===devUrl : url.protocol==='app:'&&url.host==='desktop';} catch{return false;} };
function csp() {return "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'"+(devUrl?" 'unsafe-inline'":"")+"; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://127.0.0.1:11434"+(devUrl?' ws://127.0.0.1:5173':'')+"; media-src 'self' blob:; worker-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-src 'none'; frame-ancestors 'none'";}
function bindIpc(settings:SettingsService,sales:SalesService) {
 const tasks=new Map<string,AbortController>();
 const task=(turnId:string)=>{if(typeof turnId!=='string'||turnId.length>100||!tasks.has(turnId))throw new Error('Local turn was cancelled.');return tasks.get(turnId)!;};
 const handle=(channel:string,fn:(...args:any[])=>unknown)=>ipcMain.handle(channel,(event,...args:unknown[])=> {
   if(!window||event.sender!==window.webContents||!event.senderFrame||event.senderFrame!==event.sender.mainFrame||!allowedUrl(event.senderFrame.url)) throw new Error('Untrusted desktop request.');
   return fn(...args);
 });
 handle('app:bootstrap',()=>({catalog:publicCatalog(),snapshot:sales.snapshot(),settings:settings.public(),orders:sales.orders(),version:app.getVersion(),platform:process.platform,storageNotice:sales.notice||settings.notice}));
 handle('settings:save',(update:SettingsUpdate)=>settings.update(update));
 handle('sales:start',(id?:string)=>sales.start(id));
 handle('sales:stop',(id:string)=>sales.end(id));
 handle('sales:begin',(id:string,turn:string)=>sales.begin(id,turn));
 handle('sales:complete',(id:string,turn:string,text:string)=>sales.complete(id,turn,text));
 handle('sales:select',(id:string)=>sales.select(id));
 handle('sales:offer',(id:string,dollars:number)=>sales.manualOffer(id,dollars));
 handle('sales:accept',(id:string,quantity:number)=>sales.manualAccept(id,quantity));
 handle('sales:orders',()=>sales.orders());
 handle('sales:tool',(request:ToolRequest)=>sales.tool(request));
 handle('local:check',()=>checkRuntime(settings.config()));
 handle('local:load-directory',async(directory:string)=>settings.update(await loadRuntimeDirectory(directory)));
 handle('local:choose-directory',async()=>{if(!window)return null;const selection=await dialog.showOpenDialog(window,{title:'Choose the local runtime folder containing runtime-config.json',properties:['openDirectory']});return selection.canceled?null:settings.update(await loadRuntimeDirectory(selection.filePaths[0]));});
 handle('local:open-setup',async()=>{const directory=app.isPackaged?join(process.resourcesPath,'local-setup'):join(app.getAppPath(),'scripts');const error=await shell.openPath(directory);if(error)throw new Error('Cannot open local setup folder: '+error);});
 handle('local:verify',()=>verifyRuntimeFiles(settings.config().runtimeDirectory));
 handle('local:begin',(turnId:string)=>{if(typeof turnId!=='string'||turnId.length>100)throw new Error('Invalid local turn.');for(const controller of tasks.values())controller.abort();tasks.clear();tasks.set(turnId,new AbortController());sales.begin(sales.snapshot().sessionId,turnId);});
 handle('local:cancel',(turnId:string)=>{tasks.get(turnId)?.abort();tasks.delete(turnId);});
 handle('local:chat',async(turnId:string,messages:Array<{role:string;content:string}>)=>{const controller=task(turnId);if(!Array.isArray(messages)||messages.length>40||messages.some(message=>!['user','assistant'].includes(message.role)||typeof message.content!=='string'||message.content.length>4000))throw new Error('Invalid local conversation.');const system='You are Avery, a local AI sales assistant. Answer in English unless the customer speaks Chinese. These are fictional demo products. Only describe these catalog facts: '+JSON.stringify(publicCatalog())+'. Never approve a discount, quote a negotiated price, or claim an order exists unless the application explicitly supplied that result. Do not claim payment or shipment.';const text=await localChat(settings.config(),[{role:'system',content:system},...messages],token=>{if(!controller.signal.aborted)window?.webContents.send('local:token',{turnId,token});},controller.signal);return {text};});
 handle('local:transcribe',(turnId:string,pcmBase64:string,sampleRate=16000)=>{if(typeof pcmBase64!=='string'||pcmBase64.length>16000*2*20*2)throw new Error('Audio segment too large.');return localTranscribe(settings.config(),Buffer.from(pcmBase64,'base64'),sampleRate,task(turnId).signal);});
 handle('local:speak',(turnId:string,text:string)=>localSpeak(settings.config(),text,task(turnId).signal));
}
async function createWindow() {
 window=new BrowserWindow({width:1460,height:940,minWidth:1040,minHeight:730,backgroundColor:'#0b0d11',title:'AI Voice Sales Agent',icon:join(app.getAppPath(),'assets','icon.ico'),show:false,autoHideMenuBar:true,webPreferences:{preload:join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,spellcheck:false}});
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 window.webContents.on('will-navigate',(event,url)=>{if(!allowedUrl(url))event.preventDefault();});
 window.webContents.on('will-attach-webview',event=>event.preventDefault());
 window.once('ready-to-show',()=>window?.show());
 window.on('closed',()=>{window=null;});
 if(devUrl)await window.loadURL(devUrl);else await window.loadURL('app://desktop/index.html');
}
app.whenReady().then(async()=>{
 session.defaultSession.webRequest.onBeforeRequest((details,callback)=>{
  const url=new URL(details.url);const local=url.protocol==='app:'||url.protocol==='file:'||url.protocol==='devtools:'||url.protocol==='data:'||url.protocol==='blob:'||((url.protocol==='http:'||url.protocol==='ws:')&&url.hostname==='127.0.0.1'&&(url.port==='11434'||!!devUrl&&url.port==='5173'));
  callback({cancel:!local});
 });
 const rendererRoot=resolve(app.getAppPath(),'dist','renderer');
 protocol.handle('app',async request=>{
  const url=new URL(request.url);if(url.host!=='desktop')return new Response('Not found',{status:404});
  let path:string;try{path=resolve(rendererRoot,'.'+decodeURIComponent(url.pathname));}catch{return new Response('Bad request',{status:400});}
  if(!path.startsWith(rendererRoot+sep))return new Response('Forbidden',{status:403});
  try{const response=await net.fetch(pathToFileURL(path).toString());const headers=new Headers(response.headers);headers.set('Content-Security-Policy',csp());return new Response(response.body,{status:response.status,headers});}catch{return new Response('Not found',{status:404});}
 });
 session.defaultSession.setPermissionRequestHandler((contents,permission,callback,details)=>{callback(!!window&&contents===window.webContents&&allowedUrl(details.requestingUrl||contents.getURL())&&permission==='media'&&'mediaTypes' in details&&!!details.mediaTypes?.length&&details.mediaTypes.every(type=>type==='audio'));});
 session.defaultSession.setPermissionCheckHandler((contents,permission,origin)=>!!window&&contents===window.webContents&&allowedUrl(origin)&&permission==='media');
 if(devUrl)session.defaultSession.webRequest.onHeadersReceived((details,callback)=>callback({responseHeaders:{...details.responseHeaders,'Content-Security-Policy':[csp()]}}));
 const settings=new SettingsService(app.getPath('userData'));const sales=new SalesService(app.getPath('userData'));bindIpc(settings,sales);await createWindow();
 app.on('activate',()=>{if(!window)void createWindow();});
}).catch(error=>{console.error('Desktop startup failed:',error instanceof Error?error.message:'Unknown startup error');app.exit(1);});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});

