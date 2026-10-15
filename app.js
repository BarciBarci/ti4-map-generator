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

  function buildState(title, pool, ev){
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
    const st = { cells, byKey, adj, homes, opens, rexKey: rex?rex.key:null, pool, eval:ev };
    st.homeW = computeHomeW(st);
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
    for(const n of (st.adj[pos]||[])){ const o=place[n]; if(!o) continue;
      if(sys.anomalies!==null && o.anomalies!==null) return true;
      if(sys.wormhole!==null && o.wormhole!==null && sys.wormhole===o.wormhole) return true; }
    return false;
  }

  function chooseTiles(pool, nOpen, ratio, wantWh, rng){
    const blue = pool.filter(isBlue), red = pool.filter(isRed);
    let nB = Math.round(nOpen*ratio); nB = Math.max(0, Math.min(nB, blue.length));
    let nR = nOpen-nB;
    if(nR > red.length){ nR = red.length; nB = Math.min(nOpen-nR, blue.length); }
    const build = ()=>shuffle(blue.slice(),rng).slice(0,nB).concat(shuffle(red.slice(),rng).slice(0,nR));
    if(!wantWh) return build();
    const aOf = sel=>sel.filter(x=>x.wormhole===WORMHOLES.ALPHA).length;
    const bOf = sel=>sel.filter(x=>x.wormhole===WORMHOLES.BETA).length;
    for(let t=0;t<300;t++){
      const sel=balanceWormholes(build(), blue, red, true, rng);
      const a=aOf(sel), b=bOf(sel);
      if(a===b && a>=1) return sel;   // garantiert mindestens ein korrektes Paar
    }
    // Notfall (praktisch nie): Wormholes durch gleichfarbige Nicht-Wormholes ersetzen
    const sel=build(), used={}; sel.forEach(t=>used[t.id]=1);
    const repl=(blueFlag)=>(blueFlag?blue:red).filter(x=>x.wormhole===null && !used[x.id]);
    return sel.map(t=>{
      if(t.wormhole===null) return t;
      const r=repl(isBlue(t));
      if(r.length){ const pick=r[0]; used[pick.id]=1; return pick; }
      return t;
    });
  }

  function balanceWormholes(sel, blue, red, wantPairs, rng){
    const A=WORMHOLES.ALPHA, B=WORMHOLES.BETA;
    const cnt = () => { let a=0,b=0; for(const t of sel){ if(t.wormhole===A)a++; else if(t.wormhole===B)b++; } return [a,b]; };
    const free = (isblue) => (isblue?blue:red).filter(x => x.wormhole===null && sel.indexOf(x)<0);
    let guard=0;
    while(guard++ < 40){
      const c=cnt(), a=c[0], b=c[1];
      if(a===b && (!wantPairs || a>=1)) break;
      if(a>b || (a===0 && b===0 && wantPairs)){
        const major = (a===b) ? null : A;
        if(major!==null){
          const t = sel.find(x=>x.wormhole===major);
          const r = free(isBlue(t));
          if(!r.length) break;
          sel.splice(sel.indexOf(t),1); sel.push(r[Math.floor(rng()*r.length)]);
        } else {
          let done=false;
          for(const pr of [[26,25],[102,64],[39,40],[79,113]]){
            const Al=SYS[pr[0]], Be=SYS[pr[1]];
            if(!Al||!Be||sel.indexOf(Al)>=0||sel.indexOf(Be)>=0) continue;
            const isblue=isBlue(Al);
            if(isblue!==isBlue(Be)) continue;
            const bp=isblue?blue:red;
            if(bp.indexOf(Al)<0||bp.indexOf(Be)<0) continue;
            const removable=sel.filter(x=>x.wormhole===null && isBlue(x)===isblue);
            if(removable.length<2) continue;
            sel.splice(sel.indexOf(removable[0]),1); sel.splice(sel.indexOf(removable[1]),1);
            sel.push(Al,Be); done=true; break;
          }
          if(!done) break;
        }
      } else {
        const t = sel.find(x=>x.wormhole===B);
        const r = free(isBlue(t));
        if(!r.length) break;
        sel.splice(sel.indexOf(t),1); sel.push(r[Math.floor(rng()*r.length)]);
      }
    }
    return sel;
  }

  function randomFill(st, rng){
    const place={}, pool=st.pool.slice(), order=shuffle(st.opens.slice(),rng);
    for(const pos of order){
      shuffle(pool,rng);
      let chosen=null;
      for(const t of pool){ if(!sysConflicts(st,place,pos,t)){ chosen=t; break; } }
      if(!chosen) return null;
      place[pos]=chosen; pool.splice(pool.indexOf(chosen),1);
    }
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
    const A=place[a], B=place[b];
    place[a]=B; place[b]=A;
    const ok = !sysConflicts(st,place,a,place[a]) && !sysConflicts(st,place,b,place[b]);
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
    return default_evaluators.map(function(e){
      const ev=makeEval(e.data);
      st.eval=ev; const w=computeHomeW(st);
      const val={};
      for(const sy of all) val[sy.id]=ev.sysVal(sy);
      val[REX_ID]=ev.sysVal(SYS[REX_ID]);
      return { name:e.title, ev:ev, w:w, val:val };
    });
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
        for(const t of bank.slice()){
          if(t.id===old.id || isBlue(t)!==oldBlue || t.wormhole!==oldWh) continue;
          if(bank.indexOf(t)<0) continue;              // schon verbraucht
          place[pos]=t;
          const bad=sysConflicts(st,place,pos,t);
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
  const TRAIT_FILL = {};
  TRAIT_FILL[PLANET_TRAITS.HAZARDOUS]="#c0392b";
  TRAIT_FILL[PLANET_TRAITS.INDUSTRIAL]="#27ae60";
  TRAIT_FILL[PLANET_TRAITS.CULTURAL]="#2980b9";
  function sysGlyphs(sys){
    const g=[];
    if(sys.anomalies!==null) g.push(sys.anomalies.map(a=>ANOM_LABEL[a]).join("/"));
    if(sys.wormhole!==null) g.push(sys.wormhole===WORMHOLES.ALPHA?"α":"β");
    if(LEGENDARY.indexOf(sys.id)>=0) g.push("★");
    if(STATION.indexOf(sys.id)>=0) g.push("⌂");
    return g;
  }
  function render(st, place, vals){
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
      let fill="#141420";
      const sys=place[c.key];
      if(c.type===TYPE.HOME) fill="#1f7a33";
      else if(c.type===TYPE.REX) fill="#7a6118";
      else if(c.type===TYPE.CLOSED) fill="#08080d";
      else if(c.type===TYPE.WARP) fill="#0d0d16";
      else if(c.type===TYPE.OPEN && sys) fill = isRed(sys)?"#572c27":"#1f3a63";
      fills += `<polygon points="${poly}" fill="${fill}" stroke="#000" stroke-width="1"/>`;

      const T=(y,txt,size,fillc,w)=>`<text x="${cx}" y="${y}" font-size="${size}" fill="${fillc}" text-anchor="middle" font-family="sans-serif"${w?' font-weight="bold"':''}>${txt}</text>`;
      if(c.type===TYPE.HOME){
        content += T(cy-2, "HOME", 10, "#dff5e1") + T(cy+15, hv[c.key], 16, "#fff", true);
      } else if(c.type===TYPE.REX){
        content += T(cy-6, "MECATOL", 9, "#ffe9a8") + T(cy+9, "1/6", 10, "#fff");
      } else if(c.type===TYPE.WARP){
        content += T(cy+5, "⟡", 14, "#5a5a78");
      } else if(c.type===TYPE.OPEN && sys){
        content += T(cy-17, sys.id, 9, "#a9bad6");
        const ps=sys.planets, n=ps.length;
        const spacing = n>1 ? Math.min(S*0.55, (S*1.15)/(n-1)) : 0;
        const discR = n>1 ? Math.min(8.5, spacing*0.42) : 8.5;
        const startX = cx - (n-1)*spacing/2;
        ps.forEach((pl,i)=>{
          const px=+(startX+i*spacing).toFixed(1), py=+(cy-2).toFixed(1);
          const tf=(pl.traits&&pl.traits.length)?TRAIT_FILL[pl.traits[0]]:"#7f8c8d";
          content += `<circle cx="${px}" cy="${py}" r="${discR.toFixed(1)}" fill="${tf}" stroke="#000" stroke-width="0.8"/>`;
          if(pl.tech_specialties && pl.tech_specialties.length){
            const bx=(px+discR*0.75).toFixed(1), by=(py-discR*0.75).toFixed(1);
            content += `<circle cx="${bx}" cy="${by}" r="4.2" fill="#101010" stroke="#e8e8f0" stroke-width="0.6"/>`
                     + `<text x="${bx}" y="${(+by+2.2).toFixed(1)}" font-size="6" fill="#fff" text-anchor="middle" font-family="sans-serif">${TECH_LETTER[pl.tech_specialties[0]]||""}</text>`;
          }
          content += `<text x="${px}" y="${(py+discR+8).toFixed(1)}" font-size="7.5" fill="#dfe7f5" text-anchor="middle" font-family="sans-serif">${pl.resources}/${pl.influence}</text>`;
        });
        const g=sysGlyphs(sys);
        if(g.length) content += T(cy+21, g.join(" "), 8, "#ffd479");
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${wd|0}" height="${ht|0}" viewBox="0 0 ${wd|0} ${ht|0}"><rect width="100%" height="100%" fill="#07070c"/>${fills}${content}</svg>`;
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
    return { blue, red, res, inf, tech, traits:`${haz}/${ind}/${cul}`,
      wh:`${systems.filter(s=>s.wormhole===WORMHOLES.ALPHA).length}/${systems.filter(s=>s.wormhole===WORMHOLES.BETA).length}` };
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
  function setStatus(t){ $("status").textContent=t; }

  function shortName(t){
    return t==="Simple Slice"?"Slice":t==="Joebrew"?"Joebrew":t==="Resource Access"?"Res":
           t==="Influence Access"?"Inf":t==="Tech Access"?"Tech":t;
  }

  function paint(){
    const st=cur.st, place=cur.place, prep=cur.prep, s=stats(st,place);
    const selIdx=+$("evaluator").value;
    const vals=valsE(place, prep[selIdx], st.homes, st.rexKey);
    const gaps=prep.map(E=>range(valsE(place,E,st.homes,st.rexKey)));
    const rel=gapsRel(place, prep, st.homes, st.rexKey);
    const maxRel=Math.max.apply(null,rel);
    $("map").innerHTML=render(st,place,vals);
    $("mapstring").value=mapString(st,place);
    let pills =
      `<span class="pill">Blue/Red <b>${s.blue}/${s.red}</b></span>`+
      `<span class="pill">Res/Inf <b>${s.res}/${s.inf}</b></span>`+
      `<span class="pill">Tech <b>${s.tech||"-"}</b></span>`+
      `<span class="pill">Traits R/G/B <b>${s.traits}</b></span>`+
      `<span class="pill ${s.wh.split("/")[0]===s.wh.split("/")[1]?"good":"bad"}">Wormholes α/β <b>${s.wh}</b></span>`;
    prep.forEach(function(E,i){ const g=gaps[i];
      pills += `<span class="pill ${rel[i]===0?"good":(rel[i]<=0.02?"warn":"bad")}">Gap ${shortName(E.name)} <b>${g}</b></span>`; });
    pills += `<span class="pill ${maxRel<=0.02?"good":"warn"}">Max Gap <b>${(maxRel*100).toFixed(1)}%</b></span>`;
    const side=oneSided(rel, prep, 0.02);
    pills += `<span class="pill ${side.length?"warn":"good"}">Einseitig <b>${side.length?side.join(", "):"keine"}</b></span>`;
    $("stats").innerHTML = pills;
    setStatus(side.length
      ? `Volloptimiert über alle ${prep.length} Bewertungen – Rest: ${side.join(", ")}. „Karte generieren“ liefert evtl. eine noch flachere Variante.`
      : `Volloptimiert: alle ${prep.length} Bewertungen ausgeglichen (max. Gap ${(maxRel*100).toFixed(1)}%). Home-Werte (${prep[selIdx].name}): ${vals.join(" / ")}`);
  }

  // Vollautomatische Karten-Suche ueber mehrere Runden: pro Runde ein frischer
  // Tile-Vorrat + komplette Optimierung ueber ALLE Bewertungen. Ein Gesamtbudget
  // wird auf die Runden verteilt; abgebrochen wird, sobald nichts mehr einseitig ist.
  // Liefert { st, prep, res, mx } oder null; bei zu kleinem Pool { error:"tiles", ... }.
  function generateRounds(title, pool, ratio, wantWh, rng, totalMs, targetRel, maxRounds){
    const t0=performance.now(), rounds=Math.max(1, maxRounds||4);
    let best=null;
    for(let r=0; r<rounds; r++){
      const left=totalMs-(performance.now()-t0);
      if(left<600 && best) break;
      const st=buildState(title, pool, evSlice());
      st.pool=chooseTiles(pool, st.opens.length, ratio, wantWh, rng);
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
    setStatus("Berechne & optimiere über alle Bewertungen …"); $("generate").disabled=true;
    setTimeout(()=>{
      try{
        const rng=mulberry32((Math.random()*1e9)|0);
        const ratio=(+$("ratio").value)/100, wantWh=$("wh").checked;
        const layout=default_layouts.find(l=>l.title===title);
        const nOpen=layout ? layout.data.filter(c=>c.type===TYPE.OPEN).length : 30;
        const total=Math.min(10000, 3500 + nOpen*70);
        const r=generateRounds(title, pool, ratio, wantWh, rng, total, 0.02, 4);
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

  $("players").addEventListener("change", fillLayouts);
  $("ratio").addEventListener("input", ()=>{ $("ratioVal").textContent=$("ratio").value; });
  $("evaluator").addEventListener("change", onEvaluatorChange);
  $("generate").addEventListener("click", generate);
  $("improve").addEventListener("click", improve);
  $("png").addEventListener("click", downloadPNG);
  $("copy").addEventListener("click", ()=>{ const el=$("mapstring"); el.select(); navigator.clipboard.writeText(el.value); setStatus("Map-String kopiert."); });

  fillLayouts(); fillEvaluators();
  setStatus("Bereit. „Karte generieren“ klicken.");

  if(typeof window!=="undefined"){ window.__ti4 = { buildState, buildPool, chooseTiles, balanceWormholes, generateFull, generateRounds, hillClimbAll, climbOne, bankClimb, perturb, gapsRel, oneSided, valsE, prepareEvals, randomFill, computeVals, computeHomeW, sysConflicts, render, mapString, stats, range, mulberry32, makeEval, evalUnder, evSlice, evJoe, isRed, isBlue, sysGlyphs, TECH_LETTER, ANOM_LABEL, LAYOUTS, SYS, default_evaluators }; }
})();
