// Shared helpers for the dev server and the headless test harness. No dependencies: Node 22+ and a local Chrome.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const OUT=path.join(ROOT,'.out');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.png':'image/png','.wav':'audio/wav','.md':'text/plain; charset=utf-8'};

/* index.html is a fragment (the artifact host wraps it in a document when publishing).
   Locally we wrap it the same way: doctype, charset, viewport. `extra` is injected at the end of <body>. */
export function wrapIndex(extra=''){
  const frag=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"><style>html,body{margin:0}[hidden]{display:none!important}</style></head><body>${frag}${extra}</body></html>`;
}

/* Static server for the project. `routes` maps a path to (req,res)=>void and wins over files. */
export function serve({port=0,host='127.0.0.1',routes={}}={}){
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://x');
    if(routes[url.pathname])return routes[url.pathname](req,res,url);
    if(url.pathname==='/'){res.writeHead(200,{'content-type':MIME['.html'],'cache-control':'no-store'});return res.end(wrapIndex())}
    const file=path.normalize(path.join(ROOT,decodeURIComponent(url.pathname)));
    if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end('not found')}
    res.writeHead(200,{'content-type':MIME[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(file).pipe(res);
  });
  return new Promise(ok=>server.listen(port,host,()=>ok({server,port:server.address().port})));
}

function findChrome(){
  const c=[process.env.CHROME,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Chromium.app/Contents/MacOS/Chromium','/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].filter(Boolean);
  const hit=c.find(p=>fs.existsSync(p));if(!hit)throw new Error('Chrome not found. Set CHROME=/path/to/chrome');return hit;
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* Launch headless Chrome on a page of the project and drive it over the DevTools protocol.
   WebGL runs on the software rasteriser, so frame rates here say nothing about real devices.
   Returns a page with: eval(js) (awaits promises), click(x,y), tap(selector), key(k), shot(name), errors[], close(). */
export async function launch({width=1280,height=720,pathName='/',quiet=false,mobile=false,scale=1}={}){
  fs.mkdirSync(OUT,{recursive:true});
  const {server,port}=await serve();
  const profile=path.join(OUT,'chrome-'+process.pid+'-'+Date.now());
  const proc=spawn(findChrome(),['--headless=new','--no-first-run','--no-default-browser-check','--mute-audio','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--remote-debugging-port=0','--user-data-dir='+profile,`--window-size=${width},${height}`,'about:blank'],{stdio:'ignore'});
  const close=async()=>{try{proc.kill('SIGKILL')}catch(e){}server.close();await sleep(150);fs.rmSync(profile,{recursive:true,force:true})};
  try{
    const portFile=path.join(profile,'DevToolsActivePort');
    for(let i=0;i<100&&!fs.existsSync(portFile);i++)await sleep(100);
    const dport=fs.readFileSync(portFile,'utf8').split('\n')[0];
    let target;for(let i=0;i<50&&!target;i++){const list=await (await fetch(`http://127.0.0.1:${dport}/json/list`)).json();target=list.find(t=>t.type==='page');if(!target)await sleep(100)}
    const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((ok,no)=>{ws.addEventListener('open',ok);ws.addEventListener('error',no)});
    let id=0;const pending=new Map(),listeners={},errors=[];
    ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.no(new Error(m.error.message)):p.ok(m.result)}else(listeners[m.method]||[]).forEach(f=>f(m.params))});
    const send=(method,params={})=>new Promise((ok,no)=>{pending.set(++id,{ok,no});ws.send(JSON.stringify({id,method,params}))});
    const once=method=>new Promise(ok=>{(listeners[method]=listeners[method]||[]).push(function f(p){listeners[method].splice(listeners[method].indexOf(f),1);ok(p)})});
    const on=(method,f)=>(listeners[method]=listeners[method]||[]).push(f);
    on('Runtime.exceptionThrown',p=>{const d=p.exceptionDetails;errors.push((d.exception&&d.exception.description||d.text)+' @'+(d.url||'').split('/').pop()+':'+d.lineNumber)});
    on('Runtime.consoleAPICalled',p=>{const txt=p.args.map(a=>a.value!==undefined?a.value:a.description).join(' ');if(p.type==='error')errors.push('console.error: '+txt);else if(!quiet&&p.type==='log')console.log('  [page]',txt)});
    await send('Page.enable');await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:scale,mobile});
    if(mobile)await send('Emulation.setTouchEmulationEnabled',{enabled:true});
    const loaded=once('Page.loadEventFired');await send('Page.navigate',{url:`http://127.0.0.1:${port}${pathName}`});await loaded;
    const page={errors,port,close,sleep,send,
      async eval(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});
        if(r.exceptionDetails)throw new Error('page: '+(r.exceptionDetails.exception&&r.exceptionDetails.exception.description||r.exceptionDetails.text));return r.result.value},
      async click(x,y){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});for(const type of['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,x,y,button:'left',clickCount:1});await sleep(60)},
      async tap(sel){const p=await page.eval(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return[r.left+r.width/2,r.top+r.height/2]})()`);
        if(!p)throw new Error('tap: no element for '+sel);await page.click(p[0],p[1])},
      async key(key,ms=60){const code=key.length===1?'Key'+key.toUpperCase():key;await send('Input.dispatchKeyEvent',{type:'keyDown',key,code});await sleep(ms);await send('Input.dispatchKeyEvent',{type:'keyUp',key,code})},
      async shot(name){const r=await send('Page.captureScreenshot',{format:'png'}),dir=path.join(OUT,'shots');fs.mkdirSync(dir,{recursive:true});const f=path.join(dir,name+'.png');fs.writeFileSync(f,Buffer.from(r.data,'base64'));return f}
    };
    return page;
  }catch(e){await close();throw e}
}

/* tiny test reporter */
export function reporter(title){let fails=0;console.log('\n== '+title);
  return{ok(cond,msg){if(cond)console.log('  ok   '+msg);else{fails++;console.log('  FAIL '+msg)}return cond},info(msg){console.log('       '+msg)},get fails(){return fails},
    end(){console.log(fails?`  ${fails} failed`:'  passed');return fails}};
}
