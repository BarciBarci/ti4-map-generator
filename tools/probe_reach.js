// tools/probe_reach.js - Machbarkeit: Merkmal in Reichweite von eigenem + beiden Nachbar-Homes?
const fs=require("fs"),vm=require("vm"),path=require("path"),ROOT=path.join(__dirname,"..");
function makeEl(){ return { value:"6", checked:true, style:{}, className:"", disabled:false, href:"", innerHTML:"", textContent:"", addEventListener(){}, select(){}, appendChild(){}, querySelectorAll(){ return []; }, options:[], selectedIndex:0 }; }
const els={}; const document={ getElementById(id){ return els[id]||(els[id]=makeEl()); }, createElement(){ return makeEl(); } };
const window={ setTimeout, console };
const ctx={ console, document, window, navigator:{clipboard:{writeText(){}}}, performance:{now:()=>Date.now()}, setTimeout, Math, Object, Array, String, Number, Date, Image:function(){} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,"data.js"),"utf8"),ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,"app.js"),"utf8"),ctx);
const T=ctx.window.__ti4, pool=T.buildPool(true,true,true);

function ringOrder(st){
  const cs=st.homes.map(h=>st.byKey[h]);
  let cx=0,cy=0; for(const c of cs){ cx+=c.x+c.z/2; cy+=c.z; } cx/=cs.length; cy/=cs.length;
  return st.homes.map((h,i)=>({ h:h, a:Math.atan2(st.byKey[h].z-cy, (st.byKey[h].x+st.byKey[h].z/2)-cx) }))
                 .sort((p,q)=>p.a-q.a).map(o=>o.h);
}
for(const p of ["3","4","5","6"]) for(const title of T.LAYOUTS[p]){
  const st=T.buildState(title,pool,T.evSlice());
  const ring=ringOrder(st), n=ring.length;
  const R={}; ring.forEach(h=>{ R[h]=new Set(T.reachPositions(st,h,2)); });
  let minOwn=99,minOne=99,minBoth=99,minN=99;
  ring.forEach((h,i)=>{
    const a=ring[(i-1+n)%n], b=ring[(i+1)%n];
    const own=R[h].size;
    const one=[...R[h]].filter(x=>R[a].has(x)||R[b].has(x)).length;
    const both=[...R[h]].filter(x=>R[a].has(x)&&R[b].has(x)).length;
    const nb=[...R[a]].filter(x=>R[b].has(x)).length;
    minOwn=Math.min(minOwn,own); minOne=Math.min(minOne,one); minBoth=Math.min(minBoth,both); minN=Math.min(minN,nb);
  });
  console.log(title.padEnd(22), "homes="+n, "| R(own) min="+minOwn, "| own+1 Nb min="+minOne, "| own+2Nb min="+minBoth, "| beide Nb min="+minN);
}
