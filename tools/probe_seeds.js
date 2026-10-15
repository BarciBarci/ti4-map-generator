// tools/probe_seeds.js - Streuung des Ergebnisses ueber verschiedene Tile-Auswahlen (Seeds).
const fs=require("fs"),vm=require("vm"),path=require("path"),ROOT=path.join(__dirname,"..");
function makeEl(){ return { value:"6", checked:true, style:{}, disabled:false, href:"", innerHTML:"", textContent:"", addEventListener(){}, select(){}, appendChild(){}, options:[], selectedIndex:0 }; }
const els={}; const document={ getElementById(id){ return els[id]||(els[id]=makeEl()); }, createElement(){ return makeEl(); } };
const window={ setTimeout, console };
const ctx={ console, document, window, navigator:{clipboard:{writeText(){}}}, performance:{now:()=>Date.now()}, setTimeout, Math, Object, Array, String, Number, Date, Image:function(){} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,"data.js"),"utf8"),ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,"app.js"),"utf8"),ctx);
const T=ctx.window.__ti4, pool=T.buildPool(true,true,true);

const title=process.argv[2]||"6-Player";
const N=+(process.argv[3]||8);
const RATIO=+(process.argv[4]||0.60);
const nOpen=T.buildState(title,pool,T.evSlice()).opens.length;
const budget=Math.min(10000, 3500+nOpen*70);
const vals=[];
for(let seed=1; seed<=N; seed++){
  const r=T.generateRounds(title, pool, RATIO, true, T.mulberry32(seed), budget, 0.02, 4);
  const mx=r?r.mx:1;
  vals.push(mx);
  console.log("seed",String(seed).padStart(2), "maxRel="+(mx*100).toFixed(1)+"%", r?("["+r.res.rel.map(x=>(x*100).toFixed(0)+"%").join(",")+"]"):"");
}
vals.sort((a,b)=>a-b);
const med=vals[Math.floor(vals.length/2)];
console.log(`--- ${title} (${N} Läufe, ratio ${RATIO}, Budget ${(budget/1000).toFixed(1)}s/Lauf) ---`);
console.log("best="+(vals[0]*100).toFixed(1)+"%  median="+(med*100).toFixed(1)+"%  worst="+(vals[vals.length-1]*100).toFixed(1)+"%");
