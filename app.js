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

  // ---- Rendering ----
  function esc(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function render(st, place, vals){
    const S=26, SQ=Math.sqrt(3);
    const proj=c=>[SQ*S*(c.x+c.z/2), 1.5*S*c.z];
    const pts={}; let minx=1e9,miny=1e9,maxx=-1e9,maxy=-1e9;
    for(const c of st.cells){ const p=proj(c); pts[c.key]=p;
      minx=Math.min(minx,p[0]); maxx=Math.max(maxx,p[0]); miny=Math.min(miny,p[1]); maxy=Math.max(maxy,p[1]); }
    const ox=-minx+S*1.2, oy=-miny+S*1.2, wd=maxx-minx+S*2.4, ht=maxy-miny+S*2.4;
    const vtx=[[0,-S],[SQ/2*S,-S/2],[SQ/2*S,S/2],[0,S],[-SQ/2*S,S/2],[-SQ/2*S,-S/2]];
    const hv={}; st.homes.forEach((h,i)=>hv[h]=vals[i]);
    let body="";
    for(const c of st.cells){
      const p=pts[c.key], cx=p[0]+ox, cy=p[1]+oy;
      const poly=vtx.map(v=>`${(cx+v[0]).toFixed(1)},${(cy+v[1]).toFixed(1)}`).join(" ");
      let fill="#15151f", label="", sub="", idtxt="";
      const sys=place[c.key];
      if(c.type===TYPE.HOME){ fill="#1f7a33"; label="HOME"; sub=String(hv[c.key]); }
      else if(c.type===TYPE.REX){ fill="#b8912a"; label="MECATOL"; }
      else if(c.type===TYPE.CLOSED){ fill="#0a0a10"; }
      else if(c.type===TYPE.WARP){ fill="#101018"; sub="⟡"; }
      else if(c.type===TYPE.OPEN && sys){
        fill=isRed(sys)?"#a4483f":"#3f6fb5";
        idtxt=String(sys.id);
        const parts=[];
        for(const pl of sys.planets){ let t=""; if(pl.tech_specialties) for(const ts of pl.tech_specialties) t+=TECH_LETTER[ts];
          parts.push(`${pl.resources}/${pl.influence}${t?" "+t:""}`); }
        if(sys.anomalies!==null) parts.push(sys.anomalies.map(a=>ANOM_LABEL[a]).join("/"));
        if(sys.wormhole!==null) parts.push(sys.wormhole===WORMHOLES.ALPHA?"α":"β");
        label=parts.join("  |  ");
      }
      body+=`<polygon points="${poly}" fill="${fill}" stroke="#000" stroke-width="1"/>`;
      if(idtxt) body+=`<text x="${cx.toFixed(1)}" y="${(cy-6).toFixed(1)}" font-size="10" fill="#e8e8f0" text-anchor="middle" font-family="sans-serif">${idtxt}</text>`;
      if(label) body+=`<text x="${cx.toFixed(1)}" y="${(cy+4).toFixed(1)}" font-size="7.5" fill="#f0f0f0" text-anchor="middle" font-family="sans-serif">${esc(label)}</text>`;
      if(sub && c.type!==TYPE.OPEN) body+=`<text x="${cx.toFixed(1)}" y="${(cy+17).toFixed(1)}" font-size="13" fill="#fff" text-anchor="middle" font-family="sans-serif" font-weight="bold">${sub}</text>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${wd|0}" height="${ht|0}" viewBox="0 0 ${wd|0} ${ht|0}"><rect width="100%" height="100%" fill="#07070c"/>${body}</svg>`;
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
      if(p.tech_specialties) for(const ts of p.tech_specialties) tech+=TECH_LETTER[ts];
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
  }
  function setStatus(t){ $("status").textContent=t; }
  function curEval(){ return makeEval(default_evaluators[+$("evaluator").value].data); }

  function paint(){
    const st=cur.st, vals=cur.vals, gap=range(vals), s=stats(st,cur.place);
    $("map").innerHTML=render(st,cur.place,vals);
    $("mapstring").value=mapString(st,cur.place);
    $("stats").innerHTML =
      `<span class="pill">Blue/Red <b>${s.blue}/${s.red}</b></span>`+
      `<span class="pill">Res/Inf <b>${s.res}/${s.inf}</b></span>`+
      `<span class="pill">Tech <b>${s.tech||"-"}</b></span>`+
      `<span class="pill">Traits R/G/B <b>${s.traits}</b></span>`+
      `<span class="pill">Wormholes α/β <b>${s.wh}</b></span>`+
      `<span class="pill ${gap===0?"good":"warn"}">Balance Gap <b>${gap}</b></span>`;
    setStatus(`Home-Werte: ${vals.join(" / ")}`);
  }

  function generate(){
    const p=$("players").value, title=$("layout").value;
    const pool=buildPool($("base").checked,$("pok").checked,$("te").checked);
    if(!pool.length){ setStatus("Kein Tile-Vorrat (Erweiterung wählen)."); return; }
    setStatus("Berechne …"); $("generate").disabled=true;
    setTimeout(()=>{
      try{
        const rng=mulberry32((Math.random()*1e9)|0);
        const ev=curEval();
        const st=buildState(title,pool,ev);
        st.pool=chooseTiles(pool,st.opens.length,(+$("ratio").value)/100,$("wh").checked,rng);
        if(st.pool.length<st.opens.length){ setStatus(`Zu wenige Tiles (${st.pool.length}/${st.opens.length}). Mehr Erweiterungen anhaken.`); $("generate").disabled=false; return; }
        const best=optimize(st,1500,rng);
        if(!best){ setStatus("Keine legale Karte gefunden – nochmal versuchen."); $("generate").disabled=false; return; }
        cur={ st:st, place:best.place, vals:best.vals };
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

  if(typeof window!=="undefined"){ window.__ti4 = { buildState, buildPool, chooseTiles, balanceWormholes, optimize, randomFill, computeVals, computeHomeW, sysConflicts, render, mapString, stats, range, mulberry32, makeEval, LAYOUTS, SYS, default_evaluators }; }
})();
