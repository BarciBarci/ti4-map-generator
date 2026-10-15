// node test.js  - prueft alle Layouts (3-6 Spieler) mit allen Evaluatoren.
const fs=require("fs"), vm=require("vm");

function makeEl(){ return { value:"6", checked:true, style:{}, disabled:false, href:"", innerHTML:"", textContent:"", addEventListener(){}, select(){}, appendChild(){}, options:[], selectedIndex:0 }; }
const els={}; const document={ getElementById(id){ return els[id]||(els[id]=makeEl()); }, createElement(){ return makeEl(); } };
const window={ setTimeout, console };
const ctx={ console, document, window, navigator:{clipboard:{writeText(){}}}, performance:{now:()=>Date.now()}, setTimeout, Math, Object, Array, String, Number, Date, Image:function(){} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname+"/data.js","utf8"), ctx);
vm.runInContext(fs.readFileSync(__dirname+"/app.js","utf8"), ctx);

const T=ctx.window.__ti4;
const pool=T.buildPool(true,true,true);
let fails=0, worst=0;

function run(evIndex, titles, budget){
  const ev=T.makeEval(T.default_evaluators[evIndex].data);
  for(const [p,title] of titles){
    const rng=T.mulberry32(1000+evIndex);
    const st=T.buildState(title,pool,ev);
    st.pool=T.chooseTiles(pool,st.opens.length,0.60,true,rng);
    if(st.pool.length<st.opens.length){ console.log("POOL ZU KLEIN", title); fails++; continue; }
    const best=T.optimize(st,budget,rng);
    if(!best){ console.log("KEINE KARTE", title, T.default_evaluators[evIndex].title); fails++; continue; }
    const gap=T.range(best.vals);
    const s=T.stats(st,best.place);
    const svg=T.render(st,best.place,best.vals);
    if(svg.indexOf("<svg")!==0){ console.log("RENDER FEHLER", title); fails++; }
    worst=Math.max(worst,gap);
    console.log(`${T.default_evaluators[evIndex].title.padEnd(15)} ${title.padEnd(22)} n=${st.opens.length} B/R=${s.blue}/${s.red} wh=${s.wh} gap=${gap}`);
  }
}

const allTitles = [];
for(const p of ["3","4","5","6"]) for(const t of T.LAYOUTS[p]) allTitles.push([p,t]);

console.log("--- Simple Slice (alle Layouts) ---");
run(0, allTitles, 1500);
console.log("--- weitere Evaluatoren (3P Standard + 6P) ---");
for(const i of [1,2,3,4]) run(i, [["3","3-Player Standard"],["6","6-Player"]], 1500);

console.log("--- Pipeline Simple Slice -> Joebrew (alle Layouts) ---");
{
  const evA=T.evSlice(), evB=T.evJoe();
  for(const [p,title] of allTitles){
    const rng=T.mulberry32(777);
    const st=T.buildState(title,pool,evA);
    st.pool=T.chooseTiles(pool,st.opens.length,0.60,true,rng);
    st.eval=evA; const wa=T.computeHomeW(st);
    st.eval=evB; const wb=T.computeHomeW(st);
    const valA={},valB={};
    for(const sy of st.pool){ valA[sy.id]=evA.sysVal(sy); valB[sy.id]=evB.sysVal(sy); }
    valA[18]=evA.sysVal(T.SYS[18]); valB[18]=evB.sysVal(T.SYS[18]);
    st.eval=evA; st.homeW=wa;
    const best=T.optimizePair(st,evA,evB,2500,rng,{wa:wa,wb:wb,valA:valA,valB:valB});
    if(!best){ console.log("KEINE KARTE", title); fails++; continue; }
    const gA=T.range(T.evalUnder(st,best.place,evA));
    const gB=T.range(T.evalUnder(st,best.place,evB));
    worst=Math.max(worst,gA,gB);
    console.log(`${title.padEnd(22)} n=${st.opens.length} gapSlice=${gA} gapJoebrew=${gB}`);
  }
}

console.log(fails ? ("FAILS="+fails) : ("OK - worst gap = "+worst));
