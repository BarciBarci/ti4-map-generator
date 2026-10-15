// tools/export_map.js  ->  erzeugt tools/map.json (Beispielkarte fuer den Screenshot)
// Nutzt die Standard-Pipeline Simple Slice -> Joebrew und sucht den besten von mehreren Seeds.
const fs = require("fs"), vm = require("vm"), path = require("path");
const ROOT = path.join(__dirname, "..");

function makeEl(){ return { value:"6", checked:true, style:{}, disabled:false, href:"", innerHTML:"", textContent:"", addEventListener(){}, select(){}, appendChild(){}, options:[], selectedIndex:0 }; }
const els={}; const document={ getElementById(id){ return els[id]||(els[id]=makeEl()); }, createElement(){ return makeEl(); } };
const window={ setTimeout, console };
const ctx={ console, document, window, navigator:{clipboard:{writeText(){}}}, performance:{now:()=>Date.now()}, setTimeout, Math, Object, Array, String, Number, Date, Image:function(){} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,"data.js"),"utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,"app.js"),"utf8"), ctx);
const T = ctx.window.__ti4;

const pool = T.buildPool(true, true, true);
const evA = T.evSlice(), evB = T.evJoe();

let winner = null;
function prepFor(st, evA, evB){
  st.eval=evA; const wa=T.computeHomeW(st);
  st.eval=evB; const wb=T.computeHomeW(st);
  const valA={}, valB={};
  for(const sy of st.pool){ valA[sy.id]=evA.sysVal(sy); valB[sy.id]=evB.sysVal(sy); }
  valA[18]=evA.sysVal(T.SYS[18]); valB[18]=evB.sysVal(T.SYS[18]);
  st.eval=evA; st.homeW=wa;
  return {wa:wa, wb:wb, valA:valA, valB:valB};
}
for(let seed=1; seed<=14; seed++){
  const rng = T.mulberry32(seed);
  const st = T.buildState("6-Player", pool, evA);
  st.pool = T.chooseTiles(pool, st.opens.length, 0.60, true, rng);
  const prep = prepFor(st, evA, evB);
  const b = T.optimizePair(st, evA, evB, 1500, rng, prep);
  if(!b) continue;
  const a = T.range(T.evalUnder(st, b.place, evA)), j = T.range(T.evalUnder(st, b.place, evB));
  if(!winner || a + j < winner.score){ winner = { st: st, place: b.place, a: a, j: j, score: a + j, seed: seed }; }
  if(winner.score === 0) break;
}
if(!winner) throw new Error("keine Karte gefunden");
const st = winner.st, place = winner.place, gSlice = winner.a, gJoe = winner.j;

const s = T.stats(st, place);
const systems = {};
for(const pos in place){
  const sys = place[pos];
  systems[sys.id] = {
    planets: sys.planets.map(p => ({
      r: p.resources, i: p.influence,
      traits: (p.traits||[]),
      techs: (p.tech_specialties||[]).map(t => T.TECH_LETTER[t]).filter(Boolean),
    })),
    anomalies: (sys.anomalies||[]).map(a => T.ANOM_LABEL[a]),
    wormhole: sys.wormhole===0 ? "\u03b1" : (sys.wormhole===1 ? "\u03b2" : null),
    red: T.isRed(sys),
  };
}
const placeIds = {}; for(const pos in place) placeIds[pos] = place[pos].id;
const valsB = T.evalUnder(st, place, evB);
const homeValues = {}; st.homes.forEach((h,i)=>homeValues[h]=valsB[i]);

const out = {
  title: "TI4 Balanced Map Generator",
  subtitle: "6 Spieler \u00b7 Standard \u00b7 Blue/Red " + s.blue + "/" + s.red + " \u00b7 Wormholes " + s.wh + " \u00b7 Gap Slice " + gSlice + " / Joebrew " + gJoe,
  cells: st.cells.map(c => ({x:c.x, y:c.y, z:c.z, type:c.type})),
  place: placeIds,
  systems: systems,
  homeValues: homeValues,
  mapString: T.mapString(st, place),
};
fs.writeFileSync(path.join(__dirname,"map.json"), JSON.stringify(out));
console.log("map.json geschrieben (seed "+winner.seed+"):", st.cells.length, "Felder, gap slice/joe", gSlice, gJoe);
