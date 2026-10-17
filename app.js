/* TI4 Balanced Map Generator - client-side
   Layouts & Tile-/Evaluator-Daten: joepinion/ti4-map-lab (CC BY-SA 4.0).
   Nicht-kommerzielles Fan-Projekt. Twilight Imperium (c) Fantasy Flight Games / Asmodee. */
(function () {
  "use strict";

  const TYPE = { OPEN: 1, HOME: 2, REX: 3, CLOSED: 4, WARP: 5 };
  const NEI = [[1,-1,0],[1,0,-1],[0,1,-1],[-1,1,0],[-1,0,1],[0,-1,1]];
  const REX_ID = 18;
  const LEGENDARY = [18,65,66,97,98,99,100,115];
  const STATION = [109,111,117];
  const TECH_LETTER = {}; TECH_LETTER[TECH_SPECIALTIES.WARFARE]="R"; TECH_LETTER[TECH_SPECIALTIES.PROPULSION]="B";
  TECH_LETTER[TECH_SPECIALTIES.BIOTIC]="G"; TECH_LETTER[TECH_SPECIALTIES.CYBERNETIC]="Y";
  const ANOM_LABEL = {}; ANOM_LABEL[ANOMALIES.SUPERNOVA]="SN"; ANOM_LABEL[ANOMALIES.NEBULA]="NEB";
  ANOM_LABEL[ANOMALIES.ASTEROID_FIELD]="AST"; ANOM_LABEL[ANOMALIES.GRAVITY_RIFT]="GR"; ANOM_LABEL[ANOMALIES.ENTROPIC_SCAR]="ES";

  const LAYOUTS = {
    3: ["3-Player Standard", "3-Player Settlers", "3-Player Warp"],
    4: ["4-Player Standard", "4-Player Skinny", "4-Player Warp"],
    5: ["5-Player Standard", "5-Player Skinny", "5-Player Warp"],
    6: ["6-Player", "6-Player Large Galaxy"],
  };

  // ---- Fraktionsspezifische Kartenanforderungen ----
  // Quelle: KeeganW/ti4, Option "Ensure Faction Anomalies" (src/options/MapOptions.js)
  // https://github.com/KeeganW/ti4  – kein offizielles FFG-Dokument, sondern Community-Standard.
  // Idee: das fraktionsspezifische, vorteilhafte Merkmal sichern – fehlt es, wird die Fraktion benachteiligt.
  const FACTIONS = [
    { name:"The Arborec", exp:"base" }, { name:"The Barony of Letnev", exp:"base" },
    { name:"The Clan of Saar", exp:"base" }, { name:"The Embers of Muaat", exp:"base" },
    { name:"The Emirates of Hacan", exp:"base" }, { name:"The Federation of Sol", exp:"base" },
    { name:"The Ghosts of Creuss", exp:"base" }, { name:"The L1Z1X Mindnet", exp:"base" },
    { name:"The Mentak Coalition", exp:"base" }, { name:"The Naalu Collective", exp:"base" },
    { name:"The Nekro Virus", exp:"base" }, { name:"Sardakk N'orr", exp:"base" },
    { name:"The Universities of Jol-Nar", exp:"base" }, { name:"The Winnu", exp:"base" },
    { name:"The Xxcha Kingdom", exp:"base" }, { name:"The Yin Brotherhood", exp:"base" },
    { name:"The Yssaril Tribes", exp:"base" },
    { name:"The Argent Flight", exp:"pok" }, { name:"The Empyrean", exp:"pok" },
    { name:"The Mahact Gene-sorcerers", exp:"pok" }, { name:"The Naaz-Rokha Alliance", exp:"pok" },
    { name:"The Nomad", exp:"pok" }, { name:"The Titans of Ul", exp:"pok" },
    { name:"The Vuil'raith Cabal", exp:"pok" },
    { name:"The Crimson Rebellion", exp:"te" }, { name:"The Deepwrought Scholarate", exp:"te" },
    { name:"The Firmament", exp:"te" }, { name:"Last Bastion", exp:"te" },
    { name:"The Ral Nel Consortium", exp:"te" },
  ];
  // Fraktion -> benoetigtes Merkmal (Supernova/Asteroidennebel/Gravitationsriss bzw. Wormhole).
  // Muaat/Saar/Empyrean/Vuil'raith nach KeeganW; Creuss folgt aus seiner Faehigkeit
  // ("behandelt alle Systeme mit alpha-/beta-Wormhole als benachbart").
  const FACTION_ANOMALY = {};
  FACTION_ANOMALY["The Embers of Muaat"]  = ANOMALIES.SUPERNOVA;
  FACTION_ANOMALY["The Clan of Saar"]     = ANOMALIES.ASTEROID_FIELD;
  FACTION_ANOMALY["The Empyrean"]         = ANOMALIES.NEBULA;
  FACTION_ANOMALY["The Vuil'raith Cabal"] = ANOMALIES.GRAVITY_RIFT;
  const FACTION_WORMHOLE = { "The Ghosts of Creuss": true };
  const FEATURE_LABEL = {};
  FEATURE_LABEL[ANOMALIES.SUPERNOVA]="Supernova"; FEATURE_LABEL[ANOMALIES.ASTEROID_FIELD]="Asteroidenfeld";
  FEATURE_LABEL[ANOMALIES.NEBULA]="Nebel"; FEATURE_LABEL[ANOMALIES.GRAVITY_RIFT]="Gravitationsriss";
  FEATURE_LABEL[ANOMALIES.ENTROPIC_SCAR]="Entropic Scar";

  function factionNeed(name){
    if(!name) return null;
    if(FACTION_ANOMALY[name]!==undefined) return { kind:"anomaly", value:FACTION_ANOMALY[name] };
    if(FACTION_WORMHOLE[name]) return { kind:"wormhole" };
    return null;
  }
  function needLabel(f){ return f.kind==="wormhole" ? "α/β-Wormhole" : (FEATURE_LABEL[f.value]||"?"); }
  function hasFeature(sys, f){
    if(!sys) return false;
    if(f.kind==="wormhole") return sys.wormhole!==null && sys.wormhole!==WORMHOLES.DELTA;
    return sys.anomalies!==null && sys.anomalies.indexOf(f.value)>=0;
  }

  // Merkmale, die die gewaehlten Fraktionen brauchen, die aber im Tile-Vorrat gar nicht vorkommen.
  function missingFeatures(pool, factions){
    const miss=[];
    for(const name of (factions||[])){
      const f=factionNeed(name); if(!f) continue;
      if(f.kind==="wormhole"){
        // Es braucht ein vollstaendiges Paar (>=2) eines Typs.
        const ok=wormholeTypes(pool).some(T=>pool.filter(x=>x.wormhole===T).length>=2);
        if(!ok && miss.indexOf("Wormhole (mind. 2 gleiche)")<0) miss.push("Wormhole (mind. 2 gleiche)");
        continue;
      }
      if(!pool.some(s=>hasFeature(s,f))){ const l=needLabel(f); if(miss.indexOf(l)<0) miss.push(l); }
    }
    return miss;
  }

  // Prueft je Fraktionsbedarf, ob ein passendes Tile in Reichweite liegt – und auf welcher
  // Stufe (both = auch beide Nachbarn, near = mind. ein Nachbar, own = nur eigenes Heimatsystem).
  function featureReport(st, place){
    return (st.reqs||[]).map(function(r){
      const idx=st.homes.indexOf(r.home);
      const hit=list=>(list||[]).some(p=>place[p] && hasFeature(place[p], r.feature));
      const reach = hit(r.positionsBoth) ? "both" : (hit(r.positionsNear) ? "near" : (hit(r.positions) ? "own" : null));
      return { name:(st.factionNames&&st.factionNames[idx])||("Spieler "+(idx+1)), feature:r.featureKey, ok:!!reach, reach:reach };
    });
  }

  function k(x,y,z){ return x+","+y+","+z; }
  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  function shuffle(a,rng){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); const t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
  function range(a){ return Math.max.apply(null,a)-Math.min.apply(null,a); }
  // Totzone: eine Differenz von 1 Einheit ist bei allen Evaluatoren Rauschen und wird
  // ignoriert. So dominieren Evaluatoren mit kleiner Skala (z. B. Tech Access) nicht.
  const GAP_DEADBAND = 1;
  function relGap(g,D){ return Math.max(0, g-GAP_DEADBAND)/D; }

  // ---- Daten ----
  const planetByName = {}; planet_data.forEach(p => planetByName[p.name] = p);
  const SYS = {};
  system_data.forEach(s => { SYS[s.id] = { id:s.id, planets:s.planets.map(n=>planetByName[n]).filter(Boolean), anomalies:s.anomalies, wormhole:s.wormhole }; });

  function isRex(s){ return s.id===REX_ID; }
  function isRed(s){ return s.planets.length<1 || s.anomalies!==null; }
  function isBlue(s){ return !isRed(s) && !isRex(s); }
  function rawPlanetVal(p){ let v=Math.max(p.resources,p.influence); if(p.tech_specialties) v+=p.tech_specialties.length; return v; }

  // ---- Evaluator (an Map-Lab-Parameter angelehnt) ----
  function makeEval(ev){
    const strat = +ev.PLANET_STRATEGY || 1;
    const HZ=PLANET_TRAITS.HAZARDOUS, IN=PLANET_TRAITS.INDUSTRIAL, CU=PLANET_TRAITS.CULTURAL;
    function planetVal(p){
      const r = p.resources*ev.RESOURCES_MULTIPLIER;
      const i = p.influence*ev.INFLUENCE_MULTIPLIER;
      let t = 0;
      if(p.tech_specialties){
        t += ev.TECH_MOD;
        for(const ts of p.tech_specialties){
          if(ts===TECH_SPECIALTIES.WARFARE) t+=ev.TECH_WARFARE_MOD;
          else if(ts===TECH_SPECIALTIES.PROPULSION) t+=ev.TECH_PROPULSION_MOD;
          else if(ts===TECH_SPECIALTIES.BIOTIC) t+=ev.TECH_BIOTIC_MOD;
          else if(ts===TECH_SPECIALTIES.CYBERNETIC) t+=ev.TECH_CYBERNETIC_MOD;
        }
      }
      let v = ev.BASE_PLANET_MOD;
      if(strat===2) v += Math.max(r,i,t);
      else if(strat===3) v += Math.max(r,i)+t;
      else v += r+i+t;
      if(r>0) v += ev.NONZERO_RESOURCES_MOD;
      if(i>0) v += ev.NONZERO_INFLUENCE_MOD;
      if(p.traits) for(const tr of p.traits){
        if(tr===HZ) v+=ev.TRAIT_HAZARDOUS_MOD;
        else if(tr===IN) v+=ev.TRAIT_INDUSTRIAL_MOD;
        else if(tr===CU) v+=ev.TRAIT_CULTURAL_MOD;
      }
      return v;
    }
    function sysVal(s){
      let v=0; for(const p of s.planets) v+=planetVal(p);
      const n = s.planets.length;
      if(n===1) v+=ev.SINGLE_PLANET_MOD;
      else if(n===2){
        v+=ev.MULTI_PLANET_MOD;
        const a=s.planets[0].traits, b=s.planets[1].traits;
        const match = a && b && a.some(x=>b.indexOf(x)>=0);
        v += match ? ev.MATCHING_PLANETS_MOD : ev.NONMATCHING_PLANETS_MOD;
      } else if(n>2){ v += 2*ev.MULTI_PLANET_MOD + ev.MATCHING_PLANETS_MOD; }
      if(s.id===REX_ID) v+=ev.MECATOL_REX_SYS_MOD;
      if(LEGENDARY.indexOf(s.id)>=0) v+=ev.LEGENDARY_PLANET_SYS_MOD;
      if(STATION.indexOf(s.id)>=0) v+=ev.SPACE_STATION_SYS_MOD;
      return v;
    }
    const dm = ev.DISTANCE_MULTIPLIER || [2,2,1,0,0,0,0,0,0,0,0];
    const base = (ev.DISTANCE_MOD_BASE!=null) ? ev.DISTANCE_MOD_BASE : 1;
    return { planetVal:planetVal, sysVal:sysVal, dm:dm, base:base, ev:ev };
  }

  // ---- Pool & State ----
  function buildPool(base,pok,te){
    const out=[];
    for(const id in SYS){ const n=+id;
      if(n===REX_ID) continue;
      if(n<=58 && !base) continue;
      if(n>=59 && n<=80 && !pok) continue;
      if(n>=97 && !te) continue;
      out.push(SYS[id]);
    }
    return out;
  }

  // Offene Felder, die ein Spieler von seinem Heimatsystem aus in <=maxD Zuegen erreicht
  // (andere Heimatsysteme und Mecatol werden nicht durchquert). Entspricht KeeganW's
  // "Slice" mit SLICE_DISTANCE = 2.
  function reachPositions(st, homeKey, maxD){
    const blocked={}; for(const h of st.homes) blocked[h]=1; if(st.rexKey) blocked[st.rexKey]=1;
    const dist={}; dist[homeKey]=0; let front=[homeKey];
    for(let d=1; d<=maxD; d++){ const nf=[];
      for(const c of front) for(const n of (st.adj[c]||[])){ if(blocked[n] || (n in dist)) continue; dist[n]=d; nf.push(n); }
      front=nf; }
    const opens={}; for(const o of st.opens) opens[o]=1;
    return Object.keys(dist).filter(p=>p!==homeKey && dist[p]<=maxD && opens[p]);
  }

  // Heimatsysteme im Ring anordnen (Winkel um das Kartenzentrum) -> Nachbarschaft.
  function ringOrder(st){
    const hs=st.homes; if(!hs.length) return [];
    let cx=0, cy=0;
    for(const h of hs){ const c=st.byKey[h]; cx+=c.x+c.z/2; cy+=c.z; }
    cx/=hs.length; cy/=hs.length;
    return hs.map(h=>({ h:h, a:Math.atan2(st.byKey[h].z-cy, (st.byKey[h].x+st.byKey[h].z/2)-cx) }))
             .sort((p,q)=>p.a-q.a).map(o=>o.h);
  }

  // factions: Array (pro Heimatsystem/Spieler) mit Fraktionsnamen oder null.
  // contest: true = Merkmal moeglichst auch fuer die Nachbarn erreichbar platzieren.
  function buildState(title, pool, ev, factions, contest){
    const layout = default_layouts.find(l => l.title === title);
    const cells = layout.data.map(sp => ({ x:sp.x, y:sp.y, z:sp.z, key:k(sp.x,sp.y,sp.z), type:sp.type }));
    const byKey = {}; cells.forEach(c => byKey[c.key]=c);
    const adj = {};
    cells.forEach(c => {
      if(c.type===TYPE.CLOSED) return;
      adj[c.key] = NEI.map(d => k(c.x+d[0], c.y+d[1], c.z+d[2])).filter(nk => byKey[nk] && byKey[nk].type!==TYPE.CLOSED);
    });
    const homes = cells.filter(c=>c.type===TYPE.HOME).map(c=>c.key);
    const opens = cells.filter(c=>c.type===TYPE.OPEN).map(c=>c.key);
    const rex = cells.find(c=>c.type===TYPE.REX);
    const st = { cells, byKey, adj, homes, opens, rexKey: rex?rex.key:null, pool, eval:ev, contest:!!contest };
    st.homeW = computeHomeW(st);
    st.homeRing = ringOrder(st);
    st.reach = {}; for(const h of homes) st.reach[h] = reachPositions(st, h, 2);
    // Rueckwaerts-Zuordnung: Position -> Heimatsysteme, in deren Slice sie liegt.
    st.reachHomes = {};
    for(const h of homes) for(const p of st.reach[h]) (st.reachHomes[p]=st.reachHomes[p]||[]).push(h);

    // Fraktionsbedarf: je Spieler das Merkmal + die Felder, in denen es "erreichbar" zaehlt.
    // Gestufte Listen: positionsBoth (eigenes + beide Nachbarn) > positionsNear (eigenes +
    // mind. 1 Nachbar) > positions (nur eigenes).
    st.factionNames = factions ? factions.slice() : null;
    st.reqs = [];
    if(factions) factions.forEach(function(name, i){
      const f = factionNeed(name); if(!f || !homes[i]) return;
      const h=homes[i], n=st.homeRing.length, ri=st.homeRing.indexOf(h);
      const nb=[ st.homeRing[(ri-1+n)%n], st.homeRing[(ri+1)%n] ];
      const own=st.reach[h], nbReach=nb.map(x=>st.reach[x]||[]);
      const positionsBoth=own.filter(p=>nbReach.every(r=>r.indexOf(p)>=0));
      const positionsNear=own.filter(p=>nbReach.some(r=>r.indexOf(p)>=0));
      st.reqs.push({ home:h, feature:f, featureKey:needLabel(f),
                     positions:own, positionsNear:positionsNear, positionsBoth:positionsBoth });
    });
    return st;
  }

  function computeHomeW(st){
    const ev=st.eval, res=[];
    for(const h of st.homes){
      const dist={}; dist[h]=0; let front=[h];
      for(let d=1; d<=8; d++){ const nf=[]; for(const c of front) for(const n of (st.adj[c]||[])) if(!(n in dist)){ dist[n]=d; nf.push(n); } front=nf; }
      const wm={};
      for(const key in dist){ const d=dist[key]; if(d<1) continue;
        const idx=Math.min(10, Math.round(d*ev.base)); const w=ev.dm[idx]; if(w) wm[key]=w; }
      res.push(wm);
    }
    return res;
  }

  function sysConflicts(st, place, pos, sys){
    for(const n of (st.adj[pos]||[])){ const o=place[n];
      if(o){
        if(sys.anomalies!==null && o.anomalies!==null) return true;
        if(sys.wormhole!==null && o.wormhole!==null && sys.wormhole===o.wormhole) return true;
      }
      // Kein Wormhole direkt am Heimsystem (Community-Regel, s. README).
      if(sys.wormhole!==null){ const c=st.byKey[n]; if(c && c.type===TYPE.HOME) return true; }
    }
    return false;
  }

  // Anzahl Wormholes, die im Slice (<=2 Zuege) eines Heimatsystems liegen.
  function wormholesInSlice(st, place, home){
    let n=0; for(const p of (st.reach[home]||[])){ const s=place[p]; if(s && s.wormhole!==null) n++; }
    return n;
  }
  // Hoechstens 1 Wormhole pro Spieler-Slice: prueft nur die Heimatsysteme, deren Slice
  // die uebergebenen Positionen beruehrt (schnell genug fuer den Optimierer).
  function whLimitOk(st, place, positions){
    const homes={};
    for(const pos of positions) for(const h of (st.reachHomes[pos]||[])) homes[h]=1;
    for(const h in homes) if(wormholesInSlice(st, place, h)>1) return false;
    return true;
  }
  function whLimitOkAll(st, place){
    for(const h of st.homes) if(wormholesInSlice(st, place, h)>1) return false;
    return true;
  }

  // Aus st.reqs abgeleiteter Tile-Bedarf: je Merkmal die Anzahl benötigter Tiles.
  function featureDemand(st){
    const out=[];
    for(const r of (st.reqs||[])){
      const key=r.feature.kind+":"+(r.feature.value!==undefined?r.feature.value:"wh");
      let e=out.find(o=>o.key===key);
      if(!e){ e={ key:key, feature:r.feature, count:0 }; out.push(e); }
      e.count++;
    }
    return out;
  }

  // Erzwingt, dass fuer jeden Bedarf genug Merkmals-Tiles in der Auswahl sind. Es wird ein
  // farbgleiches Tile ohne dieses Merkmal ersetzt, damit Blue/Red-Verhaeltnis erhalten bleibt.
  function ensureFeatures(sel, blue, red, demand, rng){
    for(const d of demand){
      let have = sel.filter(s=>hasFeature(s,d.feature)).length;
      while(have < d.count){
        // Nur Nicht-Wormhole-Tiles ersetzen, damit die Wormhole-Paare unangetastet bleiben.
        const cands = sel.filter(s=>!hasFeature(s,d.feature) && s.wormhole===null);
        if(!cands.length) break;
        const cand = cands[Math.floor(rng()*cands.length)];
        const color = isBlue(cand) ? blue : red;
        const repl = color.filter(s=>hasFeature(s,d.feature) && sel.indexOf(s)<0);
        if(!repl.length) break;
        sel.splice(sel.indexOf(cand),1);
        sel.push(repl[Math.floor(rng()*repl.length)]);
        have++;
      }
    }
    return sel;
  }

  // Wormhole-Regel: pro Typ entweder 0 oder mindestens 2. Ein einzelnes Wormhole ist
  // funktionslos (es hat keinen Partner). Mit requireAll wird fuer jeden im Vorrat
  // vorhandenen Typ ein vollstaendiges Paar (>=2) erzwungen. Ersetzt werden nur Tiles
  // gleicher Farbe, damit das Blue/Red-Verhaeltnis erhalten bleibt.
  function wormholeTypes(pool){
    const types=[];
    for(const t of pool){ if(t.wormhole!==null && t.wormhole!==undefined && types.indexOf(t.wormhole)<0) types.push(t.wormhole); }
    return types;
  }
  function ensureWormholes(sel, pool, requireAll, rng){
    const blue=pool.filter(isBlue), red=pool.filter(isRed);
    for(const T of wormholeTypes(pool)){
      const avail=pool.filter(x=>x.wormhole===T);
      let cur=sel.filter(x=>x.wormhole===T).length;
      const target = requireAll ? Math.min(2, avail.length) : (cur>=2 ? cur : 0);
      while(cur < target){                                  // auf ein vollstaendiges Paar auffuellen
        const add=avail.filter(x=>sel.indexOf(x)<0); if(!add.length) break;
        const t=add[Math.floor(rng()*add.length)];
        const same=(isBlue(t)?blue:red).filter(x=>x.wormhole===null && sel.indexOf(x)>=0);
        if(!same.length) break;
        sel.splice(sel.indexOf(same[Math.floor(rng()*same.length)]),1); sel.push(t); cur++;
      }
      if(cur===1){                                          // einzelnes Wormhole nicht stehen lassen
        const only=sel.find(x=>x.wormhole===T);
        const repl=(isBlue(only)?blue:red).filter(x=>x.wormhole===null && sel.indexOf(x)<0);
        if(repl.length){ sel.splice(sel.indexOf(only),1); sel.push(repl[Math.floor(rng()*repl.length)]); }
      }
    }
    return sel;
  }

  function chooseTiles(pool, nOpen, ratio, wantWh, rng, demand){
    const blue = pool.filter(isBlue), red = pool.filter(isRed);
    let nB = Math.round(nOpen*ratio); nB = Math.max(0, Math.min(nB, blue.length));
    let nR = nOpen-nB;
    if(nR > red.length){ nR = red.length; nB = Math.min(nOpen-nR, blue.length); }
    const build = ()=>shuffle(blue.slice(),rng).slice(0,nB).concat(shuffle(red.slice(),rng).slice(0,nR));
    const needWh = wantWh || (demand||[]).some(d=>d.feature.kind==="wormhole");
    let sel = build();
    sel = ensureWormholes(sel, pool, needWh, rng);           // Wormholes zuerst: je Typ 0 oder >=2
    sel = ensureFeatures(sel, blue, red, demand||[], rng);   // dann Faktionsbedarf (Wormholes bleiben unberuehrt)
    return sel;
  }

  // Platziert ein Merkmals-Tile aus der Liste an einem freien, legalen Feld.
  function placeFeatureAt(st, place, pool, rng, list, feature, pinned){
    if(!list || !list.length) return false;
    for(const pos of shuffle(list.slice(),rng)){
      if(place[pos]) continue;
      for(const t of shuffle(pool.filter(x=>hasFeature(x,feature)),rng)){
        if(!sysConflicts(st,place,pos,t)){ place[pos]=t; pool.splice(pool.indexOf(t),1); pinned.add(t.id); return true; }
      }
    }
    return false;
  }

  function randomFill(st, rng){
    const place={}, pool=st.pool.slice(), order=shuffle(st.opens.slice(),rng), pinned=new Set();
    // 1) Fraktionsbedarf zuerst. Bei "contest" wird die beste erfuellbare Stufe gewaehlt:
    //    eigenes + beide Nachbarn > eigenes + >=1 Nachbar > nur eigenes.
    for(const r of (st.reqs||[])){
      // Nachbar-Modus: streng nur "eigenes + beide Nachbarn" bzw. "eigenes + >=1 Nachbar".
      // Klappt beides nicht, wird der Versuch verworfen (kein stiller Rueckfall auf "nur eigenes").
      const lists = st.contest ? [r.positionsBoth, r.positionsNear] : [r.positions];
      let ok=false;
      for(const l of lists){ if(placeFeatureAt(st, place, pool, rng, l, r.feature, pinned)){ ok=true; break; } }
      if(!ok) return null;   // Bedarf nicht platzierbar -> neuer Versuch
    }
    // 1b) Wormholes bewusst setzen: kein Wormhole am Heimsystem (in sysConflicts geprueft) und
    //     moeglichst hoechstens 1 Wormhole pro Spieler-Slice. Das Slice-Limit ist "best effort":
    //     geht es im Layout nicht auf (enge Layouts), wird es nicht erzwungen, sondern nur
    //     gemeldet. Ist die Startbelegung sauber, halten die Optimierer sie ein (st.whStrict).
    for(const t of shuffle(pool.filter(x=>x.wormhole!==null), rng)){
      let done=false;
      for(const pos of shuffle(st.opens.slice(),rng)){
        if(place[pos]) continue;
        if(sysConflicts(st,place,pos,t)) continue;
        place[pos]=t;
        if(!whLimitOk(st,place,[pos])){ place[pos]=undefined; continue; }
        pool.splice(pool.indexOf(t),1); done=true; break;
      }
      if(!done){   // notfalls ohne das Slice-Limit
        for(const pos of shuffle(st.opens.slice(),rng)){
          if(place[pos]) continue;
          if(sysConflicts(st,place,pos,t)) continue;
          place[pos]=t; pool.splice(pool.indexOf(t),1); done=true; break;
        }
      }
      if(!done) return null;
    }
    st.whStrict = whLimitOkAll(st, place);   // nur einhalten, wenn die Startbelegung es schafft
    // 2) Rest zufaellig fuellen.
    for(const pos of order){
      if(place[pos]) continue;
      shuffle(pool,rng);
      let chosen=null;
      for(const t of pool){ if(!sysConflicts(st,place,pos,t)){ chosen=t; break; } }
      if(!chosen) return null;
      place[pos]=chosen; pool.splice(pool.indexOf(chosen),1);
    }
    st.pinned=pinned;   // Garantie-Tiles bleiben waehrend der Optimierung fixiert
    return place;
  }

  function computeVals(st, place){
    const ev=st.eval, vals=new Array(st.homes.length).fill(0);
    for(const pos in place){
      const v=ev.sysVal(place[pos]); if(!v) continue;
      for(let h=0; h<st.homes.length; h++){ const w=st.homeW[h][pos]; if(w) vals[h]+=v*w; }
    }
    if(st.rexKey){ const rv=ev.sysVal(SYS[REX_ID]);
      for(let h=0; h<st.homes.length; h++){ const w=st.homeW[h][st.rexKey]; if(w) vals[h]+=rv*w; } }
    return vals;
  }

  function swapLegal(st, place, a, b){
    if(st.pinned && (st.pinned.has(place[a].id) || st.pinned.has(place[b].id))) return false;  // Garantie-Tiles fixiert
    const A=place[a], B=place[b];
    place[a]=B; place[b]=A;
    const ok = !sysConflicts(st,place,a,place[a]) && !sysConflicts(st,place,b,place[b])
            && (!st.whStrict || whLimitOk(st,place,[a,b]));
    place[a]=A; place[b]=B;
    return ok;
  }

  // ---- Optimierung ueber beliebig viele Evaluatoren ----
  const IDX_SLICE = (function(){ const i=default_evaluators.findIndex(e=>e.title==="Simple Slice"); return i<0?0:i; })();
  const IDX_JOE = (function(){ const i=default_evaluators.findIndex(e=>e.title==="Joebrew"); return i<0?Math.min(1,default_evaluators.length-1):i; })();
  let _evS=null, _evJ=null;
  function evSlice(){ return _evS || (_evS = makeEval(default_evaluators[IDX_SLICE].data)); }
  function evJoe(){ return _evJ || (_evJ = makeEval(default_evaluators[IDX_JOE].data)); }

  function evalUnder(st, place, ev){
    const oE=st.eval, oW=st.homeW;
    st.eval=ev; st.homeW=computeHomeW(st);
    const vals=computeVals(st,place);
    st.eval=oE; st.homeW=oW;
    return vals;
  }

  // ---- Generalisierte Optimierung ueber beliebig viele Evaluatoren ----
  function valsE(place, E, homes, rexKey){
    const nH=homes.length, v=new Array(nH).fill(0);
    for(const pos in place){ const a=E.val[place[pos].id]; if(!a) continue;
      for(let h=0;h<nH;h++){ const w=E.w[h][pos]; if(w) v[h]+=a*w; } }
    if(rexKey){ const ra=E.val[REX_ID];
      for(let h=0;h<nH;h++){ const w=E.w[h][rexKey]; if(w) v[h]+=ra*w; } }
    return v;
  }

  // Ein einzelner Evaluator: Tausch-Suche auf min(max-min).
  function climbOne(st, place, E, deadline){
    const keys=Object.keys(place), nH=st.homes.length;
    const v=valsE(place,E,st.homes,st.rexKey);
    let improved=true, guard=0;
    while(improved && guard++<200 && performance.now()<deadline){
      improved=false;
      for(let i=0;i<keys.length;i++) for(let j=i+1;j<keys.length;j++){
        const p=keys[i], q=keys[j];
        const a1=E.val[place[p].id], a2=E.val[place[q].id]; if(a1===a2) continue;
        if(!swapLegal(st,place,p,q)) continue;
        let mn=Infinity, mx=-Infinity;
        for(let h=0;h<nH;h++){ const nv=v[h]+(a2-a1)*((E.w[h][p]||0)-(E.w[h][q]||0)); if(nv<mn)mn=nv; if(nv>mx)mx=nv; }
        if(mx-mn < range(v)){
          for(let h=0;h<nH;h++) v[h]+=(a2-a1)*((E.w[h][p]||0)-(E.w[h][q]||0));
          const t=place[p]; place[p]=place[q]; place[q]=t; improved=true;
        }
      }
    }
    return v;
  }

  // Alle Evaluatoren zugleich. Verglichen werden RELATIVE Gaps (gap/getBasiswert),
  // weil die Evaluatoren unterschiedliche Einheiten haben. Erstrangig max., dann Summe.
  function hillClimbAll(st, place, Es, deadline){
    const keys=Object.keys(place), nH=st.homes.length, nE=Es.length;
    const V=Es.map(E=>valsE(place,E,st.homes,st.rexKey));
    const dens=()=>V.map(v=>{ let a=0; for(const x of v){ const ax=Math.abs(x); if(ax>a)a=ax; } return Math.max(1,a); });
    const relOf=(g,D)=>{ let s=0,m=0; for(let e=0;e<nE;e++){ const r=relGap(g[e],D[e]); s+=r; if(r>m)m=r; } return [s+8*m, m]; };
    let improved=true, guard=0;
    while(improved && guard++<400 && performance.now()<deadline){
      improved=false;
      const D=dens();
      const g0=V.map(v=>range(v));
      const res=relOf(g0,D);
      let cur=res[0], curMax=res[1];
      for(let i=0;i<keys.length;i++) for(let j=i+1;j<keys.length;j++){
        const p=keys[i], q=keys[j];
        let any=false;
        const d=new Array(nE);
        for(let e=0;e<nE;e++){ const a1=Es[e].val[place[p].id], a2=Es[e].val[place[q].id]; d[e]=a2-a1; if(a2!==a1) any=true; }
        if(!any) continue;
        if(!swapLegal(st,place,p,q)) continue;
        const ng=new Array(nE);
        for(let e=0;e<nE;e++){
          const w=Es[e].w; let mn=Infinity, mxx=-Infinity;
          for(let h=0;h<nH;h++){ const nv=V[e][h]+d[e]*((w[h][p]||0)-(w[h][q]||0)); if(nv<mn)mn=nv; if(nv>mxx)mxx=nv; }
          ng[e]=mxx-mn;
        }
        const nr=relOf(ng,D), ns=nr[0], nmx=nr[1];
        if(ns < cur-1e-12 || (Math.abs(ns-cur)<1e-12 && nmx<curMax)){
          for(let e=0;e<nE;e++){ const w=Es[e].w;
            for(let h=0;h<nH;h++) V[e][h]+=d[e]*((w[h][p]||0)-(w[h][q]||0)); }
          const t=place[p]; place[p]=place[q]; place[q]=t;
          improved=true; cur=ns; curMax=nmx;
        }
      }
    }
    return V;
  }

  // Relative Gaps (gap / groesster Betrag) fuer eine Belegung.
  function gapsRel(place, Es, homes, rexKey){
    return Es.map(function(E){
      const v=valsE(place,E,homes,rexKey);
      let a=0; for(const x of v){ const ax=Math.abs(x); if(ax>a)a=ax; }
      return relGap(range(v), Math.max(1,a));
    });
  }

  // Findet Evaluatoren, die nach der Optimierung noch "einseitig" sind
  // (z. B. Ressourcen fair, aber Influence schief). Schwelle ist ein relativer Gap.
  function oneSided(rel, Es, thr){
    const out=[];
    for(let i=0;i<rel.length;i++) if(rel[i]>thr) out.push(shortName(Es[i].name)+" "+(rel[i]*100).toFixed(1)+"%");
    return out;
  }

  // Gewichte + Systemwerte fuer ALLE Evaluatoren vorberechnen.
  function prepareEvals(st){
    const all = st.allPool || st.pool;
    const out = default_evaluators.map(function(e){
      const ev=makeEval(e.data);
      st.eval=ev; const w=computeHomeW(st);
      const val={};
      for(const sy of all) val[sy.id]=ev.sysVal(sy);
      val[REX_ID]=ev.sysVal(SYS[REX_ID]);
      return { name:e.title, ev:ev, w:w, val:val };
    });
    // Zusatz-Dimension: nicht-Planeten-Tiles im eigenen Slice (<=2 Zuege).
    // Quelle: daveah/ti4_planet_selection ("each player has a similar total number of
    // non-planet tiles"); KeeganW/ti4 gewichtet rote Tiles mit 1 (analog zu Ressourcen/
    // Influence). Linear in der Zuordnung -> passt direkt in die Optimierung.
    const valNP={};
    for(const sy of all) valNP[sy.id] = (sy.planets.length<1) ? 1 : 0;
    valNP[REX_ID]=0;                       // Mecatol gehoert niemandem
    const wNP = st.homes.map(function(h){ const o={}; for(const p of (st.reach[h]||[])) o[p]=1; return o; });
    out.push({ name:"Leere Felder", ev:null, w:wNP, val:valNP, nonPlanet:true });
    return out;
  }

  // Bank-Tausch: platzierte Systeme gegen gleichfarbige, aktuell NICHT platzierte Tiles
  // ersetzen (Bank = allPool minus platzierte). Zustandslos -> keine Dubletten. Da nur
  // gleichfarbige Tiles gleichen Wormhole-Typs getauscht werden, bleiben Blue/Red-Ver-
  // haeltnis und Wormhole-Paare erhalten.
  function bankClimb(st, place, Es, deadline){
    const all = st.allPool;
    if(!all || !all.length) return;
    const nE=Es.length, nH=st.homes.length, keys=Object.keys(place);
    const V=Es.map(E=>valsE(place,E,st.homes,st.rexKey));
    const dens=()=>V.map(v=>{ let a=0; for(const x of v){ const ax=Math.abs(x); if(ax>a)a=ax; } return Math.max(1,a); });
    const relOf=(g,D)=>{ let s=0,m=0; for(let e=0;e<nE;e++){ const r=relGap(g[e],D[e]); s+=r; if(r>m)m=r; } return [s+8*m,m]; };
    let improved=true, guard=0;
    while(improved && guard++<40 && performance.now()<deadline){
      improved=false;
      const D=dens();
      const placed={}; for(const pos of keys) placed[place[pos].id]=1;
      const bank=all.filter(s=>!placed[s.id]);
      const res=relOf(V.map(v=>range(v)),D);
      let cur=res[0], curMax=res[1];
      for(const pos of keys){
        const old=place[pos], oldBlue=isBlue(old), oldWh=old.wormhole;
        if(st.pinned && st.pinned.has(old.id)) continue;   // Garantie-Tile nicht antasten
        for(const t of bank.slice()){
          if(t.id===old.id || isBlue(t)!==oldBlue || t.wormhole!==oldWh) continue;
          if(bank.indexOf(t)<0) continue;              // schon verbraucht
          place[pos]=t;
          const bad=sysConflicts(st,place,pos,t) || (st.whStrict && !whLimitOk(st,place,[pos]));
          place[pos]=old;
          if(bad) continue;
          const ng=new Array(nE);
          for(let e=0;e<nE;e++){
            const dv=Es[e].val[t.id]-Es[e].val[old.id];
            let mn=Infinity, mx=-Infinity;
            for(let h=0;h<nH;h++){ const nv=V[e][h]+dv*(Es[e].w[h][pos]||0); if(nv<mn)mn=nv; if(nv>mx)mx=nv; }
            ng[e]=mx-mn;
          }
          const nr=relOf(ng,D), ns=nr[0], nmx=nr[1];
          if(ns<cur-1e-12 || (Math.abs(ns-cur)<1e-12 && nmx<curMax)){
            for(let e=0;e<nE;e++){ const dv=Es[e].val[t.id]-Es[e].val[old.id];
              for(let h=0;h<nH;h++) V[e][h]+=dv*(Es[e].w[h][pos]||0); }
            place[pos]=t;
            bank.splice(bank.indexOf(t),1); bank.push(old);   // lokal: neu raus, alt rein
            improved=true;
            const r2=relOf(V.map(v=>range(v)),D); cur=r2[0]; curMax=r2[1];
            break;
          }
        }
      }
    }
  }

  // Ein paar legale Zufallstausche (Kick) fuer Iterated Local Search.
  function perturb(st, place, rng, n){
    const keys=Object.keys(place);
    for(let t=0;t<n;t++){
      const a=keys[Math.floor(rng()*keys.length)], b=keys[Math.floor(rng()*keys.length)];
      if(a===b || !swapLegal(st,place,a,b)) continue;
      const tmp=place[a]; place[a]=place[b]; place[b]=tmp;
    }
  }

  function generateFull(st, Es, rng, budgetMs, targetRel){
    const deadline=performance.now()+budgetMs;
    const stage=Math.max(120, budgetMs/10);
    const iS=IDX_SLICE, iJ=IDX_JOE;
    let best=null, bestScore=Infinity, bestGaps=null, bestRel=null;
    let cur=null, sinceImprove=0, STALL=20;
    while(performance.now()<deadline){
      if(!cur || sinceImprove>STALL){
        const p=randomFill(st,rng); if(!p) continue;
        climbOne(st,p,Es[iS],Math.min(deadline, performance.now()+stage));
        climbOne(st,p,Es[iJ],Math.min(deadline, performance.now()+stage));
        hillClimbAll(st,p,Es,Math.min(deadline, performance.now()+stage*2));
        bankClimb(st,p,Es,Math.min(deadline, performance.now()+stage));
        cur=p; sinceImprove=0;
      } else {
        perturb(st, cur, rng, 2+Math.floor(rng()*5));
        hillClimbAll(st,cur,Es,Math.min(deadline, performance.now()+stage*2));
        bankClimb(st,cur,Es,Math.min(deadline, performance.now()+stage));
      }
      const rel=gapsRel(cur,Es,st.homes,st.rexKey);
      const gaps=Es.map(E=>range(valsE(cur,E,st.homes,st.rexKey)));
      let s=0,m=0; for(const g of rel){ s+=g; if(g>m)m=g; }
      const score=s+8*m;
      if(score<bestScore-1e-12){
        bestScore=score; bestGaps=gaps; bestRel=rel; best={ place:Object.assign({},cur) }; sinceImprove=0;
        if(m<=targetRel) break;
      } else sinceImprove++;
    }
    return best ? { place:best.place, gaps:bestGaps, rel:bestRel, score:bestScore } : null;
  }

  // ---- Rendering ----
  function esc(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  // ---- Designs (Themes) ----
  const THEMES = {
    classic: { label:"Classic (dunkel)", bg:"#07070c", panel:"#141420",
      blue:"#1f3a63", red:"#572c27", home:"#1f7a33", rex:"#7a6118", closed:"#08080d", warp:"#0d0d16",
      stroke:"#000000", sw:1, font:"sans-serif",
      id:"#a9bad6", homeLabel:"#dff5e1", value:"#ffffff", rexLabel:"#ffe9a8", warpGlyph:"#5a5a78",
      glyph:"#ffd479", trait:["#c0392b","#27ae60","#2980b9"], traitNone:"#7f8c8d",
      techFill:"#101010", techStroke:"#e8e8f0", resinf:"#dfe7f5", scanlines:false },
    retro: { label:"Retro 8-Bit", bg:"#0b0b1f", panel:"#1b1b3a",
      blue:"#2b4bd8", red:"#c03028", home:"#2fb344", rex:"#d4a017", closed:"#000000", warp:"#12123a",
      stroke:"#000000", sw:3, font:"monospace",
      id:"#eaeaff", homeLabel:"#06310f", value:"#0b0b1f", rexLabel:"#3a2a00", warpGlyph:"#6a6aa0",
      glyph:"#ffe14d", trait:["#e04a2f","#39d353","#3aa0ff"], traitNone:"#8a8ab0",
      techFill:"#0b0b1f", techStroke:"#eaeaff", resinf:"#0b0b1f", scanlines:true },
    giger: { label:"Biomech (Giger)", bg:"#08090a", panel:"#1c1e1a",
      blue:"#2e3330", red:"#412a24", home:"#414636", rex:"#6b5a2a", closed:"#000000", warp:"#101214",
      stroke:"#000000", sw:1.5, font:"sans-serif",
      id:"#9aa08f", homeLabel:"#c9d6a8", value:"#e6ead8", rexLabel:"#d8c98a", warpGlyph:"#4a5450",
      glyph:"#a6e22e", trait:["#8a3a2a","#5a7a4a","#4a6a7a"], traitNone:"#5a6157",
      techFill:"#0c0d0c", techStroke:"#c9d6a8", resinf:"#c9d0b8", scanlines:false },
    // Realistisch: eigener Sternenhimmel, Farbverlaeufe und schattierte Planetenkugeln.
    // Bewusst KEINE FFG-Tilescans (keeganw nutzt dafuer public/tiles/ST_<id>.webp).
    realistic: { label:"Realistisch", bg:"#04070d", bgFill:"url(#gBg)", panel:"#0a0f18",
      blue:"url(#gBlue)", red:"url(#gRed)", home:"url(#gHome)", rex:"url(#gRex)",
      closed:"#010205", warp:"#060a11",
      stroke:"#1d2c42", sw:1, font:"sans-serif",
      id:"#9fb4d0", homeLabel:"#d7ffe0", value:"#ffffff", rexLabel:"#ffe9a8", warpGlyph:"#33455f",
      glyph:"#ffd479", trait:["#c0392b","#27ae60","#2980b9"], traitNone:"#7f8c8d",
      techFill:"#0b0f16", techStroke:"#c8d6ea", resinf:"#dbe6f5",
      scanlines:false, realistic:true, textShadow:true,
      swatch:{ home:"#39a05c", rex:"#9b7f2e", blue:"#2f5486", red:"#6e3a32" } },
  };
  // Reihenfolge im Design-Dropdown; "realistisch" ist der Standard.
  const THEME_ORDER = ["realistic","classic","retro","giger"];
  function currentTheme(){ const sel=($("theme")&&$("theme").value)||"realistic"; return THEMES[sel]?sel:"realistic"; }
  // Design-Einstellung im Browser speichern (uebersteht Reload).
  const THEME_PREF_KEY = "ti4design";
  function loadThemePref(){
    try{ if(typeof localStorage==="undefined") return null; const v=localStorage.getItem(THEME_PREF_KEY); return (v && THEMES[v]) ? v : null; }
    catch(e){ return null; }
  }
  function saveThemePref(k){
    try{ if(typeof localStorage!=="undefined") localStorage.setItem(THEME_PREF_KEY, k); }catch(e){ /* z. B. privater Modus */ }
  }
  function sysGlyphs(sys){
    const g=[];
    if(sys.anomalies!==null) g.push(sys.anomalies.map(a=>ANOM_LABEL[a]).join("/"));
    if(sys.wormhole!==null) g.push(sys.wormhole===WORMHOLES.ALPHA?"α":"β");
    if(LEGENDARY.indexOf(sys.id)>=0) g.push("★");
    if(STATION.indexOf(sys.id)>=0) g.push("⌂");
    return g;
  }
  // Realistische Symbol-Grafik fuer Anomalien, Wormholes, legendaere Planeten und Stationen.
  // Nur im Design "realistisch"; die anderen Designs nutzen die Text-Glyphen (SN, GR, ...).
  function tileArt(sys, cx, cy, S, th){
    if(!th || !th.realistic) return "";
    const f=n=>+n.toFixed(1);
    let out="";
    if(sys.anomalies!==null) for(const a of sys.anomalies){
      if(a===ANOMALIES.SUPERNOVA){
        out += `<circle cx="${cx}" cy="${cy}" r="${f(S*0.58)}" fill="#ff9a3c" opacity="0.32" filter="url(#fGlow)">`
             + `<animate attributeName="opacity" values="0.18;0.44;0.18" dur="4s" repeatCount="indefinite"/></circle>`
             + `<circle cx="${cx}" cy="${cy}" r="${f(S*0.44)}" fill="url(#aNova)"/>`
             + `<circle cx="${cx}" cy="${cy}" r="${f(S*0.13)}" fill="#fffdf2"/>`;
        for(let i=0;i<8;i++){ const an=i*Math.PI/4, r1=S*0.15, r2=S*0.30;
          out += `<line x1="${f(cx+Math.cos(an)*r1)}" y1="${f(cy+Math.sin(an)*r1)}" x2="${f(cx+Math.cos(an)*r2)}" y2="${f(cy+Math.sin(an)*r2)}" stroke="#ffd27a" stroke-width="1.2" opacity="0.75"/>`; }
      } else if(a===ANOMALIES.NEBULA){
        out += `<g filter="url(#fNeb)">`;
        for(const w of [[-6,-3,13,0.55],[6,2,11,0.5],[0,6,9,0.45],[-4,5,8,0.4]])
          out += `<circle cx="${f(cx+w[0]*S/30)}" cy="${f(cy+w[1]*S/30)}" r="${f(w[2]*S/30)}" fill="url(#aNeb)" opacity="${w[3]}"/>`;
        out += `</g>`;
      } else if(a===ANOMALIES.ASTEROID_FIELD){
        // Unregelaessige Felsbrocken statt Kreise (deterministisch je Position).
        for(const w of [[-9,-5,2.4,1],[3,-8,1.7,2],[10,1,2.7,3],[-3,7,1.9,4],[-12,4,1.3,5],[2,10,1.5,6],[11,-6,1.2,7]]){
          const rx=cx+w[0]*S/30, ry=cy+w[1]*S/30, rad=w[2]*S/30, sd=w[3];
          let pts="";
          for(let k2=0;k2<6;k2++){ const an=k2*Math.PI/3, rr=rad*(0.72+0.42*((Math.sin(sd*13.1+k2*7.7)+1)/2));
            pts += f(rx+Math.cos(an)*rr)+","+f(ry+Math.sin(an)*rr)+" "; }
          out += `<polygon points="${pts}" fill="#8a93a0" stroke="#2a323a" stroke-width="0.5"/>`;
        }
      } else if(a===ANOMALIES.GRAVITY_RIFT){
        out += `<circle cx="${cx}" cy="${cy}" r="${f(S*0.46)}" fill="#3a1b6e" opacity="0.35" filter="url(#fGlow)"/>`
             + `<circle cx="${cx}" cy="${cy}" r="${f(S*0.38)}" fill="url(#aRift)"/>`;
        out += `<g><animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="26s" repeatCount="indefinite"/>`;
        for(let i=0;i<4;i++){ const r=f(S*(0.36-i*0.07));
          out += `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${f(r*0.55)}" fill="none" stroke="#8f78f0" stroke-width="1" opacity="${f(0.6-i*0.12)}" transform="rotate(${-20+i*18} ${cx} ${cy})"/>`; }
        out += `</g>`;
      } else if(a===ANOMALIES.ENTROPIC_SCAR){
        const pts=[[-11,-8],[-5,-3],[-8,2],[0,6],[6,3],[10,8]].map(p=>f(cx+p[0]*S/30)+","+f(cy+p[1]*S/30)).join(" ");
        out += `<polyline points="${pts}" fill="none" stroke="#9a6bff" stroke-width="2.4" opacity="0.55"/>`
             + `<polyline points="${pts}" fill="none" stroke="#e8dcff" stroke-width="0.9" opacity="0.9"/>`;
      }
    }
    if(sys.wormhole!==null){
      const isA=sys.wormhole===WORMHOLES.ALPHA;
      out += `<circle cx="${cx}" cy="${cy}" r="${f(S*0.42)}" fill="${isA?"url(#wA)":"url(#wB)"}"/>`;
      for(let i=0;i<3;i++){ const r=f(S*(0.16+i*0.10));
        out += `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${f(r*0.6)}" fill="none" stroke="${isA?"#7fe3ff":"#d0a6ff"}" stroke-width="1" opacity="${f(0.7-i*0.16)}" transform="rotate(${-30+i*22} ${cx} ${cy})"/>`; }
      out += `<circle cx="${cx}" cy="${cy}" r="${f(S*0.07)}" fill="#ffffff" opacity="0.85"/>`;
    }
    if(LEGENDARY.indexOf(sys.id)>=0){
      const sx=f(cx+S*0.36), sy=f(cy-S*0.50), R=f(S*0.20), r=f(R*0.45);
      let pts="";
      for(let i=0;i<10;i++){ const an=-Math.PI/2+i*Math.PI/5, rad=(i%2===0)?R:r;
        pts += f(sx+Math.cos(an)*rad)+","+f(sy+Math.sin(an)*rad)+" "; }
      out += `<polygon points="${pts}" fill="url(#gStar)" stroke="#6b4a12" stroke-width="0.6"/>`;
    }
    if(STATION.indexOf(sys.id)>=0){
      const scy=f(cy+S*0.05), R=f(S*0.22);
      out += `<circle cx="${cx}" cy="${scy}" r="${R}" fill="none" stroke="#c9d6ea" stroke-width="1.6" opacity="0.75"/>`
           + `<circle cx="${cx}" cy="${scy}" r="${f(R*0.55)}" fill="none" stroke="#c9d6ea" stroke-width="1" opacity="0.6"/>`;
      for(let i=0;i<3;i++){ const an=i*Math.PI/3;
        out += `<line x1="${f(cx+Math.cos(an)*R*0.55)}" y1="${f(scy+Math.sin(an)*R*0.55)}" x2="${f(cx+Math.cos(an)*R)}" y2="${f(scy+Math.sin(an)*R)}" stroke="#c9d6ea" stroke-width="1" opacity="0.6"/>`; }
    }
    return out;
  }

  function render(st, place, vals, themeKey){
    const th = THEMES[themeKey] || THEMES.realistic;
    const S=30, SQ=Math.sqrt(3);
    const proj=c=>[SQ*S*(c.x+c.z/2), 1.5*S*c.z];
    const pts={}; let minx=1e9,miny=1e9,maxx=-1e9,maxy=-1e9;
    for(const c of st.cells){ const p=proj(c); pts[c.key]=p;
      minx=Math.min(minx,p[0]); maxx=Math.max(maxx,p[0]); miny=Math.min(miny,p[1]); maxy=Math.max(maxy,p[1]); }
    const ox=-minx+S*1.15, oy=-miny+S*1.15, wd=maxx-minx+S*2.3, ht=maxy-miny+S*2.3;
    const vtx=[[0,-S],[SQ/2*S,-S/2],[SQ/2*S,S/2],[0,S],[-SQ/2*S,S/2],[-SQ/2*S,-S/2]];
    const hv={}; st.homes.forEach((h,i)=>hv[h]=vals[i]);
    let fills="", content="";
    for(const c of st.cells){
      const p=pts[c.key], cx=+(p[0]+ox).toFixed(1), cy=+(p[1]+oy).toFixed(1);
      const poly=vtx.map(v=>`${(cx+v[0]).toFixed(1)},${(cy+v[1]).toFixed(1)}`).join(" ");
      let fill=th.panel;
      const sys=place[c.key];
      if(c.type===TYPE.HOME) fill=th.home;
      else if(c.type===TYPE.REX) fill=th.rex;
      else if(c.type===TYPE.CLOSED) fill=th.closed;
      else if(c.type===TYPE.WARP) fill=th.warp;
      else if(c.type===TYPE.OPEN && sys) fill = isRed(sys)?th.red:th.blue;
      fills += `<polygon points="${poly}" fill="${fill}" stroke="${th.stroke}" stroke-width="${th.sw}"/>`;

      const T=(y,txt,size,fillc,w)=>{
        const sh = th.textShadow ? `<text x="${cx}" y="${(y+0.9).toFixed(1)}" font-size="${size}" fill="#000000" opacity="0.55" text-anchor="middle" font-family="${th.font}"${w?' font-weight="bold"':''}>${txt}</text>` : "";
        return sh + `<text x="${cx}" y="${y}" font-size="${size}" fill="${fillc}" text-anchor="middle" font-family="${th.font}"${w?' font-weight="bold"':''}>${txt}</text>`;
      };
      if(c.type===TYPE.HOME){
        const hi=st.homes.indexOf(c.key);
        const fac=(st.factionNames && st.factionNames[hi]) ? shortFaction(st.factionNames[hi]) : null;
        content += T(cy-16, "HOME", 10, th.homeLabel)
                 + (fac ? T(cy-4, esc(fac), 10, th.glyph) : "")
                 + T(cy+15, hv[c.key], 16, th.value, true);
      } else if(c.type===TYPE.REX){
        content += T(cy-6, "MECATOL", 9, th.rexLabel) + T(cy+9, "1/6", 10, th.value);
      } else if(c.type===TYPE.WARP){
        content += T(cy+5, "◇", 14, th.warpGlyph);
      } else if(c.type===TYPE.OPEN && sys){
        content += T(cy-17, sys.id, 9, th.id);
        content += tileArt(sys, cx, cy, S, th);
        const ps=sys.planets, n=ps.length;
        const spacing = n>1 ? Math.min(S*0.55, (S*1.15)/(n-1)) : 0;
        const discR = n>1 ? Math.min(8.5, spacing*0.42) : 8.5;
        const startX = cx - (n-1)*spacing/2;
        ps.forEach((pl,i)=>{
          const px=+(startX+i*spacing).toFixed(1), py=+(cy-2).toFixed(1);
          const isReal=!!th.realistic;
          const pfill = isReal
            ? ((["url(#pRed)","url(#pGreen)","url(#pBlue)"][(pl.traits&&pl.traits.length)?pl.traits[0]:-1]) || "url(#pGrey)")
            : ((pl.traits&&pl.traits.length)?(th.trait[pl.traits[0]]||th.traitNone):th.traitNone);
          // Ringplanet: deterministisch fuer ~1/3 der Planeten (stabil je System).
          const ringed = isReal && (((((pl.name||"").length*7 + pl.resources*13 + pl.influence*5) % 3) === 0));
          const rrx=+(discR*1.95).toFixed(1), rry=+(discR*0.62).toFixed(1);
          if(ringed) content += `<g transform="rotate(-18 ${px} ${py})"><ellipse cx="${px}" cy="${py}" rx="${rrx}" ry="${rry}" fill="none" stroke="url(#gRing)" stroke-width="1.6" opacity="0.5"/></g>`;
          content += `<circle cx="${px}" cy="${py}" r="${discR.toFixed(1)}" fill="${pfill}" stroke="${isReal?"#0a1018":th.stroke}" stroke-width="${(th.sw*0.8).toFixed(2)}"/>`;
          if(isReal) content += `<circle cx="${(px-discR*0.34).toFixed(1)}" cy="${(py-discR*0.34).toFixed(1)}" r="${(discR*0.30).toFixed(1)}" fill="#ffffff" opacity="0.22"/>`;
          if(ringed) content += `<g transform="rotate(-18 ${px} ${py})"><path d="M ${(px-rrx).toFixed(1)} ${py} A ${rrx} ${rry} 0 0 0 ${(px+rrx).toFixed(1)} ${py}" fill="none" stroke="url(#gRing)" stroke-width="1.6" opacity="0.85"/></g>`;
          if(pl.tech_specialties && pl.tech_specialties.length){
            const bx=(px+discR*0.75).toFixed(1), by=(py-discR*0.75).toFixed(1);
            content += `<circle cx="${bx}" cy="${by}" r="4.2" fill="${th.techFill}" stroke="${th.techStroke}" stroke-width="0.6"/>`
                     + `<text x="${bx}" y="${(+by+2.2).toFixed(1)}" font-size="6" fill="${th.value}" text-anchor="middle" font-family="${th.font}">${TECH_LETTER[pl.tech_specialties[0]]||""}</text>`;
          }
          content += `<text x="${px}" y="${(py+discR+8).toFixed(1)}" font-size="7.5" fill="${th.resinf}" text-anchor="middle" font-family="${th.font}">${pl.resources}/${pl.influence}</text>`;
        });
        const g=sysGlyphs(sys);
        if(g.length) content += T(cy+21, g.join(" "), 8, th.glyph);
      }
    }
    // Realistisch: eigener Sternenhimmel + Farbverlaufs-Definitionen (keine FFG-Assets).
    let defs="", stars="";
    if(th.realistic){
      defs = `<defs>`+
        `<radialGradient id="gBg" cx="50%" cy="42%" r="80%"><stop offset="0%" stop-color="#0b1526"/><stop offset="60%" stop-color="#050a14"/><stop offset="100%" stop-color="#02040a"/></radialGradient>`+
        `<linearGradient id="gBlue" x1="0" y1="0" x2="0.25" y2="1"><stop offset="0%" stop-color="#2f5486"/><stop offset="100%" stop-color="#152238"/></linearGradient>`+
        `<linearGradient id="gRed" x1="0" y1="0" x2="0.25" y2="1"><stop offset="0%" stop-color="#6e3a32"/><stop offset="100%" stop-color="#381d19"/></linearGradient>`+
        `<linearGradient id="gHome" x1="0" y1="0" x2="0.25" y2="1"><stop offset="0%" stop-color="#39a05c"/><stop offset="100%" stop-color="#143a24"/></linearGradient>`+
        `<linearGradient id="gRex" x1="0" y1="0" x2="0.25" y2="1"><stop offset="0%" stop-color="#9b7f2e"/><stop offset="100%" stop-color="#463711"/></linearGradient>`+
        `<radialGradient id="pRed" cx="34%" cy="30%" r="78%"><stop offset="0%" stop-color="#f0907f"/><stop offset="45%" stop-color="#c0503f"/><stop offset="100%" stop-color="#5a1c15"/></radialGradient>`+
        `<radialGradient id="pGreen" cx="34%" cy="30%" r="78%"><stop offset="0%" stop-color="#9ae6a8"/><stop offset="45%" stop-color="#3f9a5a"/><stop offset="100%" stop-color="#16402a"/></radialGradient>`+
        `<radialGradient id="pBlue" cx="34%" cy="30%" r="78%"><stop offset="0%" stop-color="#9ccaf2"/><stop offset="45%" stop-color="#3f6fae"/><stop offset="100%" stop-color="#162c4a"/></radialGradient>`+
        `<radialGradient id="pGrey" cx="34%" cy="30%" r="78%"><stop offset="0%" stop-color="#d6dde4"/><stop offset="45%" stop-color="#7d8a96"/><stop offset="100%" stop-color="#2a323a"/></radialGradient>`+
        `<radialGradient id="aNova" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#fff8d0" stop-opacity="0.95"/><stop offset="35%" stop-color="#ffcf5a" stop-opacity="0.85"/><stop offset="70%" stop-color="#ff7a2e" stop-opacity="0.45"/><stop offset="100%" stop-color="#ff5a1e" stop-opacity="0"/></radialGradient>`+
        `<radialGradient id="aNeb" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#7fd8ff" stop-opacity="0.45"/><stop offset="60%" stop-color="#6a7dff" stop-opacity="0.22"/><stop offset="100%" stop-color="#6a7dff" stop-opacity="0"/></radialGradient>`+
        `<radialGradient id="aRift" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#000000" stop-opacity="0.92"/><stop offset="70%" stop-color="#1a0f2e" stop-opacity="0.7"/><stop offset="100%" stop-color="#1a0f2e" stop-opacity="0"/></radialGradient>`+
        `<radialGradient id="wA" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#7fe3ff" stop-opacity="0.85"/><stop offset="55%" stop-color="#2a6a9a" stop-opacity="0.55"/><stop offset="100%" stop-color="#071424" stop-opacity="0"/></radialGradient>`+
        `<radialGradient id="wB" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#e0b6ff" stop-opacity="0.85"/><stop offset="55%" stop-color="#7a3fa8" stop-opacity="0.55"/><stop offset="100%" stop-color="#1a0f2e" stop-opacity="0"/></radialGradient>`+
        `<linearGradient id="gStar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffe89a"/><stop offset="100%" stop-color="#c98a10"/></linearGradient>`+
        `<linearGradient id="gRing" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#4a5f78"/><stop offset="45%" stop-color="#d8e6f5"/><stop offset="100%" stop-color="#8fa6c0"/></linearGradient>`+
        `<filter id="fGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.2"/></filter>`+
        `<filter id="fNeb" x="-35%" y="-35%" width="170%" height="170%">`+
          `<feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="3" seed="7" result="n"/>`+
          `<feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G"/>`+
          `<feGaussianBlur stdDeviation="0.8"/>`+
        `</filter>`+
      `</defs>`;
      let sd=7;
      const rnd=()=>{ sd=(sd*1103515245+12345)&0x7fffffff; return sd/0x7fffffff; };
      for(let i=0;i<170;i++){
        const sx=(rnd()*wd).toFixed(0), sy=(rnd()*ht).toFixed(0), sr=(0.4+rnd()*1.25).toFixed(2), so=(0.12+rnd()*0.55).toFixed(2);
        stars += `<circle cx="${sx}" cy="${sy}" r="${sr}" fill="#cfe0ff" opacity="${so}"/>`;
      }
    }
    const scanDefs = th.scanlines ? `<defs><pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#000000" opacity="0.16"/></pattern></defs>` : "";
    const scanRect = th.scanlines ? `<rect width="100%" height="100%" fill="url(#scan)"/>` : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${wd|0}" height="${ht|0}" viewBox="0 0 ${wd|0} ${ht|0}">${defs}${scanDefs}<rect width="100%" height="100%" fill="${th.bgFill||th.bg}"/>${stars}${fills}${content}${scanRect}</svg>`;
  }

  // ---- Map-String & Statistik ----
  function mapString(st, place){
    const n = st.cells.length<=37 ? 36 : 60;
    return map_string_order_src.slice(0,n).map(o=>{ const sys=place[k(o.x,o.y,o.z)]; return sys?sys.id:0; }).join(" ");
  }
  function stats(st, place){
    const systems=Object.values(place);
    const blue=systems.filter(isBlue).length, red=systems.filter(isRed).length;
    let res=0,inf=0,tech="",haz=0,ind=0,cul=0;
    for(const s of systems) for(const p of s.planets){
      res+=p.resources; inf+=p.influence;
      if(p.tech_specialties) for(const ts of p.tech_specialties){ const L=TECH_LETTER[ts]; if(L) tech+=L; }
      if(p.traits) for(const tr of p.traits){ if(tr===PLANET_TRAITS.HAZARDOUS)haz++; else if(tr===PLANET_TRAITS.INDUSTRIAL)ind++; else if(tr===PLANET_TRAITS.CULTURAL)cul++; }
    }
    tech=tech.split("").sort().join("");
    // Wormholes je Typ zaehlen; gueltig ist 0 oder >=2 pro Typ (ein Einzelnes ist nutzlos).
    const whNames={}; whNames[WORMHOLES.ALPHA]="α"; whNames[WORMHOLES.BETA]="β"; whNames[WORMHOLES.DELTA]="δ";
    const wc={};
    for(const s of systems){ if(s.wormhole!==null && s.wormhole!==undefined) wc[s.wormhole]=(wc[s.wormhole]||0)+1; }
    const wkeys=Object.keys(wc);
    const wh = wkeys.length ? wkeys.map(k2=>whNames[k2]+wc[k2]).join(" ") : "–";
    const whOk = wkeys.every(k2=>wc[k2]>=2);
    // Zusatzregeln: hoechstens 1 Wormhole pro Spieler-Slice, keines am Heimsystem.
    let whSliceOk=true;
    for(const h of st.homes) if(wormholesInSlice(st, place, h)>1) whSliceOk=false;
    let whHomeOk=true;
    for(const pos in place){ const s=place[pos]; if(!s || s.wormhole===null) continue;
      for(const n of (st.adj[pos]||[])){ const c=st.byKey[n]; if(c && c.type===TYPE.HOME) whHomeOk=false; } }
    return { blue, red, res, inf, tech, traits:`${haz}/${ind}/${cul}`, wh:wh, whOk:whOk, whSliceOk:whSliceOk, whHomeOk:whHomeOk };
  }

  // ---- UI ----
  const $ = id => document.getElementById(id);
  let cur = null; // { st, place, vals }

  function fillLayouts(){
    const p=$("players").value, sel=$("layout"); sel.innerHTML="";
    LAYOUTS[p].forEach(t=>{ const o=document.createElement("option"); o.value=t; o.textContent=t; sel.appendChild(o); });
  }
  function fillEvaluators(){
    const sel=$("evaluator"); sel.innerHTML="";
    default_evaluators.forEach((e,i)=>{ const o=document.createElement("option"); o.value=String(i); o.textContent=e.title; sel.appendChild(o); });
    sel.value=String(IDX_JOE);   // Anzeige standardmäßig Joebrew (Pipeline endet auf Joebrew)
  }
  function fillThemes(){
    const sel=$("theme"); if(!sel) return; sel.innerHTML="";
    THEME_ORDER.filter(kk=>THEMES[kk]).forEach(kk=>{ const o=document.createElement("option"); o.value=kk; o.textContent=THEMES[kk].label; sel.appendChild(o); });
    sel.value = loadThemePref() || "realistic";
  }
  function setStatus(t){ $("status").textContent=t; }

  // ---- Faktions-Auswahl (UI) ----
  // Pro Spieler ein Dropdown; nur Fraktionen der aktivierten Erweiterungen.
  function enabledFactions(){
    return FACTIONS.filter(f => f.exp==="base" ? $("base").checked : (f.exp==="pok" ? $("pok").checked : $("te").checked));
  }
  function fillFactions(){
    const box=$("factions"); if(!box) return;
    const n=+$("players").value, prev=readFactions()||[];
    box.innerHTML="";
    if($("useFactions").checked){
      for(let i=0;i<n;i++){
        const row=document.createElement("div"); row.className="frow";
        const lab=document.createElement("span"); lab.textContent="Spieler "+(i+1); row.appendChild(lab);
        const sel=document.createElement("select"); sel.className="fsel";
        const none=document.createElement("option"); none.value=""; none.textContent="—"; sel.appendChild(none);
        for(const f of enabledFactions()){ const o=document.createElement("option"); o.value=f.name; o.textContent=f.name+(factionNeed(f.name)?" *":""); sel.appendChild(o); }
        sel.value = prev[i] && enabledFactions().some(f=>f.name===prev[i]) ? prev[i] : "";
        sel.addEventListener("change", syncFactionSelects);   // Einmal-Auswahl erzwingen
        row.appendChild(sel); box.appendChild(row);
      }
    }
    syncFactionSelects();
  }
  // Eine Fraktion darf nur einmal vergeben werden: bereits gewaehlte Optionen werden deaktiviert.
  function syncFactionSelects(){
    const box=$("factions");
    if(box && box.querySelectorAll){
      const sels=box.querySelectorAll("select"), used={};
      Array.prototype.forEach.call(sels, s=>{ if(s.value) used[s.value]=1; });
      Array.prototype.forEach.call(sels, s=>{
        const opts=s.options||[];
        for(let i=0;i<opts.length;i++){ const o=opts[i]; o.disabled = !!(o.value && o.value!==s.value && used[o.value]); }
      });
    }
    updateContestEnabled();
  }
  // Der Nachbar-Schalter ist nur sinnvoll, wenn auch Fraktionen gewaehlt sind.
  function updateContestEnabled(){
    const cb=$("contestFeature"); if(!cb) return;
    const facs=readFactions();
    const any=!!facs && facs.some(f=>f);
    cb.disabled=!any;
    if(!any) cb.checked=false;
    const lab=(typeof cb.closest==="function") ? cb.closest("label") : null;
    if(lab && lab.classList) lab.classList.toggle("is-disabled", !any);
    const hint=$("contestHint"); if(hint) hint.style.display = any ? "none" : "";
  }
  function readFactions(){
    if(!$("useFactions") || !$("useFactions").checked) return null;
    const sels=$("factions") ? $("factions").querySelectorAll("select") : [];
    return Array.prototype.map.call(sels, s=>s.value||null);
  }

  function shortName(t){
    return t==="Simple Slice"?"Slice":t==="Joebrew"?"Joebrew":t==="Resource Access"?"Res":
           t==="Influence Access"?"Inf":t==="Tech Access"?"Tech":t==="Leere Felder"?"Leer":t;
  }
  function shortFaction(n){
    if(!n) return "";
    const m={ "The Embers of Muaat":"Muaat", "The Clan of Saar":"Saar", "The Empyrean":"Empyrean",
              "The Vuil'raith Cabal":"Vuil'raith", "The Ghosts of Creuss":"Creuss" };
    return m[n] || n.replace(/^The /,"");
  }

  // ---- Legende unter der Karte ----
  const TECH_DE = {}; TECH_DE[TECH_LETTER[TECH_SPECIALTIES.WARFARE]]="Warfare";
  TECH_DE[TECH_LETTER[TECH_SPECIALTIES.PROPULSION]]="Propulsion";
  TECH_DE[TECH_LETTER[TECH_SPECIALTIES.BIOTIC]]="Biotic"; TECH_DE[TECH_LETTER[TECH_SPECIALTIES.CYBERNETIC]]="Cybernetic";
  const ANOM_DE = { SN:"Supernova", NEB:"Nebel", AST:"Asteroidenfeld", GR:"Gravitationsriss", ES:"Entropic Scar" };
  const ANOM_ORDER = ["SN","GR","NEB","AST","ES"];

  function legendHTML(){
    const th = THEMES[currentTheme()] || THEMES.classic;
    const sw=c=>`<span class="lg-sw" style="background:${c}"></span>`;
    const badge=t=>`<span class="lg-sw lg-badge" style="background:${th.techFill};border-color:${th.techStroke};color:${th.value}">${t}</span>`;
    const gly=t=>`<span class="lg-glyph" style="color:${th.glyph}">${t}</span>`;
    const pair=(sym,txt)=>`<span class="lg-pair">${sym}<span class="lg-t">${txt}</span></span>`;
    const item=(...parts)=>`<span class="lg-item">${parts.join("")}</span>`;
    // Bei Verlaufs-Fuellungen (realistisch) feste Swatch-Farben verwenden.
    const swc=c=>(th.swatch && th.swatch[c]) || th[c];

    const techKeys=[TECH_LETTER[TECH_SPECIALTIES.WARFARE], TECH_LETTER[TECH_SPECIALTIES.PROPULSION],
                    TECH_LETTER[TECH_SPECIALTIES.BIOTIC], TECH_LETTER[TECH_SPECIALTIES.CYBERNETIC]];
    const tech=techKeys.map(x=>[x, TECH_DE[x]||x]);
    const acrSet={}; Object.keys(ANOM_LABEL).forEach(k2=>{ acrSet[ANOM_LABEL[k2]]=1; });
    const acrList=ANOM_ORDER.filter(a=>acrSet[a]).concat(Object.keys(acrSet).filter(a=>ANOM_ORDER.indexOf(a)<0));

    return [
      item(`<span class="lg-t">Tech-Spezialisierung:</span>`, tech.map(t=>pair(badge(t[0]),t[1])).join("")),
      item(`<span class="lg-t">Zahl am Planeten (<b>3/1</b>) = Ressourcen&nbsp;/&nbsp;Influence</span>`),
      item(`<span class="lg-t">Planetentyp:</span>`,
        pair(sw(th.trait[0]),"Hazardous")+pair(sw(th.trait[1]),"Industrial")+pair(sw(th.trait[2]),"Cultural")),
      item(`<span class="lg-t">Anomalien:</span>`, acrList.map(a=>pair(gly(a), ANOM_DE[a]||a)).join("")),
      item(`<span class="lg-t">Wormhole (je Typ 0 oder ≥2; max. 1 je Slice; keins am Home):</span>`, pair(gly("α"),"Alpha")+pair(gly("β"),"Beta")),
      item(pair(gly("★"),"legendärer Planet")+pair(gly("⌂"),"Raumstation")+pair(gly("◇"),"Warprand (leer)")),
      item(pair(`<span class="lg-num">110</span>`,"Tile-Nummer (System)")),
      item(`<span class="lg-t">Felder:</span>`,
        pair(sw(swc("home")),"HOME")+pair(sw(swc("rex")),"Mecatol Rex")+pair(sw(swc("blue")),"besiedelbar (blau)")+pair(sw(swc("red")),"leer/Anomalie (rot)")),
    ].join("");
  }
  function renderLegend(){ const el=$("legend"); if(el) el.innerHTML=legendHTML(); }

  function paint(){
    const st=cur.st, place=cur.place, prep=cur.prep, s=stats(st,place);
    const selIdx=+$("evaluator").value;
    const vals=valsE(place, prep[selIdx], st.homes, st.rexKey);
    const gaps=prep.map(E=>range(valsE(place,E,st.homes,st.rexKey)));
    const rel=gapsRel(place, prep, st.homes, st.rexKey);
    const maxRel=Math.max.apply(null,rel);
    $("map").innerHTML=render(st,place,vals,currentTheme());
    if(typeof document!=="undefined" && document.body) document.body.setAttribute("data-theme", currentTheme());
    renderLegend();
    $("mapstring").value=mapString(st,place);
    let pills =
      `<span class="pill">Blue/Red <b>${s.blue}/${s.red}</b></span>`+
      `<span class="pill">Res/Inf <b>${s.res}/${s.inf}</b></span>`+
      `<span class="pill">Tech <b>${s.tech||"-"}</b></span>`+
      `<span class="pill">Traits R/G/B <b>${s.traits}</b></span>`+
      `<span class="pill ${s.whOk?"good":"bad"}">Wormholes <b>${s.wh}</b></span>`+
      `<span class="pill ${s.whSliceOk?"good":"bad"}">Wormhole ≤1/Slice <b>${s.whSliceOk?"✓":"✗"}</b></span>`+
      `<span class="pill ${s.whHomeOk?"good":"bad"}">Wormhole am Home <b>${s.whHomeOk?"keins":"ja"}</b></span>`;
    prep.forEach(function(E,i){ const g=gaps[i];
      pills += `<span class="pill ${rel[i]===0?"good":(rel[i]<=0.02?"warn":"bad")}">Gap ${shortName(E.name)} <b>${g}</b></span>`; });
    pills += `<span class="pill ${maxRel<=0.02?"good":"warn"}">Max Gap <b>${(maxRel*100).toFixed(1)}%</b></span>`;
    const side=oneSided(rel, prep, 0.02);
    pills += `<span class="pill ${side.length?"warn":"good"}">Einseitig <b>${side.length?side.join(", "):"keine"}</b></span>`;
    const frep=featureReport(st, place);
    const reachLabel=r=>r.reach==="both"?"+2 Nachbarn":r.reach==="near"?"+Nachbar":r.reach==="own"?"nur eigenes":"fehlt";
    frep.forEach(r=>{ pills += `<span class="pill ${r.ok?"good":"bad"}">${shortFaction(r.name)}: ${r.feature} <b>${reachLabel(r)}</b></span>`; });
    $("stats").innerHTML = pills;
    const fbad=frep.filter(r=>!r.ok);
    setStatus((side.length
      ? `Volloptimiert über alle ${prep.length} Bewertungen – Rest: ${side.join(", ")}.`
      : `Volloptimiert: alle ${prep.length} Bewertungen ausgeglichen (max. Gap ${(maxRel*100).toFixed(1)}%).`)
      + (frep.length ? (fbad.length ? ` Faktionsbedarf offen: ${fbad.map(r=>shortFaction(r.name)+" ("+r.feature+")").join(", ")}.` : ` Faktionsbedarf erfüllt: ${frep.map(r=>shortFaction(r.name)+"→"+r.feature+" ("+reachLabel(r)+")").join(", ")}.`) : "")
      + ` Home-Werte (${prep[selIdx].name}): ${vals.join(" / ")}`);
  }

  // Vollautomatische Karten-Suche ueber mehrere Runden: pro Runde ein frischer
  // Tile-Vorrat + komplette Optimierung ueber ALLE Bewertungen. Ein Gesamtbudget
  // wird auf die Runden verteilt; abgebrochen wird, sobald nichts mehr einseitig ist.
  // Liefert { st, prep, res, mx } oder null; bei zu kleinem Pool { error:"tiles", ... }.
  function generateRounds(title, pool, ratio, wantWh, rng, totalMs, targetRel, maxRounds, factions, contest){
    const t0=performance.now(), rounds=Math.max(1, maxRounds||4);
    let best=null;
    for(let r=0; r<rounds; r++){
      const left=totalMs-(performance.now()-t0);
      if(left<600 && best) break;
      const st=buildState(title, pool, evSlice(), factions, contest);
      if(contest){
        // Layouts ohne gemeinsame Randzone (z. B. 3-Player Standard/Warp) koennen den
        // Nachbar-Modus nicht erfuellen -> klar melden statt "keine Karte gefunden".
        const bad=(st.reqs||[]).filter(r=>!r.positionsNear || !r.positionsNear.length);
        if(bad.length) return { error:"contest", factions:bad.map(r=>st.factionNames[st.homes.indexOf(r.home)]) };
      }
      st.pool=chooseTiles(pool, st.opens.length, ratio, wantWh, rng, featureDemand(st));
      if(st.pool.length<st.opens.length) return { error:"tiles", have:st.pool.length, need:st.opens.length };
      st.allPool=pool;
      const Es=prepareEvals(st);
      st.eval=Es[IDX_SLICE].ev; st.homeW=Es[IDX_SLICE].w;
      const per=Math.max(900, Math.floor(left/(rounds-r)));
      const res=generateFull(st, Es, rng, per, targetRel);
      if(!res) continue;
      const mx=Math.max.apply(null, res.rel);
      if(!best || mx<best.mx) best={ st:st, prep:Es, res:res, mx:mx };
      if(mx<=targetRel) break;                       // vollstaendig ausgeglichen -> fertig
    }
    return best;
  }

  function generate(){
    const title=$("layout").value;
    const pool=buildPool($("base").checked,$("pok").checked,$("te").checked);
    if(!pool.length){ setStatus("Kein Tile-Vorrat (Erweiterung wählen)."); return; }
    const factions=readFactions();
    const miss=missingFeatures(pool, factions);
    if(miss.length){ setStatus("Tile-Vorrat enthält nicht: "+miss.join(", ")+". Passende Erweiterung anhaken (Anomalien sind im Grundspiel enthalten)."); return; }
    setStatus("Berechne & optimiere über alle Bewertungen …"); $("generate").disabled=true;
    setTimeout(()=>{
      try{
        const rng=mulberry32((Math.random()*1e9)|0);
        const ratio=(+$("ratio").value)/100;
        const needWh = $("wh").checked || (factions||[]).some(n=>factionNeed(n) && factionNeed(n).kind==="wormhole");
        const layout=default_layouts.find(l=>l.title===title);
        const nOpen=layout ? layout.data.filter(c=>c.type===TYPE.OPEN).length : 30;
        const total=Math.min(10000, 3500 + nOpen*70);
        const cbc=$("contestFeature");
        const contest = !!(cbc && cbc.checked && !cbc.disabled);
        const r=generateRounds(title, pool, ratio, needWh, rng, total, 0.02, 4, factions, contest);
        if(r && r.error==="contest"){ setStatus("Dieses Layout hat für "+r.factions.join(", ")+" keine gemeinsame Randzone mit den Nachbarn. Bitte „für Nachbarn erreichbar“ ausschalten oder ein anderes Layout wählen."); $("generate").disabled=false; return; }
        if(r && r.error){ setStatus(`Zu wenige Tiles (${r.have}/${r.need}). Mehr Erweiterungen anhaken.`); $("generate").disabled=false; return; }
        if(!r){ setStatus("Keine legale Karte gefunden – nochmal versuchen."); $("generate").disabled=false; return; }
        cur={ st:r.st, place:r.res.place, prep:r.prep, gaps:r.res.gaps };
        paint();
      } catch(e){ setStatus("Fehler: "+e.message); console.error(e); }
      $("generate").disabled=false;
    },20);
  }

  function improve(){
    if(!cur) return;
    setStatus("Optimiere über alle Bewertungen …"); $("improve").disabled=true;
    setTimeout(()=>{
      try{ hillClimbAll(cur.st, cur.place, cur.prep, performance.now()+1500);
           bankClimb(cur.st, cur.place, cur.prep, performance.now()+1200); paint(); }
      catch(e){ setStatus("Fehler: "+e.message); }
      $("improve").disabled=false;
    },20);
  }

  function onEvaluatorChange(){
    if(!cur) return;
    paint();
  }
  function onThemeChange(){
    if(typeof document!=="undefined" && document.body) document.body.setAttribute("data-theme", currentTheme());
    saveThemePref(currentTheme());
    renderLegend();
    if(cur) paint();
  }

  function downloadPNG(){
    if(!cur){ setStatus("Erst generieren."); return; }
    const svg=$("map").innerHTML;
    const img=new Image();
    const url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml;charset=utf-8"}));
    img.onload=()=>{
      const w=img.width||900, h=img.height||700, scale=2;
      const c=document.createElement("canvas"); c.width=w*scale; c.height=h*scale;
      const ctx=c.getContext("2d");
      ctx.fillStyle="#07070c"; ctx.fillRect(0,0,c.width,c.height);
      ctx.drawImage(img,0,0,c.width,c.height);
      URL.revokeObjectURL(url);
      const a=document.createElement("a"); a.href=c.toDataURL("image/png"); a.download="ti4-map.png"; a.click();
      setStatus("PNG gespeichert.");
    };
    img.onerror=()=>setStatus("PNG-Export fehlgeschlagen.");
    img.src=url;
  }

  $("players").addEventListener("change", ()=>{ fillLayouts(); fillFactions(); });
  $("ratio").addEventListener("input", ()=>{ $("ratioVal").textContent=$("ratio").value; });
  $("evaluator").addEventListener("change", onEvaluatorChange);
  if($("theme")) $("theme").addEventListener("change", onThemeChange);
  $("generate").addEventListener("click", generate);
  $("improve").addEventListener("click", improve);
  $("png").addEventListener("click", downloadPNG);
  $("copy").addEventListener("click", ()=>{ const el=$("mapstring"); el.select(); navigator.clipboard.writeText(el.value); setStatus("Map-String kopiert."); });
  if($("useFactions")) $("useFactions").addEventListener("change", fillFactions);
  ["base","pok","te"].forEach(id=>{ if($(id)) $(id).addEventListener("change", fillFactions); });

  fillLayouts(); fillEvaluators(); fillFactions(); fillThemes();
  if(typeof document!=="undefined" && document.body) document.body.setAttribute("data-theme", currentTheme());
  renderLegend();
  setStatus("Bereit. „Karte generieren“ klicken.");

  if(typeof window!=="undefined"){ window.__ti4 = { buildState, buildPool, chooseTiles, ensureWormholes, wormholeTypes, generateFull, generateRounds, hillClimbAll, climbOne, bankClimb, perturb, gapsRel, oneSided, valsE, prepareEvals, randomFill, computeVals, computeHomeW, sysConflicts, render, mapString, stats, range, mulberry32, makeEval, evalUnder, evSlice, evJoe, isRed, isBlue, sysGlyphs, TECH_LETTER, ANOM_LABEL, LAYOUTS, SYS, default_evaluators, FACTIONS, factionNeed, hasFeature, featureDemand, featureReport, missingFeatures, reachPositions, THEMES, THEME_ORDER, shortFaction, legendHTML, loadThemePref, saveThemePref }; }
})();
