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
    let sel = shuffle(blue.slice(),rng).slice(0,nB).concat(shuffle(red.slice(),rng).slice(0,nR));
    sel = balanceWormholes(sel, blue, red, wantWh, rng);
    return sel;
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

  function hillClimb(st, place, vals, deadline){
    const keys=Object.keys(place), ev=st.eval;
    let improved=true, guard=0;
    while(improved && guard++<400 && performance.now()<deadline){
      improved=false;
      for(let i=0;i<keys.length;i++){
        for(let j=i+1;j<keys.length;j++){
          const a=keys[i], b=keys[j];
          const va=ev.sysVal(place[a]), vb=ev.sysVal(place[b]);
          if(va===vb) continue;
          if(!swapLegal(st,place,a,b)) continue;
          let nmin=Infinity, nmax=-Infinity;
          for(let h=0; h<vals.length; h++){
            const nv = vals[h] + (vb-va)*((st.homeW[h][a]||0)-(st.homeW[h][b]||0));
            if(nv<nmin)nmin=nv; if(nv>nmax)nmax=nv;
          }
          if(nmax-nmin < range(vals)){
            for(let h=0; h<vals.length; h++) vals[h] += (vb-va)*((st.homeW[h][a]||0)-(st.homeW[h][b]||0));
            const t=place[a]; place[a]=place[b]; place[b]=t;
            improved=true;
          }
        }
      }
    }
  }

  function optimize(st, budgetMs, rng){
    const deadline=performance.now()+budgetMs;
    let best=null, bestGap=Infinity;
    while(performance.now()<deadline){
      const place=randomFill(st,rng);
      if(!place) continue;
      const vals=computeVals(st,place);
      hillClimb(st,place,vals,deadline);
      const g=range(vals);
      if(g<bestGap){ bestGap=g; best={ place:Object.assign({},place), vals:vals.slice() }; if(g===0) break; }
    }
    return best;
  }

  // ---- Zweistufige Optimierung: Simple Slice -> Joebrew ----
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

  // Direkte Optimierung der kombinierten Zielfunktion gap(A)+gap(B).
  // Nutzt vorberechnete Gewichte (wa/wb) und Systemwerte (valA/valB).
  function hillClimbCombined(st, wa, wb, valA, valB, place, deadline){
    const keys=Object.keys(place), nH=st.homes.length;
    const vA=new Array(nH).fill(0), vB=new Array(nH).fill(0);
    for(const pos in place){
      const a=valA[place[pos].id], b=valB[place[pos].id];
      for(let h=0;h<nH;h++){ vA[h]+=a*(wa[h][pos]||0); vB[h]+=b*(wb[h][pos]||0); }
    }
    if(st.rexKey){ const ra=valA[REX_ID], rb=valB[REX_ID];
      for(let h=0;h<nH;h++){ vA[h]+=ra*(wa[h][st.rexKey]||0); vB[h]+=rb*(wb[h][st.rexKey]||0); } }
    let improved=true, guard=0;
    while(improved && guard++<300 && performance.now()<deadline){
      improved=false;
      for(let i=0;i<keys.length;i++){
        for(let j=i+1;j<keys.length;j++){
          const p=keys[i], q=keys[j];
          const a1=valA[place[p].id], b1=valB[place[p].id];
          const a2=valA[place[q].id], b2=valB[place[q].id];
          if(a1===a2 && b1===b2) continue;
          if(!swapLegal(st,place,p,q)) continue;
          let nAmin=Infinity,nAmax=-Infinity,nBmin=Infinity,nBmax=-Infinity;
          for(let h=0;h<nH;h++){
            const nA=vA[h]+(a2-a1)*((wa[h][p]||0)-(wa[h][q]||0));
            const nB=vB[h]+(b2-b1)*((wb[h][p]||0)-(wb[h][q]||0));
            if(nA<nAmin)nAmin=nA; if(nA>nAmax)nAmax=nA;
            if(nB<nBmin)nBmin=nB; if(nB>nBmax)nBmax=nB;
          }
          if((nAmax-nAmin)+(nBmax-nBmin) < range(vA)+range(vB)){
            for(let h=0;h<nH;h++){
              vA[h]+=(a2-a1)*((wa[h][p]||0)-(wa[h][q]||0));
              vB[h]+=(b2-b1)*((wb[h][p]||0)-(wb[h][q]||0));
            }
            const t=place[p]; place[p]=place[q]; place[q]=t;
            improved=true;
          }
        }
      }
    }
  }

  // Restart-Schleife: pro Durchlauf A,B,A,B (endet auf B), danach direkte
  // Optimierung von gap(A)+gap(B). Behaelt die beste kombinierte Karte.
  function optimizePair(st, evA, evB, budgetMs, rng, prep){
    const deadline=performance.now()+budgetMs;
    const passes = (evB!==evA) ? [evA,evB,evA,evB] : [evA];
    const stage=Math.max(120, budgetMs/(passes.length+2));
    let best=null, bestScore=Infinity;
    while(performance.now()<deadline){
      st.eval=evA; st.homeW=computeHomeW(st);
      const place=randomFill(st,rng); if(!place) continue;
      let over=false;
      for(const ev of passes){
        if(performance.now()>=deadline){ over=true; break; }
        st.eval=ev; st.homeW=computeHomeW(st);
        const vals=computeVals(st,place);
        hillClimb(st,place,vals,Math.min(deadline, performance.now()+stage));
      }
      if(prep) hillClimbCombined(st, prep.wa, prep.wb, prep.valA, prep.valB, place, Math.min(deadline, performance.now()+stage));
      const vA=evalUnder(st,place,evA), vB=evalUnder(st,place,evB);
      const score=range(vA)+range(vB);
      if(score<bestScore){ bestScore=score; best={ place:Object.assign({},place) }; if(score===0) break; }
      if(over) break;
    }
    return best;
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
  function curEval(){ return makeEval(default_evaluators[+$("evaluator").value].data); }

  function paint(){
    const st=cur.st, place=cur.place, vals=cur.vals, s=stats(st,place);
    const gSel=range(vals);
    const gSlice=range(evalUnder(st,place,evSlice()));
    const gJoe=range(evalUnder(st,place,evJoe()));
    const selName=default_evaluators[+$("evaluator").value].title;
    $("map").innerHTML=render(st,place,vals);
    $("mapstring").value=mapString(st,place);
    let pills =
      `<span class="pill">Blue/Red <b>${s.blue}/${s.red}</b></span>`+
      `<span class="pill">Res/Inf <b>${s.res}/${s.inf}</b></span>`+
      `<span class="pill">Tech <b>${s.tech||"-"}</b></span>`+
      `<span class="pill">Traits R/G/B <b>${s.traits}</b></span>`+
      `<span class="pill">Wormholes α/β <b>${s.wh}</b></span>`;
    if(selName!=="Simple Slice") pills += `<span class="pill ${gSlice===0?"good":"warn"}">Gap Simple Slice <b>${gSlice}</b></span>`;
    if(selName!=="Joebrew") pills += `<span class="pill ${gJoe===0?"good":"warn"}">Gap Joebrew <b>${gJoe}</b></span>`;
    pills += `<span class="pill ${gSel===0?"good":"warn"}">Gap ${selName} <b>${gSel}</b></span>`;
    $("stats").innerHTML = pills;
    setStatus(`Home-Werte (${selName}): ${vals.join(" / ")}`);
  }

  function generate(){
    const p=$("players").value, title=$("layout").value;
    const pool=buildPool($("base").checked,$("pok").checked,$("te").checked);
    if(!pool.length){ setStatus("Kein Tile-Vorrat (Erweiterung wählen)."); return; }
    setStatus("Berechne …"); $("generate").disabled=true;
    setTimeout(()=>{
      try{
        const rng=mulberry32((Math.random()*1e9)|0);
        const st=buildState(title,pool,curEval());
        st.pool=chooseTiles(pool,st.opens.length,(+$("ratio").value)/100,$("wh").checked,rng);
        if(st.pool.length<st.opens.length){ setStatus(`Zu wenige Tiles (${st.pool.length}/${st.opens.length}). Mehr Erweiterungen anhaken.`); $("generate").disabled=false; return; }
        const evA=evSlice(), evB=evJoe();
        st.eval=evA; const wa=computeHomeW(st);
        st.eval=evB; const wb=computeHomeW(st);
        const valA={}, valB={};
        for(const sy of st.pool){ valA[sy.id]=evA.sysVal(sy); valB[sy.id]=evB.sysVal(sy); }
        valA[REX_ID]=evA.sysVal(SYS[REX_ID]); valB[REX_ID]=evB.sysVal(SYS[REX_ID]);
        st.eval=evA; st.homeW=wa;
        const budget=Math.min(6000, 1800 + st.opens.length*60);
        const best=optimizePair(st, evA, evB, budget, rng, {wa:wa, wb:wb, valA:valA, valB:valB});
        if(!best){ setStatus("Keine legale Karte gefunden – nochmal versuchen."); $("generate").disabled=false; return; }
        st.eval=curEval(); st.homeW=computeHomeW(st);
        cur={ st:st, place:best.place, vals:computeVals(st,best.place) };
        paint();
      } catch(e){ setStatus("Fehler: "+e.message); console.error(e); }
      $("generate").disabled=false;
    },20);
  }

  function improve(){
    if(!cur) return;
    setStatus("Verbessere …"); $("improve").disabled=true;
    setTimeout(()=>{
      try{ hillClimb(cur.st, cur.place, cur.vals, performance.now()+1500); paint(); }
      catch(e){ setStatus("Fehler: "+e.message); }
      $("improve").disabled=false;
    },20);
  }

  function onEvaluatorChange(){
    if(!cur) return;
    cur.st.eval=curEval();
    cur.st.homeW=computeHomeW(cur.st);
    cur.vals=computeVals(cur.st, cur.place);
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

  if(typeof window!=="undefined"){ window.__ti4 = { buildState, buildPool, chooseTiles, balanceWormholes, optimize, optimizePair, evalUnder, evSlice, evJoe, randomFill, computeVals, computeHomeW, sysConflicts, render, mapString, stats, range, mulberry32, makeEval, isRed, isBlue, sysGlyphs, TECH_LETTER, ANOM_LABEL, LAYOUTS, SYS, default_evaluators }; }
})();
