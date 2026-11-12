#!/usr/bin/env node
// Dev server: http://localhost:8090 (PORT to change). Binds to the LAN so a phone on the same Wi-Fi can open it.
import os from 'node:os';
import {serve} from './lib.mjs';
const port=+process.env.PORT||8090;
await serve({port,host:'0.0.0.0'});
const lan=Object.values(os.networkInterfaces()).flat().filter(i=>i&&i.family==='IPv4'&&!i.internal).map(i=>i.address);
console.log(`Graywake  http://localhost:${port}`);
for(const a of lan)console.log(`  on your phone (same Wi-Fi)  http://${a}:${port}`);
console.log(`  model gallery               http://localhost:${port}/tools/gallery.html`);
console.log(`  icon sheet                  http://localhost:${port}/tools/icons.html`);
