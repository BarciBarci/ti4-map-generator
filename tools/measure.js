// tools/measure.js - misst die App-Pipeline (generateRounds) fuer alle Layouts.
const fs=require("fs"),vm=require("vm"),path=require("path"),ROOT=path.join(__dirname,"..");
function makeEl(){ return { value:"6", checked:true, style:{}, disabled:false, href:"", innerHTML:"", textContent:"", addEventListener(){}, select(){}, appendChild(){}, options:[], selectedIndex:0 }; }
const els={}; const document={ getElementById(id){ return els[id]||(els[id]=makeEl()); }, createElement(){ return makeEl(); } };
const window={ setTimeout, console };
const ctx={ console, document, window, navigator:{clipboard:{writeText(){}}}, performance:{now:()=>Date.now()}, setTimeout, Math, Object, Array, String, Number, Date, Image:function(){} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,"data.js"),"utf8"),ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,"app.js"),"utf8"),ctx);
const T=ctx.window.__ti4;
const pool=T.buildPool(true,true,true);
const titles=[];
for(const p of ["3","4","5","6"]) for(const t of T.LAYOUTS[p]) titles.push(t);

for(const title of titles){
  const rng=T.mulberry32(99);
  const nOpen=T.buildState(title,pool,T.evSlice()).opens.length;
  const total=+(process.argv[2]||0) || Math.min(10000, 3500+nOpen*70);
  const rounds=+(process.argv[3]||4);
  const t0=Date.now();
  const res=T.generateRounds(title, pool, 0.60, true, rng, total, 0.02, rounds);
  const ms=Date.now()-t0;
  if(!res){ console.log(title.padEnd(22), "KEINE KARTE"); continue; }
  console.log(title.padEnd(22), "maxRel="+(res.mx*100).toFixed(1)+"%", "rel=["+res.res.rel.map(x=>(x*100).toFixed(0)+"%").join(",")+"]", (ms/1000).toFixed(1)+"s");
}
