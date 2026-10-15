// tools/probe_lns.js - Test: bringt LNS (exakte Permutation von k Positionen) mehr als der aktuelle Optimierer?
const fs=require("fs"),vm=require("vm"),path=require("path"),ROOT=path.join(__dirname,"..");
function makeEl(){ return { value:"6", checked:true, style:{}, className:"", disabled:false, href:"", innerHTML:"", textContent:"", addEventListener(){}, select(){}, appendChild(){}, querySelectorAll(){ return []; }, options:[], selectedIndex:0 }; }
const els={}; const document={ getElementById(id){ return els[id]||(els[id]=makeEl()); }, createElement(){ return makeEl(); } };
const window={ setTimeout, console };
const ctx={ console, document, window, navigator:{clipboard:{writeText(){}}}, performance:{now:()=>Date.now()}, setTimeout, Math, Object, Array, String, Number, Date, Image:function(){} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,"data.js"),"utf8"),ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,"app.js"),"utf8"),ctx);
const T=ctx.window.__ti4, pool=T.buildPool(true,true,true);

function score(place,Es,st){ const rel=T.gapsRel(place,Es,st.homes,st.rexKey); let s=0,m=0; for(const r of rel){ s+=r; if(r>m)m=r; } return [s+8*m, m]; }
function gapVec(place,Es,st){ return Es.map(E=>T.range(T.valsE(place,E,st.homes,st.rexKey))); }
function legal(st,place,positions){ for(const p of positions){ if(T.sysConflicts(st,place,p,place[p])) return false; } return true; }

function permutations(arr){
  const out=[];
  (function rec(cur,rest){ if(!rest.length){ out.push(cur.slice()); return; }
    for(let i=0;i<rest.length;i++){ rec(cur.concat(rest[i]), rest.slice(0,i).concat(rest.slice(i+1))); } })([], arr);
  return out;
}

function lns(st, place, Es, deadlineMs, k, rng){
  const positions=Object.keys(place);
  let cur=score(place,Es,st)[0];
  const t0=Date.now();
  let iters=0;
  while(Date.now()-t0 < deadlineMs){
    iters++;
    // k zufaellige Positionen
    const idx=new Set();
    while(idx.size<k){ idx.add(Math.floor(rng()*positions.length)); }
    const pos=[...idx].map(i=>positions[i]), tiles=pos.map(p=>place[p]);
    const before=cur;
    let bestPerm=null, bestScore=cur;
    for(const perm of permutations(tiles)){
      for(let i=0;i<pos.length;i++) place[pos[i]]=perm[i];
      if(legal(st,place,pos)){
        const s=score(place,Es,st)[0];
        if(s<bestScore-1e-12){ bestScore=s; bestPerm=perm.slice(); }
      }
      for(let i=0;i<pos.length;i++) place[pos[i]]=tiles[i];   // revert
    }
    if(bestPerm){ for(let i=0;i<pos.length;i++) place[pos[i]]=bestPerm[i]; cur=bestScore; }
  }
  return iters;
}

const K=+(process.argv[2]||5);
for(const k of [K]){
  for(const title of ["5-Player Warp","5-Player Skinny","6-Player"]){
    const nOpen=T.buildState(title,pool,T.evSlice()).opens.length;
    const budget=Math.min(10000, 3500+nOpen*70);
    const rng=T.mulberry32(99);
    const before=T.generateRounds(title, pool, 0.60, true, rng, budget, 0.02, 4);
    const place=before.res.place, st=before.st, Es=before.prep;
    const g0=gapVec(place,Es,st), r0=T.gapsRel(place,Es,st.homes,st.rexKey);
    const iters=lns(st, place, Es, 5000, k, T.mulberry32(7));
    const g1=gapVec(place,Es,st), r1=T.gapsRel(place,Es,st.homes,st.rexKey);
    const f=a=>"["+a.map(x=>(x*100).toFixed(1)+"%").join(",")+"]";
    console.log(title.padEnd(20), "vorher maxRel="+Math.max(...r0).toFixed(3), f(r0), "gaps=["+g0+"]");
    console.log(" ".repeat(20), "nachher (LNS k="+k+", "+iters+" Iter) maxRel="+Math.max(...r1).toFixed(3), f(r1), "gaps=["+g1+"]");
  }
}
