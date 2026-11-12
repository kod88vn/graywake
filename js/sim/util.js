// Small pure helpers shared by the simulation.
export const clamp=(v,a,b)=>v<a?a:v>b?b:v;
export const lerp=(a,b,t)=>a+(b-a)*t;
export const dist=(ax,ay,bx,by)=>Math.hypot(ax-bx,ay-by);
export const angDiff=(a,b)=>{let d=(a-b)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d};
export const TAU=Math.PI*2;

/** Seeded generator (mulberry32). rng() → [0,1). Carries helpers: int(a,b) inclusive, pick(array), chance(p), range(a,b). */
export function RNG(seed){
  let s=seed>>>0||1;
  const f=()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296};
  f.int=(a,b)=>a+Math.floor(f()*(b-a+1));
  f.range=(a,b)=>a+f()*(b-a);
  f.pick=a=>a[Math.floor(f()*a.length)];
  f.chance=p=>f()<p;
  f.shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(f()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
  /** Weighted pick. rows: array, w: row → weight. */
  f.weighted=(rows,w)=>{let tot=0;for(const r of rows)tot+=w(r);let x=f()*tot;for(const r of rows){x-=w(r);if(x<=0)return r}return rows[rows.length-1]};
  return f;
}
/** Unseeded convenience generator for live play (not for world generation). */
export const rnd=RNG((Date.now()^0x9e3779b9)>>>0);
export const hash=(a,b=0)=>{let h=(a*374761393+b*668265263)>>>0;h=Math.imul(h^(h>>>13),1274126177)>>>0;return(h^(h>>>16))>>>0};
/** Cheap value noise in 2D, 0..1, for ground patches and clustering. */
export function noise2(x,y,seed=0){
  const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  const h=(a,b)=>hash(a+seed*131,b+seed*17)/4294967295;
  return lerp(lerp(h(xi,yi),h(xi+1,yi),u),lerp(h(xi,yi+1),h(xi+1,yi+1),u),v);
}
export const fmtTime=min=>{const h=Math.floor(min/60)%24,m=Math.floor(min%60);return(h<10?'0':'')+h+':'+(m<10?'0':'')+m};
export const dayOf=min=>Math.floor(min/1440)+1;
export const hourOf=min=>(min/60)%24;
/** Minimal binary heap of [priority, value] pairs for Dijkstra. */
export class Heap{
  constructor(){this.k=[];this.v=[]}
  get size(){return this.k.length}
  push(k,v){const K=this.k,V=this.v;let i=K.length;K.push(k);V.push(v);while(i>0){const p=(i-1)>>1;if(K[p]<=k)break;K[i]=K[p];V[i]=V[p];i=p}K[i]=k;V[i]=v}
  pop(){const K=this.k,V=this.v,top=V[0],lk=K.pop(),lv=V.pop(),n=K.length;if(n){let i=0;for(;;){let c=i*2+1;if(c>=n)break;if(c+1<n&&K[c+1]<K[c])c++;if(K[c]>=lk)break;K[i]=K[c];V[i]=V[c];i=c}K[i]=lk;V[i]=lv}return top}
}
