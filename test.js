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

console.log(fails ? ("FAILS="+fails) : ("OK - worst gap = "+worst));
