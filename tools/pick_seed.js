// tools/pick_seed.js - sucht einen Seed mit minimalem Gap (Slice+Joebrew) fuer 6-Player
const fs=require("fs"), vm=require("vm"), path=require("path");
const ROOT=path.join(__dirname,"..");
function makeEl(){ return { value:"6", checked:true, style:{}, disabled:false, href:"", innerHTML:"", textContent:"", addEventListener(){}, select(){}, appendChild(){}, options:[], selectedIndex:0 }; }
const els={}; const document={ getElementById(id){ return els[id]||(els[id]=makeEl()); }, createElement(){ return makeEl(); } };
const window={ setTimeout, console };
const ctx={ console, document, window, navigator:{clipboard:{writeText(){}}}, performance:{now:()=>Date.now()}, setTimeout, Math, Object, Array, String, Number, Date, Image:function(){} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,"data.js"),"utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,"app.js"),"utf8"), ctx);
const T=ctx.window.__ti4;
const pool=T.buildPool(true,true,true);
const evA=T.evSlice(), evB=T.evJoe();
let best=null;
for(let seed=1; seed<=24; seed++){
  const rng=T.mulberry32(seed);
  const st=T.buildState("6-Player",pool,evA);
  st.pool=T.chooseTiles(pool,st.opens.length,0.60,true,rng);
  const b=T.optimizePair(st,evA,evB,2200,rng);
  if(!b) continue;
  const a=T.range(T.evalUnder(st,b.place,evA)), j=T.range(T.evalUnder(st,b.place,evB));
  console.log("seed",seed,"slice",a,"joe",j);
  if(!best || a+j < best.s) best={seed:seed, s:a+j, a:a, j:j};
}
console.log("BEST:", JSON.stringify(best));
