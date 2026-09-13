(() => {
  const app=document.getElementById("app"), TH=46;
  const p=t=>{const [h,m]=t.split(":").map(Number);return h*60+m};
  const dt=t=>{const [h,m]=t.split(":").map(Number);return `${String(h%24).padStart(2,"0")}:${String(m).padStart(2,"0")}`};

  function context(now=new Date()){
    let d=now.getDay(), min=now.getHours()*60+now.getMinutes();
    if(min<240){d=(d+6)%7;min+=1440}
    const tasks=(window.SCHEDULE[d]||[]).map(r=>({s:r[0],e:r[1],start:p(r[0]),end:p(r[1]),title:r[2],note:r[3]||""}));
    return {d,min,tasks};
  }
  const currentIndex=(tasks,min)=>{
    let i=tasks.findIndex(t=>min>=t.start&&min<t.end);
    if(i>=0)return i;
    i=tasks.findIndex(t=>t.start>min);
    return i>=0?i:Math.max(tasks.length-1,0);
  };

  let ctx=context(), base=currentIndex(ctx.tasks,ctx.min), view=base, busy=false;

  function card(t,i,cls=""){
    const el=document.createElement("section"); el.className=`card ${cls}`.trim();
    const meta=document.createElement("div"); meta.className="meta";
    meta.textContent=`${window.DAY_NAMES[ctx.d]} · ${i===base?"现在":"今天稍后"} · ${dt(t.s)}–${dt(t.e)}`;
    const title=document.createElement("div"); title.className="title"; title.textContent=t.title;
    el.append(meta,title);
    if(t.note){const n=document.createElement("div");n.className="note";n.textContent=t.note;el.appendChild(n)}
    return el;
  }

  function render(reset=false){
    ctx=context(); const nb=currentIndex(ctx.tasks,ctx.min);
    if(reset){base=nb;view=nb}else{base=nb;view=Math.min(Math.max(view,base),ctx.tasks.length-1)}
    app.replaceChildren();
    if(ctx.tasks.length) app.appendChild(card(ctx.tasks[view],view));
  }

  function move(dir){
    if(busy)return;
    const target=view+dir;
    if(target<base||target>=ctx.tasks.length)return;
    busy=true;
    const old=app.querySelector(".card");
    view=target;
    const nc=dir>0?"enter-up":"enter-down", oc=dir>0?"exit-up":"exit-down";
    const neu=card(ctx.tasks[view],view,nc); app.appendChild(neu);
    requestAnimationFrame(()=>{old?.classList.add(oc);neu.classList.add("enter-active")});
    setTimeout(()=>{old?.remove();neu.classList.remove("enter-up","enter-down","enter-active");busy=false},190);
  }

  let sx=0,sy=0;
  app.addEventListener("touchstart",e=>{if(e.touches.length){sx=e.touches[0].clientX;sy=e.touches[0].clientY}},{passive:true});
  app.addEventListener("touchend",e=>{
    if(!e.changedTouches.length)return;
    const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy,v=Math.abs(dy)>Math.abs(dx);
    if(v&&dy<-TH)move(1); else if(v&&dy>TH)move(-1); else if(!v&&dx<-TH)move(1); else if(!v&&dx>TH)move(-1);
  },{passive:true});

  addEventListener("keydown",e=>{
    if(["ArrowUp","ArrowRight"," ","PageDown"].includes(e.key)){e.preventDefault();move(1)}
    else if(["ArrowDown","ArrowLeft","PageUp"].includes(e.key)){e.preventDefault();move(-1)}
  });

  document.addEventListener("visibilitychange",()=>{if(!document.hidden)render(true)});
  setInterval(()=>{const n=context(),nb=currentIndex(n.tasks,n.min);if(n.d!==ctx.d||nb!==base){const at=view===base;ctx=n;base=nb;if(at){view=base;render(false)}}},30000);

  render(true);
  if("serviceWorker"in navigator)addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
})();
