// tools/preview_themes.js - rendert eine Beispielkarte in allen Designs als SVG nach previews/.
const fs=require("fs"),vm=require("vm"),path=require("path"),ROOT=path.join(__dirname,"..");
function makeEl(){ return { value:"6", checked:true, style:{}, className:"", disabled:false, href:"", innerHTML:"", textContent:"", addEventListener(){}, select(){}, appendChild(){}, querySelectorAll(){ return []; }, options:[], selectedIndex:0 }; }
const els={}; const document={ getElementById(id){ return els[id]||(els[id]=makeEl()); }, createElement(){ return makeEl(); }, body:{ setAttribute(){} } };
const window={ setTimeout, console };
const ctx={ console, document, window, navigator:{clipboard:{writeText(){}}}, performance:{now:()=>Date.now()}, setTimeout, Math, Object, Array, String, Number, Date, Image:function(){} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,"data.js"),"utf8"),ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT,"app.js"),"utf8"),ctx);
const T=ctx.window.__ti4;

const FAC=["The Embers of Muaat","The Clan of Saar","The Empyrean","The Vuil'raith Cabal","The Ghosts of Creuss","The Arborec"];
const title="6-Player";
const pool=T.buildPool(true,true,true);
const nOpen=T.buildState(title,pool,T.evSlice()).opens.length;
const r=T.generateRounds(title, pool, 0.60, true, T.mulberry32(3), Math.min(10000,3500+nOpen*70), 0.02, 4, FAC, true);
if(!r || r.error) throw new Error("keine Karte");
const st=r.st, place=r.res.place;
const vals=T.valsE(place, r.prep[T.default_evaluators.findIndex(e=>e.title==="Joebrew")], st.homes, st.rexKey);

const dir=path.join(ROOT,"previews"); fs.mkdirSync(dir,{recursive:true});
for(const key of Object.keys(T.THEMES)){
  const svg=T.render(st, place, vals, key);
  const f=path.join(dir, "theme-"+key+".svg");
  fs.writeFileSync(f, svg);
  console.log("preview:", path.relative(ROOT,f), svg.length, "bytes", "|", T.THEMES[key].label);
}
console.log("map string:", T.mapString(st, place));
