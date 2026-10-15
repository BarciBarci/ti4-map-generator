// node test.js - prüft die vollautomatische Pipeline über alle Layouts (3-6 Spieler).
const fs=require("fs"), vm=require("vm"), path=require("path");

function makeEl(){ return { value:"6", checked:true, style:{}, className:"", disabled:false, href:"", innerHTML:"", textContent:"", addEventListener(){}, select(){}, appendChild(){}, querySelectorAll(){ return []; }, options:[], selectedIndex:0 }; }
const els={}; const document={ getElementById(id){ return els[id]||(els[id]=makeEl()); }, createElement(){ return makeEl(); } };
const window={ setTimeout, console };
const _ls={}; const localStorage={ getItem(k){ return (k in _ls)?_ls[k]:null; }, setItem(k,v){ _ls[k]=String(v); }, removeItem(k){ delete _ls[k]; } };
const ctx={ console, document, window, localStorage, navigator:{clipboard:{writeText(){}}}, performance:{now:()=>Date.now()}, setTimeout, Math, Object, Array, String, Number, Date, Image:function(){} };
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
// [Titel, Fraktionen, contest?, Nachbar-Stufe verlangen?]
const fcases=[
  ["4-Player Standard", ["The Embers of Muaat","The Clan of Saar","The Ghosts of Creuss",null], false, false],
  ["6-Player", ["The Embers of Muaat","The Clan of Saar","The Empyrean","The Vuil'raith Cabal","The Ghosts of Creuss","The Arborec"], false, false],
  ["5-Player Warp", ["The Embers of Muaat","The Clan of Saar","The Empyrean","The Vuil'raith Cabal","The Ghosts of Creuss"], false, false],
  ["6-Player", ["The Embers of Muaat","The Clan of Saar","The Empyrean","The Vuil'raith Cabal","The Ghosts of Creuss","The Arborec"], true, true],
  ["5-Player Standard", ["The Embers of Muaat","The Clan of Saar","The Empyrean","The Vuil'raith Cabal","The Ghosts of Creuss"], true, true],
  ["4-Player Skinny", ["The Embers of Muaat","The Clan of Saar","The Empyrean","The Ghosts of Creuss"], true, true],
];
for(const [title,factions,contest,needNb] of fcases){
  const rng=T.mulberry32(2024);
  const nOpen=T.buildState(title,pool,T.evSlice()).opens.length;
  const r=T.generateRounds(title, pool, 0.60, true, rng, Math.min(10000,3500+nOpen*70), 0.02, 4, factions, contest);
  if(!r || r.error){ console.log("FAKTION KEINE KARTE", title, r&&r.error); fails++; continue; }
  const rep=T.featureReport(r.st, r.res.place);
  const bad=rep.filter(x=>!x.ok);
  const lonely=needNb ? rep.filter(x=>x.reach==="own") : [];
  const ids=Object.values(r.res.place).map(s=>s.id);
  const dup=(new Set(ids).size!==ids.length);
  console.log((title+(contest?" [contest]":"")).padEnd(26), rep.map(x=>(x.ok?"OK ":"FEHLT ")+x.name+"→"+x.feature+"("+x.reach+")").join(", "));
  if(bad.length||dup||lonely.length){ console.log("   FEHLER", bad.length?"Bedarf unerfüllt":"", lonely.length?("nicht kontestiert: "+lonely.map(x=>x.name).join(",")):"", dup?"Dublette":""); fails++; }
}
console.log(fails ? ("FAILS="+fails) : "OK - Faktionsbedarf überall erfüllt");

// ---- Legende ----
{
  const lg=T.legendHTML();
  const want=["Warfare","Propulsion","Biotic","Cybernetic","Supernova","Gravitationsriss","Nebel","Asteroidenfeld","Entropic Scar","Ressourcen","Wormhole","Tile-Nummer","Hazardous","Industrial","Cultural","HOME","Mecatol"];
  const miss=want.filter(w=>lg.indexOf(w)<0);
  // Kein Zusammenkleben: jede Abkuerzung muss direkt von ihrem Namen gefolgt sein (z.B. "SN Supernova").
  const glued=lg.indexOf("NEBGR")>=0 || lg.indexOf("SNES")>=0 || lg.indexOf("ASTSN")>=0;
  const pairOk=["SN & Supernova","GR & Gravitationsriss","NEB & Nebel","AST & Asteroidenfeld","ES & Entropic Scar",
                "R & Warfare","B & Propulsion","G & Biotic","Y & Cybernetic"].filter(function(pr){
    const p=pr.split(" & "), acr=p[0], nm=p[1];
    return lg.indexOf(">"+acr+"</span><span class=\"lg-t\">"+nm)<0;
  });
  console.log("Legende:", lg.length+" Zeichen", (miss.length||glued||pairOk.length)?("FEHLER "+miss.join(",")+ (glued?" [verklebt]":"")+ (pairOk.length?(" [nicht gepaart: "+pairOk.join(",")+"]"):"")):"alle Symbole erklärt und gepaart");
  if(miss.length||glued||pairOk.length){ fails++; console.log("FAILS="+fails); }
}

// ---- Design-Einstellung (localStorage) ----
{
  const p1=T.loadThemePref();                 // leer -> null
  T.saveThemePref("retro");
  const p2=T.loadThemePref();                 // -> "retro"
  T.saveThemePref("quatsch");
  const p3=T.loadThemePref();                 // ungueltig -> ignoriert -> null
  const ok=(p1===null && p2==="retro" && p3===null);
  console.log("Design-Pref:", ok?"gespeichert/geladen, ungueltige Werte ignoriert":("FEHLER "+[p1,p2,p3].join("/")));
  if(!ok){ fails++; console.log("FAILS="+fails); }
}
