// tools/export_map.js  ->  erzeugt tools/map.json (Beispielkarte fuer den Screenshot)
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
const ev = T.makeEval(T.default_evaluators[0].data);        // Simple Slice
const rng = T.mulberry32(20261015);
const st = T.buildState("6-Player", pool, ev);
st.pool = T.chooseTiles(pool, st.opens.length, 0.60, true, rng);
const best = T.optimize(st, 3000, rng);
if(!best) throw new Error("keine Karte gefunden");

const s = T.stats(st, best.place);
const systems = {};
for(const pos in best.place){
  const sys = best.place[pos];
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
const homeValues = {}; st.homes.forEach((h,i)=>homeValues[h]=best.vals[i]);
const placeIds = {};
for(const pos in best.place) placeIds[pos] = best.place[pos].id;

const out = {
  title: "TI4 Balanced Map Generator",
  subtitle: "6 Spieler \u00b7 Standard \u00b7 Blue/Red " + s.blue + "/" + s.red + " \u00b7 Wormholes " + s.wh + " \u00b7 Balance Gap " + T.range(best.vals),
  cells: st.cells.map(c => ({x:c.x, y:c.y, z:c.z, type:c.type})),
  place: placeIds,
  systems: systems,
  homeValues: homeValues,
  mapString: T.mapString(st, best.place),
};
fs.writeFileSync(path.join(__dirname,"map.json"), JSON.stringify(out));
console.log("map.json geschrieben:", st.cells.length, "Felder,", Object.keys(systems).length, "Systeme, gap", T.range(best.vals));
