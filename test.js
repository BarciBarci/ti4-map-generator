// node test.js - prüft die vollautomatische Pipeline über alle Layouts (3-6 Spieler).
const fs=require("fs"), vm=require("vm"), path=require("path");

function makeEl(){ return { value:"6", checked:true, style:{}, className:"", disabled:false, href:"", innerHTML:"", textContent:"", addEventListener(){}, select(){}, appendChild(){}, querySelectorAll(){ return []; }, options:[], selectedIndex:0 }; }
const els={}; const document={ getElementById(id){ return els[id]||(els[id]=makeEl()); }, createElement(){ return makeEl(); } };
const window={ setTimeout, console };
const ctx={ console, document, window, navigator:{clipboard:{writeText(){}}}, performance:{now:()=>Date.now()}, setTimeout, Math, Object, Array, String, Number, Date, Image:function(){} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,"data.js"),"utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname,"app.js"),"utf8"), ctx);

const T=ctx.window.__ti4;
const pool=T.buildPool(true,true,true);
const BUDGET=+(process.argv[2]||3000);
let fails=0, worst=0;

const titles=[];
for(const p of ["3","4","5","6"]) for(const t of T.LAYOUTS[p]) titles.push([p,t]);

for(const [p,title] of titles){
  const rng=T.mulberry32(4242);
  const st=T.buildState(title,pool,T.evSlice());
  st.pool=T.chooseTiles(pool,st.opens.length,0.60,true,rng);
  st.allPool=pool;

  // Wormholes immer paarweise?
  const a=st.pool.filter(s=>s.wormhole===0).length, b=st.pool.filter(s=>s.wormhole===1).length;
  if(a!==b||a<1){ console.log("WORMHOLE FEHLER", title, a, b); fails++; }

  const Es=T.prepareEvals(st);
  const res=T.generateFull(st,Es,rng,BUDGET,0.02);
  if(!res){ console.log("KEINE KARTE", title); fails++; continue; }

  const g=res.gaps, rl=res.rel;
  const ids=Object.values(res.place).map(s=>s.id);
  if(new Set(ids).size!==ids.length){ console.log("DUPLIKAT-TILE", title); fails++; }
  const wa=Object.values(res.place).filter(s=>s.wormhole===0).length, wb=Object.values(res.place).filter(s=>s.wormhole===1).length;
  if(wa!==wb){ console.log("WORMHOLE UNPAAR nach Optimierung", title, wa, wb); fails++; }
  const sideE=Es.map(E=>E.name).filter((_,i)=>rl[i]>0.02);
  if(sideE.length) console.log("   einseitig:", sideE.join(", "));
  const maxRel=Math.max.apply(null,rl);
  worst=Math.max(worst, maxRel);
  const ok=maxRel<=0.08;
  if(!ok) fails++;
  console.log(`${title.padEnd(22)} n=${String(st.opens.length).padStart(2)}  gaps=[${g.join(",")}]  rel=[${rl.map(x=>(x*100).toFixed(0)+"%").join(",")}]  maxRel=${(maxRel*100).toFixed(1)}%${ok?"":"  <-- >8%"}`);
}
console.log(fails ? ("FAILS="+fails) : ("OK - worst rel gap = "+(worst*100).toFixed(1)+"%"));

// ---- Faktions-Garantien ----
const fcases=[
  ["4-Player Standard", ["The Embers of Muaat","The Clan of Saar","The Ghosts of Creuss",null]],
  ["6-Player", ["The Embers of Muaat","The Clan of Saar","The Empyrean","The Vuil'raith Cabal","The Ghosts of Creuss","The Arborec"]],
  ["5-Player Warp", ["The Embers of Muaat","The Clan of Saar","The Empyrean","The Vuil'raith Cabal","The Ghosts of Creuss"]],
];
for(const [title,factions] of fcases){
  const rng=T.mulberry32(2024);
  const nOpen=T.buildState(title,pool,T.evSlice()).opens.length;
  const r=T.generateRounds(title, pool, 0.60, true, rng, Math.min(10000,3500+nOpen*70), 0.02, 4, factions);
  if(!r || r.error){ console.log("FAKTION KEINE KARTE", title, r&&r.error); fails++; continue; }
  const rep=T.featureReport(r.st, r.res.place);
  const bad=rep.filter(x=>!x.ok);
  const ids=Object.values(r.res.place).map(s=>s.id);
  const wa=ids.length, dup=(new Set(ids).size!==ids.length);
  console.log(title.padEnd(20), "Fraktionen:", rep.map(x=>(x.ok?"OK ":"FEHLT ")+x.name+"→"+x.feature).join(", "));
  if(bad.length||dup){ console.log("   FEHLER", bad.length?"Bedarf unerfüllt":"", dup?"Dublette":""); fails++; }
}
console.log(fails ? ("FAILS="+fails) : "OK - Faktionsbedarf überall erfüllt");
