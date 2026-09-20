/* ════ SERVICE WORKER (necessario per installazione PWA vera su Android/Chrome) ════ */
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js').catch(function(err){ console.log('SW registration failed', err); });
}

/* ════ CONSTANTS ════ */
const PUNTI=["NUMANA","OSIMO STAZIONE","SIROLO","ANCONA"];

/* ════ RUOLI & PERMESSI ════════════════════════════════════════════ */
// Ritorna il profilo corrente (o admin di default se non ancora caricato)
function _profile(){ return window._userProfile || { role:"admin", pv:null }; }
function _isAdmin(){ return _profile().role === "admin"; }
const _PV_ALIAS={"OSIMO":"OSIMO STAZIONE","NUM":"NUMANA","OSI":"OSIMO STAZIONE","SIR":"SIROLO","ANC":"ANCONA"};
function _normPV(s){ if(!s) return null; const u=String(s).trim().replace(/\s+/g," ").toUpperCase(); return _PV_ALIAS[u]||u; }
function _userPV(){ return _normPV(_profile().pv); }

// Filtra ordini in base al ruolo
function _filterOrdersByRole(arr){
  if(_isAdmin()) return arr;
  const pv = _userPV();
  return pv ? arr.filter(o => o.pv === pv) : arr;
}

// Filtra clienti: mostra solo quelli con almeno un ordine nel PV dell'operatore
function _filterCustomersByRole(arr){
  if(_isAdmin()) return arr;
  const pv = _userPV();
  if(!pv) return arr;
  const ids = new Set(orders.filter(o => o.pv === pv).map(o => o.customerId).filter(Boolean));
  const names = new Set(orders.filter(o => o.pv === pv).map(o => o.customerName).filter(Boolean));
  return arr.filter(c => ids.has(c.id) || names.has(c.name));
}

// Applica restrizioni UI in base al ruolo (chiamata dopo login)
window._applyRoleUI = function(){
  const isAdmin = _isAdmin();
  const pv = _userPV();

  // ── Prodotti: nascondi pulsanti aggiungi/modifica per operatori ──
  const prodEditBtns = document.getElementById("prod-edit-btns");
  if(prodEditBtns) prodEditBtns.style.display = isAdmin ? "flex" : "none";

  // ── Impostazioni: visibile solo all'admin ──
  const navImpostazioni = document.getElementById("nav-impostazioni");
  if(navImpostazioni) navImpostazioni.style.display = isAdmin ? "flex" : "none";

  // ── Statistiche: visibile solo all'admin (nessuna sostituzione per gli operatori PV) ──
  const navStats = document.querySelector(".nav-btn[data-tab='stats']");
  if(navStats) navStats.style.display = isAdmin ? "flex" : "none";

  // ── Messaggi: visibile solo all'admin (gli operatori PV non gestiscono la chat) ──
  const navMessaggi = document.getElementById("nav-messaggi");
  if(navMessaggi) navMessaggi.style.display = isAdmin ? "flex" : "none";

  // ── Messaggi: il filtro per punto vendita è visibile solo all'admin ──
  const waPvFilter = document.getElementById("wa-pv-filter");
  if(waPvFilter) waPvFilter.style.display = isAdmin ? "block" : "none";
  if(typeof updateWaBadge === "function") updateWaBadge();

  // ── Ordini: se operatore, blocca il filtro PV sul suo PV ──
  if(!isAdmin && pv){
    orFilterPV = pv;
    // Nascondi chip "TUTTI" e chip degli altri PV (gestito in renderOrdini)
  }

  // ── Aggiorna badge utente nella top-bar ──
  const logoutBtn = document.getElementById("logout-btn");
  if(logoutBtn){
    const label = isAdmin ? "🚪" : "🚪 " + (pv ? pv.split(" ")[0] : "");
    logoutBtn.textContent = label;
  }

  // Ri-renderizza tutto con i nuovi filtri
  if(typeof renderOrdini === "function") renderOrdini();
  if(typeof renderCustomers === "function" && document.getElementById("pg-clienti")?.classList.contains("show")) renderCustomers();
};
const PUNTI_ABBR={"NUMANA":"NUM","OSIMO STAZIONE":"OSI","SIROLO":"SIR","ANCONA":"ANC"};
const STATI=["nuovo","preparato","pronto","ritirato"];
const MESI=["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const GS=["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];
function isItalianHoliday(y,m,d){
  var mm=String(m+1).padStart(2,"0"),dd=String(d).padStart(2,"0");
  var fixed=["01-01","01-06","04-25","05-01","06-02","08-15","11-01","12-08","12-25","12-26"];
  if(fixed.indexOf(mm+"-"+dd)>=0)return true;
  function easter(yr){
    var a=yr%19,b=Math.floor(yr/100),c=yr%100;
    var d2=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);
    var h=(19*a+b-d2-g+15)%30,i=Math.floor(c/4),k=c%4;
    var l=(32+2*e+2*i-h-k)%7,mn=Math.floor((a+11*h+22*l)/451);
    var month=Math.floor((h+l-7*mn+114)/31),day=((h+l-7*mn+114)%31)+1;
    return {month:month,day:day};
  }
  var pas=easter(y);
  if((m+1)===pas.month && d===pas.day)return true;
  var pe=new Date(y,pas.month-1,pas.day);
  pe.setDate(pe.getDate()+1);
  if(pe.getMonth()===m && pe.getDate()===d)return true;
  return false;
}
const GF=["Domenica","Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"];
const REVIEW={
  numana:"https://g.page/r/Ce3nfKhcRdlEEBM/review",
  osimo:"https://g.page/r/CcZ__N3WTrpXEBM/review",
  sirolo:"https://g.page/r/CWmd7KrlgKHwEBM/review",
  ancona:"https://g.page/r/CccvheqUq8cXEBM/review"
};
const EMOJIS=["🍝","🥟","🫕","🥣","🥗","🍲","🧆","🧇","🫔","🥩","🐟","🥔","🥘","🥖","🦐","🦑","🐙","🍅","🍆","🥒","🧅","🍄","🫑"];
const STATO_NEXT={"nuovo":"preparato","preparato":"pronto","pronto":"ritirato"};
const STATO_ICON={"nuovo":"🆕","preparato":"🟡","pronto":"✅","ritirato":"🏠"};

/* ════ WHATSAPP META API CONFIG ════ */
// Configurazione caricata da Firebase (settings/wa_config) — solo l'admin può modificarla
window._waApiMem={token:"",phoneId:"",autoNuovo:false,autoPronte:false,autoRitirato:false};
const WA_API_CFG={
  get token(){return window._waApiMem.token||"";},
  get phoneId(){return window._waApiMem.phoneId||"";},
  get autoSend(){return window._waApiMem.autoPronte;},
  get autoNuovo(){return window._waApiMem.autoNuovo;},
  get autoPronte(){return window._waApiMem.autoPronte;},
  get autoRitirato(){return window._waApiMem.autoRitirato;},
  get enabled(){return !!(this.token&&this.phoneId);}
};

// Mappa template approvati Meta per ogni stato ordine
const WA_TEMPLATES={
  nuovo:{name:"nuovo_ordine_v2",params:(o)=>[o.customerName]},
  pronto:{name:"ordine_pronto",params:(o)=>[o.customerName,o.importo?"€"+o.importo:"da definire"]},
  ritirato:{name:"ordine_ritirato",params:(o)=>{
    const pvRaw=(o.pv||"").toUpperCase();
    const link=pvRaw.startsWith("OSIMO")?REVIEW.osimo:pvRaw.startsWith("SIROLO")?REVIEW.sirolo:pvRaw.startsWith("ANCONA")?REVIEW.ancona:REVIEW.numana;
    return[o.customerName,link];
  }}
};

// Invia messaggio WhatsApp via template approvato Meta (tramite proxy Netlify)
async function sendWAapi(phone,templateName,templateParams){
  if(!WA_API_CFG.enabled)return{ok:false,error:"API non configurata"};
  const p=normPhone(phone);
  if(!p)return{ok:false,error:"Numero non valido"};
  try{
    const res=await fetch("https://cozy-souffle-e9b499.netlify.app/.netlify/functions/wa-send",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        phoneId:WA_API_CFG.phoneId,
        token:WA_API_CFG.token,
        to:p,
        template:templateName,
        components:[{type:"body",parameters:templateParams.map(v=>({type:"text",text:String(v)}))}]
      })
    });
    const data=await res.json();
    if(res.ok&&data.messages)return{ok:true,msgId:data.messages[0].id};
    return{ok:false,error:(data.error&&data.error.message)||"Errore sconosciuto"};
  }catch(e){return{ok:false,error:e.message};}
}

async function sendWAapiWithFeedback(orderId,stato){
  const o=orders.find(x=>x.id===orderId);
  if(!o||!o.customerPhone){showToast("⚠️ Nessun numero WhatsApp");return;}
  const tpl=WA_TEMPLATES[stato];
  if(!tpl){showToast("⚠️ Template non trovato per stato: "+stato);return;}
  showToast("📤 Invio WA in corso…");
  const result=await sendWAapi(o.customerPhone,tpl.name,tpl.params(o));
  if(result.ok){
    showToast("✅ WhatsApp inviato!");
    // waLastMsgId = wamid del messaggio appena inviato: il webhook lo userà per ritrovare
    // quest'ordine quando arriva l'aggiornamento di stato (sent/delivered/read) da Meta.
    // waStatus/waStatusAt vengono azzerati ad ogni nuovo invio, così le spunte ripartono da zero.
    orders=orders.map(x=>x.id===orderId?{...x,waLastSent:Date.now(),waLastStato:stato,waLastMsgId:result.msgId,waStatus:null,waStatusAt:null}:x);
    lsSetOrder(orders.find(x=>x.id===orderId));
    refreshAll();
  }else{
    showToast("❌ WA fallito: "+result.error);
    console.error("WA API error:",result.error);
    const msg=waMsg(o,stato);
    setTimeout(()=>{if(confirm("Invio automatico fallito.\nAprire WhatsApp manualmente?")){openWA(o.customerPhone,msg);}},500);
  }
}

/* ════ WHATSAPP MESSAGGI (CHAT IN-APP) ════ */
var waConversations = (function(){ try{ return JSON.parse(localStorage.getItem("pf_wa_conversations"))||[]; }catch(e){ return []; } })();
window._waMsgUnsub = null;
window._waOpenConv = null;
window._waCurrentMessages = [];

// Escape HTML: qui mostriamo testo scritto dai clienti, va sempre "ripulito" prima di iniettarlo nel DOM
function waEsc(s){
  return String(s==null?"":s).replace(/[&<>"']/g,function(c){
    return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
  });
}
// Rimuove il campo "id" aggiunto lato client (non va mai scritto su Firestore)
function waStripId(obj){ const o=Object.assign({},obj); delete o.id; return o; }

function fmtWaTime(ms){
  if(!ms) return "";
  const d=new Date(ms), now=new Date();
  if(d.toDateString()===now.toDateString()) return pad(d.getHours())+":"+pad(d.getMinutes());
  return pad(d.getDate())+"/"+pad(d.getMonth()+1);
}

// Nome da mostrare per una conversazione: cliente riconosciuto > nome profilo WA > numero
function waConvName(conv){
  if(conv.customerId){
    const c=customers.find(x=>x.id===conv.customerId);
    if(c&&c.name) return c.name;
  }
  return conv.profileName||conv.phone;
}

// Conversazioni visibili in base al ruolo: admin le vede tutte, l'operatore solo quelle del suo PV
function _waVisibleConversations(){
  if(_isAdmin()) return waConversations;
  const pv=_userPV();
  return waConversations.filter(c=>c.pv===pv);
}

function updateWaBadge(){
  const badge=document.getElementById("wa-nav-badge");
  if(!badge) return;
  const total=_waVisibleConversations().reduce((s,c)=>s+(c.unreadCount||0),0);
  if(total>0){ badge.textContent=total>99?"99+":String(total); badge.style.display="inline-flex"; }
  else badge.style.display="none";
}

function renderWaConversations(){
  const cont=document.getElementById("wa-conv-list");
  if(!cont) return;
  let arr=_waVisibleConversations();
  if(_isAdmin()){
    const sel=document.getElementById("wa-pv-filter");
    const f=sel?sel.value:"tutti";
    if(f==="assegnare") arr=arr.filter(c=>c.pvStatus!=="assigned");
    else if(f&&f!=="tutti") arr=arr.filter(c=>c.pv===f);
  }
  if(!arr.length){
    cont.innerHTML="<div style='text-align:center;color:var(--txl);padding:40px 0;font-size:14px'>Nessuna conversazione</div>";
    return;
  }
  cont.innerHTML=arr.map(c=>{
    const name=waConvName(c);
    const unread=c.unreadCount||0;
    const time=fmtWaTime(c.lastMessageAt);
    const pvTag=c.pv
      ? "<span style='font-size:10px;color:var(--txl);background:var(--cd);padding:2px 6px;border-radius:6px'>"+waEsc(PUNTI_ABBR[c.pv]||c.pv)+"</span>"
      : "<span style='font-size:10px;color:#c0392b;font-weight:700'>⏳ da assegnare</span>";
    return "<div onclick=\"openWaChat('"+c.id+"')\" style='display:flex;align-items:center;gap:10px;padding:12px 6px;border-bottom:1px solid var(--cd);cursor:pointer'>"+
      "<div style='width:42px;height:42px;border-radius:50%;background:var(--t);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0'>"+waEsc((name[0]||"?").toUpperCase())+"</div>"+
      "<div style='flex:1;min-width:0'>"+
        "<div style='display:flex;justify-content:space-between;align-items:center;gap:6px'><strong style='font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'>"+waEsc(name)+"</strong><span style='font-size:11px;color:var(--txl);flex-shrink:0'>"+time+"</span></div>"+
        "<div style='display:flex;justify-content:space-between;align-items:center;margin-top:2px;gap:6px'>"+
          "<span style='font-size:12px;color:var(--txl);white-space:nowrap;overflow:hidden;text-overflow:ellipsis'>"+waEsc(c.lastMessageText||"")+"</span>"+
          (unread>0?"<span style='background:var(--t);color:#fff;font-size:11px;font-weight:700;border-radius:10px;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;padding:0 5px;flex-shrink:0'>"+unread+"</span>":"")+
        "</div>"+
        "<div style='margin-top:4px'>"+pvTag+"</div>"+
      "</div>"+
    "</div>";
  }).join("");
}

// ── Dettaglio conversazione (chat) ──
function waBuildChatHtml(conv){
  const name=waConvName(conv);
  const hours=conv.lastInboundAt?(Date.now()-conv.lastInboundAt)/3600000:999;
  const within=hours<=24;
  const winLabel=within
    ? "✅ Puoi scrivere liberamente (finestra aperta)"
    : "⏰ Finestra scaduta da "+Math.floor(hours-24)+" ore — serve un template";
  const pvLabel=conv.pv||"Da assegnare";
  return ""+
    "<div class='sheet-hd'></div>"+
    "<div style='margin-bottom:10px;padding-right:36px'>"+
      "<div class='sheet-ti' style='margin-bottom:2px'>"+waEsc(name)+"</div>"+
      "<div style='font-size:12px;color:var(--txl)'>"+waEsc(conv.phone)+" · "+waEsc(pvLabel)+"</div>"+
    "</div>"+
    "<div style='font-size:12px;font-weight:700;padding:7px 10px;border-radius:8px;margin-bottom:10px;background:"+(within?"#e8f7ee":"#fdecea")+";color:"+(within?"#1e7a46":"#c0392b")+"'>"+winLabel+"</div>"+
    "<div id='wa-chat-messages' style='display:flex;flex-direction:column;gap:8px;max-height:340px;overflow-y:auto;padding:6px 2px;margin-bottom:10px'></div>"+
    "<div id='wa-chat-send-area'></div>";
}

function waRenderSendArea(conv,within){
  const area=document.getElementById("wa-chat-send-area");
  if(!area) return;
  if(within){
    area.innerHTML=
      "<div style='display:flex;gap:8px'>"+
        "<input id='wa-chat-input' class='search-inp' placeholder='Scrivi un messaggio…' style='flex:1' onkeydown='if(event.key===\"Enter\"){event.preventDefault();waSendText();}'>"+
        "<button class='btn btn-p btn-sm' onclick='waSendText()'>Invia</button>"+
      "</div>";
  }else{
    area.innerHTML=
      "<div style='font-size:12px;color:var(--txl);margin-bottom:8px'>Finestra scaduta: scegli un template approvato da inviare</div>"+
      "<div style='display:flex;flex-direction:column;gap:6px'>"+
        "<button class='btn btn-s btn-sm' onclick=\"waSendTemplate('nuovo')\">📦 Nuovo ordine</button>"+
        "<button class='btn btn-s btn-sm' onclick=\"waSendTemplate('pronto')\">✅ Ordine pronto</button>"+
        "<button class='btn btn-s btn-sm' onclick=\"waSendTemplate('ritirato')\">🏠 Ordine ritirato</button>"+
      "</div>";
  }
}

// ── Icona di stato (spunte in stile WhatsApp) per un messaggio in uscita, in base a waStatus salvato dal webhook ──
function waStatusIcon(status){
  if(status==="read") return "<span style='color:#53bdeb;font-weight:700'>✓✓</span>";
  if(status==="delivered") return "<span style='opacity:.85'>✓✓</span>";
  if(status==="sent") return "<span style='opacity:.85'>✓</span>";
  if(status==="failed") return "<span style='color:#ffb3b3;font-weight:700'>⚠️</span>";
  return "";
}

function waRenderMessages(list){
  const cont=document.getElementById("wa-chat-messages");
  if(!cont) return;
  cont.innerHTML=list.map(m=>{
    const out=m.direction==="out";
    const time=m.timestamp?fmtWaTime(m.timestamp*1000):"";
    const statusIcon=out?waStatusIcon(m.waStatus):"";
    return "<div style='align-self:"+(out?"flex-end":"flex-start")+";max-width:78%;background:"+(out?"var(--t)":"var(--cd)")+";color:"+(out?"#fff":"var(--tx)")+";padding:8px 12px;border-radius:14px;font-size:13px;line-height:1.4'>"+
      waEsc(m.text||"")+
      "<div style='font-size:10px;opacity:.7;margin-top:3px;text-align:right'>"+time+(statusIcon?" "+statusIcon:"")+"</div>"+
    "</div>";
  }).join("");
  cont.scrollTop=cont.scrollHeight;
}

// Sottoscrizione live ai messaggi della conversazione aperta (query per numero, ordino lato client)
function waSubscribeMessages(phone){
  if(window._waMsgUnsub){ window._waMsgUnsub(); window._waMsgUnsub=null; }
  const fb=window._fb;
  if(!fb||!fb.ready) return;
  const q=fb.query(fb.collection(fb.db,"wa_messages"),fb.where("from","==",phone));
  window._waMsgUnsub=fb.onSnapshot(q,snap=>{
    const list=[];
    snap.forEach(d=>list.push(Object.assign({id:d.id},d.data())));
    list.sort((a,b)=>(a.timestamp||0)-(b.timestamp||0));
    window._waCurrentMessages=list;
    waRenderMessages(list);
  });
}

// Segna come lette le bolle in arrivo non ancora lette + azzera il contatore sulla conversazione
function waMarkRead(conv){
  if(!((conv.unreadCount||0)>0)) return;
  const fb=window._fb;
  window.fbSaveDoc("wa_conversations",conv.phone,Object.assign({},waStripId(conv),{unreadCount:0}));
  if(!fb||!fb.ready) return;
  setTimeout(()=>{
    const unread=(window._waCurrentMessages||[]).filter(m=>m.direction==="in"&&m.read===false);
    if(!unread.length) return;
    const batch=fb.writeBatch(fb.db);
    unread.forEach(m=>{ batch.set(fb.doc(fb.db,"wa_messages",m.id), Object.assign({},waStripId(m),{read:true})); });
    batch.commit().catch(e=>console.warn("wa mark-read error",e));
  },400);
}

function openWaChat(convId){
  const conv=waConversations.find(c=>c.id===convId);
  if(!conv) return;
  if(!_isAdmin()){
    const pv=_userPV();
    if(conv.pv&&conv.pv!==pv){ showToast("⚠️ Conversazione di un altro punto vendita"); return; }
  }
  window._waOpenConv=conv;
  _detailMode=true;
  showModal(waBuildChatHtml(conv));
  const within=!conv.lastInboundAt||((Date.now()-conv.lastInboundAt)/3600000)<=24;
  waRenderSendArea(conv,within);
  waSubscribeMessages(conv.phone);
  waMarkRead(conv);
}

async function waSendText(){
  const conv=window._waOpenConv;
  if(!conv) return;
  const input=document.getElementById("wa-chat-input");
  if(!input) return;
  const text=input.value.trim();
  if(!text) return;
  if(!WA_API_CFG.enabled){ showToast("⚠️ WhatsApp non configurato"); return; }
  input.disabled=true;
  try{
    const res=await fetch("https://cozy-souffle-e9b499.netlify.app/.netlify/functions/wa-send",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({phoneId:WA_API_CFG.phoneId,token:WA_API_CFG.token,to:conv.phone,message:text})
    });
    const data=await res.json();
    if(res.ok&&data.messages){
      const msgId=data.messages[0].id;
      window.fbSaveDoc("wa_messages",msgId,{
        from:conv.phone, fromRaw:null, profileName:null, type:"text", text:text,
        timestamp:Math.floor(Date.now()/1000), receivedAt:null, direction:"out",
        customerId:conv.customerId||null, pv:conv.pv||null, read:true
      });
      const updatedConv=Object.assign({},waStripId(conv),{lastMessageText:text,lastMessageAt:Date.now()});
      window.fbSaveDoc("wa_conversations",conv.phone,updatedConv);
      window._waOpenConv=Object.assign({id:conv.phone},updatedConv);
      input.value="";
    }else{
      showToast("❌ Invio fallito: "+((data.error&&data.error.message)||"errore sconosciuto"));
    }
  }catch(e){
    showToast("❌ Errore invio: "+e.message);
  }
  input.disabled=false;
  input.focus();
}

async function waSendTemplate(stato){
  const conv=window._waOpenConv;
  if(!conv) return;
  const tpl=WA_TEMPLATES[stato];
  if(!tpl) return;
  let importo=null;
  if(stato==="pronto"){
    importo=prompt("Importo totale dell'ordine (es. 18,50):");
    if(importo===null) return; // operatore ha annullato
  }
  const o={customerName:waConvName(conv), importo:importo, pv:conv.pv};
  showToast("📤 Invio template…");
  const result=await sendWAapi(conv.phone,tpl.name,tpl.params(o));
  if(result.ok){
    showToast("✅ Template inviato!");
    const summary="[Template: "+tpl.name+"]";
    window.fbSaveDoc("wa_messages",result.msgId,{
      from:conv.phone, fromRaw:null, profileName:null, type:"template", text:summary,
      timestamp:Math.floor(Date.now()/1000), receivedAt:null, direction:"out",
      customerId:conv.customerId||null, pv:conv.pv||null, read:true
    });
    const updatedConv=Object.assign({},waStripId(conv),{lastMessageText:summary,lastMessageAt:Date.now()});
    window.fbSaveDoc("wa_conversations",conv.phone,updatedConv);
    window._waOpenConv=Object.assign({id:conv.phone},updatedConv);
  }else{
    showToast("❌ Invio fallito: "+result.error);
  }
}

/* ════ UTILS ════ */
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2);
const lsGet=k=>{try{return JSON.parse(localStorage.getItem(k))||[];}catch{return[];}};
const lsSet=(k,v)=>{
  localStorage.setItem(k,JSON.stringify(v));
  if(!window.fbSaveDoc) return;
  const collMap={"pf_orders":"orders","pf_customers":"customers","pf_products":"products","pf_cats":"categories"};
  const collName=collMap[k];
  if(!collName) return;
  if(Array.isArray(v)){
    const needsOrder=(k==="pf_products"||k==="pf_cats");
    if(needsOrder && window.fbSaveBatch){
      // Usa batch atomico per prodotti/categorie e blocca il listener durante la scrittura
      const flagKey = k==="pf_products" ? "_savingProducts" : "_savingCats";
      window[flagKey]=true;
      const toSave=v.map((item,idx)=>item&&item.id?Object.assign({},item,{order:idx}):null).filter(Boolean);
      window.fbSaveBatch(collName, toSave).then(()=>{
        setTimeout(()=>{window[flagKey]=false;},1500);
      });
    } else {
      v.forEach((item,idx)=>{
        if(item&&item.id) window.fbSaveDoc(collName, item.id, item);
      });
    }
  }
};
const lsDel=(collName, id)=>{ if(window.fbDeleteDoc) window.fbDeleteDoc(collName, id); };
// Salva/aggiorna un singolo ordine su Firestore (evita race condition con onSnapshot)
const lsSetOrder=(o)=>{
  localStorage.setItem("pf_orders",JSON.stringify(orders));
  if(window.fbSaveDoc&&o&&o.id) window.fbSaveDoc("orders",o.id,o);
};
// Normalizza numero telefono: rimuove non-numerici, aggiunge prefisso 39 se assente
function normPhone(p){
  if(!p)return"";
  p=p.replace(/\D/g,"");
  if(!p)return"";
  if(p.startsWith("0"))p="39"+p.slice(1); // 0XXX → 39XXX
  else if(p.length===10&&!p.startsWith("39"))p="39"+p; // 10 cifre senza prefisso
  else if(p.length===9)p="39"+p; // 9 cifre senza prefisso
  return p;
}
const pad=n=>String(n).padStart(2,"0");
const todayStr=()=>{const n=new Date();return n.getFullYear()+"-"+pad(n.getMonth()+1)+"-"+pad(n.getDate());};
const fmtDate=d=>{if(!d)return"";const[y,m,dd]=d.split("-");return dd+"/"+m+"/"+y;};
const getDow=d=>{const[y,m,dd]=d.split("-").map(Number);return new Date(y,m-1,dd).getDay();};
const addDays=(ds,n)=>{const[y,m,d]=ds.split("-").map(Number);const dt=new Date(y,m-1,d+n);return dt.getFullYear()+"-"+pad(dt.getMonth()+1)+"-"+pad(dt.getDate());};
const openWA=(ph,msg)=>{const p=ph.replace(/\D/g,"");const isMobile=/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);if(isMobile){window.open("https://wa.me/"+p+"?text="+encodeURIComponent(msg),"_blank");return;}const url="https://web.whatsapp.com/send?phone="+p+"&text="+encodeURIComponent(msg);const sw=window.screen.width,sh=window.screen.height,pw=960,ph2=Math.min(sh-60,800),px=sw-pw-10,py=Math.max(0,Math.round((sh-ph2)/2));window.open(url,"wa_popup_"+p,"width="+pw+",height="+ph2+",left="+px+",top="+py+",resizable=yes,scrollbars=yes");};
const waMsg=(o,s)=>{
  const n=o.customerName,i=o.importo?"€"+o.importo:"da definire";
  if(s==="nuovo")return"Ciao "+n+"! Il tuo ordine è stato confermato. Grazie per averci scelto!";
  if(s==="pronto")return"Ciao "+n+"! Il tuo ordine è PRONTO per il ritiro! Totale: "+i+". Ti aspettiamo!";
  const pvRaw=(o.pv||"").toUpperCase();
  const link=pvRaw.startsWith("OSIMO")?REVIEW.osimo:pvRaw.startsWith("SIROLO")?REVIEW.sirolo:pvRaw.startsWith("ANCONA")?REVIEW.ancona:REVIEW.numana;
  return"Ciao "+n+"! Il tuo ordine è stato ritirato! Grazie per aver scelto i nostri prodotti 🍝 Speriamo di rivederti presto!\n\n⭐ Recensione Google: "+link;
};

/* ════ STATE ════ */
const DEF_CATS=[
  {id:"cat1",name:"Paste fresche",icon:"🍝"},
  {id:"cat2",name:"Paste ripiene",icon:"🥟"},
  {id:"cat3",name:"Al forno",icon:"🫕"},
  {id:"cat4",name:"Gnocchi",icon:"🥣"},
  {id:"cat5",name:"Altre preparazioni",icon:"🍲"},
];
const DEF_PRODS=[
  {id:uid(),name:"Tagliatelle all'uovo",unit:"kg",image:"🍝",catId:"cat1"},
  {id:uid(),name:"Pappardelle",unit:"kg",image:"🍝",catId:"cat1"},
  {id:uid(),name:"Tagliolini",unit:"kg",image:"🍝",catId:"cat1"},
  {id:uid(),name:"Tortellini ricotta e spinaci",unit:"kg",image:"🥟",catId:"cat2"},
  {id:uid(),name:"Tortelloni burro e salvia",unit:"kg",image:"🥟",catId:"cat2"},
  {id:uid(),name:"Lasagne",unit:"pz",image:"🫕",catId:"cat3"},
  {id:uid(),name:"Vincisgrassi",unit:"pz",image:"🫕",catId:"cat3"},
  {id:uid(),name:"Gnocchi di patate",unit:"kg",image:"🥣",catId:"cat4"},
  {id:uid(),name:"Gnocchi di zucca",unit:"kg",image:"🥣",catId:"cat4"},
];
let orders=lsGet("pf_orders");
let customers=lsGet("pf_customers");
let products=(()=>{const p=lsGet("pf_products");return p.length?p:DEF_PRODS;})();
let categories=(()=>{const c=lsGet("pf_cats");return c.length?c:DEF_CATS;})();
// Migrate old products: assign catId by name matching if missing
products=products.map(function(p){
  if(p.catId)return p;
  const n=p.name.toLowerCase();
  let catId="";
  if(n.includes("tortell")||n.includes("ravioli")||n.includes("agnolotti")||n.includes("cappelletti"))catId="cat2";
  else if(n.includes("lasagn")||n.includes("vincisgrass")||n.includes("forno"))catId="cat3";
  else if(n.includes("gnocch"))catId="cat4";
  else if(n.includes("tagliat")||n.includes("tagliol")||n.includes("pappard")||n.includes("spaghett")||n.includes("linguine")||n.includes("fettuccin"))catId="cat1";
  else catId="cat5";
  return Object.assign({},p,{catId:catId});
});
lsSet("pf_products",products);
lsSet("pf_cats",categories);

let selDate=todayStr();
let calDate=new Date();
let orDate=todayStr();
let curTab="ordini";
let orFilterPV="tutti";
let orShowRitirati=false;

/* ════ TOP BAR DATE ════ */
(function(){
  const n=new Date();
  document.getElementById("top-date").innerHTML=GF[n.getDay()].substring(0,3)+"<br>"+pad(n.getDate())+"/"+pad(n.getMonth()+1);
})();

/* ════ NAVIGATION ════ */
function isDesktop(){return window.innerWidth>=1024;}

// Restituisce la sigla/abbreviazione del prodotto se impostata, altrimenti il nome completo.
// pid = productId dell'item nell'ordine; fallback = productName salvato nell'ordine.
function _pName(pid, fallback){
  var p=products.find(function(x){return x.id===pid;});
  return (p&&p.shortName&&p.shortName.trim())?p.shortName.trim():(fallback||"");
}
function setFabDisplay(show){
  var fab=document.getElementById("fab-new-order");
  if(!fab)return;
  var inOrdini=!!document.querySelector(".nav-btn[data-tab=\"ordini\"]")?.classList.contains("on");
  if(isDesktop()){fab.style.display=(show||inOrdini)?"flex":"none";return;}
  fab.style.display=show?"flex":"none";
}
function setTab(tab){
  if(tab!=="messaggi"&&window._waMsgUnsub){window._waMsgUnsub();window._waMsgUnsub=null;}
  document.querySelectorAll(".pg").forEach(p=>p.classList.remove("show"));
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("on"));
  document.getElementById("pg-"+tab).classList.add("show");
  document.querySelector(".nav-btn[data-tab='"+tab+"']").classList.add("on");
  document.getElementById("content").scrollTop=0;
  document.getElementById("app").classList.toggle("tab-ordini-active",tab==="ordini");
  _layoutOrdiniToolbar();
  // clear detail panel on tab change
  if(isDesktop())clearDetailPanel();
  curTab=tab;
  setFabDisplay(tab==="ordini");
  
  if(tab==="ordini"){orDate=todayStr();selDate=todayStr();orFilterPV=_isAdmin()?"tutti":(_userPV()||"tutti");orShowRitirati=false;renderOrdini();}
  if(tab==="stats"){
    selDate=todayStr();stFrom=todayStr();stTo=todayStr();stChartProduct=null;stSection="prodotti";stCustOpen=null;
    document.getElementById("st-from").value=stFrom;
    document.getElementById("st-to").value=stTo;
    // reset tab buttons
    ["prodotti","clienti"].forEach(function(k){
      var btn=document.getElementById("stt-"+k);
      var panel=document.getElementById("st-"+(k==="prodotti"?"products":"customers"));
      if(btn){btn.style.background=k==="prodotti"?"var(--t)":"var(--cd)";btn.style.color=k==="prodotti"?"#fff":"var(--txl)";}
      if(panel)panel.style.display=k==="prodotti"?"block":"none";
    });
    renderStats();
  }
  if(tab==="impostazioni")setTimeout(waApiCfgInit,50);
  if(tab==="prodotti")renderProducts();
  if(tab==="clienti")renderCustomers();
  if(tab==="messaggi")renderWaConversations();
}

// Sposta ricerca/data/azioni/filtri tra la posizione originale (mobile/tablet) e i nuovi
// contenitori nella barra in alto / fascia destra (desktop). Nessun elemento viene duplicato:
// sono sempre gli stessi nodi, solo spostati nel DOM, così tutte le funzioni restano invariate.
function _layoutOrdiniToolbar(){
  var searchRow=document.getElementById("or-search-row");
  var dayNavEl=document.getElementById("or-day-nav");
  var actionsRow=document.getElementById("or-actions-row");
  var totaliToggle=document.getElementById("or-totali-toggle");
  var filtersBar=document.getElementById("or-filters");
  var topSearch=document.getElementById("top-search-wrap");
  var topDayNav=document.getElementById("top-day-nav-wrap");
  var topTools=document.getElementById("top-ordini-tools");
  var pvRail=document.getElementById("pv-rail");
  if(!searchRow||!dayNavEl||!actionsRow||!totaliToggle||!filtersBar||!topSearch||!topDayNav||!topTools||!pvRail)return;

  if(isDesktop()){
    if(searchRow.parentElement!==topSearch)topSearch.appendChild(searchRow);
    if(dayNavEl.parentElement!==topDayNav)topDayNav.appendChild(dayNavEl);
    if(actionsRow.parentElement!==topTools){topTools.appendChild(actionsRow);topTools.appendChild(totaliToggle);}
    if(filtersBar.parentElement!==pvRail)pvRail.appendChild(filtersBar);
    dayNavEl.classList.add("top-day-nav");
    document.getElementById("app-body").classList.add("has-pv-rail");
    var pBtn=document.getElementById("or-print"),tBtn=document.getElementById("or-table");
    if(pBtn){pBtn.innerHTML="🖨️<span class='top-tool-lbl'>Stampa</span>";pBtn.removeAttribute("title");}
    if(tBtn){tBtn.innerHTML="📊<span class='top-tool-lbl'>Lista</span>";tBtn.removeAttribute("title");}
    if(totaliToggle){totaliToggle.innerHTML="📦<span class='top-tool-lbl'>Totali</span>";totaliToggle.removeAttribute("title");}
  }else{
    var aSearch=document.getElementById("anchor-search"),aDayNav=document.getElementById("anchor-daynav"),
        aActions=document.getElementById("anchor-actions"),aTotali=document.getElementById("anchor-totali"),
        aFilters=document.getElementById("anchor-filters");
    if(aSearch&&searchRow.parentElement!==aSearch.parentElement)aSearch.after(searchRow);
    if(aDayNav&&dayNavEl.parentElement!==aDayNav.parentElement)aDayNav.after(dayNavEl);
    if(aFilters&&filtersBar.parentElement!==aFilters.parentElement)aFilters.after(filtersBar);
    if(aActions&&actionsRow.parentElement!==aActions.parentElement)aActions.after(actionsRow);
    if(aTotali&&totaliToggle.parentElement!==aTotali.parentElement)aTotali.after(totaliToggle);
    dayNavEl.classList.remove("top-day-nav");
    document.getElementById("app-body").classList.remove("has-pv-rail");
    var pBtn2=document.getElementById("or-print"),tBtn2=document.getElementById("or-table");
    if(pBtn2){pBtn2.innerHTML="🖨️ Stampa lista";pBtn2.removeAttribute("title");}
    if(tBtn2){tBtn2.innerHTML="📊 Crea lista personalizzata";tBtn2.removeAttribute("title");}
    if(totaliToggle){totaliToggle.innerHTML=orTotaliOpen?"📦 Nascondi totali":"📦 Totali della giornata";totaliToggle.classList.remove("active");totaliToggle.removeAttribute("title");}
  }
}
window._lastOrdiniW=window.innerWidth;
window.addEventListener("resize",function(){
  clearTimeout(window._layoutOrdiniTimer);
  window._layoutOrdiniTimer=setTimeout(function(){
    // Su mobile l'apertura della tastiera genera un resize di sola altezza (la larghezza
    // non cambia): in quel caso NON ridisegniamo la lista ordini, altrimenti si distrugge
    // il campo importo che l'utente ha appena messo a fuoco e la tastiera si chiude subito.
    var wNow=window.innerWidth;
    var widthChanged=wNow!==window._lastOrdiniW;
    window._lastOrdiniW=wNow;
    if(!widthChanged)return;
    _layoutOrdiniToolbar();
    if(curTab==="ordini")renderOrdini();
  },200);
});

/* ════ MODAL ════ */
function clearDetailPanel(){
  var dp=document.getElementById("detail-panel-content");
  var de=document.getElementById("detail-panel-empty");
  if(dp)dp.style.display="none";
  if(de)de.style.display="flex";
  var ab=document.querySelector(".app-body");
  if(ab)ab.classList.remove("detail-open");
}
function showDetailPanel(html){
  var dp=document.getElementById("detail-panel-content");
  var de=document.getElementById("detail-panel-empty");
  if(!dp)return false;
  const ms=document.createElement("div");
  ms.style.position="relative";
  const xBtn=document.createElement("button");
  xBtn.innerHTML="✕";
  xBtn.style.cssText="position:absolute;top:12px;right:12px;background:none;border:none;font-size:22px;color:var(--txl);cursor:pointer;line-height:1;z-index:20;padding:4px";
  xBtn.onclick=clearDetailPanel;
  const inner=document.createElement("div");
  inner.innerHTML=html;
  ms.appendChild(xBtn);ms.appendChild(inner);
  dp.innerHTML="";dp.appendChild(ms);
  dp.style.display="block";
  if(de)de.style.display="none";
  var ab=document.querySelector(".app-body");
  if(ab)ab.classList.add("detail-open");
  return true;
}
function showModal(html){
  // on desktop: order detail goes to side panel, forms stay as modal
  if(isDesktop()&&_detailMode){
    showDetailPanel(html);
    return;
  }
  const ms=document.getElementById("modal-sheet");
  ms.innerHTML="";
  const outer=document.createElement("div");
  outer.style.position="relative";
  const xBtn=document.createElement("button");
  xBtn.innerHTML="✕";
  xBtn.style.cssText="position:absolute;top:12px;right:12px;background:none;border:none;font-size:22px;color:var(--txl);cursor:pointer;line-height:1;z-index:20;padding:4px";
  xBtn.onclick=closeModal;
  const inner=document.createElement("div");
  inner.innerHTML=html;
  outer.appendChild(xBtn);
  outer.appendChild(inner);
  ms.appendChild(outer);
  document.getElementById("modal").classList.add("open");
  setFabDisplay(false);
}
function closeModal(){
  document.getElementById("modal").classList.remove("open");
  document.getElementById("modal-sheet").innerHTML="";
  if(document.querySelector(".nav-btn[data-tab=\"ordini\"]")?.classList.contains("on"))setFabDisplay(true);
}
function modalBgClick(e){
  if(e.target.id!=="modal")return;
  // Non chiudere se il mousedown era partito dall'interno del modal-sheet
  // (es. selezione testo che ha portato il mouse sull'overlay)
  var mdt=window._modalMousedownTarget;
  if(mdt&&mdt!==e.target){
    var sheet=document.getElementById("modal-sheet");
    if(sheet&&sheet.contains(mdt))return;
  }
  // Non chiudere se c'è testo selezionato (mouse uscito dalla finestra durante selezione)
  var sel=window.getSelection?window.getSelection():null;
  if(sel&&sel.toString().length>0)return;
  closeModal();
}


/* ════ CALENDAR ════ */
function renderCalendar(){
  const y=calDate.getFullYear(),m=calDate.getMonth();
  document.getElementById("cal-title").textContent=MESI[m]+" "+y;
  document.getElementById("cal-dow").innerHTML=GS.map(g=>"<div class='cal-dow'>"+g+"</div>").join("");
  const rawFirst=new Date(y,m,1).getDay();
  const first=(rawFirst+6)%7; // offset da lunedì (0=Lun...6=Dom)
  const last=new Date(y,m+1,0).getDate();
  const t=todayStr();
  const obd=_filterOrdersByRole(orders).reduce((a,o)=>{a[o.date]=(a[o.date]||0)+1;return a;},{});
  let html="";
  for(let i=0;i<first;i++){const pd=new Date(y,m,i-first+1);html+="<div class='cal-d faded'>"+pd.getDate()+"</div>";}
  for(let d=1;d<=last;d++){
    const ds=y+"-"+pad(m+1)+"-"+pad(d);
    const dow=(new Date(y,m,d).getDay()+6)%7; // 0=Lun...6=Dom
    const isHoliday=(dow===6)||isItalianHoliday(y,m,d);
    let cls="cal-d"+(ds===t?" is-today":"")+(ds===selDate?" is-sel":"")+(obd[ds]?" has-dot":"")+(isHoliday?" is-holiday":"");
    html+="<div class='"+cls+"' onclick=\"selectDate('"+ds+"')\">"+d+"</div>";
  }
  const usedCells=first+last;
  const tail=(7-(usedCells%7))%7;
  for(let i=1;i<=tail;i++)html+="<div class='cal-d faded'>"+i+"</div>";
  document.getElementById("cal-days").innerHTML=html;
}
function calShift(n){calDate=new Date(calDate.getFullYear(),calDate.getMonth()+n,1);renderCalendar();}
function selectDate(d){
  selDate=d;orDate=d;renderCalendar();renderOrdini();renderCalStats();
  if(curTab==="ordini"&&orCalOpen){
    orCalOpen=false;
    var cal=document.getElementById("or-cal");
    var hint=document.getElementById("or-cal-hint");
    if(cal)cal.style.display="none";
    if(hint)hint.textContent="📅 calendario";
  }
}

/* ════ GROUP HEADER ════ */
function groupHeader(label,cnt,color){
  return "<div class='group-hd'><div class='group-hd-line'></div>"+
    "<span class='group-hd-lbl'>"+label+"</span>"+
    "<span class='group-hd-cnt' style='background:"+color+"'>"+cnt+"</span>"+
    "<div class='group-hd-line'></div></div>";
}

/* ════ ORDER CARD ════ */
function statoBadgeClass(s){return s==="pronto"?"b-rdy":s==="ritirato"?"b-don":s==="preparato"?"b-pre":"b-new";}
/* ════ CONFEZIONI DISPLAY HELPER ════ */
// ── REGOLE DI VISUALIZZAZIONE PRODOTTI NELLE SCHEDE ORDINE ─────────────────
// R1: kg singola confezione       → Nome 0,500 kg
// R2: kg N confezioni uguali      → Nome N×0,500 kg
// R3: kg confezioni miste         → Nome 1×0,500 kg , 2×0,300 kg
// R4: pz singola confezione       → 3 Nome
// R5: pz N confezioni             → Nome 1×30 , 2×10
// R6: kg+pz insieme               → Nome 1×0,500 kg , 2×0,300 kg , 3×10 pz
// Separatore tra prodotti: " ; "

// Raggruppa confezioni con lo stesso valore → [{n, qty, unit}]
function fmtConfezioniGroups(confezioni, unitHint){
  var map={};
  confezioni.forEach(function(w){
    var u=(w.unit||unitHint||"kg");
    var isPz=(u==="pz");
    var v=parseFloat(w.qty)||0;
    if(v<=0)return;
    var k=isPz?String(Math.round(v)):v.toFixed(3);
    var mapKey=k+"__"+u;
    if(!map[mapKey])map[mapKey]={n:0,qty:k,unit:u};
    map[mapKey].n++;
  });
  return Object.keys(map).map(function(k){return map[k];})
    .sort(function(a,b){return parseFloat(b.qty)-parseFloat(a.qty);});
}

// Formatta un singolo gruppo: "N×0,500 kg" o "N×30 pz" o "N×30" (noPzLabel)
function _fmtGroup(g, done, noPzLabel){
  var isPz=(g.unit==="pz");
  var qStr=isPz?String(Math.round(parseFloat(g.qty))):parseFloat(g.qty).toFixed(3).replace(".",",");
  var unitStr=(!noPzLabel&&isPz)?" pz":(isPz?"":(" "+g.unit));
  var col=done?"#bbb":"var(--br)";
  if(g.n===1){
    // singola: mostra solo il valore (senza "1×")
    return "<span style='font-weight:700;color:"+col+"'>"+qStr+"</span>"
      +"<span style='font-size:11px;color:"+(done?"#bbb":"var(--txl)")+"'>"+unitStr+"</span>";
  }
  return "<span style='font-weight:700;color:"+col+"'>"+g.n+"</span>"
    +"<span style='font-weight:400;color:"+(done?"#bbb":"var(--txl)")+"'>×</span>"
    +"<span style='font-weight:700;color:"+col+"'>"+qStr+"</span>"
    +"<span style='font-size:11px;color:"+(done?"#bbb":"var(--txl)")+"'>"+unitStr+"</span>";
}

// Costruisce la stringa HTML per un item, applicando le regole R1-R6
function _fmtItemHTML(it, idx, oid, doneSet){
  const done=doneSet.has(String(idx));
  const dec=done?"color:#bbb;text-decoration:line-through;text-decoration-color:rgba(192,57,43,.35);text-decoration-thickness:1px":"";
  const doneP=done?"<sup style='font-size:18px;font-weight:900;color:#C0392B;margin-left:2px;vertical-align:super'>P</sup>":"";
  const clickAttr="data-oid='"+oid+"' data-idx='"+idx+"' onclick='event.stopPropagation();_cardItemClick(event,this)'";
  const sep="<span style='color:#bbb;margin:0 3px;pointer-events:none'>,</span>";
  const name="<strong style='font-size:16px;white-space:nowrap'>"+_pName(it.productId,it.productName)+"</strong>";

  // Normalizza: raccoglie tutte le confezioni con la loro unità
  // Supporta sia il nuovo formato {qty,unit} sia i vecchi formati
  let allConfs=[];
  if(it.unit==="mista"){
    // vecchio formato mista
    if(it.qtyKg&&parseFloat(it.qtyKg)>0){
      if(it.confezioniKg&&it.confezioniKg.length>1){
        it.confezioniKg.forEach(function(c){allConfs.push({qty:c.qty||c,unit:"kg"});});
      } else {
        allConfs.push({qty:it.qtyKg,unit:"kg"});
      }
    }
    if(it.qtyPz&&parseFloat(it.qtyPz)>0){
      if(it.confezioniPz&&it.confezioniPz.length>1){
        it.confezioniPz.forEach(function(c){allConfs.push({qty:c.qty||c,unit:"pz"});});
      } else {
        allConfs.push({qty:it.qtyPz,unit:"pz"});
      }
    }
  } else if(it.confezioni&&it.confezioni.length>1){
    // nuovo formato: array di {qty, unit}
    it.confezioni.forEach(function(c){
      allConfs.push({qty:c.qty,unit:c.unit||it.unit||"kg"});
    });
  } else {
    allConfs=[{qty:it.qty,unit:it.unit||"kg"}];
  }
  allConfs=allConfs.filter(function(c){return parseFloat(c.qty)>0;});
  if(!allConfs.length)return "";

  // Separa per unità
  var kgConfs=allConfs.filter(function(c){return c.unit!=="pz";});
  var pzConfs=allConfs.filter(function(c){return c.unit==="pz";});
  const hasMista=kgConfs.length>0&&pzConfs.length>0;
  const onlyPz=pzConfs.length>0&&kgConfs.length===0;
  const onlyKg=kgConfs.length>0&&pzConfs.length===0;

  // R4: pz singola confezione → "3 Nome"
  if(onlyPz&&pzConfs.length===1){
    const q=Math.round(parseFloat(pzConfs[0].qty));
    const inner="<span style='font-weight:700;color:"+(done?"#bbb":"var(--br)")+"'>"+q+"</span> "+name;
    return "<span style='font-size:16px;padding:1px 0;white-space:nowrap;cursor:pointer;"+dec+"' "+clickAttr+">"+inner+doneP+"</span>";
  }

  // Per tutti gli altri casi: nome viene prima, poi gruppi
  var groupsHTML=[];

  if(onlyKg||hasMista){
    const kgGroups=fmtConfezioniGroups(kgConfs,"kg");
    kgGroups.forEach(function(g){groupsHTML.push(_fmtGroup(g,done,false));});
  }
  if(onlyPz||hasMista){
    const pzGroups=fmtConfezioniGroups(pzConfs,"pz");
    // R5: pz multiple → senza etichetta "pz" finale su ogni gruppo, ma la aggiungiamo
    pzGroups.forEach(function(g){groupsHTML.push(_fmtGroup(g,done,false));});
  }

  const groupsJoined=groupsHTML.join(sep);
  const inner=name+" "+groupsJoined;
  return "<span style='font-size:16px;padding:1px 0;white-space:nowrap;cursor:pointer;"+dec+"' "+clickAttr+">"+inner+doneP+"</span>";
}

// ── FUNZIONI CONDIVISE DI FORMATTAZIONE (schede, stampa, lista personalizzata) ──

// Restituisce array normalizzato di confezioni: [{qty, unit}]
function _itemGroups(it){
  var allConfs=[];
  if(it.unit==="mista"){
    if(it.qtyKg&&parseFloat(it.qtyKg)>0){
      if(it.confezioniKg&&it.confezioniKg.length>1)
        it.confezioniKg.forEach(function(c){allConfs.push({qty:c.qty||c,unit:"kg"});});
      else allConfs.push({qty:it.qtyKg,unit:"kg"});
    }
    if(it.qtyPz&&parseFloat(it.qtyPz)>0){
      if(it.confezioniPz&&it.confezioniPz.length>1)
        it.confezioniPz.forEach(function(c){allConfs.push({qty:c.qty||c,unit:"pz"});});
      else allConfs.push({qty:it.qtyPz,unit:"pz"});
    }
  } else if(it.confezioni&&it.confezioni.length>1){
    it.confezioni.forEach(function(c){allConfs.push({qty:c.qty,unit:c.unit||it.unit||"kg"});});
  } else {
    allConfs=[{qty:it.qty,unit:it.unit||"kg"}];
  }
  return allConfs.filter(function(c){return parseFloat(c.qty)>0;});
}

// Testo puro per doPrint: "Tagliatelle 1x0,500 kg , 2x0,300 kg" / "3 Lasagne"
function _fmtItemText(it){
  var allConfs=_itemGroups(it);
  if(!allConfs.length)return "";
  var kgConfs=allConfs.filter(function(c){return c.unit!=="pz";});
  var pzConfs=allConfs.filter(function(c){return c.unit==="pz";});
  var onlyPz=pzConfs.length>0&&kgConfs.length===0;
  if(onlyPz&&pzConfs.length===1){
    return Math.round(parseFloat(pzConfs[0].qty))+" "+it.productName;
  }
  var parts=[];
  if(kgConfs.length){
    fmtConfezioniGroups(kgConfs,"kg").forEach(function(g){
      var q=parseFloat(g.qty).toFixed(3).replace(".",",");
      parts.push(g.n===1?q+" kg":g.n+"x"+q+" kg");
    });
  }
  if(pzConfs.length){
    fmtConfezioniGroups(pzConfs,"pz").forEach(function(g){
      var q=Math.round(parseFloat(g.qty));
      parts.push(g.n===1?q+" pz":g.n+"x"+q+" pz");
    });
  }
  return it.productName+" "+parts.join(" , ");
}

// HTML compatto per lista stampabile: solo le quantita con le regole R1-R6
function _fmtItemQtyPrint(item){
  var allConfs=_itemGroups(item);
  if(!allConfs.length)return "";
  var kgConfs=allConfs.filter(function(c){return c.unit!=="pz";});
  var pzConfs=allConfs.filter(function(c){return c.unit==="pz";});
  var sep="<span style='color:#bbb;margin:0 2px'>,</span>";
  var parts=[];
  if(kgConfs.length){
    fmtConfezioniGroups(kgConfs,"kg").forEach(function(g){
      var q=parseFloat(g.qty).toFixed(3).replace(".",",");
      parts.push(g.n===1
        ?"<b style='color:#C4622D'>"+q+"</b><span style='font-size:9px;color:#888;margin-left:1px'>kg</span>"
        :"<b>"+g.n+"</b><span style='color:#888'>x</span><b style='color:#C4622D'>"+q+"</b><span style='font-size:9px;color:#888;margin-left:1px'>kg</span>");
    });
  }
  if(pzConfs.length){
    fmtConfezioniGroups(pzConfs,"pz").forEach(function(g){
      var q=Math.round(parseFloat(g.qty));
      parts.push(g.n===1
        ?"<b style='color:#C4622D'>"+q+"</b><span style='font-size:9px;color:#888;margin-left:1px'>pz</span>"
        :"<b>"+g.n+"</b><span style='color:#888'>x</span><b style='color:#C4622D'>"+q+"</b><span style='font-size:9px;color:#888;margin-left:1px'>pz</span>");
    });
  }
  return parts.join(sep);
}


function orderCardHTML(o,showDate){
  const doneSet=new Set((o.itemsDone||[]).map(String));
  const isDone=o.stato==="ritirato";
  const nextStato=STATO_NEXT[o.stato||"nuovo"];
  const s=o.stato||"nuovo";
  const statoStyles={"nuovo":"background:#E3F0FF;color:#1A6BD4;border:2px solid #1A6BD4","preparato":"background:#FFF3E0;color:#E65100;border:2px solid #E65100","pronto":"background:#E8F5E3;color:#3A7A2A;border:2px solid #3A7A2A","ritirato":"background:#F0F0F0;color:#888;border:2px solid #ccc"};
  const statoBtn=nextStato
    ? "<button data-oid='"+o.id+"' onclick='event.stopPropagation();advanceOrder(this.dataset.oid)' style='"+statoStyles[s]+";border-radius:20px;padding:5px 11px;font-size:11px;font-weight:700;cursor:pointer;font-family:Lato,sans-serif;white-space:nowrap'>"+STATO_ICON[s]+" "+s+"</button>"
    : "<span style='"+statoStyles[s]+";border-radius:20px;padding:5px 11px;font-size:11px;font-weight:700;white-space:nowrap;display:inline-block'>"+STATO_ICON[s]+" "+s+"</span>";
  const canResend=(s==="nuovo"||s==="pronto"||s==="ritirato")&&o.customerPhone&&WA_API_CFG.enabled;
  // ── Spunte di lettura WhatsApp per l'ultimo messaggio inviato su quest'ordine.
  // Visibili ogni volta che è stato effettivamente inviato un template (manualmente o in automatico),
  // qualunque sia lo stato a cui si riferisce: se è partito un messaggio, si vuole sapere se arriva e se viene letto. ──
  const waTickHTML=(()=>{
    if(!o.waLastMsgId) return "";
    if(o.waStatus==="read") return "<span title='Letto dal cliente' style='color:#53bdeb;font-size:14px;font-weight:700;letter-spacing:-2px'>✓✓</span>";
    if(o.waStatus==="delivered") return "<span title='Consegnato' style='color:#9aa0a6;font-size:14px;font-weight:700;letter-spacing:-2px'>✓✓</span>";
    if(o.waStatus==="sent") return "<span title='Inviato' style='color:#9aa0a6;font-size:14px'>✓</span>";
    if(o.waStatus==="failed") return "<span title='Invio fallito' style='color:#e74c3c;font-size:14px;font-weight:700'>⚠️</span>";
    return "";
  })();
  const resendBtn=canResend
    ? "<button data-oid='"+o.id+"' data-st='"+s+"' title='Rimanda messaggio WhatsApp' onclick='event.stopPropagation();sendWAapiWithFeedback(this.dataset.oid,this.dataset.st)' style='flex:0 0 auto;width:26px;height:26px;border-radius:50%;border:1.5px solid var(--cd);background:#fff;color:var(--t);font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0'>↻</button>"
    : "";
  const prodsHTML=(()=>{
    if(!o.items)return "";
    const parts=[];
    o.items.forEach(function(it,idx){
      var h=_fmtItemHTML(it,idx,o.id,doneSet);
      if(h)parts.push(h);
    });
    return parts.join("<span style='color:var(--t);margin:0 6px;font-size:17px;font-weight:900;pointer-events:none;white-space:nowrap'>;</span>");
  })();
  let html="<div class='oc"+(isDone?" oc-done":"")+"'"
    +(showDate?"":" data-drag-id='"+o.id+"' data-drag-type='order'")
    +" id='oc-"+o.id+"' onclick=\"if(!window._dragJustEnded)openOrderDetail('"+o.id+"')\">";
  html+="<div style='display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:5px'>";
  var dragHnd=showDate?"":"<span class='or-drag-handle' ontouchstart='event.stopPropagation();_dragStart(event,\"order\",\""+o.id+"\")' onmousedown='event.stopPropagation();_dragStart(event,\"order\",\""+o.id+"\")' onclick='event.stopPropagation()'>⣿</span>";
  html+="<div style='display:flex;align-items:center;gap:5px;min-width:0;flex:1'>"+dragHnd+"<div class='oc-name'>"+o.customerName+(showDate?" <span style='font-size:11px;font-weight:400;color:var(--txl)'>"+fmtDate(o.date)+"</span>":"")+"</div></div>";
  html+="<div style='display:flex;align-items:center;gap:5px'>"+statoBtn+resendBtn+"</div>";
  html+="</div>";
  html+="<div style='display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px'>";
  html+="<span class='badge b-pv'>"+o.pv+"</span>";
  if(o.consegna)html+="<span class='b-del'>🛵</span>";
  if(o.orarioRitiro||o.orarioConsegna)html+="<span style='font-size:11px;color:var(--txl)'>⏰ "+(o.orarioRitiro||o.orarioConsegna)+"</span>";
  if(o.importo)html+="<span style='font-size:12px;font-weight:700;color:var(--t);margin-left:auto'>€"+parseFloat(o.importo).toFixed(2)+"</span>";
  html+="</div>";
  html+="<div style='display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 0;row-gap:3px'>"+prodsHTML+"</div>";
  if(o.notes)html+="<div style='font-size:11px;color:var(--txl);margin-top:3px;font-style:italic'>📝 "+o.notes+"</div>";
  // importo rapido — apre un overlay modale indipendente dalla card (vedi qiOpenModal),
  // così il campo non viene mai distrutto da un ridisegno della lista mentre l'utente digita
  const showImportoBtn=(o.stato==="preparato"||o.stato==="pronto")&&!o.importo;
  if(showImportoBtn){
    html+=
      "<div style='margin-top:7px' onclick='event.stopPropagation()'>"+
      "<button type='button' data-oid='"+o.id+"' "+
        "style='width:100%;display:flex;align-items:center;justify-content:center;gap:6px;background:#fff;border:1.5px dashed #e0cdb8;color:var(--t);border-radius:var(--rs);padding:8px;font-size:13px;font-weight:700;font-family:Lato,sans-serif;cursor:pointer' "+
        "onclick='event.stopPropagation();qiOpenModal(this.dataset.oid)'>€ Inserisci importo</button>"+
      "</div>";
  }
  // Spunta di lettura WA ancorata all'angolo in basso a destra della card; quando c'è anche
  // il pulsante "Inserisci importo" (a tutta larghezza, in fondo) la spunta si sposta più in
  // alto per restare sopra di esso invece di sovrapporglisi.
  if(waTickHTML){
    html+="<div style='position:absolute;right:10px;bottom:"+(showImportoBtn?"48px":"8px")+"'>"+waTickHTML+"</div>";
  }
  html+="</div>";
  return html;
}

function advanceOrder(id){
  const o=orders.find(x=>x.id===id);
  if(!o)return;
  const next=STATO_NEXT[o.stato||"nuovo"];
  if(!next)return;
  orders=orders.map(x=>x.id===id?{...x,stato:next}:x);
  const _aO=orders.find(x=>x.id===id);
  window._savingOrder=true; // blocca il listener ordini finché l'utente non finisce di inserire l'importo
  setTimeout(()=>{window._savingOrder=false;},8000);
  lsSetOrder(_aO);
  refreshAll();
  scrollAndPulse(id);
  if((next==="pronto"||next==="ritirato")&&_aO.customerPhone){
    const autoFlag=(next==="pronto"&&WA_API_CFG.autoPronte)||(next==="ritirato"&&WA_API_CFG.autoRitirato);
    if(WA_API_CFG.enabled&&autoFlag)sendWAapiWithFeedback(id,next);
    else showWAReminder(next);
  }
}
function scrollAndPulse(oid){
  setTimeout(function(){
    var contentEl=document.getElementById("content");
    var target=document.getElementById("oc-"+oid);
    if(target&&contentEl){
      contentEl.scrollTop=target.offsetTop-80;
      target.classList.add("oc-pulse");
      setTimeout(function(){target.classList.remove("oc-pulse");},1800);
    }
  },50);
}
// For card items: single tap toggles the whole item
function _cardItemClick(e,el){
  const oid=el.dataset.oid;
  const idx=parseInt(el.dataset.idx);
  const o=orders.find(x=>x.id===oid);
  if(!o)return;
  inlineToggle(oid,idx);
}

function inlineToggleKey(oid,key){
  // legacy - redirect to inlineToggle using idx part
  var idx=parseInt(key.split(":")[0]);
  if(!isNaN(idx))inlineToggle(oid,idx);
}

function inlineToggle(oid,idx){
  const key=String(idx);
  const o=orders.find(x=>x.id===oid);
  if(!o)return;
  const done=new Set((o.itemsDone||[]).map(String));
  const wasRemoving=done.has(key);
  if(wasRemoving)done.delete(key); else done.add(key);
  const newDone=[...done];
  const allKeys=(o.items||[]).map(function(_,i){return String(i);});
  const allDone=allKeys.length>0&&allKeys.every(function(k){return done.has(k);});
  let newStato=o.stato, newImporto=o.importo;
  if(wasRemoving){
    newImporto="";
    if(o.stato==="pronto"||o.stato==="preparato")newStato="nuovo";
  } else {
    if(allDone&&o.stato==="nuovo")newStato="preparato";
  }
  var statoChanged=newStato!==o.stato;
  orders=orders.map(x=>x.id===oid?{...x,itemsDone:newDone,stato:newStato,importo:newImporto}:x);
  window._savingOrder=true;
  setTimeout(()=>{window._savingOrder=false;},8000);
  lsSetOrder(orders.find(x=>x.id===oid));
  refreshAll();
  if(statoChanged)scrollAndPulse(oid);
}

function sendWAcard(oid,s){const o=orders.find(x=>x.id===oid);if(!o||!o.customerPhone)return alert("Nessun numero WhatsApp");openWA(o.customerPhone,waMsg(o,s));}

// ---- Importo rapido: overlay modale agganciato a document.body ----
// (indipendente dal ridisegno della lista ordini, evita che il campo venga
// distrutto mentre l'utente sta digitando sul cellulare)
function qiOpenModal(oid){
  var o=orders.find(function(x){return x.id===oid;});
  if(!o)return;
  var overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.innerHTML=
    "<div style='background:#fff;border-radius:16px;padding:22px 20px;width:100%;max-width:320px;box-shadow:0 8px 40px rgba(0,0,0,.3)'>"+
      "<div style='font-size:16px;font-weight:700;color:#333;margin-bottom:4px'>€ Importo ordine</div>"+
      "<div style='font-size:13px;color:#666;margin-bottom:14px'>"+(o.customerName||"")+"</div>"+
      "<input id='qi-modal-inp' type='number' step='0.01' inputmode='decimal' placeholder='0.00' "+
        "style='width:100%;padding:12px;border:1.5px solid #e0cdb8;border-radius:8px;font-size:18px;font-weight:700;box-sizing:border-box;outline:none;margin-bottom:14px;font-family:Lato,sans-serif'>"+
      "<div style='display:flex;gap:10px'>"+
        "<button id='qi-modal-cancel' style='flex:1;padding:10px;border:1.5px solid #ddd;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;font-family:Lato,sans-serif'>Annulla</button>"+
        "<button id='qi-modal-ok' style='flex:2;padding:10px;border:none;border-radius:8px;background:var(--t);color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:Lato,sans-serif'>Salva</button>"+
      "</div>"+
    "</div>";
  document.body.appendChild(overlay);
  var inp=overlay.querySelector('#qi-modal-inp');
  setTimeout(function(){inp.focus();},50);
  function close(){ if(overlay.parentNode)document.body.removeChild(overlay); }
  overlay.querySelector('#qi-modal-cancel').onclick=close;
  overlay.querySelector('#qi-modal-ok').onclick=function(){
    if(!inp.value||parseFloat(inp.value)<=0){showToast("Inserisci un importo valido");return;}
    qiApplyImporto(oid,inp.value);
    close();
  };
  inp.addEventListener('keydown',function(e){ if(e.key==='Enter')overlay.querySelector('#qi-modal-ok').click(); });
  overlay.addEventListener('click',function(e){ if(e.target===overlay)close(); });
}
function qiApplyImporto(oid,val){
  orders=orders.map(function(x){
    return x.id===oid?Object.assign({},x,{importo:val,stato:"pronto"}):x;
  });
  window._savingOrder=true;
  setTimeout(function(){window._savingOrder=false;},8000);
  lsSetOrder(orders.find(function(x){return x.id===oid;}));
  showToast("€ Importo salvato!");
  refreshAll();
  var _qO=orders.find(function(x){return x.id===oid;});
  if(_qO&&_qO.customerPhone){
    if(WA_API_CFG.enabled&&WA_API_CFG.autoPronte)sendWAapiWithFeedback(oid,"pronto");
    else showWAReminder("pronto");
  }
}

function quickImporto(oid){
  var inp=document.querySelector(".qi-inp[data-oid='"+oid+"']");
  if(!inp||!inp.value||parseFloat(inp.value)<=0)return;
  orders=orders.map(function(x){
    return x.id===oid?Object.assign({},x,{importo:inp.value,stato:"pronto"}):x;
  });
  window._savingOrder=true;
  setTimeout(function(){window._savingOrder=false;},8000);
  lsSetOrder(orders.find(function(x){return x.id===oid;}));
  showToast("€ Importo salvato!");
  refreshAll();
  var _qiO=orders.find(function(x){return x.id===oid;});
  if(_qiO&&_qiO.customerPhone){
    if(WA_API_CFG.enabled&&WA_API_CFG.autoPronte)sendWAapiWithFeedback(oid,"pronto");
    else showWAReminder("pronto");
  }
}
function qiSave(btn){
  var oid=btn.dataset.oid;
  var inp=btn.parentElement.querySelector(".qi-inp");
  if(!inp||!inp.value||parseFloat(inp.value)<=0){showToast("Inserisci un importo valido");return;}
  orders=orders.map(function(x){
    return x.id===oid?Object.assign({},x,{importo:inp.value,stato:"pronto"}):x;
  });
  window._savingOrder=true;
  setTimeout(function(){window._savingOrder=false;},8000);
  lsSetOrder(orders.find(function(x){return x.id===oid;}));
  showToast("€ Importo salvato!");
  refreshAll();
  var _qsO=orders.find(function(x){return x.id===oid;});
  if(_qsO&&_qsO.customerPhone){
    if(WA_API_CFG.enabled&&WA_API_CFG.autoPronte)sendWAapiWithFeedback(oid,"pronto");
    else showWAReminder("pronto");
  }
  // dopo il render, scorri sulla card aggiornata usando data-oid
  setTimeout(function(){
    var contentEl=document.getElementById("content");
    if(!contentEl)return;
    // la card ha data-oid nel pulsante WA o nel pulsante stato
    // cerchiamo il div .oc che contiene un elemento con data-oid=oid
    var target=document.getElementById("oc-"+oid);
    if(target){
      var cardTop=target.offsetTop;
      contentEl.scrollTop=cardTop-80;
      // heartbeat per attirare l'attenzione
      target.classList.add("oc-pulse");
      setTimeout(function(){target.classList.remove("oc-pulse");},1800);
    }
  },50);
}

/* ════ WA API CONFIG PANEL ════ */
function waApiCfgInit(){
  var ti=document.getElementById("wa-token-inp");
  var pi=document.getElementById("wa-phoneid-inp");
  var tp=document.getElementById("wa-testphone-inp");
  if(ti)ti.value=window._waApiMem.token||"";
  if(pi)pi.value=window._waApiMem.phoneId||"";
  var cn=document.getElementById("wa-auto-nuovo-chk");
  var cp=document.getElementById("wa-auto-pronto-chk");
  var cr=document.getElementById("wa-auto-ritirato-chk");
  if(cn)cn.checked=!!window._waApiMem.autoNuovo;
  if(cp)cp.checked=!!window._waApiMem.autoPronte;
  if(cr)cr.checked=!!window._waApiMem.autoRitirato;
  if(tp)tp.value=localStorage.getItem("wa_api_test_phone")||"";
  waApiCfgUpdateBadge();
}
function waApiCfgUpdate(){waApiCfgUpdateBadge();}
function waApiCfgUpdateBadge(){
  var badge=document.getElementById("wa-api-status-badge");
  if(!badge)return;
  var enabled=WA_API_CFG.enabled;
  badge.textContent=enabled?"✅ Configurata":"⚠️ Non configurata";
  badge.style.background=enabled?"#e8f5e3":"#fff3e0";
  badge.style.color=enabled?"#3a7a2a":"#e65100";
}
function waApiCfgSave(){
  var t=(document.getElementById("wa-token-inp")||{}).value||"";
  var p=(document.getElementById("wa-phoneid-inp")||{}).value||"";
  var cn=document.getElementById("wa-auto-nuovo-chk");
  var cp=document.getElementById("wa-auto-pronto-chk");
  var cr=document.getElementById("wa-auto-ritirato-chk");
  var cfg={token:t.trim(),phoneId:p.trim(),autoNuovo:!!(cn&&cn.checked),autoPronte:!!(cp&&cp.checked),autoRitirato:!!(cr&&cr.checked)};
  Object.assign(window._waApiMem,cfg);
  if(window.fbSaveDoc)window.fbSaveDoc("settings","wa_config",cfg);
  waApiCfgUpdateBadge();
  var msg=document.getElementById("wa-cfg-msg");
  if(msg){msg.textContent="✅ Salvato su Firebase!";msg.style.color="#3a7a2a";setTimeout(()=>{msg.textContent="";},2500);}
}
async function waApiCfgTest(){
  waApiCfgSave();
  var msg=document.getElementById("wa-cfg-msg");
  if(!WA_API_CFG.enabled){
    if(msg){msg.textContent="⚠️ Inserisci token e Phone Number ID prima";msg.style.color="#e65100";}
    return;
  }
  var testPhone=localStorage.getItem("wa_api_test_phone")||"";
  if(!testPhone){
    if(msg){msg.textContent="⚠️ Inserisci un numero di test";msg.style.color="#e65100";}
    return;
  }
  if(msg){msg.textContent="📤 Invio messaggio di test…";msg.style.color="#1a6bd4";}
  let p=testPhone.replace(/\D/g,"");
  if(p.startsWith("0"))p="39"+p;
  else if(p.length===10&&!p.startsWith("39"))p="39"+p;
  try{
    const res=await fetch("https://cozy-souffle-e9b499.netlify.app/.netlify/functions/wa-send",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({phoneId:WA_API_CFG.phoneId,token:WA_API_CFG.token,to:p,template:"hello_world"})
    });
    const data=await res.json();
    if(res.ok&&data.messages){
      if(msg){msg.textContent="✅ Test riuscito! Messaggio inviato.";msg.style.color="#3a7a2a";}
    }else{
      const errMsg=(data.error&&data.error.message)||"Errore sconosciuto";
      if(msg){msg.textContent="❌ "+errMsg;msg.style.color="#c62828";}
    }
  }catch(e){
    if(msg){msg.textContent="❌ "+e.message;msg.style.color="#c62828";}
  }
}
setTimeout(waApiCfgUpdateBadge,800);

function showToast(msg){
  var t=document.getElementById("toast");
  if(!t)return;
  t.textContent=msg;
  t.classList.add("show");
  setTimeout(function(){t.classList.remove("show");},2000);
}
function showWAReminder(evento){
  // evento: 'nuovo' | 'pronto' | 'ritirato'
  var msgs={
    nuovo:"Ricorda di inviare al cliente il messaggio WhatsApp di conferma ordine! 💬",
    pronto:"Ricorda di inviare al cliente il messaggio WhatsApp per avvisarlo che l'ordine è pronto! ✅",
    ritirato:"Ricorda di inviare al cliente il messaggio WhatsApp di ringraziamento e recensione! ⭐"
  };
  var icons={nuovo:"🛒",pronto:"✅",ritirato:"🏠"};
  var msg=msgs[evento]||msgs.nuovo;
  var icon=icons[evento]||"💬";
  var ov=document.createElement("div");
  ov.id="wa-reminder-ov";
  ov.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;";
  ov.innerHTML="<div style='background:#fff;border-radius:16px;padding:28px 24px 22px;max-width:320px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.22);text-align:center;'>"
    +"<div style='font-size:40px;margin-bottom:10px;'>"+icon+"</div>"
    +"<div style='font-size:15px;font-weight:600;color:#1a1a1a;line-height:1.5;margin-bottom:20px;'>"+msg+"</div>"
    +"<button onclick=\"document.getElementById('wa-reminder-ov').remove()\" style='background:#25D366;color:#fff;border:none;border-radius:10px;padding:12px 32px;font-size:15px;font-weight:700;cursor:pointer;width:100%;'>Ho Capito</button>"
    +"</div>";
  document.body.appendChild(ov);
}
function refreshAll(){
  if(curTab==="ordini"){
    renderOrdini();
    var _srchQ=document.getElementById("or-q");
    if(_srchQ&&_srchQ.value.trim())orSearch(_srchQ.value);
  }
}

/* ════ ORDINI PAGE ════ */
function renderOrdini(){
  document.getElementById("or-date-lbl").textContent=fmtDate(orDate);
  document.getElementById("or-dow-lbl").textContent=GF[getDow(orDate)];
  // Filtra ordini per ruolo
  const all=_filterOrdersByRole(orders.filter(o=>o.date===orDate));
  document.getElementById("or-print").style.display=all.length?"":"none";
  document.getElementById("or-table").style.display=all.length?"":"none";

  // PV filter grid via DOM — operatore vede solo il suo PV
  if(_isAdmin()){
    window._pvList=["tutti","NUMANA","OSIMO STAZIONE","SIROLO","ANCONA"];
  } else {
    const pv=_userPV();
    window._pvList = pv ? [pv] : ["tutti","NUMANA","OSIMO STAZIONE","SIROLO","ANCONA"];
    if(pv && orFilterPV !== pv) orFilterPV = pv;
  }
  const pvCounts={"tutti":all.length};
  PUNTI.forEach(pv=>{pvCounts[pv]=all.filter(o=>_normPV(o.pv)===pv).length;});
  const filterEl=document.getElementById("or-filters");
  filterEl.innerHTML="";
  const grid=document.createElement("div");
  grid.className="pv-grid";
  // Layout: [TUTTI quadrato] { [griglia 2x2 cerchi]
  // Tutti a sinistra, parentesi graffa, cerchi a destra
  // PV2: 4 cerchi agli angoli, TUTTI a forma di rombo al centro (3x3 grid)
  // [ ANC ] [  ] [ OSI ]
  // [     ] TUTTI [    ]
  // [ NUM ] [  ] [ SIR ]
  // PV2: posizionamento assoluto dentro un contenitore relativo
  // Cerchi agli angoli, rombo al centro, sovrapposti con translate
  // PV1: TUTTI quadrato a sinistra + { + griglia 2x2 cerchi a destra
  // PV: una riga, 5 chip tondeggianti, larghezza piena
  var vertical=isDesktop();
  var row=document.createElement("div");
  row.style.cssText=vertical
    ? "display:flex;flex-direction:column;gap:8px;width:100%"
    : "display:flex;gap:4px;width:100%;margin-bottom:8px";
  var pvDefs=[
    {idx:0,label:"Tutti",pv:"tutti",cnt:pvCounts["tutti"]},
    {idx:1,label:"Numana",pv:"NUMANA",cnt:pvCounts["NUMANA"]},
    {idx:2,label:"Osimo",pv:"OSIMO STAZIONE",cnt:pvCounts["OSIMO STAZIONE"]},
    {idx:3,label:"Sirolo",pv:"SIROLO",cnt:pvCounts["SIROLO"]},
    {idx:4,label:"Ancona",pv:"ANCONA",cnt:pvCounts["ANCONA"]}
  ];
  pvDefs.forEach(function(d){
    var on=orFilterPV===d.pv;
    var chip=document.createElement("div");
    if(vertical){
      chip.style.cssText=
        "border-radius:14px;display:flex;flex-direction:column;align-items:center;"+
        "justify-content:center;gap:2px;cursor:pointer;transition:all .15s;padding:10px 6px;"+
        "border:1.5px solid "+(on?"var(--go)":"#fff")+";"+
        "background:"+(on?"var(--go)":"#fff")+";color:"+(on?"#3a2900":"var(--td)")+";"+
        "box-shadow:0 2px 6px rgba(0,0,0,.15);font-weight:800;";
    }else{
      chip.style.cssText=
        "flex:1;border-radius:20px;display:flex;flex-direction:column;align-items:center;"+
        "justify-content:center;gap:1px;cursor:pointer;transition:all .15s;padding:5px 2px;"+
        "border:1.5px solid "+(on?"var(--t)":"#ccc")+";"+
        "background:"+(on?"var(--t)":"var(--cd)")+";color:"+(on?"#fff":"var(--txl)")+";";
    }
    chip.onclick=function(){orSetPVI(d.idx);};
    var nm=document.createElement("span");
    nm.style.cssText=vertical?"font-size:11.5px;font-weight:800;line-height:1.25;text-align:center":"font-size:9px;font-weight:700;line-height:1;text-align:center";
    nm.textContent=d.label;
    var ct=document.createElement("span");
    ct.style.cssText=vertical?"font-size:14px;font-weight:800;line-height:1;margin-top:2px":"font-size:8px;opacity:.8;line-height:1";
    ct.textContent=d.cnt;
    chip.appendChild(nm);chip.appendChild(ct);
    row.appendChild(chip);
  });
  filterEl.innerHTML="";
  filterEl.appendChild(row);

  const day=orFilterPV==="tutti"?all:all.filter(o=>_normPV(o.pv)===orFilterPV);
  if(!day.length){document.getElementById("or-list").innerHTML="<div class='empty'><div class='empty-ico'>📋</div><div>Nessun ordine</div></div>";return;}

  const groups=[
    {key:"nuovo",label:"Da fare",icon:"🆕",color:"#1A6BD4"},
    {key:"preparato",label:"Preparati",icon:"🟡",color:"#E65100"},
    {key:"pronto",label:"Pronti",icon:"✅",color:"#3A7A2A"},
  ];
  const ritirati=day.filter(o=>o.stato==="ritirato");
  let html="";
  let anyActiveGroup=false;
  function sortByManual(arr){
    return arr.slice().sort(function(a,b){
      var ma=a.manualOrder!=null?a.manualOrder:99999;
      var mb=b.manualOrder!=null?b.manualOrder:99999;
      return ma-mb;
    });
  }
  groups.forEach(g=>{
    const grp=sortByManual(day.filter(o=>(o.stato||"nuovo")===g.key));
    if(!grp.length)return;
    anyActiveGroup=true;
    html+=groupHeader(g.icon+" "+g.label,grp.length,g.color);
    html+=grp.map(o=>orderCardHTML(o)).join("");
  });
  if(!anyActiveGroup&&ritirati.length){
    html+="<div class='empty' style='padding:30px 16px'><div class='empty-ico'>🎉</div><div>Tutti gli ordini di oggi sono stati ritirati</div></div>";
  }
  if(ritirati.length){
    html+="<div class='ritirati-toggle' onclick='orToggleRitirati()'>"+
      (orShowRitirati?"▲ Nascondi":"▼ Mostra")+" ritirati ("+ritirati.length+")</div>";
    if(orShowRitirati){
      const ritiOrdered=sortByManual(ritirati);
      html+=groupHeader("🏠 Ritirati",ritiOrdered.length,"#999");
      html+=ritiOrdered.map(o=>orderCardHTML(o)).join("");
    }
  }
  document.getElementById("or-list").innerHTML=html;
  if(!document.getElementById("_drag-style")){var st=document.createElement("style");st.id="_drag-style";st.textContent="._drag-over{outline:2.5px dashed var(--t)!important;outline-offset:3px;background:var(--cd)!important;border-radius:var(--r)}";document.head.appendChild(st);}
}
function orSetPVI(i){orFilterPV=(window._pvList||["tutti","NUMANA","OSIMO STAZIONE","SIROLO","ANCONA"])[i];renderOrdini();if(orTotaliOpen)renderTotali();}
function orToggleRitirati(){orShowRitirati=!orShowRitirati;renderOrdini();}
let orTotaliOpen=false;
let orTotaliPV="tutti";
function orToggleTotali(){
  orTotaliOpen=!orTotaliOpen;
  const el=document.getElementById("or-totali");
  const btn=document.getElementById("or-totali-toggle");
  if(el)el.style.display=orTotaliOpen?"block":"none";
  if(btn){
    if(isDesktop()){
      btn.innerHTML="📦<span class='top-tool-lbl'>"+(orTotaliOpen?"Chiudi":"Totali")+"</span>";
      btn.classList.toggle("active",orTotaliOpen);
    }else{
      btn.innerHTML=orTotaliOpen?"📦 Nascondi totali":"📦 Totali della giornata";
    }
  }
  if(orTotaliOpen)renderTotali();
}
function renderTotali(){
  const el=document.getElementById("or-totali");
  if(!el)return;
  // Filtra ordini per ruolo
  const allDayRaw=orders.filter(function(o){return o.date===orDate;});
  const allDay=_filterOrdersByRole(allDayRaw);
  const day=orTotaliPV==="tutti"
    ? allDay
    : allDay.filter(function(o){return _normPV(o.pv)===orTotaliPV;});

  // Operatore: mostra solo il suo PV nei totali
  const pvDefsAll=[
    {pv:"tutti",label:"Tutti"},
    {pv:"NUMANA",label:"Numana"},
    {pv:"OSIMO STAZIONE",label:"Osimo"},
    {pv:"SIROLO",label:"Sirolo"},
    {pv:"ANCONA",label:"Ancona"}
  ];
  const pvDefs=_isAdmin()?pvDefsAll:pvDefsAll.filter(function(d){return d.pv==="tutti"||d.pv===_userPV();});
  var hFilter='<div style="display:flex;gap:4px;margin-bottom:10px">';
  pvDefs.forEach(function(d){
    var on=orTotaliPV===d.pv;
    var cnt=d.pv==="tutti"?allDay.length:allDay.filter(function(o){return _normPV(o.pv)===d.pv;}).length;
    hFilter+='<div data-tpv="'+d.pv.replace(/"/g,"&quot;")+'" onclick="orTotaliSetPV(this.dataset.tpv)"'+
      ' style="flex:1;border-radius:20px;display:flex;flex-direction:column;align-items:center;gap:1px;cursor:pointer;padding:5px 2px;'+
      'border:1.5px solid '+(on?'var(--t)':'#ccc')+';'+
      'background:'+(on?'var(--t)':'var(--cd)')+'">'+
      '<span style="font-size:9px;font-weight:700;line-height:1;text-align:center;color:'+(on?'#fff':'var(--txl)')+'">'+d.label+'</span>'+
      '<span style="font-size:8px;opacity:.8;line-height:1;color:'+(on?'#fff':'var(--txl)')+'">'+cnt+'</span>'+
    '</div>';
  });
  hFilter+='</div>';

  if(!day.length){
    el.innerHTML='<div class="card">'+hFilter+
      '<div class="empty" style="padding:10px"><div class="empty-ico" style="font-size:30px">📦</div><div>Nessun ordine</div></div></div>';
    return;
  }

  const totals={};
  // mappa nome prodotto -> icona dal catalogo prodotti
  function getProdImage(productName){
    var p=products.find(function(x){return x.name===productName;});
    return p?p.image:"";
  }
  day.forEach(function(o){
    if(!o.items)return;
    o.items.forEach(function(it){
      if(it.unit==="mista"){
        var img=getProdImage(it.productName);
        if(it.qtyKg&&parseFloat(it.qtyKg)>0){
          const k=it.productName+"__kg";
          if(!totals[k])totals[k]={name:it.productName,unit:"kg",qty:0,image:img};
          if(it.confezioniKg&&it.confezioniKg.length>1){
            totals[k].qty+=it.confezioniKg.reduce(function(s,c){return s+(parseFloat(c.qty)||0);},0);
          } else {
            totals[k].qty+=parseFloat(it.qtyKg);
          }
        }
        if(it.qtyPz&&parseFloat(it.qtyPz)>0){
          const k=it.productName+"__pz";
          if(!totals[k])totals[k]={name:it.productName,unit:"pz",qty:0,image:img};
          if(it.confezioniPz&&it.confezioniPz.length>1){
            totals[k].qty+=it.confezioniPz.reduce(function(s,c){return s+(parseFloat(c.qty)||0);},0);
          } else {
            totals[k].qty+=parseFloat(it.qtyPz);
          }
        }
        return;
      }
      var img=getProdImage(it.productName);
      const key=it.productName+(it.unit==="pz"?"__pz":"");
      if(!totals[key])totals[key]={name:it.productName,unit:it.unit,qty:0,image:img};
      // Se ci sono confezioni, somma quelle (robustezza per ordini vecchi dove qty
      // potrebbe essere solo la prima confezione invece del totale)
      if(it.confezioni&&it.confezioni.length>1){
        var confTotal=it.confezioni.reduce(function(s,c){return s+(parseFloat(c.qty)||0);},0);
        totals[key].qty+=confTotal;
      } else {
        totals[key].qty+=parseFloat(it.qty||0);
      }
    });
  });

  const rows=Object.values(totals).sort(function(a,b){
    const nc=a.name.localeCompare(b.name,"it");
    if(nc!==0)return nc;
    return a.unit==="kg"?-1:1;
  });

  const pvLabel=orTotaliPV==="tutti"?"tutti i punti vendita":orTotaliPV;
  var h='<div class="card">';
  h+=hFilter;
  h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
  h+='<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--txl)">📦 Totali – '+fmtDate(orDate)+'</div>';
  h+='<div style="font-size:11px;color:var(--txl);font-style:italic">'+pvLabel+'</div>';
  h+='</div>';
  h+='<div style="border:1.5px solid #e0cdb8;border-radius:var(--rs);overflow:hidden">';
  rows.forEach(function(p,i){
    const qtyFmt=p.unit==="kg"?p.qty.toFixed(3).replace(".",","):Math.round(p.qty).toString();
    const isLast=i===rows.length-1;
    const nextSame=!isLast&&rows[i+1]&&rows[i+1].name===p.name;
    const prevSame=i>0&&rows[i-1]&&rows[i-1].name===p.name;
    const isMistaRow=nextSame||prevSame;
    const borderStyle=isLast||nextSame?"":'border-bottom:1px solid #e8d8c4';
    h+='<div style="display:flex;align-items:center;gap:10px;padding:'+(isMistaRow?'7px':'10px')+' 12px;'+borderStyle+'">';
    if(!prevSame){
      var icon=p.image||(p.unit==="kg"?"🍝":"🫕");
      h+='<span style="font-size:18px;width:26px;text-align:center">'+icon+'</span>';
      h+='<span style="flex:1;font-size:13px;font-weight:600;color:var(--tx)">'+p.name+'</span>';
    } else {
      h+='<span style="width:26px"></span>';
      h+='<span style="flex:1"></span>';
    }
    h+='<span style="font-size:16px;font-weight:700;color:var(--t)">'+qtyFmt+'</span>';
    h+='<span style="font-size:11px;color:var(--txl);width:22px">'+p.unit+'</span>';
    h+='</div>';
  });
  h+='</div>';
  h+='<div style="margin-top:8px;font-size:11px;color:var(--txl);text-align:right">'+rows.length+' prodotti · '+day.length+' ordini</div>';
  h+='</div>';
  el.innerHTML=h;
}

function orTotaliSetPV(pv){
  orTotaliPV=pv;
  renderTotali();
}

/* ════ STATISTICHE ════ */
var stFrom=todayStr(), stTo=todayStr();
var stChartProduct=null;
var stSection="prodotti";
var stCustOpen=null;

function stChip(days){
  stTo=todayStr();
  stFrom=addDays(stTo,-(days-1));
  document.getElementById("st-from").value=stFrom;
  document.getElementById("st-to").value=stTo;
  stChartProduct=null;
  // highlight chip attiva
  [7,30,90,365].forEach(function(d){
    var b=document.getElementById("stc-"+d);
    if(b){b.className="btn btn-sm "+(d===days?"btn-p":"btn-s");b.style.borderRadius="20px";b.style.fontSize="12px";}
  });
  renderStats();
}
function stDateChange(){
  stFrom=document.getElementById("st-from").value||todayStr();
  stTo=document.getElementById("st-to").value||todayStr();
  if(stFrom>stTo){stTo=stFrom;document.getElementById("st-to").value=stTo;}
  stChartProduct=null;
  // deseleziona chips
  [7,30,90,365].forEach(function(d){
    var b=document.getElementById("stc-"+d);
    if(b){b.className="btn btn-s btn-sm";b.style.borderRadius="20px";b.style.fontSize="12px";}
  });
  renderStats();
}
function stDayCount(){
  return Math.round((new Date(stTo)-new Date(stFrom))/86400000)+1;
}
function stOrdersInRange(){
  return _filterOrdersByRole(orders).filter(function(o){return o.date>=stFrom&&o.date<=stTo;});
}

function renderStats(){
  var range=stOrdersInRange();
  var nDays=stDayCount();
  var fatturato=range.filter(function(o){return o.importo;})
    .reduce(function(s,o){return s+parseFloat(o.importo||0);},0);

  // KPI – solo ordini e fatturato
  var kpi=document.getElementById("st-kpi");
  if(kpi){
    kpi.innerHTML=
      "<div class='stat'><div class='stat-val'>"+range.length+"</div><div class='stat-lbl'>Ordini</div></div>"+
      "<div class='stat'><div class='stat-val'>€"+fatturato.toFixed(2)+"</div><div class='stat-lbl'>Fatturato</div></div>";
  }
  // aggiorna contatore clienti broadcast
  var bcCnt=document.getElementById("st-broadcast-cnt");
  if(bcCnt){
    var uniq=Object.keys(range.reduce(function(a,o){if(o.customerPhone)a[o.customerPhone]=1;return a;},{})).length;
    bcCnt.textContent=uniq+" clienti con numero WhatsApp nel periodo";
  }

  // Prodotti
  var pc={};
  range.forEach(function(o){
    if(!o.items)return;
    o.items.forEach(function(i){
      if(i.unit==="mista"){
        if(i.qtyKg&&parseFloat(i.qtyKg)>0){
          var k=i.productName+"__kg";
          if(!pc[k])pc[k]={name:i.productName,unit:"kg",qty:0,orders:0};
          pc[k].qty+=parseFloat(i.qtyKg);pc[k].orders++;
        }
        if(i.qtyPz&&parseFloat(i.qtyPz)>0){
          var k2=i.productName+"__pz";
          if(!pc[k2])pc[k2]={name:i.productName,unit:"pz",qty:0,orders:0};
          pc[k2].qty+=parseFloat(i.qtyPz);pc[k2].orders++;
        }
        return;
      }
      if(!pc[i.productName])pc[i.productName]={name:i.productName,unit:i.unit,qty:0,orders:0};
      pc[i.productName].qty+=parseFloat(i.qty||0);
      pc[i.productName].orders++;
    });
  });
  var prodList=Object.values(pc).sort(function(a,b){
    if(a.name===b.name)return a.unit==="kg"?-1:1;
    return b.qty-a.qty;
  });
  var rangeLabel=nDays===1?GF[getDow(stFrom)]+" "+fmtDate(stFrom):fmtDate(stFrom)+" – "+fmtDate(stTo);

  var pp=document.getElementById("st-products");
  if(pp){
    if(stSection!=="prodotti"){pp.style.display="none";}
    else if(!prodList.length){
      pp.innerHTML="<div class='empty' style='padding:18px 0'><div class='empty-ico' style='font-size:28px'>📦</div><div>Nessun dato nel periodo</div></div>";
    } else {
      var maxQty=prodList[0].qty||1;
      var h="<div class='card'>";
      h+="<div style='font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--txl);margin-bottom:10px'>🏆 Prodotti – "+rangeLabel+"</div>";
      // Merge mista pairs for ranking number
      var rankIdx=0;var lastRankName="";
      prodList.forEach(function(p,i){
        var qFmt=p.unit==="kg"?p.qty.toFixed(3).replace(".",","):Math.round(p.qty).toString();
        var barW=Math.round((p.qty/maxQty)*100);
        var isLast=i===prodList.length-1;
        var isOpen=stChartProduct===p.name;
        var nextSame=!isLast&&prodList[i+1]&&prodList[i+1].name===p.name;
        var prevSame=i>0&&prodList[i-1]&&prodList[i-1].name===p.name;
        if(!prevSame){rankIdx++;lastRankName=p.name;}
        var borderStyle=isLast||nextSame?"":"border-bottom:1px solid var(--cd)";
        h+="<div data-pname='"+p.name.replace(/'/g,"&#39;")+"' onclick='stToggleChart(this.dataset.pname)' style='padding:"+(prevSame?"4px":"10px")+" 0 10px;"+(borderStyle)+";cursor:pointer'>";
        h+="<div style='display:flex;align-items:center;gap:8px;margin-bottom:5px'>";
        if(!prevSame){
          h+="<span style='font-size:13px;font-weight:700;color:var(--t);width:20px;text-align:right'>"+rankIdx+".</span>";
          h+="<span style='flex:1;font-size:13px;font-weight:600'>"+p.name+"</span>";
        } else {
          h+="<span style='width:20px'></span>";
          h+="<span style='flex:1'></span>";
        }
        h+="<span style='font-size:14px;font-weight:700;color:var(--br)'>"+qFmt+"</span>";
        h+="<span style='font-size:11px;color:var(--txl);width:22px'>"+p.unit+"</span>";
        if(!prevSame)h+="<span style='font-size:14px;color:var(--txl);transition:transform .2s;display:inline-block;"+(isOpen?"transform:rotate(180deg)":"")+"'>▾</span>";
        h+="</div>";
        h+="<div style='margin-left:28px;display:flex;align-items:center;gap:6px'>";
        h+="<div style='flex:1;height:6px;background:var(--cd);border-radius:3px;overflow:hidden'>";
        h+="<div style='height:100%;width:"+barW+"%;background:var(--t);border-radius:3px'></div></div>";
        h+="<span style='font-size:10px;color:var(--txl);white-space:nowrap'>"+p.orders+" ord.</span>";
        h+="</div>";
        // grafico inline + pulsante WA se aperto
        if(isOpen){
          h+="<div style='margin-top:10px'>"+stBuildChart(p.name,p.unit)+"</div>";
          // clienti che hanno acquistato questo prodotto nel periodo
          var prodBuyers={};
          range.forEach(function(o){
            if(!o.items||!o.customerPhone)return;
            if(o.items.some(function(i){return i.productName===p.name;})){
              prodBuyers[o.customerId||o.customerName]={name:o.customerName,phone:o.customerPhone};
            }
          });
          var buyerList=Object.values(prodBuyers);
          var waPromo="Ciao! 🌾 Questa settimana in laboratorio prepariamo "+p.name+" — e lo abbiamo messo in promozione speciale per te! Vuoi che te ne metta da parte un po'? 😊";
          h+="<div style='background:var(--cr);border-radius:var(--rs);padding:10px;margin-top:8px'>";
          h+="<div style='font-size:11px;color:var(--txl);margin-bottom:8px'><b style='color:var(--br)'>"+buyerList.length+"</b> clienti hanno acquistato questo prodotto nel periodo</div>";
          if(buyerList.length){
            h+="<div style='display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px'>";
            buyerList.forEach(function(b){
              h+="<span style='background:var(--cd);border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700;color:var(--br)'>"+b.name.split(" ")[0]+"</span>";
            });
            h+="</div>";
            // pulsante unico che apre WA per ogni cliente in sequenza
            window._promoList=buyerList.map(function(b){return {n:b.name,p:b.phone};});
            window._promoProduct=p.name;
            h+="<button type='button' onclick='event.stopPropagation();stSendPromoAll(window._promoList,window._promoProduct)' class='btn btn-g btn-sm' style='width:100%;font-size:12px'>💬 Invia promozione a tutti ("+buyerList.length+")</button>";
          }
          h+="</div>";
        }
        h+="</div>";
      });
      h+="</div>";
      pp.innerHTML=h;
      pp.style.display="block";
    }
  }
  // aggiorna la sezione attiva se non è prodotti
  if(stSection==="clienti")renderCustomerStats();
}

/* ── sezione attiva ── */
function stSetSection(s){
  stSection=s;
  stChartProduct=null;
  ["prodotti","clienti"].forEach(function(k){
    var btn=document.getElementById("stt-"+k);
    var panel=document.getElementById("st-"+(k==="prodotti"?"products":"customers"));
    var on=k===s;
    if(btn){btn.style.background=on?"var(--t)":"var(--cd)";btn.style.color=on?"#fff":"var(--txl)";}
    if(panel)panel.style.display=on?"block":"none";
  });
  if(s==="clienti")renderCustomerStats();
}

/* ── CLIENTI ── */
function renderCustomerStats(){
  var range=stOrdersInRange();
  var nDays=stDayCount();
  var rangeLabel=nDays===1?GF[getDow(stFrom)]+" "+fmtDate(stFrom):fmtDate(stFrom)+" – "+fmtDate(stTo);
  var el=document.getElementById("st-customers");
  if(!el)return;

  // Aggrega per cliente
  var cc={};
  range.forEach(function(o){
    var id=o.customerId||o.customerName;
    if(!cc[id])cc[id]={id:id,name:o.customerName,phone:o.customerPhone||"",orders:[],fat:0,products:{}};
    cc[id].orders.push(o);
    if(o.importo)cc[id].fat+=parseFloat(o.importo||0);
    if(o.items)o.items.forEach(function(i){
      if(!cc[id].products[i.productName])cc[id].products[i.productName]={name:i.productName,unit:i.unit,qty:0};
      cc[id].products[i.productName].qty+=parseFloat(i.qty||0);
    });
  });

  var cList=Object.values(cc).sort(function(a,b){return b.orders.length-a.orders.length;});
  if(!cList.length){el.innerHTML="<div class='empty' style='padding:18px 0'><div class='empty-ico' style='font-size:28px'>👥</div><div>Nessun dato nel periodo</div></div>";return;}

  // Calcola recency (ultima data ordine), frequency (n. ordini), monetary (fatturato) – RFM semplificato
  var maxF=Math.max.apply(null,cList.map(function(c){return c.orders.length;}));
  var today=new Date(todayStr());

  var h="<div class='card' style='margin-bottom:10px'>";
  h+="<div style='font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--txl);margin-bottom:2px'>👥 Clienti – "+rangeLabel+"</div>";
  h+="<div style='font-size:11px;color:var(--txl);margin-bottom:12px'>"+cList.length+" clienti attivi · tocca per vedere lo storico</div>";

  cList.forEach(function(c,ci){
    var lastDate=c.orders.map(function(o){return o.date;}).sort().slice(-1)[0];
    var daysSince=Math.round((today-new Date(lastDate))/86400000);
    var recencyLabel=daysSince===0?"oggi":daysSince===1?"ieri":daysSince+"g fa";
    var recencyColor=daysSince<=3?"#3A7A2A":daysSince<=14?"#E65100":"#999";
    var barW=Math.round((c.orders.length/maxF)*100);
    var isOpen=stCustOpen===c.id;
    var isLast=ci===cList.length-1;

    // Prodotto preferito
    var favProd=Object.values(c.products).sort(function(a,b){return b.qty-a.qty;})[0];
    var favLabel=favProd?(favProd.name.split(" ").slice(0,2).join(" ")):"–";

    h+="<div data-cid='"+c.id+"' onclick='stToggleCust(this.dataset.cid)' style='padding:10px 0;"+(isLast?"":"border-bottom:1px solid var(--cd)")+";cursor:pointer'>";
    // riga principale
    h+="<div style='display:flex;align-items:center;gap:8px;margin-bottom:5px'>";
    h+="<div style='width:32px;height:32px;border-radius:50%;background:var(--cd);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:var(--br);flex-shrink:0'>"+(c.name.charAt(0).toUpperCase())+"</div>";
    h+="<div style='flex:1;min-width:0'>";
    h+="<div style='font-size:13px;font-weight:700;color:var(--br);white-space:nowrap;overflow:hidden;text-overflow:ellipsis'>"+c.name+"</div>";
    h+="<div style='font-size:11px;color:var(--txl)'>Preferisce: <b>"+favLabel+"</b></div>";
    h+="</div>";
    h+="<div style='text-align:right;flex-shrink:0'>";
    h+="<div style='font-size:13px;font-weight:700;color:var(--t)'>"+c.orders.length+" ord.</div>";
    h+="<div style='font-size:10px;font-weight:700;color:"+recencyColor+"'>"+recencyLabel+"</div>";
    h+="</div>";
    h+="<span style='font-size:13px;color:var(--txl);display:inline-block;"+(isOpen?"transform:rotate(180deg)":"")+"'>▾</span>";
    h+="</div>";
    // barra frequenza
    h+="<div style='display:flex;align-items:center;gap:6px;margin-bottom:"+(isOpen?8:0)+"px'>";
    h+="<div style='flex:1;height:4px;background:var(--cd);border-radius:2px;overflow:hidden'><div style='height:100%;width:"+barW+"%;background:var(--t);border-radius:2px'></div></div>";
    h+="<span style='font-size:10px;color:var(--txl);white-space:nowrap'>€"+c.fat.toFixed(0)+"</span>";
    h+="</div>";

    // dettaglio espanso
    if(isOpen){
      var prods=Object.values(c.products).sort(function(a,b){return b.qty-a.qty;});
      var allOrds=c.orders.slice().sort(function(a,b){return a.date>b.date?-1:1;});
      h+="<div style='background:var(--cr);border-radius:var(--rs);padding:10px;margin-top:4px'>";
      // prodotti acquistati
      h+="<div style='font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--txl);margin-bottom:6px'>Prodotti acquistati</div>";
      var maxPQ=prods[0]?prods[0].qty:1;
      prods.forEach(function(p){
        var pFmt=p.unit==="kg"?p.qty.toFixed(3).replace(".",","):Math.round(p.qty).toString();
        var pw2=Math.round((p.qty/maxPQ)*100);
        h+="<div style='display:flex;align-items:center;gap:6px;margin-bottom:5px'>";
        h+="<span style='flex:1;font-size:12px'>"+p.name+"</span>";
        h+="<div style='width:60px;height:5px;background:#e0d0be;border-radius:3px;overflow:hidden'><div style='height:100%;width:"+pw2+"%;background:var(--t);border-radius:3px'></div></div>";
        h+="<span style='font-size:11px;font-weight:700;color:var(--br);width:56px;text-align:right'>"+pFmt+" "+p.unit+"</span>";
        h+="</div>";
      });
      // ultimi ordini
      h+="<div style='font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--txl);margin:10px 0 6px'>Ultimi ordini</div>";
      allOrds.slice(0,5).forEach(function(o){
        var items=o.items?o.items.map(function(i){return i.productName.split(" ")[0]+" "+i.qty+i.unit;}).join(", "):"";
        h+="<div style='display:flex;gap:8px;font-size:11px;padding:4px 0;border-bottom:1px solid #e8d8c4;align-items:flex-start'>";
        h+="<span style='color:var(--txl);white-space:nowrap'>"+fmtDate(o.date)+"</span>";
        h+="<span style='flex:1;color:var(--tx)'>"+items+"</span>";
        h+="<span style='font-weight:700;color:var(--t);white-space:nowrap'>"+(o.importo?"€"+o.importo:"")+"</span>";
        h+="</div>";
      });
      // WA marketing
      if(c.phone){
        var lastProd=favProd?favProd.name:"i nostri prodotti";
        var waText="Ciao "+c.name.split(" ")[0]+"! 🌾 Questa settimana in laboratorio prepariamo "+lastProd+" — come cliente affezionata ti avvisiamo in anteprima prima che finiscano. Vuoi che te ne metta da parte un po'? 😊";
        h+="<button onclick=\"event.stopPropagation();openWA('"+c.phone+"','"+waText.replace(/'/g,"\\'")+"')\" class='btn btn-g btn-sm' style='margin-top:10px;width:100%'>💬 Invia promozione WhatsApp</button>";
      }
      h+="</div>";
    }
    h+="</div>";
  });
  h+="</div>";

  // Clienti a rischio abbandono (non ordinano da >30 gg)
  var allCust={};
  orders.forEach(function(o){
    var id=o.customerId||o.customerName;
    if(!allCust[id]||o.date>allCust[id].lastDate)allCust[id]={name:o.customerName,phone:o.customerPhone||"",lastDate:o.date,count:(allCust[id]?allCust[id].count:0)+1};
    else allCust[id].count++;
  });
  var atRisk=Object.values(allCust).filter(function(c){
    return Math.round((today-new Date(c.lastDate))/86400000)>30;
  }).sort(function(a,b){return a.lastDate<b.lastDate?-1:1;}).slice(0,10);

  if(atRisk.length){
    h+="<div class='card'>";
    h+="<div style='font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--txl);margin-bottom:4px'>⚠️ Clienti da riconquistare</div>";
    h+="<div style='font-size:11px;color:var(--txl);margin-bottom:10px'>Non ordinano da più di 30 giorni</div>";
    atRisk.forEach(function(c,ci){
      var ds=Math.round((today-new Date(c.lastDate))/86400000);
      var isLast=ci===atRisk.length-1;
      h+="<div style='display:flex;align-items:center;gap:8px;padding:8px 0;"+(isLast?"":"border-bottom:1px solid var(--cd)")+"'>";
      h+="<div style='width:30px;height:30px;border-radius:50%;background:#fce8e6;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#C0392B;flex-shrink:0'>"+c.name.charAt(0).toUpperCase()+"</div>";
      h+="<div style='flex:1'><div style='font-size:13px;font-weight:700'>"+c.name+"</div><div style='font-size:10px;color:#C0392B;font-weight:700'>"+ds+" giorni fa</div></div>";
      if(c.phone){
        var waR="Ciao "+c.name.split(" ")[0]+"! 👋 Ci manchi! Torna a trovarci per scoprire le novità di stagione 🍝";
        h+="<button onclick=\"openWA('"+c.phone+"','"+waR.replace(/'/g,"\\'")+"')\" class='btn btn-g btn-sm' style='font-size:11px'>💬 WA</button>";
      }
      h+="</div>";
    });
    h+="</div>";
  }

  el.innerHTML=h;
}
function stToggleCust(id){
  stCustOpen=(stCustOpen===id)?null:id;
  renderCustomerStats();
  if(stCustOpen){
    setTimeout(function(){
      var el=document.querySelector("[data-cid='"+stCustOpen+"']");
      if(el){var c=document.getElementById("content");c.scrollTop=el.offsetTop-80;}
    },40);
  }
}

/* ── PRODUZIONE ── */
function stToggleChart(name){
  stChartProduct=(stChartProduct===name)?null:name;
  renderStats();
  if(stChartProduct){
    setTimeout(function(){
      var el=document.querySelector("[data-pname='"+stChartProduct.replace(/'/g,"&#39;")+"']");
      if(el){var c=document.getElementById("content");c.scrollTop=el.offsetTop-80;}
    },40);
  }
}

function stSendPromoAll(buyers, prodName){
  if(!buyers||!buyers.length)return;
  var i=0;
  function sendNext(){
    if(i>=buyers.length)return;
    var b=buyers[i++];
    var msg="Ciao "+b.n.split(" ")[0]+"! 🌾 Questa settimana in laboratorio prepariamo "+prodName+" — e lo abbiamo messo in promozione speciale per te! Vuoi che te ne metta da parte un po'? 😊";
    openWA(b.p, msg);
    if(i<buyers.length) setTimeout(sendNext, 800);
  }
  sendNext();
}

function stBroadcast(){
  var txt=(document.getElementById("st-broadcast-txt").value||"").trim();
  if(!txt){showToast("Scrivi prima il messaggio!");return;}
  var range=stOrdersInRange();
  var seen={};
  var list=[];
  range.forEach(function(o){
    if(o.customerPhone&&!seen[o.customerPhone]){
      seen[o.customerPhone]=1;
      list.push({name:o.customerName,phone:o.customerPhone});
    }
  });
  if(!list.length){showToast("Nessun cliente con numero nel periodo");return;}
  if(!confirm("Inviare il messaggio a "+list.length+" clienti via WhatsApp?"))return;
  var i=0;
  function sendNext(){
    if(i>=list.length)return;
    var c=list[i++];
    var personalised=txt.replace(/\{nome\}/gi,c.name.split(" ")[0]);
    openWA(c.phone, personalised);
    if(i<list.length) setTimeout(sendNext, 800);
  }
  sendNext();
}

function stBuildChart(prodName, unit){
  // Costruisce dati giornalieri per il prodotto nell'intervallo
  var range=stOrdersInRange();
  var nDays=stDayCount();

  // Raggruppa per data
  var byDate={};
  var d=stFrom;
  while(d<=stTo){byDate[d]=0;d=addDays(d,1);}
  range.forEach(function(o){
    if(!o.items)return;
    o.items.forEach(function(i){
      if(i.productName===prodName)byDate[o.date]=(byDate[o.date]||0)+parseFloat(i.qty||0);
    });
  });

  var labels=Object.keys(byDate).sort();
  var vals=labels.map(function(k){return byDate[k];});
  var maxV=Math.max.apply(null,vals)||1;
  var total=vals.reduce(function(s,v){return s+v;},0);
  var avg=total/nDays;

  // SVG line chart
  var W=320, H=90, PL=8, PR=8, PT=8, PB=20;
  var cW=W-PL-PR, cH=H-PT-PB;
  var n=labels.length;
  if(n<2){
    // solo un punto – barra singola
    var v=vals[0]||0;
    var vFmt=unit==="kg"?v.toFixed(3).replace(".",","):Math.round(v).toString();
    return "<div style='text-align:center;padding:10px;background:var(--cr);border-radius:var(--rs);font-size:13px;color:var(--txl)'>"+vFmt+" "+unit+" in data "+fmtDate(labels[0])+"</div>";
  }

  // Punti
  var pts=labels.map(function(l,i){
    var x=PL+(i/(n-1))*cW;
    var y=PT+(1-(vals[i]/maxV))*cH;
    return {x:x,y:y,v:vals[i],d:l};
  });

  // Linea e area
  var linePath="M"+pts.map(function(p){return p.x.toFixed(1)+","+p.y.toFixed(1);}).join("L");
  var areaPath=linePath+"L"+pts[pts.length-1].x.toFixed(1)+","+(PT+cH)+"L"+pts[0].x.toFixed(1)+","+(PT+cH)+"Z";

  // Linea media
  var avgY=(PT+(1-(avg/maxV))*cH).toFixed(1);

  // Etichette asse X: mostra solo prima, ultima e ogni ~5° punto se molti
  var xLabels="";
  var step=nDays<=14?1:nDays<=60?7:30;
  labels.forEach(function(l,i){
    var show=(i===0||i===n-1||(nDays>1&&i%Math.max(1,Math.floor(n/4))===0));
    if(!show)return;
    var x=PL+(i/(n-1))*cW;
    var lbl=nDays<=31?fmtDate(l).slice(0,5):fmtDate(l).slice(0,5);
    xLabels+="<text x='"+x.toFixed(1)+"' y='"+(H-4)+"' text-anchor='middle' font-size='8' fill='#7A5C45'>"+lbl+"</text>";
  });

  // Etichetta max e totale
  var totalFmt=unit==="kg"?total.toFixed(3).replace(".",","):Math.round(total).toString();
  var avgFmt=unit==="kg"?avg.toFixed(3).replace(".",","):avg.toFixed(1);

  var svg="<svg viewBox='0 0 "+W+" "+H+"' style='width:100%;height:auto;overflow:visible'>"+
    "<defs><linearGradient id='stG' x1='0' y1='0' x2='0' y2='1'><stop offset='0%' stop-color='#C4622D' stop-opacity='.25'/><stop offset='100%' stop-color='#C4622D' stop-opacity='0'/></linearGradient></defs>"+
    // area
    "<path d='"+areaPath+"' fill='url(#stG)'/>"+
    // linea media tratteggiata
    "<line x1='"+PL+"' y1='"+avgY+"' x2='"+(W-PR)+"' y2='"+avgY+"' stroke='#D4A853' stroke-width='1' stroke-dasharray='3,3'/>"+
    // linea principale
    "<path d='"+linePath+"' fill='none' stroke='#C4622D' stroke-width='2' stroke-linejoin='round' stroke-linecap='round'/>"+
    // punti
    pts.map(function(p){
      return "<circle cx='"+p.x.toFixed(1)+"' cy='"+p.y.toFixed(1)+"' r='3' fill='#C4622D' stroke='#fff' stroke-width='1.5'/>";
    }).join("")+
    // etichette X
    xLabels+
    "</svg>";

  return "<div style='background:var(--cr);border-radius:var(--rs);padding:10px 8px 4px'>"+
    "<div style='display:flex;justify-content:space-between;margin-bottom:6px'>"+
    "<span style='font-size:10px;color:var(--txl)'>Media/giorno: <b style=\"color:var(--br)\">"+avgFmt+" "+unit+"</b></span>"+
    "<span style='font-size:10px;color:var(--txl)'>Totale: <b style=\"color:var(--t)\">"+totalFmt+" "+unit+"</b></span>"+
    "</div>"+svg+"</div>";
}

function renderCalStats(){
  if(curTab==="stats")renderStats();
}

/* ════ CALENDARIO INLINE ORDINI ════ */
var orCalOpen=false;
function orToggleCal(){
  orCalOpen=!orCalOpen;
  var cal=document.getElementById("or-cal");
  var hint=document.getElementById("or-cal-hint");
  if(cal)cal.style.display=orCalOpen?"block":"none";
  if(hint)hint.textContent=orCalOpen?"📅 chiudi":"📅 calendario";
  if(orCalOpen){selDate=orDate;renderCalendar();}
}
function orShift(n){
  orDate=addDays(orDate,n);selDate=orDate;orFilterPV=_isAdmin()?"tutti":(_userPV()||"tutti");orShowRitirati=false;
  if(orCalOpen){orCalOpen=false;var cal=document.getElementById("or-cal");if(cal)cal.style.display="none";var hint=document.getElementById("or-cal-hint");if(hint)hint.textContent="📅 calendario";}
  renderOrdini();if(orTotaliOpen)renderTotali();
}
function orSearch(q){
  document.getElementById("or-clr").style.display=q?"":"none";
  if(!q.trim()){document.getElementById("or-results").style.display="none";document.getElementById("or-main").style.display="";return;}
  document.getElementById("or-main").style.display="none";
  document.getElementById("or-results").style.display="";
  const lq=q.toLowerCase();
  const res=_filterOrdersByRole(orders).filter(o=>(o.customerName&&o.customerName.toLowerCase().includes(lq))||(o.items&&o.items.some(i=>i.productName.toLowerCase().includes(lq)))||(o.pv&&o.pv.toLowerCase().includes(lq)));
  document.getElementById("or-results").innerHTML="<div style='font-size:13px;color:var(--txl);margin-bottom:10px'>"+res.length+" risultati</div>"+res.map(o=>orderCardHTML(o,true)).join("");
}
function orClear(){document.getElementById("or-q").value="";orSearch("");}
function doPrint(){
  const day=orders.filter(o=>o.date===orDate);
  const pw=window.open("","_blank");
  let h="<html><head><title>Ordini "+fmtDate(orDate)+"</title><style>body{font-family:Arial;padding:20px}h1{font-size:18px;margin-bottom:14px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:7px;font-size:12px;text-align:left}th{background:#f5e8d5}</style></head><body>";
  h+="<h1>"+GF[getDow(orDate)]+" "+fmtDate(orDate)+"</h1>";
  h+="<table><tr><th>Nome</th><th>Punto Vendita</th><th>Telefono</th><th>Prodotti</th><th>Note</th><th>Orario</th></tr>";
  day.forEach(o=>{
    const pr=o.items?o.items.map(function(it){return _fmtItemText(it);}).join(" ; "):"";
    const orr=o.consegna?"Consegna "+(o.orarioConsegna||""):(o.orarioRitiro||"");
    h+="<tr><td>"+o.customerName+"</td><td>"+o.pv+"</td><td>"+(o.customerPhone||"")+"</td><td>"+pr+"</td><td>"+(o.notes||"")+"</td><td>"+orr+"</td></tr>";
  });
  h+="</table></body></html>";
  pw.document.write(h);pw.document.close();pw.print();
}

/* ════ PRODUCTS ════ */
/* ════ DRAG & DROP ════ */
var _drag={active:false,el:null,ghost:null,type:null,id:null,startY:0,lastY:0,scrollTimer:null};

function _dragClean(){
  if(_drag.ghost&&_drag.ghost.parentNode)_drag.ghost.parentNode.removeChild(_drag.ghost);
  if(_drag.el){_drag.el.style.opacity="";_drag.el.style.transform="";}
  document.querySelectorAll("._drag-over").forEach(function(e){e.classList.remove("_drag-over");});
  clearInterval(_drag.scrollTimer);
  _drag={active:false,el:null,ghost:null,type:null,id:null,startY:0,lastY:0,scrollTimer:null};
}

function _dragStart(e,type,id){
  var touch=e.touches?e.touches[0]:e;
  var el=e.currentTarget.closest ? (e.currentTarget.closest("[data-drag-id]")||e.currentTarget) : e.currentTarget;
  _drag.active=true;_drag.type=type;_drag.id=id;
  _drag.el=el;_drag.startY=touch.clientY;_drag.lastY=touch.clientY;
  var rect=el.getBoundingClientRect();
  var ghost=el.cloneNode(true);
  ghost.style.cssText="position:fixed;left:"+rect.left+"px;top:"+rect.top+"px;width:"+rect.width+"px;opacity:.88;pointer-events:none;z-index:9999;box-shadow:0 8px 30px rgba(92,51,23,.32);transform:scale(1.03);border-radius:var(--r)";
  document.body.appendChild(ghost);
  _drag.ghost=ghost;
  el.style.opacity="0.3";
  var content=document.getElementById("content");
  _drag.scrollTimer=setInterval(function(){
    if(!_drag.active)return;
    var y=_drag.lastY,wh=window.innerHeight;
    if(y>wh-90)content.scrollTop+=12;
    else if(y<160)content.scrollTop-=12;
  },30);
  e.preventDefault();
}

function _dragMove(e){
  if(!_drag.active)return;
  var touch=e.touches?e.touches[0]:e;
  var dy=touch.clientY-_drag.startY;
  _drag.lastY=touch.clientY;
  if(_drag.ghost)_drag.ghost.style.transform="scale(1.03) translateY("+dy+"px)";
  document.querySelectorAll("._drag-over").forEach(function(el){el.classList.remove("_drag-over");});
  var target=document.elementFromPoint(touch.clientX,touch.clientY);
  if(!target)return;
  var dropEl=target.closest?target.closest("[data-drag-id]"):null;
  if(dropEl&&dropEl!==_drag.el&&dropEl.dataset.dragType===_drag.type)dropEl.classList.add("_drag-over");
  e.preventDefault();
}

function _dragEnd(e){
  if(!_drag.active)return;
  e.preventDefault();
  window._dragJustEnded=true;
  setTimeout(function(){window._dragJustEnded=false;},300);
  var touch=e.changedTouches?e.changedTouches[0]:e;
  var target=document.elementFromPoint(touch.clientX,touch.clientY);
  if(target){
    var dropEl=target.closest?target.closest("[data-drag-id]"):null;
    if(dropEl&&dropEl!==_drag.el&&dropEl.dataset.dragType===_drag.type){
      var toId=dropEl.dataset.dragId;
      if(_drag.type==="cat"){
        var fi=categories.findIndex(function(c){return c.id===_drag.id;});
        var ti=categories.findIndex(function(c){return c.id===toId;});
        if(fi>-1&&ti>-1){var tmp=categories.splice(fi,1)[0];categories.splice(ti,0,tmp);lsSet("pf_cats",categories);}
      } else if(_drag.type==="order"){
        // Riordina le schede ordine: sposta l'ordine draggato prima/dopo il target
        var fromOrd=orders.find(function(o){return o.id===_drag.id;});
        var toOrd=orders.find(function(o){return o.id===toId;});
        if(fromOrd&&toOrd&&fromOrd.stato===toOrd.stato){
          // Prendi tutti gli ordini dello stesso stato/giorno/pv, ordinati per manualOrder
          var stato=fromOrd.stato||"nuovo";
          var grpAll=orders.filter(function(o){
            return o.date===orDate&&(orFilterPV==="tutti"||_normPV(o.pv)===orFilterPV)&&(o.stato||"nuovo")===stato;
          }).slice().sort(function(a,b){
            return (a.manualOrder!=null?a.manualOrder:99999)-(b.manualOrder!=null?b.manualOrder:99999);
          });
          // Rimuovi il dragged e inseriscilo prima del target
          var fromIdx=grpAll.findIndex(function(o){return o.id===_drag.id;});
          var toIdx=grpAll.findIndex(function(o){return o.id===toId;});
          if(fromIdx>-1&&toIdx>-1){
            var moved=grpAll.splice(fromIdx,1)[0];
            var insertAt=toIdx>fromIdx?toIdx-1:toIdx;
            grpAll.splice(insertAt,0,moved);
            window._savingOrder=true;
            grpAll.forEach(function(o,i){
              var ord=orders.find(function(x){return x.id===o.id;});
              if(ord){ord.manualOrder=i;lsSetOrder(ord);}
            });
            setTimeout(function(){window._savingOrder=false;},5000);
          }
        }
      } else {
        var fi=products.findIndex(function(p){return p.id===_drag.id;});
        var ti=products.findIndex(function(p){return p.id===toId;});
        if(fi>-1&&ti>-1){var tmp=products.splice(fi,1)[0];products.splice(ti,0,tmp);lsSet("pf_products",products);}
      }
    }
  }
  var wasOrder=_drag.type==="order";
  _dragClean();
  if(wasOrder)renderOrdini();
  else renderProducts();
}

function renderProducts(){
  document.getElementById("pr-cnt").textContent=products.length+" prodotti · "+categories.length+" categorie";
  const el=document.getElementById("pr-list");
  if(products.length===0){el.innerHTML="<div class='empty'><div class='empty-ico'>🍝</div><div>Nessun prodotto</div></div>";return;}
  el.innerHTML="";
  if(!document.getElementById("_drag-style")){
    var st=document.createElement("style");st.id="_drag-style";
    st.textContent="._drag-over{outline:2.5px dashed var(--t)!important;outline-offset:3px;background:var(--cd)!important;border-radius:var(--r)}";
    document.head.appendChild(st);
  }
  // Filtro per nome prodotto dalla casella di ricerca
  var prQ=(document.getElementById("pr-q")||{value:""}).value.toLowerCase().trim();
  var visibleProds=prQ?products.filter(function(p){return (p.name||"").toLowerCase().indexOf(prQ)>-1;}):products;
  if(visibleProds.length===0){el.innerHTML="<div class='empty'><div class='empty-ico'>🔍</div><div>Nessun prodotto trovato per \""+prQ+"\"</div></div>";return;}
  const groups=categories.map(function(c){
    return {cat:c,prods:visibleProds.filter(function(p){return p.catId===c.id;})};
  });
  const noCat=visibleProds.filter(function(p){return !p.catId||!categories.find(function(c){return c.id===p.catId;});});
  if(noCat.length)groups.push({cat:{id:"",name:"Senza categoria",icon:"📦"},prods:noCat});
  groups.forEach(function(g){
    if(g.prods.length===0)return;
    var section=document.createElement("div");
    if(g.cat.id){section.dataset.dragId=g.cat.id;section.dataset.dragType="cat";section.style.borderRadius="var(--r)";}
    var hdr=document.createElement("div");
    hdr.style.cssText="display:flex;align-items:center;justify-content:space-between;margin:14px 0 6px;padding:0 2px";
    var handleH=g.cat.id?"<span style='font-size:17px;color:var(--txl);padding:4px 8px 4px 0;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;flex-shrink:0' class='_drag-handle-cat'>⠿</span>":"";
    var editBtns=g.cat.id&&_isAdmin()
      ? "<div style='display:flex;gap:5px'>"+
          "<button class='btn btn-s btn-sm' data-cid='"+g.cat.id+"' onclick='openCatForm(this.dataset.cid)'>✏️</button>"+
          "<button class='btn btn-d btn-sm' data-cid='"+g.cat.id+"' onclick='delCat(this.dataset.cid)'>🗑️</button>"+
        "</div>"
      : "";
    hdr.innerHTML=
      "<div style='display:flex;align-items:center;gap:6px;flex:1'>"+
        handleH+
        "<span style='font-size:20px'>"+g.cat.icon+"</span>"+
        "<span style='font-weight:700;font-size:15px;color:var(--br)'>"+g.cat.name+"</span>"+
        "<span style='font-size:11px;color:var(--txl)'>("+g.prods.length+")</span>"+
      "</div>"+editBtns;
    if(g.cat.id){
      (function(catId,sec){
        var h=hdr.querySelector("._drag-handle-cat");
        if(h){
          h.addEventListener("touchstart",function(ev){_dragStart(ev,"cat",catId);sec.style.opacity="0.3";},{passive:false});
          h.addEventListener("mousedown",function(ev){_dragStart(ev,"cat",catId);});
        }
      })(g.cat.id,section);
    }
    section.appendChild(hdr);
    g.prods.forEach(function(p){
      var card=document.createElement("div");
      card.className="card";
      card.dataset.dragId=p.id;card.dataset.dragType="prod";
      card.style.cssText="margin-bottom:7px;transition:outline .1s";
      card.innerHTML=
        "<div style='display:flex;align-items:center;gap:10px'>"+
          "<span style='font-size:17px;color:var(--txl);padding:6px 4px;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;flex-shrink:0' class='_drag-handle-prod'>⠿</span>"+
          "<span style='font-size:24px;width:34px;text-align:center'>"+p.image+"</span>"+
          "<div style='flex:1'>"+
            "<div style='font-size:14px;font-weight:700'>"+p.name+"</div>"+
            (p.shortName&&p.shortName.trim()?"<div style='font-size:12px;color:var(--txl);font-style:italic;margin-top:1px'>→ "+p.shortName.trim()+"</div>":"")+
            "<div style='font-size:11px;color:var(--txl);margin-top:2px'>"+
              (p.code?"<span style='background:var(--cd);color:var(--br);font-weight:700;padding:1px 6px;border-radius:10px;margin-right:6px'>cod. "+p.code+"</span>":"<span style='color:#b6a488'>nessun codice</span>")+
              "<span>"+(p.unit||"kg")+"</span>"+
            "</div>"+
          "</div>"+
          (_isAdmin() ? "<div style='display:flex;gap:5px'>"+
            "<button class='btn btn-s btn-sm' data-pid='"+p.id+"' onclick='openProdForm(this.dataset.pid)'>✏️</button>"+
            "<button class='btn btn-d btn-sm' data-pid='"+p.id+"' onclick='delProduct(this.dataset.pid)'>🗑️</button>"+
          "</div>" : "")+
        "</div>";
      (function(pid,c){
        var h=c.querySelector("._drag-handle-prod");
        if(h){
          h.addEventListener("touchstart",function(ev){_dragStart(ev,"prod",pid);},{passive:false});
          h.addEventListener("mousedown",function(ev){_dragStart(ev,"prod",pid);});
        }
      })(p.id,card);
      section.appendChild(card);
    });
    el.appendChild(section);
  });
}
function delProduct(id){
  var p=products.find(function(x){return x.id===id;});
  if(confirm("Eliminare \""+p.name+"\"?")){
    products=products.filter(function(x){return x.id!==id;});
    lsSet("pf_products",products);lsDel("products",id);renderProducts();
  }
}
function delCat(id){
  var c=categories.find(function(x){return x.id===id;});
  if(confirm("Eliminare categoria \""+c.name+"\"?\nI prodotti rimarranno senza categoria.")){
    categories=categories.filter(function(x){return x.id!==id;});
    lsSet("pf_cats",categories);lsDel("categories",id);renderProducts();
  }
}

/* ════ CUSTOMERS ════ */
function renderCustomers(){
  const q=(document.getElementById("cl-q")||{value:""}).value.toLowerCase();
  const visibleCustomers=_filterCustomersByRole(customers);
  const sorted=[...visibleCustomers].sort((a,b)=>(a.name||'').localeCompare(b.name||'','it'));
  const fil=q?sorted.filter(c=>(c.name&&c.name.toLowerCase().includes(q))||(c.phone&&c.phone.includes(q))):sorted;
  document.getElementById("cl-cnt").textContent=visibleCustomers.length+" clienti";
  document.getElementById("cl-list").innerHTML=fil.length===0?
    "<div class='empty'><div class='empty-ico'>👥</div><div>"+(q?"Nessun risultato":"Nessun cliente")+"</div></div>":
    fil.map(c=>{
      const co=orders.filter(o=>o.customerId===c.id||o.customerName===c.name);
      return "<div class='card'>"+
        "<div style='display:flex;align-items:center;gap:10px;padding-bottom:10px;border-bottom:1px solid var(--cd)'>"+
          "<div style='width:40px;height:40px;border-radius:50%;background:var(--tl);color:#fff;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:700;flex-shrink:0'>"+c.name.charAt(0).toUpperCase()+"</div>"+
          "<div style='flex:1'><div style='font-size:15px;font-weight:700'>"+c.name+"</div>"+
          "<div style='font-size:11px;color:var(--txl)'>"+(c.phone||"Nessun telefono")+" · "+co.length+" ordini</div></div>"+
        "</div>"+
        "<div style='display:flex;gap:6px;flex-wrap:wrap;margin-top:10px'>"+
          "<button class='btn btn-s btn-sm' onclick=\"openCustForm('"+c.id+"')\">✏️ Modifica</button>"+
          "<button class='btn btn-s btn-sm' onclick=\"openCustHistory('"+c.id+"')\">📋 Storico</button>"+
          (c.phone?"<a href='tel:"+c.phone.replace(/\\D/g,'')+"' class='btn btn-sm' style='background:#2196F3;color:#fff;text-decoration:none;font-size:13px;padding:6px 10px;display:inline-flex;align-items:center;gap:4px'>📞</a>":"")+
          (c.phone?"<button class='wa-btn' style='font-size:11px;padding:6px 10px' onclick=\"openWA('"+c.phone+"','Ciao "+c.name+"!')\">💬 WA</button>":"")+
          "<button class='btn btn-d btn-sm' onclick=\"delCustomer('"+c.id+"')\">🗑️</button>"+
        "</div></div>";
    }).join("");
}
function delCustomer(id){
  const c=customers.find(x=>x.id===id);
  if(!c) return;
  // Operatore: può eliminare solo se il cliente ha ordini nel suo PV
  if(!_isAdmin()){
    const pv=_userPV();
    const hasOrderInPV=orders.some(o=>_normPV(o.pv)===pv&&(o.customerId===c.id||o.customerName===c.name));
    if(!hasOrderInPV){alert("Non hai i permessi per eliminare questo cliente.");return;}
  }
  if(confirm("Eliminare \""+c.name+"\"?")){customers=customers.filter(x=>x.id!==id);lsSet("pf_customers",customers);lsDel("customers",id);renderCustomers();}
}

/* ════ ORDER FORM — NUOVO DESIGN ════ */
let formItems=[];
let formPV=PUNTI[0];

function fToggleDel(){
  const on=document.getElementById("f-del").checked;
  document.getElementById("f-delfields").style.display=on?"block":"none";
  document.getElementById("f-ritfield").style.display=on?"none":"block";
}
// Chip mattina/pomeriggio: toggle indipendente dal time input
function fSetSlot(val){
  var matBtn=document.getElementById("f-slot-mat");
  var pomBtn=document.getElementById("f-slot-pom");
  if(!matBtn)return;
  var activeStyle="background:var(--t);color:#fff;border-color:var(--t)";
  if(val==="Mattina"){
    var active=matBtn.dataset.on!=="1";
    matBtn.dataset.on=active?"1":"";
    pomBtn.dataset.on="";
    matBtn.style.cssText=active?activeStyle:"";
    pomBtn.style.cssText="";
    window._orSlot=active?"Mattina":null;
  } else {
    var active=pomBtn.dataset.on!=="1";
    pomBtn.dataset.on=active?"1":"";
    matBtn.dataset.on="";
    pomBtn.style.cssText=active?activeStyle:"";
    matBtn.style.cssText="";
    window._orSlot=active?"Pomeriggio":null;
  }
}
function fInitSlot(val){
  var matBtn=document.getElementById("f-slot-mat");
  var pomBtn=document.getElementById("f-slot-pom");
  if(!matBtn)return;
  var activeStyle="background:var(--t);color:#fff;border-color:var(--t)";
  if(val&&val.startsWith("Mattina")){
    matBtn.dataset.on="1";matBtn.style.cssText=activeStyle;window._orSlot="Mattina";
  } else if(val&&val.startsWith("Pomeriggio")){
    pomBtn.dataset.on="1";pomBtn.style.cssText=activeStyle;window._orSlot="Pomeriggio";
  }
}
window._orSlot=null;

window._fSave=function(eid,emode){fSave(eid,emode);};
function openOrderForm(editId,defaultDate){
  const edit=editId?orders.find(o=>o.id===editId):null;
  window._pickedCustId=edit?edit.customerId||null:null; // reset: in modifica riparte dal cliente dell'ordine, in nuovo ordine da vuoto
  window._forceNewCustomer=false; // reset: annulla eventuale scelta "è un cliente nuovo" di un ordine precedente
  // Controllo permessi: operatore può modificare solo ordini del suo PV
  if(edit && !_isAdmin()){
    const pv=_userPV();
    if(edit.pv !== pv){ alert("Non hai i permessi per modificare questo ordine."); return; }
  }
  const isEdit=!!edit;
  const date=edit?edit.date:(defaultDate||todayStr());
  formItems=edit&&edit.items?JSON.parse(JSON.stringify(edit.items)).reduce(function(acc,it){
    // Compatibilità con vecchio formato mista: espande in due voci separate per kg e pz
    if(it.unit==="mista"){
      if(it.qtyKg&&parseFloat(it.qtyKg)>0)acc.push({productId:it.productId,productName:it.productName,qty:it.qtyKg,unit:"kg",confezioni:it.confezioniKg&&it.confezioniKg.length>0?it.confezioniKg.map(function(c){return {qty:c.qty||c,unit:"kg"};}):[{qty:it.qtyKg,unit:"kg"}]});
      if(it.qtyPz&&parseFloat(it.qtyPz)>0){
        var pid2=acc.find(function(x){return x.productId===it.productId;})?it.productId+"__pz_tmp":it.productId;
        acc.push({productId:it.productId+"__pz_tmp",_realPid:it.productId,productName:it.productName,qty:it.qtyPz,unit:"pz",confezioni:it.confezioniPz&&it.confezioniPz.length>0?it.confezioniPz.map(function(c){return {qty:c.qty||c,unit:"pz"};}):[{qty:it.qtyPz,unit:"pz"}]});
      }
    } else {
      // Normalizza unit: se mancante usa kg
      var u=it.unit||"kg";
      var item=Object.assign({},it,{unit:u});
      if(item.confezioni)item.confezioni=item.confezioni.map(function(c){return typeof c==="object"?{qty:c.qty||"",unit:c.unit||u}:{qty:c,unit:u};});
      acc.push(item);
    }
    return acc;
  },[]):[];
  formPV=edit?edit.pv:(_isAdmin()?PUNTI[0]:(_userPV()||PUNTI[0]));

  _detailMode=false;
  function render(){
    if(_is15()){ renderOrder15(edit,isEdit,date); return; }
    const pvBtns=_isAdmin()
      ? PUNTI.map(p=>
          "<button type='button' class='pv-sel-btn"+(formPV===p?" on":"")+"' onclick=\"formSetPV('"+p+"')\">"+p+"</button>"
        ).join("")
      : "<button type='button' class='pv-sel-btn on' style='cursor:default'>"+formPV+"</button>";

    const itemsHTML=formItems.length===0?
      "<div style='font-size:13px;color:var(--txl);padding:6px 0'>Nessun prodotto aggiunto</div>":
      formItems.map((it,i)=>
        "<div class='prod-row'><span style='flex:1;font-size:14px'>"+it.productName+"</span>"+
        "<span style='font-weight:700;color:var(--t)'>"+it.qty+" "+it.unit+"</span>"+
        "<button class='btn btn-d btn-sm' style='margin-left:8px' onclick='fRemItem("+i+")'>✕</button></div>"
      ).join("");

    const prodsOpts=products.map(p=>"<option value='"+p.id+"'>"+p.name+" ("+p.unit+")</option>").join("");

    const prodGridHTML="";

    showModal(
      "<div class='sheet-hd'></div>"+
      "<div style='display:flex;align-items:center;gap:10px;margin-bottom:14px'>"+
        "<button type='button' id='hw-open-btn' onclick='hwOpen()' title='Scrivi a mano' style='display:none;align-items:center;justify-content:center;width:38px;height:38px;min-width:38px;background:linear-gradient(135deg,#C4622D,#5C3317);color:#fff;border:none;border-radius:10px;font-size:20px;line-height:1;cursor:pointer;box-shadow:0 2px 8px rgba(92,51,23,.25)'>"+
          "✍️"+
        "</button>"+
        "<div class='sheet-ti' style='margin-bottom:0'>"+(isEdit?"Modifica Ordine":"Nuovo Ordine")+"</div>"+
      "</div>"+

      "<div class='fg'><label class='lbl'>Data</label>"+
      "<input type='date' class='inp' id='f-date' value='"+date+"'></div>"+

      "<div class='fg' style='position:relative'><label class='lbl'>Cliente</label>"+
      "<input class='inp' id='f-name' placeholder='Nome cliente\u2026' value='"+(edit?edit.customerName:"")+"' oninput='fSuggest(this.value)' autocomplete='off' autocapitalize='characters' style='text-transform:uppercase'>"+
      "<div class='sug-box' id='f-sug'></div></div>"+

      "<div class='fg'><label class='lbl'>Telefono WhatsApp</label>"+
      "<input class='inp' id='f-phone' type='tel' inputmode='numeric' placeholder='es. 3931234567' value='"+(edit?edit.customerPhone:"")+"' onfocus='document.getElementById(\"f-sug\").innerHTML=\"\"'></div>"+

      "<div class='fg'><label class='lbl'>Punto di Ritiro</label>"+
      "<div class='pv-sel-grid' id='f-pv-grid'>"+pvBtns+"</div></div>"+

      "<div class='fg'><label class='lbl'>\uD83C\uDF5D Prodotti e Quantit\u00e0</label>"+
      "<div style='position:relative;margin-bottom:6px'>"+
        "<span style='position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:13px'>\uD83D\uDD0D</span>"+
        "<input class='inp' id='pg-search' placeholder='Cerca prodotto\u2026' oninput='pgFilter(this.value)' onfocus='this.select()' "+
          "style='padding-left:32px;font-size:13px;background:#fff'>"+
      "</div>"+
      "<div class='prod-grid-list' id='prod-grid-wrap'></div>"+
      "<div id='f-custom-row' style='margin-top:6px;display:none;background:var(--cd);border-radius:var(--rs);padding:10px'>"+
        "<div style='font-size:11px;font-weight:700;color:var(--txl);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em'>Articolo non in lista</div>"+
        "<input class='inp' id='f-custom-name' placeholder='Nome articolo...' style='margin-bottom:6px'>"+
        "<div style='display:flex;gap:8px'>"+
          "<input class='inp' type='number' id='f-custom-qty' placeholder='Qt\u00e0' step='0.001' style='flex:1;font-size:16px;font-weight:700;text-align:center'>"+
          "<select class='inp sel' id='f-custom-unit' style='flex:1'><option value='kg'>kg</option><option value='pz'>pz</option></select>"+
          "<button class='btn btn-p' onclick='fAddCustom()' style='padding:8px 14px'>\u2713</button>"+
        "</div>"+
      "</div>"+
      "<button class='btn btn-s btn-sm' style='margin-top:6px;width:100%' onclick='fToggleCustom()'>+ Articolo non in lista</button></div>"+

      "<div class='fg'><label class='lbl' style='display:flex;align-items:center;gap:8px'>"+
      "<input type='checkbox' id='f-del' "+(edit&&edit.consegna?"checked":"")+" onchange='fToggleDel()' style='width:18px;height:18px'> \uD83D\uDEF5 Consegna a domicilio</label></div>"+

      "<div id='f-delfields' style='display:"+(edit&&edit.consegna?"block":"none")+"'>"+
        "<div class='fg'><label class='lbl'>Indirizzo</label><input class='inp' id='f-addr' placeholder='Via, Numero, Citt\u00e0' value='"+(edit?edit.indirizzoConsegna||"":"")+"'></div>"+
        "<div class='fg'><label class='lbl'>Orario consegna</label><input type='time' class='inp' id='f-ordel' value='"+(edit?edit.orarioConsegna||"":"")+"'></div>"+
      "</div>"+
      "<div id='f-ritfield' style='display:"+(edit&&edit.consegna?"none":"block")+"'>"+
        "<div class='fg'><label class='lbl'>Orario ritiro</label>"+
        "<div style='display:flex;gap:6px;margin-bottom:6px'>"+
          "<button type='button' id='f-slot-mat' class='btn btn-sm' onclick='fSetSlot(\"Mattina\")' style='flex:1;font-size:13px'>\uD83C\uDF05 Mattina</button>"+
          "<button type='button' id='f-slot-pom' class='btn btn-sm' onclick='fSetSlot(\"Pomeriggio\")' style='flex:1;font-size:13px'>\uD83C\uDF07 Pomeriggio</button>"+
        "</div>"+
        "<input type='time' class='inp' id='f-orrit' value='"+(edit&&edit.orarioRitiro?(edit.orarioRitiro.includes(' ')?edit.orarioRitiro.split(' ')[1]:(edit.orarioRitiro==="Mattina"||edit.orarioRitiro==="Pomeriggio"?"":edit.orarioRitiro)):"")+"'>"+
        "</div>"+
      "</div>"+

      "<div class='fg'><label class='lbl'>Note</label>"+
      "<textarea class='inp ta' id='f-notes' placeholder='Note aggiuntive\u2026' autocapitalize='sentences'>"+(edit?edit.notes||"":"")+"</textarea></div>"+

      ((!isEdit&&_isAdmin())?
      "<div class='fg' style='display:flex;align-items:center;gap:8px'>"+
        "<input type='checkbox' id='f-send-confirm' checked style='width:18px;height:18px;accent-color:var(--t)'>"+
        "<label for='f-send-confirm' style='font-size:13px;color:var(--tx);cursor:pointer'>Invia messaggio di conferma al cliente</label>"+
      "</div>" : "")+

      "<div id='f-cart' style='margin-top:10px;background:var(--cd);border-radius:var(--rs);padding:0;overflow:hidden;display:none'>"+
        "<div style='display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#f0dcc8'>"+
          "<span style='font-size:11px;font-weight:700;color:var(--br);text-transform:uppercase;letter-spacing:.05em'>\uD83D\uDED2 Articoli aggiunti</span>"+
          "<span id='f-cart-count' style='font-size:11px;font-weight:700;color:var(--t)'></span>"+
        "</div>"+
        "<div id='f-cart-list' style='max-height:120px;overflow-y:auto;padding:4px 0'></div>"+
      "</div>"+
      "<div style='display:flex;gap:10px;margin-top:8px'>"+
        "<button class='btn btn-s' style='flex:1' onclick='closeModal()'>Annulla</button>"+
        "<button class='btn btn-p' data-eid='"+(isEdit?edit.id:"")+"' data-emode='"+(isEdit?"edit":"new")+"' onclick='window._fSave(this.dataset.eid,this.dataset.emode)' style='flex:2;font-size:15px;padding:12px'>\uD83D\uDCBE Salva</button>"+
      "</div>"
    )
  }

  window._orSlot=null;
  setTimeout(function(){fInitSlot(edit?edit.orarioRitiro||'':'');fUpdateCart();if(window.hwInitBtn)hwInitBtn();},60);
  window.formSetPV=function(p){
    formPV=p;
    // Aggiorna solo i bottoni PV senza ricostruire il modal (evita di cancellare nome/telefono)
    var grid=document.getElementById("f-pv-grid");
    if(grid){
      grid.querySelectorAll(".pv-sel-btn").forEach(function(btn){
        btn.classList.toggle("on", btn.textContent===p);
      });
    }
    var badge=document.getElementById("o15-pv-val");
    if(badge)badge.textContent=p;
    document.querySelectorAll(".o15-pv-opt").forEach(function(o){
      o.classList.toggle("on", o.textContent.trim()===p);
    });
  };

  render();
  setTimeout(function(){
    var ms=document.getElementById("modal-sheet");
    if(ms)ms.scrollTop=0;
    var modal=document.getElementById("modal");
    if(modal)modal.scrollTop=0;
    if(_is15())return; // sui 15" non si forza il focus: si attiva solo toccando un campo
    var nameInp=document.getElementById("f-name");
    if(nameInp){nameInp.focus();}
  },80);
}

// Soglia per riconoscere i monitor touch da 15" dei punti vendita (desktop/tablet più piccoli restano sulla scheda classica)
// Soglia per riconoscere i monitor touch POS Windows dei punti vendita (desktop/tablet/iPad restano sulla scheda classica):
// serve che siano vere tutte e tre le condizioni, così anche un iPad in orizzontale con la stessa risoluzione non viene toccato.
function _is15(){
  var wideEnough=window.innerWidth>=1024;
  var isTouch=("ontouchstart" in window)||(navigator.maxTouchPoints>0);
  var isWindows=/Windows/i.test(navigator.userAgent);
  return wideEnough&&isTouch&&isWindows;
}

/* ══════════════════════════════════════════════════════════
   NUOVO ORDINE — SCHERMATA DEDICATA MONITOR TOUCH 15"
   ══════════════════════════════════════════════════════════ */
window._o15Active=false;

function _closeOrderUI(){
  if(window._o15Active){ o15Close(); } else { closeModal(); }
}

function o15Close(){
  var root=document.getElementById("o15-root");
  if(root){ root.classList.remove("open"); root.innerHTML=""; }
  window._o15Active=false;
  if(document.querySelector(".nav-btn[data-tab=\"ordini\"]")?.classList.contains("on"))setFabDisplay(true);
}

// ---- helper tastiera/tastierino: scrivono nel campo attualmente attivo (document.activeElement) ----
function _kbFire(el){
  el.dispatchEvent(new Event("input",{bubbles:true}));
  el.dispatchEvent(new Event("change",{bubbles:true}));
}
function _kbInsert(text){
  var el=document.activeElement;
  if(!el||(el.tagName!=="INPUT"&&el.tagName!=="TEXTAREA"))return;
  var start=el.selectionStart!=null?el.selectionStart:el.value.length;
  var end=el.selectionEnd!=null?el.selectionEnd:el.value.length;
  el.value=el.value.slice(0,start)+text+el.value.slice(end);
  var pos=start+text.length;
  try{el.setSelectionRange(pos,pos);}catch(e){}
  _kbFire(el);
}
function _kbBackspace(){
  var el=document.activeElement;
  if(!el||(el.tagName!=="INPUT"&&el.tagName!=="TEXTAREA"))return;
  var start=el.selectionStart!=null?el.selectionStart:el.value.length;
  var end=el.selectionEnd!=null?el.selectionEnd:el.value.length;
  if(start===end){ if(start===0)return; start=start-1; }
  el.value=el.value.slice(0,start)+el.value.slice(end);
  try{el.setSelectionRange(start,start);}catch(e){}
  _kbFire(el);
}
function _kbClear(){
  var el=document.activeElement;
  if(!el||(el.tagName!=="INPUT"&&el.tagName!=="TEXTAREA"))return;
  el.value="";
  _kbFire(el);
}

// ---- Data/Orario: apre il calendario/orologio nativo del dispositivo ----
function o15Pick(el){ try{ el.showPicker(); }catch(e){} }

// ---- Punto di ritiro: badge con menu a tendina (solo admin) ----
function o15TogglePV(e){
  e.stopPropagation();
  if(!_isAdmin())return;
  document.getElementById("o15-pv-dropdown").classList.toggle("show");
}
document.addEventListener("click",function(){
  var dd=document.getElementById("o15-pv-dropdown");
  if(dd)dd.classList.remove("show");
});

// ---- tastiera qwerty (appare nella zona pulsantiera per i campi di testo) ----
function o15ShowQwerty(){
  var pager=document.getElementById("o15-pager"); if(pager)pager.style.display="none";
  var vp=document.getElementById("o15-variant-picker"); if(vp)vp.classList.remove("show");
  var qw=document.getElementById("o15-qwerty"); if(qw)qw.classList.add("show");
  var done=document.getElementById("o15-qwerty-done"); if(done)done.classList.add("show");
  var dots=document.getElementById("o15-page-dots"); if(dots)dots.style.visibility="hidden";
}
function o15HideQwerty(){
  if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();
  var qw=document.getElementById("o15-qwerty"); if(qw)qw.classList.remove("show");
  var done=document.getElementById("o15-qwerty-done"); if(done)done.classList.remove("show");
  var pager=document.getElementById("o15-pager"); if(pager)pager.style.display="block";
  var dots=document.getElementById("o15-page-dots"); if(dots)dots.style.visibility="visible";
}

// ---- ricerca prodotti per nome ----
function o15FilterSearch(v){
  var sv=document.getElementById("o15-search-val");
  if(sv)sv.classList.toggle("filled",!!v);
  o15BuildGrid(v||"");
}
function o15ClearSearch(){
  var inp=document.getElementById("o15-search-input");
  if(inp){inp.value="";inp.blur();}
  o15FilterSearch("");
  o15HideQwerty();
}

// ---- abbreviazione automatica del nome per il pulsante ----
function _o15Abbr(name){
  if(!name)return "";
  var n=name.toUpperCase();
  return n.length>12?n.slice(0,12)+".":n;
}

// ---- pulsantiera: costruzione griglia 4 pagine × 50 codici (200 prodotti totali) ----
function o15BuildGrid(filterText){
  var byCode={};
  products.forEach(function(p){
    if(p.code){ var c=String(p.code); (byCode[c]=byCode[c]||[]).push(p); }
  });
  var q=(filterText||"").toLowerCase().trim();
  for(var pgIdx=0; pgIdx<4; pgIdx++){
    var el=document.getElementById("o15-page"+(pgIdx+1));
    if(!el)continue;
    var html="";
    for(var i=1;i<=50;i++){
      var code=pgIdx*50+i;
      var group=byCode[String(code)]||null;
      if(group&&q){
        var matches=group.some(function(p){return p.name.toLowerCase().indexOf(q)>-1;});
        if(!matches)group=null;
      }
      if(!group||group.length===0){
        html+="<div class='o15-pcode o15-empty'></div>";
      }else{
        var isGroup=group.length>1;
        var display=group[0];
        var n=formItems.filter(function(x){return group.some(function(p){return p.id===x.productId;});}).length;
        html+="<div class='o15-pcode"+(isGroup?" group":"")+(n>0?" selected":"")+"' id='o15-btn-"+code+"' onclick='o15TapCode("+code+")'>"+
          "<span class='o15-pcount' id='o15-cnt-"+code+"' style='display:"+(n>0?"flex":"none")+"'>"+n+"</span>"+
          (isGroup?"<span class='o15-arrow'>▸</span>":"")+
          "<span class='o15-pname'>"+_o15Abbr(display.shortName&&display.shortName.trim()?display.shortName.trim():display.name)+"</span>"+
          "<span class='o15-pnum'>"+String(code).padStart(2,"0")+"</span>"+
        "</div>";
      }
    }
    el.innerHTML=html;
  }
}

function o15TapCode(code){
  var group=products.filter(function(p){return String(p.code)===String(code);});
  if(group.length===0)return; // pulsante vuoto, nessun prodotto con questo codice
  if(group.length===1){ o15AddProduct(group[0].id); return; }
  o15OpenVariantPicker(code,group);
}

function o15OpenVariantPicker(code,group){
  var pager=document.getElementById("o15-pager"); if(pager)pager.style.display="none";
  var qw=document.getElementById("o15-qwerty"); if(qw)qw.classList.remove("show");
  var done=document.getElementById("o15-qwerty-done"); if(done)done.classList.remove("show");
  var dots=document.getElementById("o15-page-dots"); if(dots)dots.style.visibility="hidden";
  document.getElementById("o15-vp-title").textContent="Codice "+code+" — scegli la versione";
  document.getElementById("o15-vp-grid").innerHTML=group.map(function(p){
    var sel=formItems.some(function(x){return x.productId===p.id;});
    return "<div class='o15-vp-btn"+(sel?" selected":"")+"' onclick=\"o15AddProduct('"+p.id+"')\">"+
      "<span class='o15-vp-name'>"+(p.shortName&&p.shortName.trim()?p.shortName.trim():p.name)+"</span>"+
      "<span class='o15-vp-unit'>"+(p.unit||"kg")+"</span>"+
    "</div>";
  }).join("");
  document.getElementById("o15-variant-picker").classList.add("show");
}
function o15CloseVariantPicker(){
  var vp=document.getElementById("o15-variant-picker"); if(vp)vp.classList.remove("show");
  var pager=document.getElementById("o15-pager"); if(pager)pager.style.display="block";
  var dots=document.getElementById("o15-page-dots"); if(dots)dots.style.visibility="visible";
}

// tocco su un codice/variante: se il prodotto è già nel carrello lo rimuove del tutto (secondo tocco),
// altrimenti lo aggiunge subito con quantità di default, pronta per essere sovrascritta
function o15AddProduct(pid){
  var wrap=document.getElementById("prod-grid-wrap");
  var already=formItems.some(function(x){return x.productId===pid;});
  if(already){
    formItems=formItems.filter(function(x){return x.productId!==pid;});
    var rowEl=document.getElementById("pgr-"+pid);
    if(rowEl)rowEl.remove();
    fUpdateCart();
    o15RefreshGridHighlight(pid);
    o15RefreshCartEmptyState();
    o15CloseVariantPicker();
    return;
  }
  var p=products.find(function(x){return x.id===pid;});
  if(!p||!wrap)return;
  wrap.insertAdjacentHTML("beforeend",_pgProductHTML(p,true));
  var qtyInp=document.getElementById("pgi-"+pid);
  if(qtyInp){
    qtyInp.value="1";
    pgChange(qtyInp);
    setTimeout(function(){ qtyInp.focus(); qtyInp.select(); },30);
  }
  o15RefreshGridHighlight(pid);
  o15RefreshCartEmptyState();
  o15CloseVariantPicker();
}

function o15RefreshGridHighlight(pid){
  var p=products.find(function(x){return x.id===pid;});
  if(!p||!p.code)return;
  var siblingIds=products.filter(function(x){return x.code===p.code;}).map(function(x){return x.id;});
  var n=formItems.filter(function(x){return siblingIds.indexOf(x.productId)>-1;}).length;
  var btn=document.getElementById("o15-btn-"+p.code);
  var badge=document.getElementById("o15-cnt-"+p.code);
  if(!btn)return;
  if(n>0){ btn.classList.add("selected"); if(badge){badge.style.display="flex";badge.textContent=n;} }
  else{ btn.classList.remove("selected"); if(badge)badge.style.display="none"; }
}
function o15RefreshCartEmptyState(){
  var wrap=document.getElementById("prod-grid-wrap");
  var empty=document.getElementById("o15-cart-empty");
  if(!wrap||!empty)return;
  empty.style.display=wrap.children.length===0?"block":"none";
}

// ---- paginazione pulsantiera (trascinamento dito/mouse, senza pointer-capture) ----
var _o15CurrentPage=0;
function o15GoPage(n){
  _o15CurrentPage=n;
  var track=document.getElementById("o15-pages-track");
  if(track)track.style.transform="translateX(-"+(n*25)+"%)";
  document.querySelectorAll("#o15-page-dots .d").forEach(function(d,i){d.classList.toggle("on",i===n);});
}

function o15AddCustom(){
  fAddCustom();
  o15RefreshCartEmptyState();
  o15HideQwerty();
}

// ---- costruzione della schermata ----
function renderOrder15(edit,isEdit,date){
  window._o15Active=true;
  var root=document.getElementById("o15-root");
  if(!root){
    root=document.createElement("div");
    root.id="o15-root";
    document.body.appendChild(root);
  }
  var pv=formPV;
  var pvOptsHTML=PUNTI.map(function(p){return "<div class='o15-pv-opt"+(pv===p?" on":"")+"' onclick=\"event.stopPropagation();formSetPV('"+p+"');document.getElementById('o15-pv-dropdown').classList.remove('show')\">"+p+"</div>";}).join("");

  var existingRowsHTML=formItems.reduce(function(acc,it){
    var pid=it._realPid||it.productId;
    if(acc.seen[pid])return acc;
    acc.seen[pid]=true;
    var p=products.find(function(x){return x.id===pid;});
    if(p)acc.html+=_pgProductHTML(p,true);
    return acc;
  },{html:"",seen:{}}).html;

  root.innerHTML=
    "<div class='o15-topbar'>"+
      "<h1>"+(isEdit?"Modifica Ordine":"Nuovo Ordine")+"</h1>"+
      "<span class='o15-tag'>"+pv+"</span>"+
      "<div class='o15-close' onclick='o15Close()'>✕</div>"+
    "</div>"+
    "<div class='o15-main'>"+
      "<div class='o15-lcd-panel'><div class='o15-lcd-screen'>"+

        "<div class='o15-row'>"+
          "<div class='o15-field'><div class='o15-lbl'>📅 Data</div><input type='date' id='f-date' value='"+date+"' onclick='o15Pick(this)'></div>"+
          "<div class='o15-badge"+(_isAdmin()?" admin-tap":"")+"' id='o15-pv-badge' onclick='o15TogglePV(event)'>"+
            "<div class='o15-lbl'>Punto di ritiro"+(_isAdmin()?" ▾":"")+"</div>"+
            "<div class='o15-val' id='o15-pv-val'>"+pv+"</div>"+
            "<div class='o15-pv-dropdown' id='o15-pv-dropdown'>"+pvOptsHTML+"</div>"+
          "</div>"+
        "</div>"+

        "<div class='o15-field' style='position:relative'><div class='o15-lbl'>👤 Cliente</div>"+
          "<input id='f-name' inputmode='none' autocapitalize='characters' style='text-transform:uppercase' placeholder='Nome cliente…' "+
            "value='"+(edit?edit.customerName:"")+"' oninput='fSuggest(this.value)' onfocus='this.select();o15ShowQwerty()'>"+
          "<div class='sug-box' id='f-sug'></div>"+
        "</div>"+

        "<div class='o15-field'><div class='o15-lbl'>📱 Telefono WhatsApp</div>"+
          "<input id='f-phone' type='tel' inputmode='none' placeholder='es. 3931234567' value='"+(edit?edit.customerPhone:"")+"' onfocus='this.select();document.getElementById(\"f-sug\").innerHTML=\"\"'>"+
        "</div>"+

        "<div class='o15-cart-box'>"+
          "<div class='o15-hd'><span>🛒 Prodotti nel carrello</span></div>"+
          "<div id='prod-grid-wrap'>"+existingRowsHTML+"</div>"+
          "<div class='o15-empty' id='o15-cart-empty' style='display:"+(formItems.length===0?"block":"none")+"'>Tocca un codice nella pulsantiera in basso per aggiungere un prodotto</div>"+
        "</div>"+
        "<div class='o15-custom-btn' onclick='fToggleCustom()'>➕ Articolo non in lista</div>"+
        "<div id='f-custom-row' style='display:none;background:var(--cd);border-radius:var(--rs);padding:10px'>"+
          "<div style='font-size:11px;font-weight:700;color:var(--txl);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em'>Nuovo articolo</div>"+
          "<input class='inp' id='f-custom-name' inputmode='none' placeholder='Nome articolo…' style='margin-bottom:6px' onfocus='this.select();o15ShowQwerty()'>"+
          "<div style='display:flex;gap:8px'>"+
            "<input class='inp' type='text' inputmode='none' id='f-custom-qty' placeholder='Qtà' style='flex:1;font-size:16px;font-weight:700;text-align:center' onfocus='this.select()'>"+
            "<select class='inp sel' id='f-custom-unit' style='flex:1'><option value='kg'>kg</option><option value='pz'>pz</option></select>"+
            "<button class='btn btn-p' onclick='o15AddCustom()' style='padding:8px 14px'>✓</button>"+
          "</div>"+
        "</div>"+

        "<div class='o15-toggle-row' onclick=\"document.getElementById('f-del').click()\">"+
          "<input type='checkbox' class='box' id='f-del' "+(edit&&edit.consegna?"checked":"")+" onchange='fToggleDel()' onclick='event.stopPropagation()'>"+
          "<span class='lab'>🛵 Consegna a domicilio</span>"+
        "</div>"+
        "<div id='f-delfields' style='display:"+(edit&&edit.consegna?"block":"none")+"'>"+
          "<div class='o15-row'>"+
            "<div class='o15-field'><div class='o15-lbl'>Indirizzo</div><input id='f-addr' inputmode='none' placeholder='Via, numero, città' value='"+(edit?edit.indirizzoConsegna||"":"")+"' onfocus='this.select();o15ShowQwerty()'></div>"+
            "<div class='o15-field'><div class='o15-lbl'>Orario consegna</div><input type='time' id='f-ordel' value='"+(edit?edit.orarioConsegna||"":"")+"' onclick='o15Pick(this)'></div>"+
          "</div>"+
        "</div>"+
        "<div id='f-ritfield' style='display:"+(edit&&edit.consegna?"none":"block")+"'>"+
          "<div class='o15-row'>"+
            "<button type='button' id='f-slot-mat' class='btn btn-sm' onclick='fSetSlot(\"Mattina\")' style='flex:1;font-size:13px'>🌅 Mattina</button>"+
            "<button type='button' id='f-slot-pom' class='btn btn-sm' onclick='fSetSlot(\"Pomeriggio\")' style='flex:1;font-size:13px'>🌇 Pomeriggio</button>"+
            "<div class='o15-field' style='max-width:36%'><div class='o15-lbl'>Orario ritiro</div><input type='time' id='f-orrit' value='"+(edit&&edit.orarioRitiro?(edit.orarioRitiro.includes(' ')?edit.orarioRitiro.split(' ')[1]:(edit.orarioRitiro==='Mattina'||edit.orarioRitiro==='Pomeriggio'?'':edit.orarioRitiro)):'')+"' onclick='o15Pick(this)'></div>"+
          "</div>"+
        "</div>"+

        "<div class='o15-field o15-note-textarea'><div class='o15-lbl'>📝 Note</div>"+
          "<textarea id='f-notes' inputmode='none' placeholder='Note aggiuntive…' onfocus='this.select();o15ShowQwerty()'>"+(edit?edit.notes||"":"")+"</textarea>"+
        "</div>"+

        ((!isEdit&&_isAdmin())?
        "<div class='o15-admin-inline'><div class='o15-tag2'>Solo admin</div>"+
          "<div class='o15-toggle-row' style='background:transparent;padding:0' onclick=\"document.getElementById('f-send-confirm').click()\">"+
            "<input type='checkbox' class='box' id='f-send-confirm' checked onclick='event.stopPropagation()'>"+
            "<span class='lab'>Invia messaggio di conferma al cliente</span>"+
          "</div>"+
        "</div>":"")+

        "<div id='f-cart' style='display:none'></div><div id='f-cart-list'></div><div id='f-cart-count'></div>"+
      "</div></div>"+

      "<div class='o15-key-panel'>"+
        "<div class='o15-numpad-target' id='o15-active-label'>nessuno — tocca un campo</div>"+
        "<div class='o15-numpad-wrap'><div class='o15-numpad'>"+
          "<div class='o15-nk' onpointerdown=\"event.preventDefault();_kbInsert('7')\">7</div><div class='o15-nk' onpointerdown=\"event.preventDefault();_kbInsert('8')\">8</div><div class='o15-nk' onpointerdown=\"event.preventDefault();_kbInsert('9')\">9</div>"+
          "<div class='o15-nk' onpointerdown=\"event.preventDefault();_kbInsert('4')\">4</div><div class='o15-nk' onpointerdown=\"event.preventDefault();_kbInsert('5')\">5</div><div class='o15-nk' onpointerdown=\"event.preventDefault();_kbInsert('6')\">6</div>"+
          "<div class='o15-nk' onpointerdown=\"event.preventDefault();_kbInsert('1')\">1</div><div class='o15-nk' onpointerdown=\"event.preventDefault();_kbInsert('2')\">2</div><div class='o15-nk' onpointerdown=\"event.preventDefault();_kbInsert('3')\">3</div>"+
          "<div class='o15-nk o15-dec' onpointerdown=\"event.preventDefault();_kbInsert('.')\">,</div><div class='o15-nk' onpointerdown=\"event.preventDefault();_kbInsert('0')\">0</div><div class='o15-nk o15-dec' onpointerdown=\"event.preventDefault();_kbInsert('.')\">.</div>"+
          "<div class='o15-nk o15-back' onpointerdown='event.preventDefault();_kbBackspace()'>⌫</div><div class='o15-nk o15-clear' onpointerdown='event.preventDefault();_kbClear()'>C</div>"+
        "</div></div>"+
        "<div class='o15-key-actions'>"+
          "<div class='o15-kbtn o15-cancel' onclick='o15Close()'>Annulla</div>"+
          "<div class='o15-kbtn o15-save' data-eid='"+(isEdit?edit.id:"")+"' data-emode='"+(isEdit?"edit":"new")+"' onclick='window._fSave(this.dataset.eid,this.dataset.emode)'>💾 Salva</div>"+
        "</div>"+
      "</div>"+
    "</div>"+

    "<div class='o15-bottom-panel'>"+
      "<div class='o15-bottom-hd'>"+
        "<div class='o15-search-box'>"+
          "<span>🔎</span>"+
          "<input id='o15-search-input' inputmode='none' placeholder='Cerca prodotto per nome…' style='background:transparent;border:none;outline:none;color:inherit;font-size:12px;flex:1' oninput='o15FilterSearch(this.value)' onfocus='o15ShowQwerty()'>"+
          "<span class='o15-search-clear' onclick='o15ClearSearch()'>✕</span>"+
        "</div>"+
        "<div class='o15-page-dots' id='o15-page-dots'><div class='d on' onclick='o15GoPage(0)'></div><div class='d' onclick='o15GoPage(1)'></div><div class='d' onclick='o15GoPage(2)'></div><div class='d' onclick='o15GoPage(3)'></div></div>"+
        "<div class='o15-qwerty-done' id='o15-qwerty-done' onclick='o15HideQwerty()'>✓ Fatto</div>"+
      "</div>"+
      "<div class='o15-pager' id='o15-pager'>"+
        "<div class='o15-pages-track' id='o15-pages-track'>"+
          "<div class='o15-page' id='o15-page1'></div>"+
          "<div class='o15-page' id='o15-page2'></div>"+
          "<div class='o15-page' id='o15-page3'></div>"+
          "<div class='o15-page' id='o15-page4'></div>"+
        "</div>"+
      "</div>"+
      "<div class='o15-variant-picker' id='o15-variant-picker'>"+
        "<div class='o15-vp-title' id='o15-vp-title'>Scegli la versione</div>"+
        "<div class='o15-vp-grid' id='o15-vp-grid'></div>"+
        "<div class='o15-vp-cancel' onclick='o15CloseVariantPicker()'>✕ Annulla</div>"+
      "</div>"+
      "<div class='o15-qwerty' id='o15-qwerty'>"+
        "<div class='o15-qrow'><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('Q')\">Q</div><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('W')\">W</div><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('E')\">E</div><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('R')\">R</div><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('T')\">T</div><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('Y')\">Y</div><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('U')\">U</div><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('I')\">I</div><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('O')\">O</div><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('P')\">P</div></div>"+
        "<div class='o15-qrow'><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('A')\">A</div><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('S')\">S</div><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('D')\">D</div><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('F')\">F</div><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('G')\">G</div><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('H')\">H</div><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('J')\">J</div><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('K')\">K</div><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('L')\">L</div></div>"+
        "<div class='o15-qrow'><div class='o15-qkey o15-wide o15-del' onpointerdown='event.preventDefault();_kbBackspace()'>⌫ Canc</div><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('Z')\">Z</div><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('X')\">X</div><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('C')\">C</div><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('V')\">V</div><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('B')\">B</div><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('N')\">N</div><div class='o15-qkey' onpointerdown=\"event.preventDefault();_kbInsert('M')\">M</div><div class='o15-qkey o15-wide o15-enter' onclick='o15HideQwerty()'>Invio ⏎</div></div>"+
        "<div class='o15-qrow'><div class='o15-qkey o15-space' onpointerdown=\"event.preventDefault();_kbInsert(' ')\">spazio</div></div>"+
      "</div>"+
    "</div>"+
    "<div class='o15-footnote'>I codici con la freccina ▸ hanno più versioni: si apre un pannello con pulsanti grandi per scegliere.</div>";

  root.classList.add("open");
  setFabDisplay(false);

  if(!root._o15FocusBound){
    root._o15FocusBound=true;
    root.addEventListener("focusin",function(e){
      var el=e.target;
      if(el.tagName!=="INPUT"&&el.tagName!=="TEXTAREA")return;
      document.querySelectorAll(".o15-field").forEach(function(f){f.classList.remove("active");});
      var wrap=el.closest(".o15-field");
      if(wrap)wrap.classList.add("active");
      var label="";
      if(el.classList.contains("pgrow-qty")){
        var row=el.closest(".pgrow");
        var nameEl=row?row.querySelector(".pgrow-name"):null;
        label="Quantità — "+(nameEl?nameEl.textContent.trim():"");
      }else if(wrap){
        var lblEl=wrap.querySelector(".o15-lbl");
        label=lblEl?lblEl.textContent.replace(/^[^\wÀ-ÿ]+/,"").trim():"";
      }else if(el.id==="o15-search-input"){
        label="Ricerca prodotto";
      }else if(el.id==="f-custom-name"){
        label="Nome nuovo articolo";
      }else if(el.id==="f-custom-qty"){
        label="Quantità nuovo articolo";
      }
      document.getElementById("o15-active-label").innerHTML=label?("Campo attivo: <b>"+label+"</b>"):"nessuno — tocca un campo";
    });
  }

  o15BuildGrid("");
  o15GoPage(0);

  // trascinamento con il dito/mouse per l'LCD e per le pagine della pulsantiera (nessuna pointer-capture)
  (function(){
    var lcd=root.querySelector(".o15-lcd-screen");
    if(lcd){
      var dragging=false,startY=0,startScroll=0;
      lcd.addEventListener("pointerdown",function(e){ if(e.pointerType!=="mouse")return; dragging=true; startY=e.clientY; startScroll=lcd.scrollTop; });
      lcd.addEventListener("pointermove",function(e){ if(!dragging||e.pointerType!=="mouse")return; lcd.scrollTop=startScroll-(e.clientY-startY); });
      ["pointerup","pointercancel","pointerleave"].forEach(function(ev){ lcd.addEventListener(ev,function(){dragging=false;}); });
    }
    var pager=document.getElementById("o15-pager");
    if(pager){
      var touchX=null;
      pager.addEventListener("touchstart",function(e){ touchX=e.touches[0].clientX; });
      pager.addEventListener("touchend",function(e){
        if(touchX===null)return;
        var dx=e.changedTouches[0].clientX-touchX;
        if(dx<-40&&_o15CurrentPage<3)o15GoPage(_o15CurrentPage+1);
        if(dx>40&&_o15CurrentPage>0)o15GoPage(_o15CurrentPage-1);
        touchX=null;
      });
      var mx=null;
      pager.addEventListener("pointerdown",function(e){ if(e.pointerType==="mouse")mx=e.clientX; });
      pager.addEventListener("pointerup",function(e){
        if(e.pointerType!=="mouse"||mx===null)return;
        var dx=e.clientX-mx;
        if(dx<-40&&_o15CurrentPage<3)o15GoPage(_o15CurrentPage+1);
        if(dx>40&&_o15CurrentPage>0)o15GoPage(_o15CurrentPage-1);
        mx=null;
      });
    }
  })();
}

function fRemItem(i){formItems.splice(i,1);fUpdateCart();}

function fUpdateCart(){
  var cart=document.getElementById("f-cart");
  var list=document.getElementById("f-cart-list");
  var count=document.getElementById("f-cart-count");
  if(!cart||!list)return;
  // Raccogli tutti gli item correnti da formItems + input visibili
  pgSaveAllQty();
  // Costruisci lista display
  var display=[];
  var seen={};
  formItems.forEach(function(it){
    var pid=it.productId||"";
    var name=it.productName;
    if(!seen[pid]){seen[pid]={name:name,parts:[]};}
    var u=it.unit||"kg";
    if(it.confezioni&&it.confezioni.length>1){
      // mostra ogni confezione
      it.confezioni.forEach(function(c){
        var q=parseFloat(c.qty)||0;
        var cu=c.unit||u;
        if(q>0){
          if(cu==="kg")seen[pid].parts.push("<b style='color:var(--t)'>"+q.toFixed(3).replace(".",",")+"</b>&nbsp;kg");
          else seen[pid].parts.push("<b style='color:var(--t)'>"+Math.round(q)+"</b>&nbsp;pz");
        }
      });
    } else {
      var q=parseFloat(it.qty)||0;
      if(q>0){
        if(u==="kg")seen[pid].parts.push("<b style='color:var(--t)'>"+q.toFixed(3).replace(".",",")+"</b>&nbsp;kg");
        else seen[pid].parts.push("<b style='color:var(--t)'>"+Math.round(q)+"</b>&nbsp;pz");
      }
    }
  });
  Object.keys(seen).forEach(function(pid){
    var d=seen[pid];
    if(d.parts.length)display.push({name:d.name,qty:d.parts.join(" + ")});
  });
  if(!display.length){cart.style.display="none";return;}
  cart.style.display="block";
  if(count)count.textContent=display.length+" "+(display.length===1?"articolo":"articoli");
  list.innerHTML=display.map(function(d,i){
    return "<div style='display:flex;align-items:center;gap:8px;padding:5px 10px;"+(i%2?"background:#fdf6ec":"")+"'>"+
      "<span style='flex:1;font-size:12px;font-weight:600;color:var(--tx)'>"+d.name+"</span>"+
      "<span style='font-size:12px'>"+d.qty+"</span>"+
    "</div>";
  }).join("");
}
// ── NUOVO SISTEMA CONFEZIONI: tutti i prodotti trattati come "misti" ──────
// Ogni prodotto ha un unico slot con toggle kg/pz per riga e pulsanti +/-
// Il productId in formItems è sempre p.id (senza suffissi _kg/_pz)
// Ogni riga confezione ha il proprio toggle unità indipendente

function _pgUnitParams(unit){
  return unit==="kg"
    ? {step:"0.001",imode:"decimal",ph:"0,000"}
    : {step:"1",    imode:"numeric", ph:"0"};
}

// Legge l'unità corrente di una riga dal suo bottone toggle
function _pgRowUnit(row){
  if(!row)return "kg";
  const btn=row.querySelector(".pgrow-unit-mista");
  return btn?(btn.dataset.unit||"kg"):"kg";
}

// Costruisce HTML per una singola riga confezione
function _pgConfRowHTML(pid,i,qty,unit,p,isFirst,for15){
  const up=_pgUnitParams(unit);
  const _pgDispName=p.shortName&&p.shortName.trim()?p.shortName.trim():p.name;
  const nameSpan=isFirst
    ? "<span class='pgrow-name'>"+p.image+"&nbsp;"+_pgDispName+"</span>"
    : "<span class='pgrow-name' style='visibility:hidden;pointer-events:none'>"+p.image+"&nbsp;"+_pgDispName+"</span>";
  const unitBtn="<button type='button' class='pgrow-unit-mista' data-unit='"+unit+"' "+
    "onclick='pgToggleRowUnit(this,\""+pid+"\","+i+")'>"+unit+"</button>";
  const plusBtn="<button type='button' class='pgrow-plus' onclick='pgAddConf(\""+pid+"\")'>+</button>";
  const minusBtn=isFirst
    ? "<span style='width:28px;flex-shrink:0'></span>"
    : "<button type='button' class='pgrow-minus' onclick='pgRemoveConf(this,\""+pid+"\","+i+")'>−</button>";
  const qtyId=isFirst?"id='pgi-"+pid+"'":"";
  const qtyAttrs=isFirst
    ? "data-pid='"+pid+"' onchange='pgChange(this)' onblur='pgChange(this)'"
    : "data-pid='"+pid+"' data-cidx='"+i+"' oninput='pgChangeConf(this)'";
  // Su 15": campo testo (non number) con tastiera di sistema disattivata, così si usa solo il tastierino a schermo
  // senza gli inconvenienti dei campi numerici nativi durante la digitazione assistita da JS.
  const typeAttrs=for15
    ? "type='text' inputmode='none'"
    : "type='number' inputmode='"+up.imode+"' step='"+up.step+"' min='0'";
  return "<div class='pgrow-conf-row' id='pgcr-"+pid+"-"+i+"'>" +
    nameSpan+
    "<input class='pgrow-qty' "+typeAttrs+" "+
      "placeholder='"+up.ph+"' value='"+(qty||"")+"'  "+
      qtyId+" "+qtyAttrs+" onfocus='this.select()'>"+
    unitBtn+
    plusBtn+
    minusBtn+
  "</div>";
}

// Toggle unità di una singola riga (indipendente dalle altre)
function pgToggleRowUnit(btn,pid,idx){
  const cur=btn.dataset.unit==="kg"?"pz":"kg";
  btn.dataset.unit=cur;
  btn.textContent=cur;
  const row=btn.closest(".pgrow-conf-row");
  const inp=row?row.querySelector(".pgrow-qty"):null;
  if(inp){
    const up=_pgUnitParams(cur);
    inp.setAttribute("step",up.step);
    inp.setAttribute("inputmode",up.imode);
    inp.setAttribute("placeholder",up.ph);
  }
  _pgSyncConf(pid);
  fUpdateCart();
}

// Sincronizza formItems per un prodotto leggendo tutte le sue righe
function _pgSyncConf(pid){
  const confBox=document.getElementById("pgc-"+pid);
  const row=document.getElementById("pgr-"+pid);
  if(!confBox)return;
  const rows=confBox.querySelectorAll(".pgrow-conf-row");
  const confezioni=[];
  rows.forEach(function(r){
    const inp=r.querySelector(".pgrow-qty");
    const unit=_pgRowUnit(r);
    const qty=inp?inp.value:"";
    confezioni.push({qty:qty,unit:unit});
  });
  const total=confezioni.reduce(function(s,c){return s+(parseFloat(c.qty)||0);},0);
  if(row)row.style.background=total>0?"#fff8f2":"";
  formItems=formItems.filter(function(x){return x.productId!==pid;});
  if(total>0){
    const prod=products.find(function(x){return x.id===pid;});
    if(prod){
      const firstFilled=confezioni.find(function(c){return parseFloat(c.qty)>0;})||confezioni[0];
      const unitPrev=firstFilled?firstFilled.unit:"kg";
      const item={productId:pid,productName:prod.name,qty:String(total),unit:unitPrev};
      if(confezioni.length>1)item.confezioni=confezioni;
      formItems.push(item);
    }
  }
}

function pgChangeConf(inp){
  _pgSyncConf(inp.dataset.pid);
  fUpdateCart();
}

function pgChange(inp){
  const pid=inp.dataset.pid;
  const confBox=document.getElementById("pgc-"+pid);
  const allRows=confBox?confBox.querySelectorAll(".pgrow-conf-row"):[];
  const hasMultiple=allRows.length>1;
  const perPiece=parseFloat(inp.value)||0;
  const row=document.getElementById("pgr-"+pid);
  if(row)row.style.background=(perPiece>0||hasMultiple)?"#fff8f2":"";
  if(hasMultiple){
    _pgSyncConf(pid);
    return;
  }
  formItems=formItems.filter(x=>x.productId!==pid);
  if(inp.value&&perPiece>0){
    const prod=products.find(x=>x.id===pid);
    if(prod){
      const firstRow=confBox?confBox.querySelector(".pgrow-conf-row"):null;
      const unit=_pgRowUnit(firstRow);
      formItems.push({productId:pid,productName:prod.name,qty:inp.value,unit:unit});
    }
  }
  fUpdateCart();
}

// Costruisce il blocco HTML per un prodotto nel form
function _pgProductHTML(p,for15){
  const existing=formItems.find(x=>x.productId===p.id);
  let rows=[];
  if(existing&&existing.confezioni&&existing.confezioni.length>1){
    rows=existing.confezioni.map(function(c){return {qty:c.qty,unit:c.unit||p.unit||"kg"};});
  } else if(existing&&existing.qty&&parseFloat(existing.qty)>0){
    const u=existing.unit==="mista"?(p.unit||"kg"):(existing.unit||p.unit||"kg");
    rows=[{qty:existing.qty,unit:u}];
  } else {
    rows=[{qty:"",unit:p.unit||"kg"}];
  }
  let rowsHTML="";
  rows.forEach(function(r,i){
    rowsHTML+=_pgConfRowHTML(p.id,i,r.qty,r.unit||p.unit||"kg",p,i===0,for15);
  });
  const hasVal=!!(existing&&existing.qty&&parseFloat(existing.qty)>0);
  return "<div class='pgrow' id='pgr-"+p.id+"'"+(hasVal?" style='background:#fff8f2'":" style=''")+">"+
    "<div class='pgrow-conf-list' id='pgc-"+p.id+"'>"+rowsHTML+"</div>"+
  "</div>";
}

function buildProdGrid(filterQ){
  const q=(filterQ||"").toLowerCase().trim();
  let html="";
  const allGroups=categories.map(c=>({
    cat:c,
    prods:products.filter(p=>p.catId===c.id&&(!q||p.name.toLowerCase().includes(q)))
  })).concat([{
    cat:{id:"__none__",name:"Senza categoria",icon:"📦"},
    prods:products.filter(p=>(!p.catId||!categories.find(c=>c.id===p.catId))&&(!q||p.name.toLowerCase().includes(q)))
  }]);
  allGroups.forEach(function(g){
    if(g.prods.length===0)return;
    html+="<div style='background:var(--cd);padding:7px 12px;font-size:12px;font-weight:700;color:var(--br);display:flex;align-items:center;gap:6px'>"+
      "<span>"+g.cat.icon+"</span><span>"+g.cat.name+"</span>"+
      "<span style='font-weight:400;color:var(--txl)'>("+g.prods.length+")</span></div>";
    g.prods.forEach(function(p){
      html+=_pgProductHTML(p);
    });
  });
  if(!html)html="<div style='padding:14px;text-align:center;color:var(--txl);font-size:13px'>Nessun prodotto trovato</div>";
  return html;
}

function pgAddConf(pid){
  const confBox=document.getElementById("pgc-"+pid);
  if(!confBox)return;
  const currentRows=confBox.querySelectorAll(".pgrow-conf-row");
  const n=currentRows.length;
  const lastRow=currentRows.length>0?currentRows[currentRows.length-1]:null;
  const p=products.find(x=>x.id===pid);
  if(!p)return;
  const lastUnit=lastRow?_pgRowUnit(lastRow):(p.unit||"kg");
  const lastVal=lastRow&&lastRow.querySelector(".pgrow-qty")?lastRow.querySelector(".pgrow-qty").value:"";
  confBox.insertAdjacentHTML("beforeend",_pgConfRowHTML(pid,n,lastVal,lastUnit,p,false,!!window._o15Active));
  _pgSyncConf(pid);
  const newInp=confBox.lastElementChild&&confBox.lastElementChild.querySelector(".pgrow-qty");
  if(newInp)setTimeout(function(){newInp.focus();newInp.select();},50);
}

function pgRemoveConf(btn,pid,idx){
  const confBox=document.getElementById("pgc-"+pid);
  if(!confBox)return;
  const rows=confBox.querySelectorAll(".pgrow-conf-row");
  if(rows.length<=1)return;
  btn.closest(".pgrow-conf-row").remove();
  confBox.querySelectorAll(".pgrow-conf-row").forEach(function(r,i){
    const inp=r.querySelector(".pgrow-qty");
    if(inp&&inp.dataset.cidx!==undefined)inp.dataset.cidx=i;
    const remBtn=r.querySelector(".pgrow-minus");
    if(remBtn)remBtn.setAttribute("onclick","pgRemoveConf(this,'"+pid+"',"+i+")");
    r.id="pgcr-"+pid+"-"+i;
  });
  _pgSyncConf(pid);
  fUpdateCart();
}

function pgSaveAllQty(){
  const wrap=document.getElementById("prod-grid-wrap");
  if(!wrap)return;
  const pids=new Set();
  wrap.querySelectorAll(".pgrow-conf-list").forEach(function(box){
    if(box.id&&box.id.startsWith("pgc-"))pids.add(box.id.slice(4));
  });
  pids.forEach(function(pid){_pgSyncConf(pid);});
}

function pgFilter(q){
  pgSaveAllQty();
  const wrap=document.getElementById("prod-grid-wrap");
  if(!wrap)return;
  if(!q||!q.trim()){
    wrap.innerHTML="";
    return;
  }
  wrap.innerHTML=buildProdGrid(q);
}

function fSuggest(val){
  window._pickedCustId=null; // l'utente sta digitando a mano: invalida qualunque selezione precedente dal menu
  window._forceNewCustomer=false; // annulla anche un'eventuale scelta "è un cliente nuovo" fatta in precedenza
  const box=document.getElementById("f-sug");
  if(!val.trim()){box.innerHTML="";return;}
  const lv=val.toLowerCase();
  const sug=customers.filter(c=>c.name&&c.name.toLowerCase().includes(lv)).slice(0,5);
  let html=sug.map(c=>"<div class='sug-item' onclick=\"fPickCust('"+c.id+"')\"><b>"+c.name+"</b><br><span style='font-size:11px;color:var(--txl)'>"+( c.phone||"")+"</span></div>").join("");
  // Se ci sono omonimi, aggiungi in fondo l'opzione per non collegarsi a nessuno di loro
  if(sug.length)html+="<div class='sug-item' style='color:#C4622D;font-weight:700' onclick='fMarkNewCustomer()'>➕ È un cliente nuovo</div>";
  box.innerHTML=html;
}
function fMarkNewCustomer(){
  window._pickedCustId=null;
  window._forceNewCustomer=true; // in fSave: non agganciare nessun cliente esistente con questo nome
  document.getElementById("f-sug").innerHTML="";
}
function fPickCust(id){
  const c=customers.find(x=>x.id===id);
  window._pickedCustId=id; // memorizza l'ID esatto scelto dal menu, per evitare ambiguità con clienti omonimi
  document.getElementById("f-name").value=c.name;
  document.getElementById("f-phone").value=c.phone||"";
  document.getElementById("f-sug").innerHTML="";
}
function fSave(editId,mode){
  const name=document.getElementById("f-name").value.trim();
  const phone=normPhone(document.getElementById("f-phone").value.trim());
  // Per gli operatori, usa sempre il PV dal profilo (non formPV che potrebbe
  // essere stato inizializzato prima che il profilo fosse caricato)
  const pv=_normPV(_isAdmin()?formPV:(_userPV()||formPV));
  const consegna=document.getElementById("f-del").checked;
  const addr=(document.getElementById("f-addr")||{value:""}).value.trim();
  const orDel=(document.getElementById("f-ordel")||{value:""}).value;
  var _timeInp=document.getElementById("f-orrit");
  var _timeVal=_timeInp?_timeInp.value.trim():"";
  // Combina slot (Mattina/Pomeriggio) con orario preciso se entrambi presenti
  const orRit=window._orSlot&&_timeVal?window._orSlot+" "+_timeVal:window._orSlot||_timeVal;
  const notes=document.getElementById("f-notes").value.trim();
  const date=document.getElementById("f-date").value;

  pgSaveAllQty();
  // Raccogli eventuali input visibili non ancora catturati da pgSaveAllQty
  products.forEach(function(p){
    const inp=document.getElementById("pgi-"+p.id);
    const confBox=document.getElementById("pgc-"+p.id);
    const hasMultiConf=confBox&&confBox.querySelectorAll(".pgrow-conf-row").length>1;
    if(hasMultiConf)return; // già gestito da _pgSyncConf
    if(inp){
      formItems=formItems.filter(function(x){return x.productId!==p.id;});
      if(inp.value&&parseFloat(inp.value)>0){
        const firstRow=confBox?confBox.querySelector(".pgrow-conf-row"):null;
        const unit=firstRow?_pgRowUnit(firstRow):"kg";
        formItems.push({productId:p.id,productName:p.name,qty:inp.value,unit:unit});
      }
    }
  });
  if(!name)return alert("Inserisci il nome del cliente");
  if(formItems.length===0)return alert("Aggiungi almeno un prodotto");
  const nameFmt=name.toUpperCase();

  // Se durante la digitazione l'utente ha toccato "➕ È un cliente nuovo" nel menu
  // suggerimenti, non agganciare nessun cliente esistente con lo stesso nome:
  // ne crea uno separato, anche se il telefono è vuoto.
  const forceNewCust=window._forceNewCustomer;
  window._forceNewCustomer=false;

  let c=window._pickedCustId?customers.find(x=>x.id===window._pickedCustId):null;
  if(!c&&!forceNewCust)c=customers.find(x=>x.name&&x.name.toLowerCase()===nameFmt.toLowerCase());
  window._savingOrder=true; // blocca il listener ordini durante il salvataggio
  if(!c){c={id:uid(),name:nameFmt,phone};customers.push(c);customers.sort((a,b)=>(a.name||'').localeCompare(b.name||'','it'));lsSet("pf_customers",customers);}
  else if(phone&&!c.phone){c.phone=phone;lsSet("pf_customers",customers);}
  const edit=mode==="edit"?orders.find(o=>o.id===editId):null;
  const o={
    id:edit?edit.id:uid(),date,customerId:c.id,customerName:c.name,
    customerPhone:phone||c.phone||"",pv,items:formItems,consegna,
    indirizzoConsegna:addr,orarioConsegna:orDel,orarioRitiro:orRit,notes,
    stato:edit?edit.stato:"nuovo",importo:edit?edit.importo:"",
    itemsDone:edit?edit.itemsDone:[],
    createdAt:edit?edit.createdAt:new Date().toISOString(),
    manualOrder:edit&&edit.manualOrder!=null?edit.manualOrder:null
  };
  if(mode==="edit")orders=orders.map(x=>x.id===o.id?o:x);else orders.push(o);
  lsSetOrder(o);
  setTimeout(()=>{window._savingOrder=false;},5000); // riabilita il listener dopo 5s
  // Leggo la checkbox PRIMA di chiudere il modulo: closeModal() svuota il DOM del modal-sheet
  const confirmBox=document.getElementById("f-send-confirm");
  const wantsSend=confirmBox?confirmBox.checked:true; // niente checkbox (non-admin) = comportamento invariato
  _closeOrderUI();
  refreshAll();
  renderCalendar();
  scrollAndPulse(o.id);
  showToast(mode==="edit"?"✏️ Ordine modificato!":"✅ Ordine salvato!");
  if(mode!=="edit"&&o.customerPhone){
    if(wantsSend){
      if(WA_API_CFG.enabled&&WA_API_CFG.autoNuovo)sendWAapiWithFeedback(o.id,"nuovo");
      else showWAReminder("nuovo");
    }
  }
}

/* ════ ORDER DETAIL ════ */
var _detailMode=false;
function openOrderDetail(id){
  _detailMode=true;

  function buildDetailDOM(o){
    var ms=document.createElement("div");

    // header
    var hdr=document.createElement("div");
    hdr.innerHTML="<div class='sheet-hd'></div>";
    ms.appendChild(hdr);

    // title row
    var titleRow=document.createElement("div");
    titleRow.style.cssText="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;padding-right:36px";
    var titleLeft=document.createElement("div");
    titleLeft.innerHTML="<div class='sheet-ti' style='margin-bottom:2px'>"+o.customerName+"</div>"+
      "<div style='font-size:12px;color:var(--txl)'>"+fmtDate(o.date)+" · "+GF[getDow(o.date)]+"</div>";
    var titleBtns=document.createElement("div");
    titleBtns.style.cssText="display:flex;gap:6px;margin-top:28px";
    if(o.customerPhone){
      var callBtn=document.createElement("a");
      callBtn.href="tel:"+o.customerPhone.replace(/\D/g,"");
      callBtn.className="btn btn-sm";
      callBtn.style.cssText="background:#2196F3;color:#fff;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;padding:6px 10px;font-size:15px";
      callBtn.textContent="📞";
      callBtn.title="Chiama "+o.customerName;
      titleBtns.appendChild(callBtn);
    }
    var editBtn=document.createElement("button");
    editBtn.className="btn btn-s btn-sm";editBtn.textContent="✏️";
    editBtn.onclick=function(){closeModal();setTimeout(function(){openOrderForm(o.id);},80);};
    var delBtn=document.createElement("button");
    delBtn.className="btn btn-d btn-sm";delBtn.textContent="🗑️";
    delBtn.onclick=function(){window.delOrder(o.id);};
    titleBtns.appendChild(editBtn);titleBtns.appendChild(delBtn);
    titleRow.appendChild(titleLeft);titleRow.appendChild(titleBtns);
    ms.appendChild(titleRow);

    // info card
    var card=document.createElement("div");
    card.className="card";card.style.marginBottom="12px";
    var badges="<span class='badge b-pv'>"+o.pv+"</span>"+(o.consegna?" <span class='b-del'>🛵 Consegna</span>":"");
    var info=(o.customerPhone?"<div style='font-size:13px;margin-bottom:4px'>📱 "+o.customerPhone+"</div>":"")+
      (o.orarioRitiro?"<div style='font-size:13px;margin-bottom:4px'>⏰ Ritiro: "+o.orarioRitiro+"</div>":"")+
      (o.orarioConsegna?"<div style='font-size:13px;margin-bottom:4px'>⏰ Consegna: "+o.orarioConsegna+"</div>":"")+
      (o.indirizzoConsegna?"<div style='font-size:13px;margin-bottom:4px'>📍 "+o.indirizzoConsegna+"</div>":"")+
      (o.notes?"<div style='font-size:13px;color:var(--txl);font-style:italic'>📝 "+o.notes+"</div>":"");
    card.innerHTML="<div style='display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px'>"+badges+"</div>"+info;
    ms.appendChild(card);

    // items label
    var itemLbl=document.createElement("div");
    itemLbl.className="sec-lbl";
    itemLbl.innerHTML="Articoli <span style='font-size:10px;font-weight:400'>(tocca per segnare preparato)</span>";
    ms.appendChild(itemLbl);

    // items list
    // itemsDone can contain integers (legacy) or strings like "2:0.300" for grouped confezioni
    var doneSet=new Set((o.itemsDone||[]).map(String));
    var itemsWrap=document.createElement("div");
    itemsWrap.style.marginBottom="14px";

    // helper: crea i bottoni ✏️ e 🗑️ per ogni riga
    function makeItemActions(oid, itemIdx, isKg, currentQty){
      var wrap=document.createElement("div");
      wrap.style.cssText="display:flex;align-items:center;gap:4px;flex-shrink:0;margin-left:4px";

      var editBtn=document.createElement("button");
      editBtn.className="btn btn-s btn-sm";
      editBtn.style.cssText="padding:3px 7px;font-size:13px;line-height:1";
      editBtn.textContent="✏️";
      editBtn.title="Modifica quantità";
      editBtn.onclick=function(e){
        e.stopPropagation();
        window.detailEditItem(oid, itemIdx, isKg);
      };

      var delBtn=document.createElement("button");
      delBtn.className="btn btn-d btn-sm";
      delBtn.style.cssText="padding:3px 7px;font-size:13px;line-height:1";
      delBtn.textContent="🗑️";
      delBtn.title="Elimina prodotto";
      delBtn.onclick=function(e){
        e.stopPropagation();
        window.detailDeleteItem(oid, itemIdx);
      };

      wrap.appendChild(editBtn);
      wrap.appendChild(delBtn);
      return wrap;
    }

    (o.items||[]).forEach(function(it,idx){
      var isKg=it.unit==="kg";
      var nConf=it.confezioni?it.confezioni.length:1;

      if(nConf>1&&it.confezioni){
        var groups=fmtConfezioniGroups(it.confezioni,it.unit);
        var isPzUnit=it.unit==="pz";
        groups.forEach(function(g){
          var key=idx+":"+g.qty;
          var done=doneSet.has(key)||doneSet.has(String(idx));
          var dec=done?"color:#bbb;text-decoration:line-through;text-decoration-color:rgba(192,57,43,.4);":"";
          var qtyCol=done?"#bbb":"var(--t)";
          var doneIcon=done?"<sup style='font-size:16px;font-weight:900;color:#C0392B;margin-left:6px'>P</sup>":"<span style='font-size:14px;color:#ccc;margin-left:6px'>○</span>";
          var qtyDisplay=isPzUnit?Math.round(parseFloat(g.qty)):parseFloat(g.qty).toFixed(3).replace(".",",");
          var gRow=document.createElement("div");
          gRow.style.cssText="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 0;border-bottom:1px solid var(--cd);cursor:pointer";
          var innerWrap=document.createElement("div");
          innerWrap.style.cssText="display:flex;align-items:center;flex:1;gap:8px;min-width:0";
          innerWrap.innerHTML=
            "<span style='font-size:15px;"+dec+"flex:1;min-width:0'>"+
              "<span style='font-weight:700'>"+g.n+"</span>"+
              " <strong>"+_pName(it.productId,it.productName)+"</strong>"+
            "</span>"+
            "<span style='font-size:14px;font-weight:700;color:"+qtyCol+"'>× "+qtyDisplay+"</span>"+
            doneIcon;
          (function(k){innerWrap.onclick=function(){window.toggleItemKey(o.id,k);};})(key);
          gRow.appendChild(innerWrap);
          gRow.appendChild(makeItemActions(o.id,idx,!isPzUnit,it.qty));
          itemsWrap.appendChild(gRow);
        });
      } else {
        var done=doneSet.has(String(idx));
        var qtyFmt=isKg
          ? parseFloat(it.qty).toFixed(3).replace(".",",")
          : String(parseInt(it.qty)||it.qty);
        var doneIcon=done?"<sup style='font-size:16px;font-weight:900;color:#C0392B;margin-left:6px'>P</sup>":"<span style='font-size:14px;color:#ccc;margin-left:6px'>○</span>";
        var dec=done?"color:#bbb;text-decoration:line-through;text-decoration-color:rgba(192,57,43,.4);":"";
        var mainRow=document.createElement("div");
        mainRow.style.cssText="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 0;border-bottom:1px solid var(--cd);cursor:pointer";
        var innerWrap=document.createElement("div");
        innerWrap.style.cssText="display:flex;align-items:center;flex:1;gap:8px;min-width:0";
        if(it.unit==="pz"){
          innerWrap.innerHTML="<span style='font-size:15px;font-weight:700;"+dec+"flex:1'>"+qtyFmt+" "+_pName(it.productId,it.productName)+"</span>"+doneIcon;
        } else if(it.unit==="mista"){
          var mistaStr="";
          if(it.qtyKg&&parseFloat(it.qtyKg)>0)mistaStr+="<span style='font-weight:700;color:"+(done?"#bbb":"var(--t)")+"'>"+parseFloat(it.qtyKg).toFixed(3).replace(".",",")+" kg</span>";
          if(it.qtyPz&&parseFloat(it.qtyPz)>0){if(mistaStr)mistaStr+=" + ";mistaStr+="<span style='font-weight:700;color:"+(done?"#bbb":"var(--t)")+"'>"+parseInt(it.qtyPz)+" pz</span>";}
          innerWrap.innerHTML="<span style='font-size:15px;font-weight:700;"+dec+"flex:1'>"+_pName(it.productId,it.productName)+"</span>"+mistaStr+doneIcon;
        } else {
          innerWrap.innerHTML=
            "<span style='font-size:15px;font-weight:700;"+dec+"flex:1'>"+_pName(it.productId,it.productName)+"</span>"+
            "<span style='font-size:14px;font-weight:700;color:"+(done?"#bbb":"var(--t)")+"'>"+qtyFmt+"</span>"+
            doneIcon;
        }
        (function(i){innerWrap.onclick=function(){window.toggleItem(o.id,i);};})(idx);
        mainRow.appendChild(innerWrap);
        mainRow.appendChild(makeItemActions(o.id,idx,isKg,it.qty));
        itemsWrap.appendChild(mainRow);
      }
    });
    ms.appendChild(itemsWrap);

    // importo
    var impDiv=document.createElement("div");
    impDiv.className="fg";
    impDiv.innerHTML="<label class='lbl'>Importo €</label>"+
      "<div style='display:flex;gap:8px'>"+
        "<input class='inp' type='number' step='0.01' id='det-imp' value='"+(o.importo||"")+"' placeholder='0.00' style='flex:1;font-size:18px;font-weight:700'>"+
      "</div>";
    var saveImpBtn=document.createElement("button");
    saveImpBtn.className="btn btn-p";saveImpBtn.textContent="💾 Salva";
    saveImpBtn.onclick=function(){window.saveImp(o.id);};
    impDiv.querySelector("div").appendChild(saveImpBtn);
    ms.appendChild(impDiv);

    // stato
    var s=o.stato||"nuovo";
    var statoColors={"nuovo":"#E3F0FF","preparato":"#FFF3E0","pronto":"#E8F5E3","ritirato":"#F0F0F0"};
    var statoTx={"nuovo":"#1A6BD4","preparato":"#E65100","pronto":"#3A7A2A","ritirato":"#888"};
    var statoDiv=document.createElement("div");
    statoDiv.className="fg";
    statoDiv.innerHTML="<label class='lbl'>Stato</label>";
    var statoBtns=document.createElement("div");
    statoBtns.style.cssText="display:flex;gap:8px;flex-wrap:wrap";
    STATI.forEach(function(st){
      var b=document.createElement("button");
      b.className="btn btn-sm";
      b.style.cssText="flex:1;background:"+(s===st?statoColors[st]:"var(--cd)")+";color:"+(s===st?statoTx[st]:"var(--txl)")+";border:2px solid "+(s===st?statoTx[st]:"transparent");
      b.innerHTML=STATO_ICON[st]+" "+st;
      (function(st2){b.onclick=function(){window.chStato(o.id,st2);};})(st);
      statoBtns.appendChild(b);
    });
    statoDiv.appendChild(statoBtns);
    ms.appendChild(statoDiv);

    // reinvio manuale messaggi WhatsApp per stato (riga separata, dimensioni uniformi)
    if(o.customerPhone&&WA_API_CFG.enabled){
      var resendDiv=document.createElement("div");
      resendDiv.className="fg";
      resendDiv.innerHTML="<label class='lbl'>Rimanda notifica WhatsApp</label>";
      var resendBtns=document.createElement("div");
      resendBtns.style.cssText="display:flex;gap:8px";
      ["nuovo","pronto","ritirato"].forEach(function(st){
        var rb=document.createElement("button");
        rb.type="button";
        rb.className="btn btn-sm";
        rb.style.cssText="flex:1;background:#25D366;color:#fff";
        rb.innerHTML="↻ "+st;
        (function(st2){rb.onclick=function(){sendWAapiWithFeedback(o.id,st2);};})(st);
        resendBtns.appendChild(rb);
      });
      resendDiv.appendChild(resendBtns);
      ms.appendChild(resendDiv);
    }

    // close button
    var closeRow=document.createElement("div");
    closeRow.style.cssText="display:flex;gap:10px;margin-top:8px";
    var closeBtn=document.createElement("button");
    closeBtn.className="btn btn-s";closeBtn.style.flex="1";closeBtn.textContent="Chiudi";
    closeBtn.onclick=closeModal;
    closeRow.appendChild(closeBtn);
    ms.appendChild(closeRow);

    return ms;
  }

  function render(){
    var o=orders.find(function(x){return x.id===id;});
    if(!o)return closeModal();
    var dom=buildDetailDOM(o);
    // inject into modal or detail panel
    if(isDesktop()){
      var dp=document.getElementById("detail-panel-content");
      var de=document.getElementById("detail-panel-empty");
      var xBtn=document.createElement("button");
      xBtn.innerHTML="✕";
      xBtn.style.cssText="position:absolute;top:12px;right:12px;background:none;border:none;font-size:22px;color:var(--txl);cursor:pointer;z-index:20;padding:4px";
      xBtn.onclick=clearDetailPanel;
      var outer=document.createElement("div");
      outer.style.position="relative";
      outer.appendChild(xBtn);outer.appendChild(dom);
      if(dp){dp.innerHTML="";dp.appendChild(outer);dp.style.display="block";}
      if(de)de.style.display="none";
      var ab=document.querySelector(".app-body");
      if(ab)ab.classList.add("detail-open");
    } else {
      var ms=document.getElementById("modal-sheet");
      var xBtn2=document.createElement("button");
      xBtn2.innerHTML="✕";
      xBtn2.style.cssText="position:absolute;top:12px;right:12px;background:none;border:none;font-size:22px;color:var(--txl);cursor:pointer;z-index:20;padding:4px";
      xBtn2.onclick=closeModal;
      var outer2=document.createElement("div");
      outer2.style.position="relative";
      outer2.appendChild(xBtn2);outer2.appendChild(dom);
      ms.innerHTML="";ms.appendChild(outer2);
      document.getElementById("modal").classList.add("open");
      setFabDisplay(false);
    }
  }

  _detailMode=false;
  window.delOrder=function(oid){
    var o=orders.find(function(x){return x.id===oid;});
    if(!o) return;
    if(!_isAdmin()){
      var pv=_userPV();
      if(o.pv!==pv){alert("Non hai i permessi per eliminare questo ordine.");return;}
    }
    if(confirm("Eliminare questo ordine?")){
      var _delId=oid;
      orders=orders.filter(function(x){return x.id!==_delId;});
      localStorage.setItem("pf_orders",JSON.stringify(orders));
      lsDel("orders",_delId);closeModal();clearDetailPanel();refreshAll();renderCalendar();
    }
  };
  window.saveImp=function(oid){
    var v=document.getElementById("det-imp").value;
    orders=orders.map(function(x){return x.id===oid?Object.assign({},x,{importo:v,stato:v?"pronto":x.stato}):x;});
    lsSetOrder(orders.find(function(x){return x.id===oid;}));refreshAll();render();
    var _siO=orders.find(function(x){return x.id===oid;});
    if(v&&_siO&&_siO.customerPhone)showWAReminder("pronto");
  };
  window.chStato=function(oid,s){
    orders=orders.map(function(x){return x.id===oid?Object.assign({},x,{stato:s}):x;});
    lsSetOrder(orders.find(function(x){return x.id===oid;}));refreshAll();render();
    var _csO=orders.find(function(x){return x.id===oid;});
    if((s==="pronto"||s==="ritirato")&&_csO&&_csO.customerPhone){
      const autoFlag=(s==="pronto"&&WA_API_CFG.autoPronte)||(s==="ritirato"&&WA_API_CFG.autoRitirato);
      if(WA_API_CFG.enabled&&autoFlag)sendWAapiWithFeedback(oid,s);
      else showWAReminder(s);
    }
  };
  /* Helper: count total "tappable" rows for this order (groups for kg+confezioni, 1 per other item) */
  function countTappable(o){
    var tot=0;
    (o.items||[]).forEach(function(it){
      var isKg=it.unit==="kg";
      var nConf=it.confezioni?it.confezioni.length:1;
      if(nConf>1&&it.confezioni)tot+=fmtConfezioniGroups(it.confezioni,it.unit).length;
      else tot+=1;
    });
    return tot;
  }
  /* Helper: collect all tappable keys for this order */
  function allTappableKeys(o){
    var keys=[];
    (o.items||[]).forEach(function(it,idx){
      var isKg=it.unit==="kg";
      var nConf=it.confezioni?it.confezioni.length:1;
      if(nConf>1&&it.confezioni){
        fmtConfezioniGroups(it.confezioni,it.unit).forEach(function(g){keys.push(String(idx)+":"+g.qty);});
      } else {
        keys.push(String(idx));
      }
    });
    return keys;
  }
  window.toggleItemKey=function(oid,key){
    var o=orders.find(function(x){return x.id===oid;});if(!o)return;
    var done=new Set((o.itemsDone||[]).map(String));
    var wasRemoving=done.has(key);
    if(wasRemoving)done.delete(key);else done.add(key);
    var newDone=[...done];
    var allKeys=allTappableKeys(o);
    var allDone=allKeys.length>0&&allKeys.every(function(k){return done.has(k);});
    var newStato=o.stato,newImporto=o.importo;
    if(wasRemoving){newImporto="";if(o.stato==="pronto"||o.stato==="preparato")newStato="nuovo";}
    else if(allDone&&o.stato==="nuovo")newStato="preparato";
    orders=orders.map(function(x){return x.id===oid?Object.assign({},x,{itemsDone:newDone,stato:newStato,importo:newImporto}):x;});
    lsSetOrder(orders.find(function(x){return x.id===oid;}));refreshAll();render();
  };
  window.toggleItem=function(oid,idx){
    var key=String(idx);
    var o=orders.find(function(x){return x.id===oid;});if(!o)return;
    var done=new Set((o.itemsDone||[]).map(String));
    var wasRemoving=done.has(key);
    if(wasRemoving)done.delete(key);else done.add(key);
    var newDone=[...done];
    var allKeys=allTappableKeys(o);
    var allDone=allKeys.length>0&&allKeys.every(function(k){return done.has(k);});
    var newStato=o.stato,newImporto=o.importo;
    if(wasRemoving){newImporto="";if(o.stato==="pronto"||o.stato==="preparato")newStato="nuovo";}
    else if(allDone&&o.stato==="nuovo")newStato="preparato";
    orders=orders.map(function(x){return x.id===oid?Object.assign({},x,{itemsDone:newDone,stato:newStato,importo:newImporto}):x;});
    lsSetOrder(orders.find(function(x){return x.id===oid;}));refreshAll();render();
  };

  // ── detailEditItem: modifica inline la quantità di un prodotto ──────────
  window.detailEditItem=function(oid,itemIdx,isKg){
    var o=orders.find(function(x){return x.id===oid;});
    if(!o)return;
    var it=o.items[itemIdx];
    if(!it)return;
    var isMista=(it.unit==="mista");
    var newItems=o.items.slice();
    if(isMista){
      var kgVal=it.qtyKg?parseFloat(it.qtyKg):0;
      var pzVal=it.qtyPz?parseInt(it.qtyPz):0;
      var ansKg=window.prompt("Quantità kg di "+it.productName+" (attuale: "+kgVal.toFixed(3).replace(".",",")+"):",kgVal>0?kgVal.toFixed(3):"");
      if(ansKg===null)return;
      var newKg=parseFloat(ansKg.replace(",","."))||0;
      var ansPz=window.prompt("Quantità pz di "+it.productName+" (attuale: "+pzVal+"):",pzVal>0?String(pzVal):"");
      if(ansPz===null)return;
      var newPz=parseInt(ansPz)||0;
      if(newKg<0||newPz<0)return alert("Quantità non valida");
      if(newKg<=0&&newPz<=0){newItems.splice(itemIdx,1);}
      else{newItems[itemIdx]=Object.assign({},it,{qtyKg:newKg>0?String(newKg):"",qtyPz:newPz>0?String(newPz):"",qty:newKg>0?String(newKg):(newPz>0?String(newPz):"")});}
    } else {
      var curQty=isKg?parseFloat(it.qty).toFixed(3):String(parseInt(it.qty)||it.qty);
      var unit=it.unit||"kg";
      var ansQty=window.prompt("Quantità di "+it.productName+" ("+unit+"):",curQty);
      if(ansQty===null)return;
      var newQty=unit==="kg"?parseFloat(ansQty.replace(",",".")):parseInt(ansQty);
      if(isNaN(newQty)||newQty<0)return alert("Quantità non valida");
      if(newQty<=0){newItems.splice(itemIdx,1);}
      else{newItems[itemIdx]=Object.assign({},it,{qty:String(newQty)});}
    }
    orders=orders.map(function(x){return x.id===oid?Object.assign({},x,{items:newItems}):x;});
    lsSetOrder(orders.find(function(x){return x.id===oid;}));
    refreshAll();render();
  };
  // ── detailDeleteItem: elimina un prodotto dall'ordine ───────────────────
  window.detailDeleteItem=function(oid,itemIdx){
    var o=orders.find(function(x){return x.id===oid;});
    if(!o)return;
    var it=o.items[itemIdx];
    if(!it)return;
    if(!confirm('Eliminare "'+it.productName+'" dall\'ordine?'))return;
    var newItems=o.items.slice();
    newItems.splice(itemIdx,1);
    // aggiusta itemsDone: rimuovi le chiavi relative all'indice eliminato e riscala
    var done=new Set((o.itemsDone||[]).map(String));
    var newDone=[];
    (o.itemsDone||[]).forEach(function(k){
      var ks=String(k);
      var ki=parseInt(ks.split(":")[0]);
      if(ki===itemIdx)return; // elimina questa chiave
      if(ki>itemIdx){
        // riscala l'indice
        var rest=ks.indexOf(":")>=0?ks.slice(ks.indexOf("")):"";
        newDone.push(String(ki-1)+(ks.indexOf(":")>=0?ks.slice(ks.indexOf(":")):""));
      } else {
        newDone.push(ks);
      }
    });
    orders=orders.map(function(x){return x.id===oid?Object.assign({},x,{items:newItems,itemsDone:newDone}):x;});
    lsSetOrder(orders.find(function(x){return x.id===oid;}));
    refreshAll();render();
  };

  render();
}

/* ════ PRODUCT FORM ════ */
let pfImg="🍝";
let pfUnit="kg";
function openProdForm(id){
  const p=id?products.find(x=>x.id===id):null;
  pfImg=p?p.image:"🍝";
  pfUnit=p?(p.unit||"kg"):"kg";
  const catOpts="<option value=''>-- Nessuna --</option>"+
    categories.map(c=>"<option value='"+c.id+"'"+(p&&p.catId===c.id?" selected":"")+">"+c.icon+" "+c.name+"</option>").join("");
  showModal(
    "<div class='sheet-hd'></div>"+
    "<div class='sheet-ti'>"+(p?"Modifica Prodotto":"Nuovo Prodotto")+"</div>"+
    "<div class='fg'><label class='lbl'>Icona</label>"+
    "<div style='display:flex;flex-wrap:wrap;gap:6px' id='pf-emojis'>"+
    EMOJIS.map(e=>"<span class='chip "+(pfImg===e?"chip-on":"chip-off")+"' style='font-size:20px;padding:5px 9px' onclick=\"pfPick('"+e+"')\">"+e+"</span>").join("")+
    "</div></div>"+
    "<div class='fg'><label class='lbl'>Nome Prodotto</label>"+
    "<input class='inp' id='pf-name' placeholder=\"es. Tagliatelle all'uovo\" value='"+(p?p.name:"")+"'></div>"+
    "<div class='fg'><label class='lbl'>Sigla / Abbreviazione</label>"+
    "<input class='inp' id='pf-short' placeholder='es. Tagl. uovo' value='"+(p&&p.shortName?p.shortName:"")+"'>"+
    "<div style='font-size:11px;color:var(--txl);margin-top:5px'>Nome breve usato negli ordini, nelle chips e nella pulsantiera da 15\". Se vuoto, viene usato il nome completo.</div></div>"+
    "<div class='fg'><label class='lbl'>Categoria</label>"+
    "<select class='inp sel' id='pf-cat'>"+catOpts+"</select></div>"+
    "<div class='fg'><label class='lbl'>Unità di misura predefinita</label>"+
    "<div style='display:flex;gap:8px' id='pf-unit-toggle'>"+
      "<span class='chip "+(pfUnit==="kg"?"chip-on":"chip-off")+"' data-u='kg' style='flex:1;text-align:center;padding:8px' onclick=\"pfPickUnit('kg')\">kg (peso)</span>"+
      "<span class='chip "+(pfUnit==="pz"?"chip-on":"chip-off")+"' data-u='pz' style='flex:1;text-align:center;padding:8px' onclick=\"pfPickUnit('pz')\">pz (pezzi)</span>"+
    "</div>"+
    "<div style='font-size:11px;color:var(--txl);margin-top:5px'>Appare di default nella riga prodotto durante l'ordine (comunque modificabile con un tocco).</div></div>"+
    "<div class='fg'><label class='lbl'>Codice pulsantiera (opzionale)</label>"+
    "<input class='inp' id='pf-code' type='number' inputmode='numeric' min='1' max='200' placeholder='da 1 a 200' value='"+(p&&p.code?p.code:"")+"'>"+
    "<div style='font-size:11px;color:var(--txl);margin-top:5px'>Usato dalla schermata ordini sui monitor da 15\". Prodotti con lo <b>stesso codice</b> diventano versioni dello stesso pulsante.</div></div>"+
    "<div style='display:flex;gap:10px;margin-top:8px'>"+
      "<button class='btn btn-s' style='flex:1' onclick='closeModal()'>Annulla</button>"+
      "<button class='btn btn-p' style='flex:2' onclick=\"pfSave('"+(p?p.id:"")+"')\">💾 Salva</button>"+
    "</div>"
  );
}
function pfPickUnit(u){
  pfUnit=u;
  document.querySelectorAll("#pf-unit-toggle .chip").forEach(function(el){
    el.className="chip "+(el.dataset.u===u?"chip-on":"chip-off");
  });
}
function pfPick(e){pfImg=e;document.querySelectorAll("#pf-emojis .chip").forEach(el=>{el.className="chip "+(el.textContent.trim()===e?"chip-on":"chip-off");el.style.fontSize="20px";el.style.padding="5px 9px";});}
function pfSave(existId){
  const name=document.getElementById("pf-name").value.trim();
  const shortName=(document.getElementById("pf-short")||{value:""}).value.trim();
  const unit=pfUnit==="pz"?"pz":"kg";
  const catId=document.getElementById("pf-cat").value;
  const codeRaw=document.getElementById("pf-code").value.trim();
  let code=null;
  if(codeRaw){
    code=parseInt(codeRaw,10);
    if(!code||code<1||code>200)return alert("Il codice deve essere un numero tra 1 e 200 (oppure lascialo vuoto).");
  }
  if(!name)return alert("Inserisci il nome del prodotto");
  const prod={id:existId||uid(),name,shortName:shortName||"",unit,image:pfImg,catId:catId||"",code:code};
  if(existId)products=products.map(x=>x.id===prod.id?prod:x);else products.push(prod);
  lsSet("pf_products",products);closeModal();renderProducts();
}

/* ════ CUSTOMER FORM ════ */
function openCatForm(id){
  const c=id?categories.find(x=>x.id===id):null;
  const catEmojis=["🍝","🥟","🫕","🥣","🍲","🧆","🥩","🫔","🥗","🍜"];
  let catIcon=c?c.icon:"🍝";

  // use DOM to build modal to avoid quote issues
  const wrap=document.createElement("div");
  wrap.innerHTML=
    "<div class='sheet-hd'></div>"+
    "<div class='sheet-ti'>"+(c?"Modifica Categoria":"Nuova Categoria")+"</div>"+
    "<div class='fg'><label class='lbl'>Icona</label>"+
    "<div id='cat-emojis' style='display:flex;flex-wrap:wrap;gap:6px'></div></div>"+
    "<div class='fg'><label class='lbl'>Nome Categoria</label>"+
    "<input class='inp' id='cf-catname' placeholder='es. Paste fresche' value='"+(c?c.name:"")+"'></div>"+
    "<div style='display:flex;gap:10px;margin-top:8px'>"+
      "<button id='cat-cancel' class='btn btn-s' style='flex:1'>Annulla</button>"+
      "<button id='cat-save' class='btn btn-p' style='flex:2'>💾 Salva</button>"+
    "</div>";

  const closeBtn2=document.createElement("button");
  closeBtn2.innerHTML="✕";
  closeBtn2.setAttribute("style","position:absolute;top:14px;right:14px;background:none;border:none;font-size:22px;color:var(--txl);cursor:pointer;line-height:1;z-index:10");
  closeBtn2.onclick=closeModal;
  const outer=document.createElement("div");
  outer.style.position="relative";
  outer.appendChild(closeBtn2);
  outer.appendChild(wrap);
  document.getElementById("modal-sheet").innerHTML="";
  document.getElementById("modal-sheet").appendChild(outer);
  document.getElementById("modal").classList.add("open");
  setFabDisplay(false);

  // build emoji chips via DOM
  const emojiWrap=document.getElementById("cat-emojis");
  catEmojis.forEach(e=>{
    const span=document.createElement("span");
    span.className="chip "+(catIcon===e?"chip-on":"chip-off");
    span.style.cssText="font-size:20px;padding:4px 8px";
    span.textContent=e;
    span.onclick=()=>{
      catIcon=e;
      emojiWrap.querySelectorAll(".chip").forEach(el=>{
        el.className="chip "+(el.textContent===e?"chip-on":"chip-off");
      });
    };
    emojiWrap.appendChild(span);
  });

  document.getElementById("cat-cancel").onclick=closeModal;
  document.getElementById("cat-save").onclick=()=>{
    const name=document.getElementById("cf-catname").value.trim();
    if(!name)return alert("Inserisci il nome della categoria");
    const cat={id:id||uid(),name:name,icon:catIcon};
    if(id)categories=categories.map(x=>x.id===cat.id?cat:x);else categories.push(cat);
    lsSet("pf_cats",categories);closeModal();renderProducts();
  };
}

function openCustForm(id){
  const c=id?customers.find(x=>x.id===id):null;
  showModal(
    "<div class='sheet-hd'></div>"+
    "<div class='sheet-ti'>"+(c?"Modifica Cliente":"Nuovo Cliente")+"</div>"+
    "<div class='fg'><label class='lbl'>Nome</label><input class='inp' id='cf-name' placeholder='Nome e Cognome' value='"+(c?c.name:"")+"'></div>"+
    "<div class='fg'><label class='lbl'>Telefono WhatsApp</label><input class='inp' id='cf-phone' placeholder='es. 3931234567' value='"+(c?c.phone||"":"")+"'></div>"+
    "<div style='display:flex;gap:10px;margin-top:8px'>"+
      "<button class='btn btn-s' style='flex:1' onclick='closeModal()'>Annulla</button>"+
      "<button class='btn btn-p' style='flex:2' onclick=\"cfSave('"+( c?c.id:"")+"')\">💾 Salva</button>"+
    "</div>"
  );
}
function cfSave(existId){
  const name=document.getElementById("cf-name").value.trim();
  const phone=normPhone(document.getElementById("cf-phone").value.trim());
  if(!name)return alert("Inserisci il nome");
  const existing=existId?customers.find(x=>x.id===existId):null;
  const cust=Object.assign({},existing,{id:existId||uid(),name,phone});
  if(existId)customers=customers.map(x=>x.id===cust.id?cust:x);else customers.push(cust);
  customers.sort((a,b)=>(a.name||'').localeCompare(b.name||'','it'));
  lsSet("pf_customers",customers);closeModal();renderCustomers();
}

/* ════ MANUTENZIONE: normalizza una tantum i numeri di telefono clienti salvati in formato non standard ════ */
async function cfNormalizePhones(){
  if(!_isAdmin())return;
  if(!confirm("Verranno controllati i numeri di telefono di tutti i "+customers.length+" clienti e corretti quelli in formato non standard (es. senza prefisso 39). Procedere?"))return;
  const btn=document.getElementById("cf-normphone-btn");
  const btnLabel=btn?btn.textContent:"";
  if(btn){btn.disabled=true;btn.textContent="⏳ Controllo in corso…";}
  const fixedNames=[];
  for(const c of customers){
    if(!c.phone)continue;
    const n=normPhone(c.phone);
    if(n&&n!==c.phone){
      c.phone=n;
      fixedNames.push(c.name||c.id);
      if(window.fbSaveDoc)await window.fbSaveDoc("customers",c.id,c);
    }
  }
  localStorage.setItem("pf_customers",JSON.stringify(customers));
  renderCustomers();
  if(btn){btn.disabled=false;btn.textContent=btnLabel;}
  alert(fixedNames.length
    ?"Corretti "+fixedNames.length+" numeri:\n"+fixedNames.join("\n")
    :"Tutti i numeri erano già nel formato corretto. Nessuna modifica necessaria.");
}

/* ════ CUSTOMER HISTORY ════ */
function openCustHistory(id){
  const c=customers.find(x=>x.id===id);
  const co=orders.filter(o=>o.customerId===id||o.customerName===c.name);
  const sorted=[...co].sort((a,b)=>b.date.localeCompare(a.date));
  const tot=sorted.filter(o=>o.importo).reduce((s,o)=>s+parseFloat(o.importo||0),0);
  showModal(
    "<div class='sheet-hd'></div>"+
    "<div style='display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px'>"+
    "<div class='sheet-ti' style='margin-bottom:0'>Storico – "+c.name+"</div>"+
    (c.phone?"<a href='tel:"+c.phone.replace(/\D/g,'')+"' class='btn btn-sm' style='background:#2196F3;color:#fff;text-decoration:none;font-size:15px;padding:7px 12px;display:inline-flex;align-items:center;flex-shrink:0'>📞</a>":"")+
    "</div>"+
    "<div class='stat-grid' style='margin-bottom:14px'>"+
      "<div class='stat'><div class='stat-val'>"+sorted.length+"</div><div class='stat-lbl'>Ordini</div></div>"+
      "<div class='stat'><div class='stat-val'>€"+tot.toFixed(2)+"</div><div class='stat-lbl'>Speso</div></div>"+
    "</div>"+
    (sorted.length===0?"<div class='empty'><div class='empty-ico'>📋</div><div>Nessun ordine</div></div>":
     sorted.map(o=>orderCardHTML(o,true)).join(""))
  );
  setTimeout(()=>{
    document.querySelectorAll("#modal-sheet .oc").forEach((el,i)=>{
      if(sorted[i])el.onclick=()=>{closeModal();setTimeout(()=>openOrderDetail(sorted[i].id),80);};
    });
  },50);
}

/* TABLE BUILDER */
function openTableBuilder(){
  var all=orders.filter(function(o){return o.date===orDate;});
  var day=orFilterPV==="tutti"?all:all.filter(function(o){return _normPV(o.pv)===orFilterPV;});
  if(day.length===0){alert("Nessun ordine per questo giorno");return;}

  var prodsInOrders={};
  day.forEach(function(o){
    if(o.items)o.items.forEach(function(i){
      var p=products.find(function(x){return x.name===i.productName;});
      if(p)prodsInOrders[p.id]=true;
    });
  });

  var selProds={};
  products.forEach(function(p){selProds[p.id]=!!prodsInOrders[p.id];});

  function getCatProdsInOrders(catId){
    return products.filter(function(p){return p.catId===catId&&prodsInOrders[p.id];});
  }

  function updateCatCheckbox(catId){
    var cb=document.getElementById("cat-chk-"+catId);
    if(!cb)return;
    var prods=getCatProdsInOrders(catId);
    var allSel=prods.length>0&&prods.every(function(p){return selProds[p.id];});
    var someSel=prods.some(function(p){return selProds[p.id];});
    cb.checked=allSel;
    cb.indeterminate=someSel&&!allSel;
  }

  function buildTbRows(filterQ){
    var q=(filterQ||"").toLowerCase().trim();
    var el=document.getElementById("tb-prod-list");
    if(!el)return;
    el.innerHTML="";
    var groups=categories.map(function(c){
      return {cat:c,prods:products.filter(function(p){return p.catId===c.id&&prodsInOrders[p.id]&&(!q||p.name.toLowerCase().includes(q));})};
    });
    var noCat=products.filter(function(p){
      return (!p.catId||!categories.find(function(c){return c.id===p.catId;}))&&prodsInOrders[p.id]&&(!q||p.name.toLowerCase().includes(q));
    });
    if(noCat.length)groups.push({cat:{id:"__nocat__",name:"Senza categoria",icon:"*"},prods:noCat});
    var found=false;
    groups.forEach(function(g){
      if(!g.prods.length)return;
      found=true;
      var hdr=document.createElement("div");
      hdr.style.cssText="background:var(--cd);padding:5px 10px;font-size:11px;font-weight:700;color:var(--br);display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none";
      var catChk=document.createElement("input");
      catChk.type="checkbox";
      catChk.id="cat-chk-"+g.cat.id;
      var allProdsInCat=getCatProdsInOrders(g.cat.id);
      catChk.checked=allProdsInCat.length>0&&allProdsInCat.every(function(p){return selProds[p.id];});
      catChk.indeterminate=allProdsInCat.some(function(p){return selProds[p.id];})&&!catChk.checked;
      catChk.style.cssText="width:16px;height:16px;accent-color:var(--t);flex-shrink:0;cursor:pointer";
      (function(g2,chk){
        chk.onchange=function(){
          var val=this.checked;
          getCatProdsInOrders(g2.cat.id).forEach(function(p){selProds[p.id]=val;});
          var list=document.getElementById("tb-prod-list");
          if(list)list.querySelectorAll(".prod-chk-"+g2.cat.id).forEach(function(c){c.checked=val;});
        };
        hdr.onclick=function(e){if(e.target!==chk){chk.checked=!chk.checked;chk.onchange.call(chk);}};
      })(g,catChk);
      hdr.appendChild(catChk);
      hdr.innerHTML+="<span>"+g.cat.icon+"</span><span>"+g.cat.name+"</span><span style='font-weight:400;color:var(--txl)'>("+g.prods.length+")</span>";
      el.appendChild(hdr);
      g.prods.forEach(function(p){
        var row=document.createElement("div");
        row.style.cssText="display:flex;align-items:center;gap:9px;padding:7px 10px 7px 22px;border-bottom:1px solid var(--cd);background:#fff;cursor:pointer";
        var chk=document.createElement("input");
        chk.type="checkbox";chk.checked=!!selProds[p.id];
        chk.className="prod-chk-"+g.cat.id;
        chk.style.cssText="width:16px;height:16px;accent-color:var(--t);flex-shrink:0;cursor:pointer";
        (function(pid,checkbox,rowEl,catId){
          var toggle=function(){
            selProds[pid]=!selProds[pid];
            checkbox.checked=selProds[pid];
            updateCatCheckbox(catId);
          };
          rowEl.onclick=function(e){if(e.target!==checkbox)toggle();};
          checkbox.onchange=function(){selProds[pid]=this.checked;updateCatCheckbox(catId);};
        })(p.id,chk,row,g.cat.id);
        var lbl=document.createElement("span");
        lbl.style.cssText="font-size:13px;flex:1";
        lbl.innerHTML=p.image+" "+p.name+" <span style='font-size:11px;color:var(--txl)'>("+p.unit+")</span>";
        row.appendChild(chk);row.appendChild(lbl);
        el.appendChild(row);
      });
    });
    if(!found)el.innerHTML="<div style='padding:14px;text-align:center;color:var(--txl);font-size:13px'>Nessun prodotto negli ordini di oggi</div>";
  }

  var orderedCount=Object.keys(prodsInOrders).length;

  function renderBuilder(){
    showModal(
      "<div class='sheet-hd'></div>"+
      "<div class='sheet-ti'>📊 Crea Lista Personalizzata</div>"+
      "<div style='font-size:12px;color:var(--txl);margin-bottom:10px'>"+GF[getDow(orDate)]+" "+fmtDate(orDate)+(orFilterPV!=="tutti"?" · "+orFilterPV:"")+" · "+day.length+" ordini · "+orderedCount+" articoli ordinati</div>"+
      "<div class='sec-lbl'>Seleziona articoli da includere (solo quelli ordinati oggi)</div>"+
      "<div style='display:flex;gap:8px;margin-bottom:8px'>"+
        "<button class='btn btn-s btn-sm' onclick='tbSelAll(true)'>"+String.fromCharCode(10003)+" Tutti</button>"+
        "<button class='btn btn-s btn-sm' onclick='tbSelAll(false)'>"+String.fromCharCode(215)+" Nessuno</button>"+
      "</div>"+
      "<div style='position:relative;margin-bottom:8px'>"+
        "<span style='position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:13px;pointer-events:none'>&#128269;</span>"+
        "<input class='inp' id='tb-search' placeholder='Cerca articolo...' oninput='tbFilter(this.value)' style='padding-left:32px;font-size:13px;background:#fff'>"+
      "</div>"+
      "<div id='tb-prod-list' style='border:1.5px solid var(--cd);border-radius:var(--rs);overflow:hidden;max-height:40vh;overflow-y:auto'></div>"+
      "<div class='divider'></div>"+
      "<div style='display:flex;gap:10px;margin-top:4px'>"+
        "<button class='btn btn-s' style='flex:1' onclick='closeModal()'>Annulla</button>"+
        "<button class='btn btn-p' style='flex:2' onclick='generateTable()'>"+String.fromCharCode(128248)+" Genera e Stampa</button>"+
      "</div>"
    );
    setTimeout(function(){buildTbRows("");},60);
  }

  window.tbFilter=function(q){buildTbRows(q);};
  window.tbSelAll=function(val){
    products.forEach(function(p){if(prodsInOrders[p.id])selProds[p.id]=val;});
    var el=document.getElementById("tb-prod-list");
    if(el){
      el.querySelectorAll("input[type=checkbox]").forEach(function(c){c.checked=val;c.indeterminate=false;});
    }
  };

  window.generateTable=function(){
    var selProdsArr=products.filter(function(p){return selProds[p.id];});
    if(!selProdsArr.length){alert("Seleziona almeno un articolo");return;}

    // Usa funzione condivisa con regole R1-R6
    var fmtItemQty=_fmtItemQtyPrint;

    // Colonne per CATEGORIA; ogni categoria include solo prodotti selezionati
    // che abbiano almeno un ordine nel giorno (punto 4)
    var selNames={};selProdsArr.forEach(function(p){selNames[p.name]=p;});
    var catCols=[];
    categories.forEach(function(cat){
      // Prodotti selezionati di questa categoria presenti in almeno un ordine
      var prods=selProdsArr.filter(function(p){
        if(p.catId!==cat.id)return false;
        return day.some(function(o){return o.items&&o.items.find(function(i){return i.productName===p.name;});});
      });
      if(prods.length)catCols.push({cat:cat,prods:prods});
    });
    var nocat=selProdsArr.filter(function(p){
      var inCat=categories.find(function(c){return c.id===p.catId;});
      if(inCat)return false;
      return day.some(function(o){return o.items&&o.items.find(function(i){return i.productName===p.name;});});
    });
    if(nocat.length)catCols.push({cat:{id:"__nc__",name:"Altro",icon:""},prods:nocat});

    var rows=day.filter(function(o){return o.items&&o.items.some(function(i){return selNames[i.productName];});});
    if(!rows.length){alert("Nessun ordine contiene gli articoli selezionati");return;}

    var pw=window.open("","_blank");
    var title=GF[getDow(orDate)]+" "+fmtDate(orDate)+(orFilterPV!=="tutti"?" - "+orFilterPV:"");

    var h="<!DOCTYPE html><html lang='it'><head><meta charset='UTF-8'>"+
      "<title>Lista "+fmtDate(orDate)+"</title>"+
      "<style>"+
      "@page{size:A4 landscape;margin:8mm 10mm}"+
      "body{font-family:Arial,sans-serif;padding:0;margin:0;font-size:11px}"+
      "h1{font-size:14px;margin:0 0 1px 0;color:#5C3317;display:inline}"+
      ".sub{font-size:10px;color:#888;display:inline;margin-left:10px}"+
      ".hd{margin-bottom:6px;display:flex;align-items:baseline;justify-content:space-between}"+
      "table{width:100%;border-collapse:collapse;table-layout:auto}"+
      "th{background:#f0dcc8;border:1px solid #bbb;padding:4px 6px;font-size:10px;font-weight:700;text-align:center}"+
      "th.th-cli{text-align:left;width:115px;white-space:nowrap}"+
      "th.th-pv{width:56px;white-space:nowrap}"+
      "th.th-or{width:42px;white-space:nowrap}"+
      "th.th-nt{width:68px;text-align:left;white-space:nowrap}"+
      "th.th-cat{min-width:90px}"+
      "td{border:1px solid #ddd;padding:3px 5px;font-size:10px;vertical-align:top}"+
      "td.td-cli{font-weight:700;color:#3a3a3a;white-space:nowrap;vertical-align:middle}"+
      "td.td-pv{font-size:9px;color:#666;text-align:center;white-space:nowrap;vertical-align:middle}"+
      "td.td-or{text-align:center;font-size:9px;color:#555;white-space:nowrap;vertical-align:middle}"+
      "td.td-nt{font-size:9px;color:#777;font-style:italic;vertical-align:top}"+
      "td.td-cat{vertical-align:top}"+
      /* prodotto nella cella: flex-wrap orizzontale con ; come separatore */
      ".pblock{display:inline-flex;flex-wrap:wrap;align-items:baseline;width:100%;gap:0}"+
      ".pitem{display:inline-flex;align-items:baseline;gap:2px;white-space:nowrap}"+
      ".pname{color:#222;font-weight:600;font-size:10px}"+
      ".psep{color:#C4622D;font-weight:900;font-size:12px;margin:0 4px;line-height:1}"+
      "td.e{color:#ccc;text-align:center;font-size:9px;vertical-align:middle}"+
      "tr:nth-child(even) td{background:#fdf8f3}"+
      "@media print{.noprint{display:none!important}}"+
      "</style></head><body>"+
      "<div class='hd'>"+
        "<div><h1>"+title+"</h1><span class='sub'>"+rows.length+" ordini</span></div>"+
        "<button class='noprint' onclick='window.print()' style='padding:4px 12px;background:#C4622D;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:11px'>Stampa</button>"+
      "</div>"+
      "<table><thead><tr>"+
        "<th class='th-cli'>Cliente</th>"+
        "<th class='th-pv'>P.Vendita</th>";
    catCols.forEach(function(cc){
      h+="<th class='th-cat'>"+(cc.cat.icon?cc.cat.icon+" ":"")+cc.cat.name+"</th>";
    });
    h+="<th class='th-nt'>Note</th><th class='th-or'>Orario</th></tr></thead><tbody>";

    var sorted=rows.slice().sort(function(a,b){
      var ta=a.orarioRitiro||a.orarioConsegna||"";
      var tb=b.orarioRitiro||b.orarioConsegna||"";
      return ta.localeCompare(tb);
    });

    sorted.forEach(function(o){
      h+="<tr><td class='td-cli'>"+o.customerName+"</td><td class='td-pv'>"+o.pv+"</td>";
      catCols.forEach(function(cc){
        var items=[];
        cc.prods.forEach(function(p){
          var item=o.items?o.items.find(function(i){return i.productName===p.name;}):null;
          if(item)items.push({p:p,item:item});
        });
        if(!items.length){h+="<td class='e'>·</td>";return;}
        // Costruisce blocco orizzontale: nome qty ; nome qty ; ...
        // Ogni "pitem" non si spezza (white-space:nowrap), la riga si wrappa fra prodotti
        var parts=items.map(function(x){
          // Usa _fmtItemText per rispettare R4 (pz singola: "3 Nome") e tutte le altre regole
          var fullText=_fmtItemText(x.item);
          // Converti in HTML sostituendo "x" con il simbolo moltiplicazione e applicando stili
          var html=fullText
            .replace(/\b(\d+)x(\d)/g,function(_,n,d){return "<b>"+n+"</b><span style='color:#888'>x</span><b style='color:#C4622D'>"+d;})
            .replace(/(\d+,\d+)\s*(kg)/g,"<b style='color:#C4622D'>$1</b><span style='font-size:9px;color:#888;margin-left:1px'>$2</span>")
            .replace(/(\d+)\s*(pz)/g,"<b style='color:#C4622D'>$1</b><span style='font-size:9px;color:#888;margin-left:1px'>$2</span>")
            .replace(/,\s*/g,"<span style='color:#bbb;margin:0 2px'>,</span>");
          return "<span class='pitem'>"+html+"</span>";
        });
        // Unisce con separatore ; (il separatore è inline, tra gli item, così wrap avviene dopo il ;)
        var inner="";
        parts.forEach(function(part,i){
          inner+=part;
          if(i<parts.length-1)inner+="<span class='psep'>;</span>";
        });
        h+="<td class='td-cat'><div class='pblock'>"+inner+"</div></td>";
      });
      h+="<td class='td-nt'>"+(o.notes||"")+"</td>";
      var orario=(o.orarioRitiro||o.orarioConsegna||"-")+(o.consegna?" \u2708":"");
      h+="<td class='td-or'>"+orario+"</td></tr>";
    });

    h+="</tbody></table></body></html>";
    pw.document.write(h);pw.document.close();closeModal();
  };

  renderBuilder();
}

/* TABLE BUILDER */
function openTableBuilder(){
  var all=orders.filter(function(o){return o.date===orDate;});
  var day=orFilterPV==="tutti"?all:all.filter(function(o){return _normPV(o.pv)===orFilterPV;});
  if(day.length===0){alert("Nessun ordine per questo giorno");return;}

  var prodsInOrders={};
  day.forEach(function(o){
    if(o.items)o.items.forEach(function(i){
      var p=products.find(function(x){return x.name===i.productName;});
      if(p)prodsInOrders[p.id]=true;
    });
  });

  var selProds={};
  products.forEach(function(p){selProds[p.id]=!!prodsInOrders[p.id];});

  function getCatProdsInOrders(catId){
    return products.filter(function(p){return p.catId===catId&&prodsInOrders[p.id];});
  }

  function updateCatCheckbox(catId){
    var cb=document.getElementById("cat-chk-"+catId);
    if(!cb)return;
    var prods=getCatProdsInOrders(catId);
    var allSel=prods.length>0&&prods.every(function(p){return selProds[p.id];});
    var someSel=prods.some(function(p){return selProds[p.id];});
    cb.checked=allSel;
    cb.indeterminate=someSel&&!allSel;
  }

  function buildTbRows(filterQ){
    var q=(filterQ||"").toLowerCase().trim();
    var el=document.getElementById("tb-prod-list");
    if(!el)return;
    el.innerHTML="";
    var groups=categories.map(function(c){
      return {cat:c,prods:products.filter(function(p){return p.catId===c.id&&prodsInOrders[p.id]&&(!q||p.name.toLowerCase().includes(q));})};
    });
    var noCat=products.filter(function(p){
      return (!p.catId||!categories.find(function(c){return c.id===p.catId;}))&&prodsInOrders[p.id]&&(!q||p.name.toLowerCase().includes(q));
    });
    if(noCat.length)groups.push({cat:{id:"__nocat__",name:"Senza categoria",icon:"*"},prods:noCat});
    var found=false;
    groups.forEach(function(g){
      if(!g.prods.length)return;
      found=true;
      var hdr=document.createElement("div");
      hdr.style.cssText="background:var(--cd);padding:5px 10px;font-size:11px;font-weight:700;color:var(--br);display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none";
      var catChk=document.createElement("input");
      catChk.type="checkbox";
      catChk.id="cat-chk-"+g.cat.id;
      var allProdsInCat=getCatProdsInOrders(g.cat.id);
      catChk.checked=allProdsInCat.length>0&&allProdsInCat.every(function(p){return selProds[p.id];});
      catChk.indeterminate=allProdsInCat.some(function(p){return selProds[p.id];})&&!catChk.checked;
      catChk.style.cssText="width:16px;height:16px;accent-color:var(--t);flex-shrink:0;cursor:pointer";
      (function(g2,chk){
        chk.onchange=function(){
          var val=this.checked;
          getCatProdsInOrders(g2.cat.id).forEach(function(p){selProds[p.id]=val;});
          var list=document.getElementById("tb-prod-list");
          if(list)list.querySelectorAll(".prod-chk-"+g2.cat.id).forEach(function(c){c.checked=val;});
        };
        hdr.onclick=function(e){if(e.target!==chk){chk.checked=!chk.checked;chk.onchange.call(chk);}};
      })(g,catChk);
      hdr.appendChild(catChk);
      hdr.innerHTML+="<span>"+g.cat.icon+"</span><span>"+g.cat.name+"</span><span style='font-weight:400;color:var(--txl)'>("+g.prods.length+")</span>";
      el.appendChild(hdr);
      g.prods.forEach(function(p){
        var row=document.createElement("div");
        row.style.cssText="display:flex;align-items:center;gap:9px;padding:7px 10px 7px 22px;border-bottom:1px solid var(--cd);background:#fff;cursor:pointer";
        var chk=document.createElement("input");
        chk.type="checkbox";chk.checked=!!selProds[p.id];
        chk.className="prod-chk-"+g.cat.id;
        chk.style.cssText="width:16px;height:16px;accent-color:var(--t);flex-shrink:0;cursor:pointer";
        (function(pid,checkbox,rowEl,catId){
          var toggle=function(){
            selProds[pid]=!selProds[pid];
            checkbox.checked=selProds[pid];
            updateCatCheckbox(catId);
          };
          rowEl.onclick=function(e){if(e.target!==checkbox)toggle();};
          checkbox.onchange=function(){selProds[pid]=this.checked;updateCatCheckbox(catId);};
        })(p.id,chk,row,g.cat.id);
        var lbl=document.createElement("span");
        lbl.style.cssText="font-size:13px;flex:1";
        lbl.innerHTML=p.image+" "+p.name+" <span style='font-size:11px;color:var(--txl)'>("+p.unit+")</span>";
        row.appendChild(chk);row.appendChild(lbl);
        el.appendChild(row);
      });
    });
    if(!found)el.innerHTML="<div style='padding:14px;text-align:center;color:var(--txl);font-size:13px'>Nessun prodotto negli ordini di oggi</div>";
  }

  var orderedCount=Object.keys(prodsInOrders).length;

  function renderBuilder(){
    showModal(
      "<div class='sheet-hd'></div>"+
      "<div class='sheet-ti'>📊 Crea Lista Personalizzata</div>"+
      "<div style='font-size:12px;color:var(--txl);margin-bottom:10px'>"+GF[getDow(orDate)]+" "+fmtDate(orDate)+(orFilterPV!=="tutti"?" · "+orFilterPV:"")+" · "+day.length+" ordini · "+orderedCount+" articoli ordinati</div>"+
      "<div class='sec-lbl'>Seleziona articoli da includere (solo quelli ordinati oggi)</div>"+
      "<div style='display:flex;gap:8px;margin-bottom:8px'>"+
        "<button class='btn btn-s btn-sm' onclick='tbSelAll(true)'>"+String.fromCharCode(10003)+" Tutti</button>"+
        "<button class='btn btn-s btn-sm' onclick='tbSelAll(false)'>"+String.fromCharCode(215)+" Nessuno</button>"+
      "</div>"+
      "<div style='position:relative;margin-bottom:8px'>"+
        "<span style='position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:13px;pointer-events:none'>&#128269;</span>"+
        "<input class='inp' id='tb-search' placeholder='Cerca articolo...' oninput='tbFilter(this.value)' style='padding-left:32px;font-size:13px;background:#fff'>"+
      "</div>"+
      "<div id='tb-prod-list' style='border:1.5px solid var(--cd);border-radius:var(--rs);overflow:hidden;max-height:40vh;overflow-y:auto'></div>"+
      "<div class='divider'></div>"+
      "<div style='display:flex;gap:10px;margin-top:4px'>"+
        "<button class='btn btn-s' style='flex:1' onclick='closeModal()'>Annulla</button>"+
        "<button class='btn btn-p' style='flex:2' onclick='generateTable()'>"+String.fromCharCode(128248)+" Genera e Stampa</button>"+
      "</div>"
    );
    setTimeout(function(){buildTbRows("");},60);
  }

  window.tbFilter=function(q){buildTbRows(q);};
  window.tbSelAll=function(val){
    products.forEach(function(p){if(prodsInOrders[p.id])selProds[p.id]=val;});
    var el=document.getElementById("tb-prod-list");
    if(el){
      el.querySelectorAll("input[type=checkbox]").forEach(function(c){c.checked=val;c.indeterminate=false;});
    }
  };

  window.generateTable=function(){
    var selProdsArr=products.filter(function(p){return selProds[p.id];});
    if(!selProdsArr.length){alert("Seleziona almeno un articolo");return;}

    // Usa funzione condivisa con regole R1-R6
    var fmtItemQty=_fmtItemQtyPrint;

    // Colonne per CATEGORIA; ogni categoria include solo prodotti selezionati
    // che abbiano almeno un ordine nel giorno (punto 4)
    var selNames={};selProdsArr.forEach(function(p){selNames[p.name]=p;});
    var catCols=[];
    categories.forEach(function(cat){
      // Prodotti selezionati di questa categoria presenti in almeno un ordine
      var prods=selProdsArr.filter(function(p){
        if(p.catId!==cat.id)return false;
        return day.some(function(o){return o.items&&o.items.find(function(i){return i.productName===p.name;});});
      });
      if(prods.length)catCols.push({cat:cat,prods:prods});
    });
    var nocat=selProdsArr.filter(function(p){
      var inCat=categories.find(function(c){return c.id===p.catId;});
      if(inCat)return false;
      return day.some(function(o){return o.items&&o.items.find(function(i){return i.productName===p.name;});});
    });
    if(nocat.length)catCols.push({cat:{id:"__nc__",name:"Altro",icon:""},prods:nocat});

    var rows=day.filter(function(o){return o.items&&o.items.some(function(i){return selNames[i.productName];});});
    if(!rows.length){alert("Nessun ordine contiene gli articoli selezionati");return;}

    var pw=window.open("","_blank");
    var title=GF[getDow(orDate)]+" "+fmtDate(orDate)+(orFilterPV!=="tutti"?" - "+orFilterPV:"");

    var h="<!DOCTYPE html><html lang='it'><head><meta charset='UTF-8'>"+
      "<title>Lista "+fmtDate(orDate)+"</title>"+
      "<style>"+
      "@page{size:A4 landscape;margin:8mm 10mm}"+
      "body{font-family:Arial,sans-serif;padding:0;margin:0;font-size:11px}"+
      "h1{font-size:14px;margin:0 0 1px 0;color:#5C3317;display:inline}"+
      ".sub{font-size:10px;color:#888;display:inline;margin-left:10px}"+
      ".hd{margin-bottom:6px;display:flex;align-items:baseline;justify-content:space-between}"+
      "table{width:100%;border-collapse:collapse;table-layout:auto}"+
      "th{background:#f0dcc8;border:1px solid #bbb;padding:4px 6px;font-size:10px;font-weight:700;text-align:center}"+
      "th.th-cli{text-align:left;width:115px;white-space:nowrap}"+
      "th.th-pv{width:56px;white-space:nowrap}"+
      "th.th-or{width:42px;white-space:nowrap}"+
      "th.th-nt{width:68px;text-align:left;white-space:nowrap}"+
      "th.th-cat{min-width:90px}"+
      "td{border:1px solid #ddd;padding:3px 5px;font-size:10px;vertical-align:top}"+
      "td.td-cli{font-weight:700;color:#3a3a3a;white-space:nowrap;vertical-align:middle}"+
      "td.td-pv{font-size:9px;color:#666;text-align:center;white-space:nowrap;vertical-align:middle}"+
      "td.td-or{text-align:center;font-size:9px;color:#555;white-space:nowrap;vertical-align:middle}"+
      "td.td-nt{font-size:9px;color:#777;font-style:italic;vertical-align:top}"+
      "td.td-cat{vertical-align:top}"+
      /* prodotto nella cella: flex-wrap orizzontale con ; come separatore */
      ".pblock{display:inline-flex;flex-wrap:wrap;align-items:baseline;width:100%;gap:0}"+
      ".pitem{display:inline-flex;align-items:baseline;gap:2px;white-space:nowrap}"+
      ".pname{color:#222;font-weight:600;font-size:10px}"+
      ".psep{color:#C4622D;font-weight:900;font-size:12px;margin:0 4px;line-height:1}"+
      "td.e{color:#ccc;text-align:center;font-size:9px;vertical-align:middle}"+
      "tr:nth-child(even) td{background:#fdf8f3}"+
      "@media print{.noprint{display:none!important}}"+
      "</style></head><body>"+
      "<div class='hd'>"+
        "<div><h1>"+title+"</h1><span class='sub'>"+rows.length+" ordini</span></div>"+
        "<button class='noprint' onclick='window.print()' style='padding:4px 12px;background:#C4622D;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:11px'>Stampa</button>"+
      "</div>"+
      "<table><thead><tr>"+
        "<th class='th-cli'>Cliente</th>"+
        "<th class='th-pv'>P.Vendita</th>";
    catCols.forEach(function(cc){
      h+="<th class='th-cat'>"+(cc.cat.icon?cc.cat.icon+" ":"")+cc.cat.name+"</th>";
    });
    h+="<th class='th-nt'>Note</th><th class='th-or'>Orario</th></tr></thead><tbody>";

    var sorted=rows.slice().sort(function(a,b){
      var ta=a.orarioRitiro||a.orarioConsegna||"";
      var tb=b.orarioRitiro||b.orarioConsegna||"";
      return ta.localeCompare(tb);
    });

    sorted.forEach(function(o){
      h+="<tr><td class='td-cli'>"+o.customerName+"</td><td class='td-pv'>"+o.pv+"</td>";
      catCols.forEach(function(cc){
        var items=[];
        cc.prods.forEach(function(p){
          var item=o.items?o.items.find(function(i){return i.productName===p.name;}):null;
          if(item)items.push({p:p,item:item});
        });
        if(!items.length){h+="<td class='e'>·</td>";return;}
        // Costruisce blocco orizzontale: nome qty ; nome qty ; ...
        // Ogni "pitem" non si spezza (white-space:nowrap), la riga si wrappa fra prodotti
        var parts=items.map(function(x){
          // Usa _fmtItemText per rispettare R4 (pz singola: "3 Nome") e tutte le altre regole
          var fullText=_fmtItemText(x.item);
          // Converti in HTML sostituendo "x" con il simbolo moltiplicazione e applicando stili
          var html=fullText
            .replace(/\b(\d+)x(\d)/g,function(_,n,d){return "<b>"+n+"</b><span style='color:#888'>x</span><b style='color:#C4622D'>"+d;})
            .replace(/(\d+,\d+)\s*(kg)/g,"<b style='color:#C4622D'>$1</b><span style='font-size:9px;color:#888;margin-left:1px'>$2</span>")
            .replace(/(\d+)\s*(pz)/g,"<b style='color:#C4622D'>$1</b><span style='font-size:9px;color:#888;margin-left:1px'>$2</span>")
            .replace(/,\s*/g,"<span style='color:#bbb;margin:0 2px'>,</span>");
          return "<span class='pitem'>"+html+"</span>";
        });
        // Unisce con separatore ; (il separatore è inline, tra gli item, così wrap avviene dopo il ;)
        var inner="";
        parts.forEach(function(part,i){
          inner+=part;
          if(i<parts.length-1)inner+="<span class='psep'>;</span>";
        });
        h+="<td class='td-cat'><div class='pblock'>"+inner+"</div></td>";
      });
      h+="<td class='td-nt'>"+(o.notes||"")+"</td>";
      var orario=(o.orarioRitiro||o.orarioConsegna||"-")+(o.consegna?" \u2708":"");
      h+="<td class='td-or'>"+orario+"</td></tr>";
    });

    h+="</tbody></table></body></html>";
    pw.document.write(h);pw.document.close();closeModal();
  };

  renderBuilder();
}

/* DEMO DATA */
function loadDemoData(){
  if(orders.length>0)return;
  var t=todayStr(),y=addDays(t,-1),tm=addDays(t,1);
  var dc=[
    {id:"dc1",name:"Marco Rossi",phone:"393331234567"},
    {id:"dc2",name:"Giulia Bianchi",phone:"393349876543"},
    {id:"dc3",name:"Famiglia Conti",phone:"393357654321"},
    {id:"dc4",name:"Ristorante Da Mario",phone:"393361122334"},
    {id:"dc5",name:"Paola Ferretti",phone:"393375544332"},
  ];
  var p=products,find=function(n){return p.find(function(x){return x.name.indexOf(n)>-1;})||p[0];};
  var base=[
    {id:"do1",date:t,customerId:"dc1",customerName:"Marco Rossi",customerPhone:"393331234567",pv:"NUMANA",items:[{productId:find("Tagliatelle").id,productName:"Tagliatelle all'uovo",qty:"0.500",unit:"kg"},{productId:find("Tortellini").id,productName:"Tortellini ricotta e spinaci",qty:"0.300",unit:"kg"}],itemsDone:[0,1],consegna:false,orarioRitiro:"11:30",notes:"Senza glutine se possibile",stato:"preparato",importo:"",createdAt:new Date().toISOString()},
    {id:"do2",date:t,customerId:"dc2",customerName:"Giulia Bianchi",customerPhone:"393349876543",pv:"SIROLO",items:[{productId:find("Pappardelle").id,productName:"Pappardelle",qty:"1.000",unit:"kg"},{productId:find("Lasagne").id,productName:"Lasagne",qty:"4",unit:"pz"}],itemsDone:[0],consegna:false,orarioRitiro:"12:00",notes:"",stato:"nuovo",importo:"",createdAt:new Date().toISOString()},
    {id:"do3",date:t,customerId:"dc3",customerName:"Famiglia Conti",customerPhone:"393357654321",pv:"ANCONA",items:[{productId:find("Gnocchi").id,productName:"Gnocchi di patate",qty:"0.800",unit:"kg"},{productId:find("Tagliolini").id,productName:"Tagliolini",qty:"0.500",unit:"kg"}],itemsDone:[],consegna:true,indirizzoConsegna:"Via Roma 12, Ancona",orarioConsegna:"13:00",orarioRitiro:"",notes:"Citofono Conti",stato:"nuovo",importo:"",createdAt:new Date().toISOString()},
    {id:"do4",date:t,customerId:"dc4",customerName:"Ristorante Da Mario",customerPhone:"393361122334",pv:"OSIMO STAZIONE",items:[{productId:find("Tagliatelle").id,productName:"Tagliatelle all'uovo",qty:"2.000",unit:"kg"},{productId:find("Pappardelle").id,productName:"Pappardelle",qty:"1.500",unit:"kg"},{productId:find("Tortellini").id,productName:"Tortellini ricotta e spinaci",qty:"1.000",unit:"kg"}],itemsDone:[0,1,2],consegna:false,orarioRitiro:"10:00",notes:"Cliente abituale",stato:"pronto",importo:"28.50",createdAt:new Date().toISOString()},
    {id:"do5",date:t,customerId:"dc5",customerName:"Paola Ferretti",customerPhone:"393375544332",pv:"NUMANA",items:[{productId:find("Lasagne").id,productName:"Lasagne",qty:"2",unit:"pz"}],itemsDone:[0],consegna:false,orarioRitiro:"17:00",notes:"",stato:"ritirato",importo:"12.00",createdAt:new Date().toISOString()},
    {id:"do6",date:y,customerId:"dc1",customerName:"Marco Rossi",customerPhone:"393331234567",pv:"NUMANA",items:[{productId:find("Gnocchi").id,productName:"Gnocchi di patate",qty:"1.000",unit:"kg"}],itemsDone:[0],consegna:false,orarioRitiro:"11:00",notes:"",stato:"ritirato",importo:"9.00",createdAt:new Date().toISOString()},
    {id:"do7",date:tm,customerId:"dc2",customerName:"Giulia Bianchi",customerPhone:"393349876543",pv:"SIROLO",items:[{productId:find("Tortellini").id,productName:"Tortellini ricotta e spinaci",qty:"0.500",unit:"kg"},{productId:find("Tagliatelle").id,productName:"Tagliatelle all'uovo",qty:"0.500",unit:"kg"}],itemsDone:[],consegna:false,orarioRitiro:"10:30",notes:"Chiamare prima",stato:"nuovo",importo:"",createdAt:new Date().toISOString()},
  ];
  var nomi=[["Luca Marchetti","393381234501"],["Sara Valentini","393382234502"],["Antonio Greco","393383234503"],["Federica Mori","393384234504"],["Giovanni Ricci","393385234505"],["Elisa Lombardi","393386234506"],["Stefano Barbieri","393387234507"],["Chiara Fontana","393388234508"],["Roberto Esposito","393389234509"],["Martina Galli","393390234510"],["Davide Cattaneo","393391234511"],["Valentina Marini","393392234512"],["Francesco Ruggiero","393393234513"],["Silvia Coppola","393394234514"],["Massimo Bruno","393395234515"],["Elena Ferrara","393396234516"],["Andrea Russo","393397234517"],["Laura De Luca","393398234518"],["Simone Amato","393399234519"],["Cristina Serra","393400234520"],["Paolo Monti","393401234521"],["Alessia Rizzo","393402234522"],["Marco Villa","393403234523"],["Giovanna Costa","393404234524"],["Nicola Fabbri","393405234525"],["Marta Pellegrini","393406234526"],["Claudio Moretti","393407234527"],["Rossella Santoro","393408234528"],["Enrico Caruso","393409234529"],["Daniela Fiore","393410234530"],["Gianluca Poli","393411234531"],["Roberta Bassi","393412234532"],["Fabrizio Longo","393413234533"],["Patrizia Serra","393414234534"],["Vincenzo Riva","393415234535"],["Monica Grassi","393416234536"],["Alberto Sordi","393417234537"],["Cinzia Negri","393418234538"],["Emanuele Tosi","393419234539"],["Francesca Vitale","393420234540"],["Sergio Gatto","393421234541"],["Ornella Farina","393422234542"],["Tiziano Ferri","393423234543"],["Annamaria Costa","393424234544"],["Diego Palermo","393425234545"],["Luisa Neri","393426234546"],["Piero Romagnoli","393427234547"],["Carla Martini","393428234548"],["Bruno Conti","393429234549"],["Mirella Donati","393430234550"]];
  var combos=[[["Tagliatelle all'uovo","0.500","kg"],["Tortellini ricotta e spinaci","0.300","kg"]],[["Pappardelle","1.000","kg"]],[["Lasagne","4","pz"],["Gnocchi di patate","0.500","kg"]],[["Tagliolini","0.750","kg"],["Tagliatelle all'uovo","0.250","kg"]],[["Tortellini ricotta e spinaci","1.000","kg"],["Lasagne","2","pz"]],[["Gnocchi di patate","1.500","kg"]],[["Tagliatelle all'uovo","2.000","kg"],["Pappardelle","1.000","kg"]],[["Lasagne","6","pz"]],[["Tagliolini","0.500","kg"]],[["Tortellini ricotta e spinaci","0.500","kg"],["Gnocchi di patate","0.800","kg"]]];
  var statiList=["nuovo","nuovo","nuovo","preparato","preparato","pronto","ritirato"];
  var orari=["08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","14:00","15:00","16:00","17:00","17:30","18:00"];
  var note=["","","","Allergia al glutine","Chiamare prima","Urgente","","","","Senza sale",""];
  var extraC=[],extraO=[];
  nomi.forEach(function(nm,i){
    var cid="dcx"+i;
    extraC.push({id:cid,name:nm[0],phone:nm[1]});
    var combo=combos[i%combos.length];
    var pv=PUNTI[i%4];
    var stato=statiList[i%statiList.length];
    var orario=orari[i%orari.length];
    var items=combo.map(function(ci){var pr=p.find(function(x){return x.name.indexOf(ci[0].split(" ")[0])>-1;})||p[0];return {productId:pr.id,productName:pr.name,qty:ci[1],unit:ci[2]};});
    var allIdx=items.map(function(_,ii){return ii;});
    var itemsDone=[],importo="";
    if(stato==="preparato")itemsDone=allIdx;
    if(stato==="pronto"){itemsDone=allIdx;importo=(8+i%15)+"."+(50-i%50<10?"0":"")+(50-i%50);}
    if(stato==="ritirato"){itemsDone=allIdx;importo=(8+i%15)+"."+(50-i%50<10?"0":"")+(50-i%50);}
    var isC=i%7===0;
    extraO.push({id:"dox"+i,date:t,customerId:cid,customerName:nm[0],customerPhone:nm[1],pv:pv,items:items,itemsDone:itemsDone,consegna:isC,indirizzoConsegna:isC?"Via Garibaldi "+(i+1)+", "+pv:"",orarioConsegna:isC?orario:"",orarioRitiro:isC?"":orario,notes:note[i%note.length],stato:stato,importo:importo,createdAt:new Date().toISOString()});
  });
  customers=[...dc,...extraC];
  orders=[...base,...extraO];
  lsSet("pf_customers",customers);
  lsSet("pf_orders",orders);
  renderOrdini();
}
/* ════ INIT ════ */
// Se ci sono dati in localStorage li mostriamo subito (offline-first)
// Firebase aggiornerà in tempo reale non appena il listener risponde
if(orders.length === 0 && customers.length === 0) {
  // Primo avvio: carica i dati demo solo in locale (non su Firebase)
  // così l'utente vede qualcosa subito mentre Firebase si connette
}
document.getElementById("app").classList.add("tab-ordini-active");
_layoutOrdiniToolbar();
renderOrdini();

// Listener drag&drop globali registrati all'avvio
document.addEventListener("touchmove", _dragMove, {passive:false});
document.addEventListener("touchend", _dragEnd);
document.addEventListener("mousemove", _dragMove);
document.addEventListener("mouseup", _dragEnd);
// Blocca click sintetici post-drag
document.addEventListener("click", function(e){
  if(window._dragJustEnded){e.stopPropagation();e.preventDefault();}
}, true);

// Chiude il menu suggerimenti clienti (nuovo ordine) se si clicca fuori dal campo nome o dal menu stesso
document.addEventListener("click", function(e){
  var box=document.getElementById("f-sug");
  if(!box||!box.innerHTML)return;
  if(e.target.id==="f-name")return; // click sul campo stesso: lascia il menu aperto
  if(e.target.closest&&e.target.closest(".sug-item"))return; // click su un suggerimento: gestito da fPickCust
  box.innerHTML=""; // qualunque altro click (anche se "assorbito" dal menu sovrapposto) lo chiude
});

// ═══════════════════════════════════════════════
//  SCRITTURA A MANO – ZONE PER CAMPO (tablet+)
// ═══════════════════════════════════════════════
(function(){
  var penSize = 4;
  var eraserMode = false;
  var hwParsed = null;

  // Mappa zone: nome zona → {canvas, ctx, drawing, hasStrokes}
  var zones = {};
  var ZONE_NAMES = ['nome','telefono','prodotti-nome','prodotti-qty','orario','note','indirizzo','orario-consegna'];

  // ── GESTIONE API KEY ──
  // Salvataggio esplicito col pulsante 💾.
  // Per ri-visualizzare/modificare una chiave già salvata è richiesta
  // l'autenticazione del dispositivo (biometria, PIN, pattern…) via WebAuthn.

  window.hwSaveKeyBtn = function(){
    var inp = document.getElementById('hw-api-key');
    if(!inp) return;
    var val = inp.value.trim();
    if(!val){ showToast('Incolla prima la API key nel campo'); return; }
    localStorage.setItem('gv_api_key', val);
    hwKeyShowSaved();
    showToast('🔑 Chiave API salvata!');
  };

  window.hwSaveKey = function(val){ /* legacy — non usato */ };

  window.hwToggleKeyVisibility = function(){
    var inp = document.getElementById('hw-api-key');
    if(!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
  };

  // Mostra UI "chiave salvata" — input nascosto, badge verde visibile
  function hwKeyShowSaved(){
    // Nasconde l'intera riga — la chiave è protetta, non serve mostrarla
    var row  = document.getElementById('hw-apikey-row');
    if(row)  row.style.display = 'none';
  }

  // Mostra UI modifica — intera riga visibile, badge nascosto
  function hwKeyShowEdit(prefill){
    var row  = document.getElementById('hw-apikey-row');
    var inp  = document.getElementById('hw-api-key');
    var stat = document.getElementById('hw-key-status');
    var btn  = document.getElementById('hw-key-save-btn');
    var eye  = row ? row.querySelector('button[title="Mostra/nascondi"]') : null;
    if(row){  row.style.display = 'flex'; row.style.background = '#fffaf5'; }
    if(inp){  inp.style.display = ''; inp.value = prefill||''; inp.type = 'password'; }
    if(btn)  btn.style.display  = '';
    if(eye)  eye.style.display  = '';
    if(stat) stat.style.display = 'none';
    setTimeout(function(){ if(inp) inp.focus(); }, 80);
  }

  // Pulsante 🔑 in toolbar — se chiave già salvata richiede autenticazione
  window.hwShowKeyRow = function(){
    var saved = localStorage.getItem('gv_api_key') || '';
    if(!saved){ hwKeyShowEdit(''); return; }
    hwRequestBiometric(function(ok){
      if(ok){ hwKeyShowEdit(saved); }
      else   { showToast('🔒 Autenticazione non riuscita'); }
    });
  };

  // WebAuthn: chiede verifica utente (impronta, Face ID, PIN, pattern…)
  function hwRequestBiometric(callback){
    if(!window.PublicKeyCredential ||
       !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable){
      hwBiometricFallback(callback); return;
    }
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      .then(function(avail){
        if(!avail){ hwBiometricFallback(callback); return; }

        var challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        var credId = localStorage.getItem('hw_biometric_cred_id');

        if(!credId){
          // Prima volta: registra la credenziale platform
          navigator.credentials.create({ publicKey:{
            challenge: challenge,
            rp:{ name:'Il Pastaio', id: location.hostname||'localhost' },
            user:{ id: new TextEncoder().encode('pastaio-api-key'),
                   name:'pastaio', displayName:'Il Pastaio' },
            pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
            authenticatorSelection:{
              authenticatorAttachment:'platform',
              userVerification:'required',
              residentKey:'preferred'
            },
            timeout:60000
          }}).then(function(cred){
            localStorage.setItem('hw_biometric_cred_id',
              btoa(String.fromCharCode.apply(null, new Uint8Array(cred.rawId))));
            callback(true);
          }).catch(function(err){
            console.warn('WebAuthn create:', err.name);
            hwBiometricFallback(callback);
          });
        } else {
          // Credenziale già registrata: verifica
          var rawId = Uint8Array.from(atob(credId), function(c){ return c.charCodeAt(0); });
          navigator.credentials.get({ publicKey:{
            challenge: challenge,
            allowCredentials:[{id:rawId, type:'public-key'}],
            userVerification:'required',
            timeout:60000
          }}).then(function(){ callback(true); })
            .catch(function(err){
              console.warn('WebAuthn get:', err.name);
              if(err.name==='NotAllowedError'){ callback(false); }
              else {
                // Credenziale non più valida (es. nuovo dispositivo): ricrea
                localStorage.removeItem('hw_biometric_cred_id');
                hwRequestBiometric(callback);
              }
            });
        }
      }).catch(function(){ hwBiometricFallback(callback); });
  }

  // Fallback: prompt password del browser (quando WebAuthn non disponibile o fallisce)
  function hwBiometricFallback(callback){
    // Usiamo un overlay modale personalizzato invece di prompt() 
    // perché prompt() è bloccato in alcuni browser mobile
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = 
      '<div style="background:#fff;border-radius:16px;padding:24px 20px;width:100%;max-width:320px;box-shadow:0 8px 40px rgba(0,0,0,.3)">' +
        '<div style="font-size:16px;font-weight:700;color:#333;margin-bottom:6px">🔑 Verifica accesso</div>' +
        '<div style="font-size:13px;color:#666;margin-bottom:16px">Inserisci la password per visualizzare la chiave API</div>' +
        '<input id="hw-auth-pw" type="password" placeholder="Password…" style="width:100%;padding:10px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:15px;box-sizing:border-box;outline:none;margin-bottom:14px">' +
        '<div style="display:flex;gap:10px">' +
          '<button id="hw-auth-cancel" style="flex:1;padding:10px;border:1.5px solid #ddd;border-radius:8px;background:#fff;font-size:14px;cursor:pointer">Annulla</button>' +
          '<button id="hw-auth-ok" style="flex:2;padding:10px;border:none;border-radius:8px;background:#C4622D;color:#fff;font-size:14px;font-weight:700;cursor:pointer">Conferma</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    var pw = overlay.querySelector('#hw-auth-pw');
    pw.focus();
    overlay.querySelector('#hw-auth-cancel').onclick = function(){
      document.body.removeChild(overlay); callback(false);
    };
    overlay.querySelector('#hw-auth-ok').onclick = function(){
      document.body.removeChild(overlay);
      // Qualsiasi password non vuota è accettata — la protezione reale è biometrica
      // questo è solo un secondo layer di consapevolezza
      callback(pw.value.length > 0);
    };
    pw.addEventListener('keydown', function(e){
      if(e.key === 'Enter'){ overlay.querySelector('#hw-auth-ok').click(); }
    });
  }

  function hwLoadKey(){
    var saved = localStorage.getItem('gv_api_key') || '';
    var inp = document.getElementById('hw-api-key');
    if(inp) inp.value = saved; // mantieni in memoria per le chiamate API
    if(saved){
      hwKeyShowSaved(); // nasconde l'intera riga
    } else {
      hwKeyShowEdit(''); // mostra il box inserimento
    }
  }

  // ── VISIBILITÀ PULSANTE: visibile su TUTTI i dispositivi ──
  function hwCheckDevice(){
    var btn = document.getElementById('hw-open-btn');
    if(!btn) return;
    btn.style.display = 'flex';
    // Toolbar mobile
    var mob = document.getElementById('hw-mobile-toolbar');
    if(mob) mob.style.display = window.innerWidth < 768 ? 'flex' : 'none';
  }
  window.addEventListener('resize', hwCheckDevice);
  window.hwInitBtn = function(){ setTimeout(hwCheckDevice, 60); };

  // ── PREVIEW CANVAS NELLE ZONE COLLASSATE ──
  // Trova il bounding box del contenuto non-bianco nel canvas
  function hwCanvasBBox(canvas){
    var ctx = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    var data = ctx.getImageData(0, 0, w, h).data;
    var minX=w, maxX=0, minY=h, maxY=0;
    for(var y=0; y<h; y++){
      for(var x=0; x<w; x++){
        var i=(y*w+x)*4;
        // Pixel non bianco/trasparente
        if(data[i]<240 || data[i+1]<240 || data[i+2]<240){
          if(x<minX) minX=x; if(x>maxX) maxX=x;
          if(y<minY) minY=y; if(y>maxY) maxY=y;
        }
      }
    }
    if(minX>maxX) return null; // canvas vuoto
    // Aggiungi margine
    var pad=6;
    return { x:Math.max(0,minX-pad), y:Math.max(0,minY-pad),
             w:Math.min(w,maxX-minX+pad*2), h:Math.min(h,maxY-minY+pad*2) };
  }

  function hwUpdatePreview(zoneName){
    if(window.innerWidth >= 768) return;
    var previewId = 'hw-preview-'+(zoneName==='prodotti-nome'||zoneName==='prodotti-qty'?'prodotti':zoneName);
    var container = document.getElementById(previewId);
    if(!container) return;
    container.innerHTML = '';

    // Per prodotti: affianca nome e quantità
    var toShow = zoneName==='prodotti' ? ['prodotti-nome','prodotti-qty'] : [zoneName];
    var hasAny = toShow.some(function(n){ return zones[n]&&zones[n].hasStrokes; });
    if(!hasAny) return;

    // Crea canvas preview unico con sfondo bianco
    var zoneEl = document.querySelector('.hw-zone[data-zone="'+zoneName+'"]');
    var zoneW = zoneEl ? zoneEl.offsetWidth : (window.innerWidth - 32);
    var previewH = zoneName==='prodotti' ? 60 : 32; // px di altezza preview

    var out = document.createElement('canvas');
    out.width  = zoneW * 2;   // retina
    out.height = previewH * 2;
    out.style.cssText = 'width:'+zoneW+'px;height:'+previewH+'px;display:block;border-radius:4px;background:#fff;box-shadow:inset 0 0 0 1px rgba(196,98,45,.15)';
    var octx = out.getContext('2d');
    octx.fillStyle = '#fff';
    octx.fillRect(0, 0, out.width, out.height);

    if(zoneName==='prodotti'){
      // Colonna nomi (75%) + quantità (25%)
      var splits = [{n:'prodotti-nome', x:0, fw:0.72}, {n:'prodotti-qty', x:0.75, fw:0.25}];
      splits.forEach(function(s){
        var src = zones[s.n]&&zones[s.n].canvas;
        if(!src||!zones[s.n].hasStrokes) return;
        var bb = hwCanvasBBox(src);
        if(!bb) return;
        var destX = Math.round(s.x * out.width);
        var destW = Math.round(s.fw * out.width);
        var scale = Math.min(destW/bb.w, out.height/bb.h) * 0.85;
        var dw = Math.round(bb.w*scale), dh = Math.round(bb.h*scale);
        var dy = Math.round((out.height-dh)/2);
        octx.drawImage(src, bb.x, bb.y, bb.w, bb.h, destX+Math.round((destW-dw)/2), dy, dw, dh);
        // Linea divisoria
        if(s.x>0){ octx.strokeStyle='rgba(196,98,45,.2)'; octx.lineWidth=1; octx.beginPath(); octx.moveTo(destX,4); octx.lineTo(destX,out.height-4); octx.stroke(); }
      });
    } else {
      var src = zones[zoneName]&&zones[zoneName].canvas;
      if(src&&zones[zoneName].hasStrokes){
        var bb = hwCanvasBBox(src);
        if(bb){
          var scale = Math.min(out.width/bb.w, out.height/bb.h) * 0.85;
          var dw = Math.round(bb.w*scale), dh = Math.round(bb.h*scale);
          octx.drawImage(src, bb.x, bb.y, bb.w, bb.h,
            Math.round((out.width-dw)/2), Math.round((out.height-dh)/2), dw, dh);
        }
      }
    }

    container.appendChild(out);
    container.style.cssText = 'position:relative;width:100%;padding:3px 0 2px;background:rgba(255,250,245,.5)';
  }

  // ── EXPAND / COLLAPSE ZONE SU MOBILE ──
  var hwExpandedZone = null;


  window.hwZoneTap = function(e, zoneName){
    if(window.innerWidth >= 768) return;
    if(e.target.closest('.hw-zone-confirm-btn') || e.target.closest('button')) return;
    var zoneEl = document.querySelector('.hw-zone[data-zone="'+zoneName+'"]');
    if(!zoneEl || zoneEl.classList.contains('hw-expanded')) return;
    hwZoneExpand(zoneName);
  };

  // Altezze collassate FISSE — non cambiano mai al variare del contenuto
  var HW_FIXED_H = {nome:52, telefono:52, orario:52, note:52};

  function hwGetCollapsedH(zoneName){
    if(zoneName !== 'prodotti') return HW_FIXED_H[zoneName] || 52;
    // prodotti: spazio rimanente dopo le altre 4 zone fisse
    var panelElG = document.getElementById('hw-panel');
    var pH = panelElG ? panelElG.offsetHeight : Math.round(window.innerHeight * 0.95);
    var tH = 0;
    if(panelElG){ for(var i=0;i<panelElG.children.length;i++){ var c=panelElG.children[i]; if(c.id!=='hw-zones'&&c.id!=='hw-delivery-panel'&&c.id!=='hw-rules-panel') tH+=c.offsetHeight||0; } }
    var zH = pH - tH - 22 - 4;
    var otherH = 52*4 + 4 + 4; // 4 zone×52 + 4 divisori + bordo container
    return Math.max(120, zH - otherH);
  }

  function hwZoneExpand(zoneName){
    var zones_container = document.getElementById('hw-zones');
    var zoneEl = document.querySelector('.hw-zone[data-zone="'+zoneName+'"]');
    if(!zoneEl) return;

    // Collassa eventuale zona già espansa
    if(hwExpandedZone && hwExpandedZone !== zoneName){
      hwZoneCollapseSilent(hwExpandedZone);
    }

    hwExpandedZone = zoneName;
    zoneEl.classList.add('hw-expanded');
    zoneEl.classList.remove('hw-collapsed');
    zoneEl.style.cssText = ''; // clear forced collapse styles

    // Aggiungi mini-toolbar alla label della zona espansa (solo mobile)
    if(window.innerWidth < 768){
      var labelEl0 = zoneEl.querySelector('.hw-zone-label');
      if(labelEl0 && !labelEl0.querySelector('.hw-zone-exp-tools')){
        var tools = document.createElement('div');
        tools.className = 'hw-zone-exp-tools';
        tools.innerHTML =
          '<button onclick="event.stopPropagation();hwSetSize(2)" id="hwez-sz-2" class="btn btn-sm" title="Sottile"><span style="width:3px;height:3px;background:var(--br);border-radius:50%;display:inline-block"></span></button>'+
          '<button onclick="event.stopPropagation();hwSetSize(4)" id="hwez-sz-4" class="btn btn-sm btn-p" title="Medio"><span style="width:5px;height:5px;background:var(--br);border-radius:50%;display:inline-block"></span></button>'+
          '<button onclick="event.stopPropagation();hwSetSize(7)" id="hwez-sz-7" class="btn btn-sm" title="Spesso"><span style="width:8px;height:8px;background:var(--br);border-radius:50%;display:inline-block"></span></button>'+
          '<button onclick="event.stopPropagation();hwToggleEraser()" id="hwez-eraser" class="btn btn-sm" style="font-size:13px">🧽</button>'+
          '<button onclick="event.stopPropagation();hwClearZoneMobile(\''+zoneName+'\')" class="btn btn-s btn-sm" style="font-size:12px">🗑️</button>';
        labelEl0.appendChild(tools);
      }
    }
    // Su mobile: il container deve avere position:relative con altezza definita per l'absolute child
    if(zones_container && window.innerWidth < 768){
      // Zona espansa: position:fixed con le coordinate esatte di #hw-panel
      var panelEl = document.getElementById('hw-panel');
      var pr = panelEl ? panelEl.getBoundingClientRect() : {left:0,top:0,width:window.innerWidth,height:window.innerHeight*0.95};
      zoneEl.style.cssText = 'position:fixed;left:'+pr.left+'px;top:'+pr.top+'px;width:'+pr.width+'px;height:'+pr.height+'px;z-index:2000;display:flex;flex-direction:column;background:var(--cr);overflow:hidden;';
    }
    if(zones_container) zones_container.classList.add('has-expanded');

    // Reinizializza canvas dopo che il browser ha applicato le classi e calcolato il layout
    setTimeout(function(){

      var isMobile = window.innerWidth < 768;
      var isMulti  = (zoneName === 'prodotti');
      var toInit   = isMulti ? ['prodotti-nome','prodotti-qty'] : [zoneName];

      // Misura le dimensioni reali del container (già impostato con altezza esatta)
      var panelW, availH;
      if(isMobile){
        // Usa le dimensioni di #hw-panel (dove la zona è ora fixed)
        var panelEl2 = document.getElementById('hw-panel');
        var pr2 = panelEl2 ? panelEl2.getBoundingClientRect() : null;
        panelW = pr2 ? pr2.width  : window.innerWidth;
        var fullH = pr2 ? pr2.height : window.innerHeight * 0.95;
        var labelEl2 = zoneEl.querySelector('.hw-zone-label');
        var labelH2  = labelEl2 ? labelEl2.offsetHeight : 36;
        availH = fullH - labelH2 - 70; // 70px per pulsante ✓ Fatto
        if(availH < 150) availH = 400;
      } else {
        panelW = zones_container ? zones_container.offsetWidth : window.innerWidth;
        var fullH2 = zones_container ? zones_container.offsetHeight : 400;
        var labelEl3 = zoneEl.querySelector('.hw-zone-label');
        var labelH3  = labelEl3 ? labelEl3.offsetHeight : 36;
        availH = fullH2 - labelH3 - 68;
        if(availH < 80) availH = 300;
      }

      toInit.forEach(function(n){
        var wrap = document.querySelector('[data-subzone="'+n+'"]')
                 || document.querySelector('.hw-zone[data-zone="'+n+'"] .hw-zone-canvas-wrap');
        var oldC = document.querySelector('[data-zone="'+n+'"].hw-zone-canvas');
        if(!wrap || !oldC) return;

        wrap.style.position = 'relative';
        wrap.style.overflow = 'hidden';

        var W = panelW;
        if(isMulti){
          if(n === 'prodotti-qty')  W = Math.round(panelW * 0.25);
          else                      W = Math.round(panelW * 0.75);
        }
        var H = availH;

        var nc = document.createElement('canvas');
        nc.className   = oldC.className;
        nc.dataset.zone = n;
        oldC.parentNode.replaceChild(nc, oldC);

        nc.width  = W * 2;
        nc.height = H * 2;
        nc.style.cssText = 'display:block;position:absolute;top:0;left:0;width:'+W+'px;height:'+H+'px;touch-action:none;';

        var ctx = nc.getContext('2d');
        ctx.strokeStyle = '#111';
        ctx.lineWidth   = penSize * 2;
        ctx.lineCap     = 'round';
        ctx.lineJoin    = 'round';
        ctx.fillStyle   = '#fff';
        ctx.fillRect(0, 0, nc.width, nc.height);

        var prev = zones[n];
        if(prev && prev.canvas && prev.hasStrokes){
          ctx.drawImage(prev.canvas, 0, 0, nc.width, nc.height);
        }
        var hadStrokes = prev ? prev.hasStrokes : false;
        zones[n] = { canvas:nc, ctx:ctx, drawing:false, hasStrokes:hadStrokes };
    

        var guide = wrap.querySelector('.hw-zone-guide');
        if(guide) guide.style.display = hadStrokes ? 'none' : '';

        (function(zonKey){
          nc.addEventListener('mousedown',  function(ev){ startDraw(ev,zonKey); },{passive:false});
          nc.addEventListener('mousemove',  function(ev){ moveDraw(ev,zonKey); }, {passive:false});
          nc.addEventListener('mouseup',    function(ev){ endDraw(ev,zonKey); },  {passive:false});
          nc.addEventListener('mouseleave', function(ev){ endDraw(ev,zonKey); },  {passive:false});
          nc.addEventListener('touchstart', function(ev){ startDraw(ev,zonKey); },{passive:false});
          nc.addEventListener('touchmove',  function(ev){ moveDraw(ev,zonKey); }, {passive:false});
          nc.addEventListener('touchend',   function(ev){ endDraw(ev,zonKey); },  {passive:false});
        }(n));
      });

    }, 150); // fine setTimeout espansione
  }

  // Cancella solo la zona corrente espansa (mobile)
  window.hwClearZoneMobile = function(zoneName){
    var toClr = zoneName==='prodotti' ? ['prodotti-nome','prodotti-qty'] : [zoneName];
    toClr.forEach(function(n){ hwClearZone(n); });
  };

  function hwZoneCollapseSilent(zoneName){
    var zoneEl = document.querySelector('.hw-zone[data-zone="'+zoneName+'"]');
    if(!zoneEl) return;
    // Rimuovi mini-toolbar dalla label
    var t = zoneEl.querySelector('.hw-zone-exp-tools');
    if(t) t.parentNode.removeChild(t);
    var _ch = (window.innerWidth < 768) ? hwGetCollapsedH(zoneName) : 42;
    zoneEl.classList.remove('hw-expanded');
    zoneEl.classList.add('hw-collapsed');
    zoneEl.style.cssText = 'display:block;height:'+_ch+'px;min-height:'+_ch+'px;max-height:'+_ch+'px;overflow:hidden;flex:none';
    if(hwExpandedZone === zoneName) hwExpandedZone = null;
    var zones_container = document.getElementById('hw-zones');
    if(zones_container) zones_container.classList.remove('has-expanded');
  }

  window.hwZoneCollapse = function(e, zoneName){
    e.stopPropagation();
    var zoneEl = document.querySelector('.hw-zone[data-zone="'+zoneName+'"]');
    if(!zoneEl) return;
    // Rimuovi mini-toolbar
    var t = zoneEl.querySelector('.hw-zone-exp-tools');
    if(t) t.parentNode.removeChild(t);
    hwUpdatePreview(zoneName);
    var _ch = (window.innerWidth < 768) ? hwGetCollapsedH(zoneName) : 42;
    zoneEl.classList.remove('hw-expanded');
    zoneEl.classList.add('hw-collapsed');
    zoneEl.style.cssText = 'display:block;height:'+_ch+'px;min-height:'+_ch+'px;max-height:'+_ch+'px;overflow:hidden;flex:none';
    hwExpandedZone = null;
    var zc = document.getElementById('hw-zones');
    if(zc){
      zc.classList.remove('has-expanded');
      if(window.innerWidth < 768){
        // Ricalcola zonesH con la stessa formula di hwOpen
        var panelEl3 = document.getElementById('hw-panel');
        var tH3 = 0;
        if(panelEl3){ for(var i3=0;i3<panelEl3.children.length;i3++){ var c3=panelEl3.children[i3]; if(c3.id!=='hw-zones'&&c3.id!=='hw-delivery-panel'&&c3.id!=='hw-rules-panel') tH3+=c3.offsetHeight||0; } }
        var panelEl3b = document.getElementById('hw-panel');
        var pH3b = panelEl3b ? panelEl3b.offsetHeight : Math.round(window.innerHeight*0.95);
        var zonesH3 = pH3b - tH3 - 22 - 4;
        // Ricalcola prodotti col nuovo zonesH
        var zProdEl = document.querySelector('.hw-zone[data-zone="prodotti"]');
        if(zProdEl && zProdEl.classList.contains('hw-collapsed')){
          var newProdH = Math.max(120, zonesH3 - (52*4+4+4));
          zProdEl.style.cssText='display:block;height:'+newProdH+'px;min-height:'+newProdH+'px;max-height:'+newProdH+'px;overflow:hidden;flex:none';
        }
        zc.style.cssText = 'display:block;flex:none;height:'+zonesH3+'px;min-height:'+zonesH3+'px;max-height:'+zonesH3+'px;border:2px solid var(--t);border-radius:10px;overflow:hidden;background:#fff;position:relative';
      }
    }
  };

  // ── APRI ──
  window.hwOpen = function(){
    var ov = document.getElementById('hw-overlay');
    ov.classList.add('open');
    hwParsed = null;
    hwExpandedZone = null;
    if(eraserMode){ eraserMode=false; var eb=document.getElementById('hw-eraser-btn'); if(eb){eb.className='btn btn-sm';eb.style.outline='';} }
    document.getElementById('hw-status').textContent = '';
    hwLoadKey();
    if(!hwRules) hwLoadRules();
    hwCheckDevice();

    setTimeout(function(){
      var order = ['nome','telefono','prodotti','orario','note'];
      var hwZonesEl = document.getElementById('hw-zones');

      if(window.innerWidth >= 768){
        // Desktop: flex layout normale
        if(hwZonesEl) hwZonesEl.style.cssText = '';
        if(hwZonesEl) hwZonesEl.classList.remove('has-expanded');
        order.forEach(function(n){
          var z = document.querySelector('.hw-zone[data-zone="'+n+'"]');
          if(z){ z.classList.remove('hw-collapsed','hw-expanded'); z.style.cssText = ''; }
        });
        initAllZones();
      } else {
        // Mobile: usa window.innerHeight che è sempre affidabile
        // Dal debug: screenH=712=panelH (il panel è 95vh), toolbarH=52 (misurato)
        var hwZonesEl2 = document.getElementById('hw-zones');

        // Misura toolbar (elementi sopra hw-zones nel panel)
        var panelEl2 = document.getElementById('hw-panel');
        var toolbarH2 = 0;
        if(panelEl2){
          for(var ci2=0; ci2<panelEl2.children.length; ci2++){
            var ch2 = panelEl2.children[ci2];
            if(ch2.id!=='hw-zones' && ch2.id!=='hw-delivery-panel' && ch2.id!=='hw-rules-panel')
              toolbarH2 += ch2.offsetHeight || 0;
          }
        }
        // panelH = 95vh, padding panel = 12+10=22px
        var panelH2   = panelEl2 ? panelEl2.offsetHeight : Math.round(window.innerHeight * 0.95);
        var zonesH2   = panelH2 - toolbarH2 - 22 - 4;
        // 4 zone×52px (fixed) + 4 divisori + 4px bordo container
        var usedH2    = 52*4 + 4 + 4;
        var prodH2    = Math.max(120, zonesH2 - usedH2);

        if(hwZonesEl2) hwZonesEl2.style.cssText =
          'display:block;flex:none;height:'+zonesH2+'px;min-height:'+zonesH2+'px;max-height:'+zonesH2+'px;'+
          'border:2px solid var(--t);border-radius:10px;overflow:hidden;background:#fff;position:relative';

        var collapsedH2 = {nome:52, telefono:52, prodotti:prodH2, orario:52, note:52};
        order.forEach(function(n){
          var z = document.querySelector('.hw-zone[data-zone="'+n+'"]');
          var h = collapsedH2[n] || 52;
          if(z){
            z.classList.remove('hw-expanded');
            z.classList.add('hw-collapsed');
            z.style.cssText = 'display:block;height:'+h+'px;min-height:'+h+'px;max-height:'+h+'px;overflow:hidden;flex:none';
          }
        });
        initAllZones();
      }
    }, 120); // attendi che il browser abbia fatto il reflow del pannello
  };
  window.hwClose = function(){
    document.getElementById('hw-overlay').classList.remove('open');
    // Reset stato expanded/collapsed
    hwExpandedZone = null;
    var container = document.getElementById('hw-zones');
    if(container) container.classList.remove('has-expanded');
    document.querySelectorAll('.hw-zone.hw-expanded, .hw-zone.hw-collapsed').forEach(function(z){
      z.classList.remove('hw-expanded','hw-collapsed');
      z.style.cssText = ''; // restore natural flex for desktop
    });
  };
  window.hwBgClick = function(e){
    if(e.target === document.getElementById('hw-overlay')) hwClose();
  };

  // ── INIZIALIZZA TUTTI I CANVAS ──
  function initAllZones(){
    // Su mobile le zone sono tutte collassate (dimensioni 0): non ha senso inizializzarle.
    // Verranno inizializzate singolarmente in hwZoneExpand al momento del tap.
    var isMobile = window.innerWidth < 768;

    ZONE_NAMES.forEach(function(name){
      // Sub-zones (prodotti-nome, prodotti-qty) use data-zone on canvas-wrap directly
      var wrap = document.querySelector('[data-subzone="'+name+'"]')
               || document.querySelector('.hw-zone[data-zone="'+name+'"] .hw-zone-canvas-wrap');
      var oldCanvas = document.querySelector('[data-zone="'+name+'"].hw-zone-canvas');
      if(!wrap || !oldCanvas) return;

      // Su mobile: resetta solo lo stato, non ridimensionare (dimensioni sono 0 da collapsed)
      if(isMobile){
        zones[name] = { canvas: oldCanvas, ctx: oldCanvas.getContext('2d'), drawing: false, hasStrokes: false };
        var guide = wrap.querySelector('.hw-zone-guide');
        var result = wrap.querySelector('.hw-zone-result');
        if(guide)  guide.style.display = '';
        if(result){ result.classList.remove('show'); result.innerHTML = ''; }
        return; // il canvas verrà ridimensionato correttamente in hwZoneExpand
      }

      // Desktop/tablet: inizializza normalmente
      var nc = oldCanvas.cloneNode(false);
      oldCanvas.parentNode.replaceChild(nc, oldCanvas);

      var W = wrap.offsetWidth  || 600;
      var H = wrap.offsetHeight || 80;
      nc.width  = W * 2;
      nc.height = H * 2;
      nc.style.width  = W + 'px';
      nc.style.height = H + 'px';

      var ctx = nc.getContext('2d');
      ctx.strokeStyle = '#111';
      ctx.lineWidth   = penSize * 2;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.fillStyle   = '#fff';
      ctx.fillRect(0, 0, nc.width, nc.height);

      zones[name] = { canvas: nc, ctx: ctx, drawing: false, hasStrokes: false };

      // Mostra guida
      var guide = wrap.querySelector('.hw-zone-guide');
      var result = wrap.querySelector('.hw-zone-result');
      if(guide)  guide.style.display = '';
      if(result){ result.classList.remove('show'); result.innerHTML = ''; }

      // Event listeners
      nc.addEventListener('mousedown',  function(e){ startDraw(e, name); }, {passive:false});
      nc.addEventListener('mousemove',  function(e){ moveDraw(e, name); },  {passive:false});
      nc.addEventListener('mouseup',    function(e){ endDraw(e, name); },   {passive:false});
      nc.addEventListener('mouseleave', function(e){ endDraw(e, name); },   {passive:false});
      nc.addEventListener('touchstart', function(e){ startDraw(e, name); }, {passive:false});
      nc.addEventListener('touchmove',  function(e){ moveDraw(e, name); },  {passive:false});
      nc.addEventListener('touchend',   function(e){ endDraw(e, name); },   {passive:false});
    });
  }

  function getPos(e, canvas){
    var r = canvas.getBoundingClientRect();
    var sx = canvas.width  / r.width;
    var sy = canvas.height / r.height;
    var src = e.touches ? e.touches[0] : e;
    return { x:(src.clientX - r.left)*sx, y:(src.clientY - r.top)*sy };
  }
  function startDraw(e, name){
    e.preventDefault();
    var z = zones[name]; if(!z) return;
    // Usa la gomma del pannello corretto (consegna o principale)
    var isDeliveryZone = HW_DELIVERY_ZONES.indexOf(name) >= 0;
    var activeEraser = isDeliveryZone ? delEraserMode : eraserMode;
    z.drawing = true;
    if(!activeEraser) z.hasStrokes = true;
    var guide = document.querySelector('[data-subzone="'+name+'"] .hw-zone-guide')
             || document.querySelector('.hw-zone[data-zone="'+name+'"] .hw-zone-guide');
    if(guide && !activeEraser) guide.style.display = 'none';
    var p = getPos(e, z.canvas);
    z.ctx.save();
    if(activeEraser){
      z.ctx.globalCompositeOperation = 'destination-out';
      z.ctx.strokeStyle = 'rgba(0,0,0,1)';
      z.ctx.lineWidth = penSize * 6;
    } else {
      z.ctx.globalCompositeOperation = 'source-over';
      z.ctx.strokeStyle = '#111';
      z.ctx.lineWidth = penSize * 2;
    }
    z.ctx.beginPath(); z.ctx.moveTo(p.x, p.y);
  }
  function moveDraw(e, name){
    e.preventDefault();
    var z = zones[name]; if(!z || !z.drawing) return;
    var p = getPos(e, z.canvas);
    z.ctx.lineTo(p.x, p.y); z.ctx.stroke();
    z.ctx.beginPath(); z.ctx.moveTo(p.x, p.y);
  }
  function endDraw(e, name){
    e.preventDefault();
    var z = zones[name]; if(!z) return;
    z.drawing = false;
    z.ctx.restore(); // ripristina compositeOperation
  }

  // ── CANCELLA TUTTO ──
  window.hwClearAll = function(){
    ZONE_NAMES.forEach(function(name){ hwClearZone(name); });
    hwParsed = null;
    document.getElementById('hw-status').textContent = '';
    // Su mobile: resetta preview e ripristina altezze fisse
    if(window.innerWidth < 768){
      // Svuota tutti i preview e azzera il loro stile
      ['nome','telefono','prodotti','orario','note'].forEach(function(n){
        var prev = document.getElementById('hw-preview-'+n);
        if(prev){ prev.innerHTML=''; prev.removeAttribute('style'); }
      });
      // Reimposta tutte le zone collassate alle altezze fisse
      // (prodotti incluso — ricalcola con hwGetCollapsedH)
      ['nome','telefono','prodotti','orario','note'].forEach(function(n){
        var z = document.querySelector('.hw-zone[data-zone="'+n+'"]');
        if(z && z.classList.contains('hw-collapsed')){
          var h = hwGetCollapsedH(n);
          z.style.cssText='display:block;height:'+h+'px;min-height:'+h+'px;max-height:'+h+'px;overflow:hidden;flex:none';
        }
      });
    }
  };
  // mantieni compatibilità col vecchio pulsante
  window.hwClear = window.hwClearAll;

  function hwClearZone(name){
    var z = zones[name]; if(!z) return;
    z.ctx.fillStyle = '#fff';
    z.ctx.fillRect(0, 0, z.canvas.width, z.canvas.height);
    z.hasStrokes = false;
    var wrap = document.querySelector('[data-subzone="'+name+'"]')
             || document.querySelector('.hw-zone[data-zone="'+name+'"] .hw-zone-canvas-wrap');
    if(!wrap) return;
    var guide  = wrap.querySelector('.hw-zone-guide');
    var result = wrap.querySelector('.hw-zone-result');
    if(guide)  guide.style.display  = '';
    if(result){ result.classList.remove('show'); result.innerHTML = ''; }
    // Svuota preview nella zona collassata
    var zoneName = name.replace('-nome','').replace('-qty','');
    var prev = document.getElementById('hw-preview-'+zoneName);
    if(prev){ prev.innerHTML=''; prev.removeAttribute('style'); }
  }

  // ── GOMMA ──
  window.hwToggleEraser = function(){
    eraserMode = !eraserMode;
    // Bottone gomma desktop
    var btn = document.getElementById('hw-eraser-btn');
    if(btn){ btn.className='btn btn-sm'+(eraserMode?' btn-p':''); btn.style.outline=eraserMode?'2px solid var(--t)':''; }
    // Bottone gomma zona espansa mobile
    var btnz = document.getElementById('hwez-eraser');
    if(btnz){ btnz.className='btn btn-sm'+(eraserMode?' btn-p':''); btnz.style.outline=eraserMode?'2px solid var(--t)':''; }
    // Aggiorna cursore
    ZONE_NAMES.forEach(function(name){
      var wrap = document.querySelector('.hw-zone[data-zone="'+name+'"] .hw-zone-canvas-wrap');
      if(wrap) wrap.style.cursor = eraserMode ? 'cell' : 'crosshair';
    });
    // Spessore penna: deseleziona quando gomma attiva, riseleziona quando disattivata
    ['2','4','7'].forEach(function(x){
      var b1 = document.getElementById('hw-sz-'+x);
      var b2 = document.getElementById('hwez-sz-'+x);
      var active = !eraserMode && x===String(penSize);
      if(b1) b1.className = 'btn btn-sm'+(active?' btn-p':'');
      if(b2) b2.className = 'btn btn-sm'+(active?' btn-p':'');
    });
  };

  // ── SPESSORE PENNA ──
  window.hwSetSize = function(s){
    penSize = s;
    // Disattiva gomma se attiva
    if(eraserMode){
      eraserMode = false;
      var eb = document.getElementById('hw-eraser-btn');
      if(eb){ eb.className='btn btn-sm'; eb.style.outline=''; }
      var ebz = document.getElementById('hwez-eraser');
      if(ebz){ ebz.className='btn btn-sm'; ebz.style.outline=''; }
      ZONE_NAMES.forEach(function(name){
        var wrap = document.querySelector('.hw-zone[data-zone="'+name+'"] .hw-zone-canvas-wrap');
        if(wrap) wrap.style.cursor = 'crosshair';
      });
    }
    // Aggiorna bottoni spessore desktop
    ['2','4','7'].forEach(function(x){
      var b = document.getElementById('hw-sz-'+x);
      if(b) b.className = 'btn btn-sm' + (x===String(s) ? ' btn-p' : '');
    });
    // Aggiorna bottoni spessore zona espansa mobile
    ['2','4','7'].forEach(function(x){
      var b = document.getElementById('hwez-sz-'+x);
      if(b) b.className = 'btn btn-sm' + (x===String(s) ? ' btn-p' : '');
    });
    // Aggiorna lineWidth sui canvas attivi
    ZONE_NAMES.forEach(function(name){
      if(zones[name]) zones[name].ctx.lineWidth = s * 2;
    });
  };

  // ── ANALIZZA ──
  window.hwRecognize = function(){
    var anyStrokes = ZONE_NAMES.some(function(n){ return zones[n] && zones[n].hasStrokes; });
    if(!anyStrokes){ showToast('Scrivi prima qualcosa nelle zone!'); return; }

    var apiKey = document.getElementById('hw-api-key') ? document.getElementById('hw-api-key').value.trim() : '';
    if(!apiKey){
      document.getElementById('hw-status').textContent = '⚠️ Inserisci la API key Google Cloud Vision (pulsante 🔑).';
      hwKeyShowEdit('');
      return;
    }

    var btn    = document.getElementById('hw-rec-btn');
    var btnMob = document.getElementById('hw-rec-btn-mob');
    var statusEl = document.getElementById('hw-status');
    if(btn)    { btn.disabled    = true; btn.textContent    = '⏳ Analisi…'; }
    if(btnMob) { btnMob.disabled = true; btnMob.textContent = '⏳ Analisi…'; }

    var zonesWithStrokes = ZONE_NAMES.filter(function(n){ return zones[n] && zones[n].hasStrokes; });
    var results = {};
    var i = 0;

    function next(){
      if(i >= zonesWithStrokes.length){
        if(btn)    { btn.disabled    = false; btn.textContent    = '🔍 Analizza'; }
        if(btnMob) { btnMob.disabled = false; btnMob.textContent = '🔍 Analizza'; }
        statusEl.textContent = '';
        hwParsed = hwParseZones(results);
        hwShowZoneResults(hwParsed, results);
        hwApplyAll();
        return;
      }

      var name = zonesWithStrokes[i]; i++;
      statusEl.textContent = '⏳ ' + i + '/' + zonesWithStrokes.length + ' – ' + name + '…';

      // Converti canvas in base64 JPEG (più leggero di PNG per Vision API)
      var processed = hwPreprocess(zones[name].canvas);
      var dataURL = processed.toDataURL('image/jpeg', 0.92);
      var base64 = dataURL.split(',')[1];

      // Google Cloud Vision API — DOCUMENT_TEXT_DETECTION è ottimale per handwriting
      var body = {
        requests: [{
          image: { content: base64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
          imageContext: { languageHints: ['it','it-IT'] }
        }]
      };

      fetch('https://vision.googleapis.com/v1/images:annotate?key=' + apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      .then(function(r){ return r.json(); })
      .then(function(data){
        var text = '';
        try {
          text = data.responses[0].fullTextAnnotation.text || '';
        } catch(e){
          // Nessun testo trovato — non è un errore
          text = '';
        }
        results[name] = text.trim();
        next();
      })
      .catch(function(err){
        results[name] = '';
        statusEl.textContent = '⚠️ Errore Vision API (' + name + '): ' + (err.message || err);
        setTimeout(next, 500);
      });
    }

    next();
  };

  // Pre-processing: scala 2× e sfondo bianco (Vision non ha bisogno di binarizzazione aggressiva)
  function hwPreprocess(srcCanvas){
    var scale = 2;
    var off = document.createElement('canvas');
    off.width  = srcCanvas.width  * scale;
    off.height = srcCanvas.height * scale;
    var ctx = off.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, off.width, off.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(srcCanvas, 0, 0, off.width, off.height);
    return off;
  }

  // ── PARSER PER ZONA ──
  // ════════════════════════════════════════════════
  //  REGOLE QUANTITÀ — gestione e persistenza
  // ════════════════════════════════════════════════

  // Struttura regole default
  var HW_RULES_DEFAULT = {
    units: [
      // Conversioni unità di misura → {unit: 'kg'|'pz', factor: moltiplicatore}
      { abbr:'kg',    unit:'kg', factor:1,       desc:'Chilogrammi' },
      { abbr:'hg',    unit:'kg', factor:0.1,     desc:'Etti (1 hg = 0,1 kg)' },
      { abbr:'dag',   unit:'kg', factor:0.01,    desc:'Decagrammi' },
      { abbr:'g',     unit:'kg', factor:0.001,   desc:'Grammi' },
      { abbr:'gr',    unit:'kg', factor:0.001,   desc:'Grammi (variante)' },
      { abbr:'gramm', unit:'kg', factor:0.001,   desc:'Grammi (esteso)' },
      { abbr:'pz',    unit:'pz', factor:1,       desc:'Pezzi' },
      { abbr:'pezz',  unit:'pz', factor:1,       desc:'Pezzi (variante)' },
      { abbr:'nr',    unit:'pz', factor:1,       desc:'Numero' },
      { abbr:'n',     unit:'pz', factor:1,       desc:'N. / n,' },
    ],
    cats: [
      // Parole-chiave nel nome prodotto → unità default
      { keyword:'tagliat',      unit:'kg', desc:'Tagliatelle' },
      { keyword:'tagliol',      unit:'kg', desc:'Tagliolini' },
      { keyword:'pappard',      unit:'kg', desc:'Pappardelle' },
      { keyword:'spaghett',     unit:'kg', desc:'Spaghetti' },
      { keyword:'linguine',     unit:'kg', desc:'Linguine' },
      { keyword:'fettuccin',    unit:'kg', desc:'Fettuccine' },
      { keyword:'tortell',      unit:'kg', desc:'Tortellini/Tortelloni' },
      { keyword:'ravioli',      unit:'kg', desc:'Ravioli' },
      { keyword:'agnolot',      unit:'kg', desc:'Agnolotti' },
      { keyword:'cappellet',    unit:'kg', desc:'Cappelletti' },
      { keyword:'brodo',        unit:'kg', desc:'Da brodo' },
      { keyword:'gnocch',       unit:'kg', desc:'Gnocchi' },
      { keyword:'pasta ripien', unit:'kg', desc:'Pasta ripiena' },
      { keyword:'pasta fresc',  unit:'kg', desc:'Pasta fresca' },
      { keyword:'lasagn',       unit:'pz', desc:'Lasagne' },
      { keyword:'gratin',       unit:'pz', desc:'Gratin' },
      { keyword:'vincisgrass',  unit:'pz', desc:'Vincisgrassi' },
      { keyword:'forno',        unit:'pz', desc:'Al forno' },
      { keyword:'panetteria',   unit:'pz', desc:'Panetteria' },
      { keyword:'pasticceria',  unit:'pz', desc:'Pasticceria' },
      { keyword:'panett',       unit:'pz', desc:'Panettone/Panetti' },
      { keyword:'brioche',      unit:'pz', desc:'Brioche' },
      { keyword:'croissant',    unit:'pz', desc:'Croissant' },
      { keyword:'pizza',        unit:'pz', desc:'Pizza' },
      { keyword:'focaccia',     unit:'pz', desc:'Focaccia' },
    ],
    logic: [
      { id:'decimal_kg',  enabled:true,  desc:'Numero decimale → kg  (es: 0,5 = 0,5 kg)' },
      { id:'integer_pz',  enabled:true,  desc:'Numero intero → pz    (es: 3 = 3 pz)' },
      { id:'leading_int', enabled:true,  desc:'Numero intero PRIMA del nome → pz  (es: "2 Ravioli")' },
      { id:'nxq',         enabled:true,  desc:'N × Q = confezioni     (es: 2 x 1,500 = 2 conf. 1,5 kg)' },
      { id:'orphan_qty',  enabled:true,  desc:'Riga quantità senza nome → confezione aggiuntiva del prodotto soprastante' },
    ]
  };

  var hwRules = null; // caricato da localStorage o default
  var hwActiveRulesTab = 'units';

  function hwLoadRules(){
    try {
      var saved = localStorage.getItem('hw_qty_rules');
      hwRules = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(HW_RULES_DEFAULT));
    } catch(e){
      hwRules = JSON.parse(JSON.stringify(HW_RULES_DEFAULT));
    }
  }
  function hwSaveRules(){
    // Salva su localStorage (immediato, funziona offline)
    var json = JSON.stringify(hwRules);
    localStorage.setItem('hw_qty_rules', json);
    // Salva su Firestore (sincronizzato su tutti i dispositivi)
    if(window.fbSaveDoc){
      window.fbSaveDoc('settings', 'hw_rules', { id:'hw_rules', rules: json });
    }
  }

  window.hwOpenRules = function(){
    if(!hwRules) hwLoadRules();
    var p = document.getElementById('hw-rules-panel');
    if(p){ p.style.display = 'flex'; }
    hwRulesTab('units');
  };
  window.hwCloseRules = function(){
    var p = document.getElementById('hw-rules-panel');
    if(p) p.style.display = 'none';
  };

  // ── PANNELLO CONSEGNA A DOMICILIO ──
  var HW_DELIVERY_ZONES = ['indirizzo', 'orario-consegna'];

  window.hwOpenDelivery = function(){
    var p = document.getElementById('hw-delivery-panel');
    if(p){ p.style.display = 'flex'; }
    document.getElementById('hw-del-btn').disabled = false;
    document.getElementById('hw-del-btn').textContent = '🔍 Analizza consegna';
    // Reset gomma consegna
    delEraserMode = false;
    var eb = document.getElementById('hw-del-eraser-btn');
    if(eb){ eb.className='btn btn-sm'; eb.style.outline=''; }
    // Reset spessore penna attivo
    ['2','4','7'].forEach(function(x){
      var b = document.getElementById('hw-del-sz-'+x);
      if(b) b.className = 'btn btn-sm' + (x===String(penSize) ? ' btn-p' : '');
    });
    // Inizializza i canvas del pannello consegna
    setTimeout(function(){
      HW_DELIVERY_ZONES.forEach(function(name){
        var wrap = document.querySelector('[data-subzone="'+name+'"]');
        var oldCanvas = document.querySelector('[data-zone="'+name+'"].hw-zone-canvas');
        if(!wrap || !oldCanvas) return;
        var nc = oldCanvas.cloneNode(false);
        oldCanvas.parentNode.replaceChild(nc, oldCanvas);
        var W = wrap.offsetWidth || 600;
        var H = wrap.offsetHeight || 80;
        nc.width  = W * 2; nc.height = H * 2;
        nc.style.width = W+'px'; nc.style.height = H+'px';
        var ctx = nc.getContext('2d');
        ctx.strokeStyle='#111'; ctx.lineWidth=penSize*2;
        ctx.lineCap='round'; ctx.lineJoin='round';
        ctx.fillStyle='#fff'; ctx.fillRect(0,0,nc.width,nc.height);
        zones[name] = { canvas:nc, ctx:ctx, drawing:false, hasStrokes:false };
        var guide  = wrap.querySelector('.hw-zone-guide');
        var result = wrap.querySelector('.hw-zone-result');
        if(guide)  guide.style.display = '';
        if(result){ result.classList.remove('show'); result.innerHTML=''; }
        nc.addEventListener('mousedown',  function(e){ startDraw(e,name); },{passive:false});
        nc.addEventListener('mousemove',  function(e){ moveDraw(e,name); }, {passive:false});
        nc.addEventListener('mouseup',    function(e){ endDraw(e,name); },  {passive:false});
        nc.addEventListener('mouseleave', function(e){ endDraw(e,name); },  {passive:false});
        nc.addEventListener('touchstart', function(e){ startDraw(e,name); },{passive:false});
        nc.addEventListener('touchmove',  function(e){ moveDraw(e,name); }, {passive:false});
        nc.addEventListener('touchend',   function(e){ endDraw(e,name); },  {passive:false});
      });
    }, 80);
  };

  window.hwCloseDelivery = function(){
    var p = document.getElementById('hw-delivery-panel');
    if(p) p.style.display = 'none';
  };

  // ── STRUMENTI PANNELLO CONSEGNA ──
  var delEraserMode = false;

  window.hwDelSetSize = function(s){
    penSize = s; // condivide la stessa variabile globale
    HW_DELIVERY_ZONES.forEach(function(name){
      var z = zones[name]; if(z) z.ctx.lineWidth = s * 2;
    });
    // Disattiva gomma se attiva
    if(delEraserMode){
      delEraserMode = false;
      var eb = document.getElementById('hw-del-eraser-btn');
      if(eb){ eb.className='btn btn-sm'; eb.style.outline=''; }
      HW_DELIVERY_ZONES.forEach(function(name){
        var wrap = document.querySelector('[data-subzone="'+name+'"]');
        if(wrap) wrap.style.cursor = 'crosshair';
      });
    }
    ['2','4','7'].forEach(function(x){
      var b = document.getElementById('hw-del-sz-'+x);
      if(b) b.className = 'btn btn-sm' + (x===String(s) ? ' btn-p' : '');
    });
  };

  window.hwDelToggleEraser = function(){
    delEraserMode = !delEraserMode;
    var btn = document.getElementById('hw-del-eraser-btn');
    if(btn){
      btn.className = 'btn btn-sm' + (delEraserMode ? ' btn-p' : '');
      btn.style.outline = delEraserMode ? '2px solid var(--t)' : '';
    }
    HW_DELIVERY_ZONES.forEach(function(name){
      var wrap = document.querySelector('[data-subzone="'+name+'"]');
      if(wrap) wrap.style.cursor = delEraserMode ? 'cell' : 'crosshair';
    });
    if(delEraserMode){
      ['2','4','7'].forEach(function(x){
        var b = document.getElementById('hw-del-sz-'+x);
        if(b) b.className = 'btn btn-sm';
      });
    } else {
      var b = document.getElementById('hw-del-sz-'+penSize);
      if(b) b.className = 'btn btn-sm btn-p';
    }
  };

  window.hwDelClearAll = function(){
    HW_DELIVERY_ZONES.forEach(function(name){ hwClearZone(name); });
  };

  window.hwAnalyzeDelivery = function(){
    var apiKey = document.getElementById('hw-api-key') ? document.getElementById('hw-api-key').value.trim() : '';
    if(!apiKey){
      // prova a rileggere da localStorage
      apiKey = localStorage.getItem('gv_api_key') || '';
    }
    if(!apiKey){
      document.getElementById('hw-status').textContent = '⚠️ Inserisci prima la API key (pulsante 🔑).';
      hwCloseDelivery();
      return;
    }

    var btn = document.getElementById('hw-del-btn');
    btn.disabled = true; btn.textContent = '⏳ Lettura…';

    var zonesWithStrokes = HW_DELIVERY_ZONES.filter(function(n){ return zones[n] && zones[n].hasStrokes; });
    var results = {};
    var i = 0;

    function next(){
      if(i >= zonesWithStrokes.length){
        btn.disabled = false; btn.textContent = '🔍 Analizza consegna';
        // Applica risultati al form e chiudi
        hwApplyDelivery(results);
        hwCloseDelivery();
        return;
      }
      var name = zonesWithStrokes[i]; i++;
      var processed = hwPreprocess(zones[name].canvas);
      var dataURL = processed.toDataURL('image/jpeg', 0.92);
      var base64  = dataURL.split(',')[1];
      var body = {
        requests:[{
          image:{ content:base64 },
          features:[{ type:'DOCUMENT_TEXT_DETECTION', maxResults:1 }],
          imageContext:{ languageHints:['it','it-IT'] }
        }]
      };
      fetch('https://vision.googleapis.com/v1/images:annotate?key='+apiKey,{
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
      })
      .then(function(r){ return r.json(); })
      .then(function(data){
        var text='';
        try{ text=data.responses[0].fullTextAnnotation.text||''; }catch(e){}
        results[name] = text.trim();
        next();
      })
      .catch(function(){ results[name]=''; next(); });
    }
    next();
  };

  function hwApplyDelivery(res){
    // Attiva checkbox consegna
    var cb = document.getElementById('f-del');
    if(cb && !cb.checked){ cb.checked = true; if(window.fToggleDel) fToggleDel(); }

    // Indirizzo
    if(res.indirizzo){
      var addr = res.indirizzo.replace(/\n/g,' ').replace(/\s+/g,' ').trim();
      var el = document.getElementById('f-addr');
      if(el){ el.value = addr; }
      // Mostra risultato nella zona
      showZoneResult('indirizzo', addr);
    }

    // Orario consegna
    if(res['orario-consegna']){
      var ot = res['orario-consegna'].toLowerCase().replace(/\s+/g,' ').trim();
      var orario = '';
      var tm = ot.match(/(\d{1,2})[:\.\s](\d{2})/) || ot.match(/(\d{1,2})(\d{2})/);
      if(tm){
        var h=parseInt(tm[1],10), m=parseInt(tm[2],10);
        if(h>=0&&h<24&&m>=0&&m<60)
          orario = String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
      }
      if(!orario) orario = res['orario-consegna'].trim();
      var el = document.getElementById('f-ordel');
      if(el){ el.value = orario; }
      showZoneResult('orario-consegna', orario);
    }

    showToast('🛵 Dati consegna inseriti!');
  }
  window.hwRulesReset = function(){
    if(!confirm('Ripristinare tutte le regole ai valori predefiniti?')) return;
    hwRules = JSON.parse(JSON.stringify(HW_RULES_DEFAULT));
    hwSaveRules();
    hwRulesTab(hwActiveRulesTab);
    showToast('↩ Regole ripristinate');
  };

  window.hwRulesTab = function(tab){
    hwActiveRulesTab = tab;
    ['units','cats','logic'].forEach(function(t){
      var btn = document.getElementById('hw-rtab-'+t);
      if(btn){
        btn.style.background = t===tab ? 'var(--t)' : 'var(--cd)';
        btn.style.color      = t===tab ? '#fff'     : 'var(--txl)';
      }
    });
    hwRenderRulesTab(tab);
  };

  function hwRenderRulesTab(tab){
    var el = document.getElementById('hw-rules-content');
    if(!el || !hwRules) return;
    var h = '';

    if(tab === 'units'){
      h += '<div style="font-size:11px;color:var(--txl);margin-bottom:8px">Abbreviazioni riconosciute nella scrittura. Priorità massima su tutte le altre regole.</div>';
      h += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
      h += '<tr style="background:var(--cd)"><th style="padding:5px 8px;text-align:left">Abbreviazione</th><th style="padding:5px 8px;text-align:left">Unità</th><th style="padding:5px 8px;text-align:left">Fattore (→ kg)</th><th style="padding:5px 8px;text-align:left">Descrizione</th><th style="padding:5px 8px"></th></tr>';
      hwRules.units.forEach(function(u, i){
        h += '<tr style="border-bottom:1px solid var(--cd)">';
        h += '<td style="padding:4px 8px"><input type="text" value="'+u.abbr+'" data-tab="units" data-idx="'+i+'" data-field="abbr" onchange="hwRuleEdit(this)" style="width:60px;border:1.5px solid #ddd;border-radius:6px;padding:3px 6px;font-family:monospace;font-size:12px"></td>';
        h += '<td style="padding:4px 8px"><select data-tab="units" data-idx="'+i+'" data-field="unit" onchange="hwRuleEdit(this)" style="border:1.5px solid #ddd;border-radius:6px;padding:3px 5px;font-size:12px"><option value="kg"'+(u.unit==='kg'?' selected':'')+'>kg</option><option value="pz"'+(u.unit==='pz'?' selected':'')+'>pz</option></select></td>';
        h += '<td style="padding:4px 8px"><input type="number" step="0.001" value="'+u.factor+'" data-tab="units" data-idx="'+i+'" data-field="factor" onchange="hwRuleEdit(this)" style="width:70px;border:1.5px solid #ddd;border-radius:6px;padding:3px 6px;font-size:12px"></td>';
        h += '<td style="padding:4px 8px"><input type="text" value="'+u.desc+'" data-tab="units" data-idx="'+i+'" data-field="desc" onchange="hwRuleEdit(this)" style="width:100%;border:1.5px solid #ddd;border-radius:6px;padding:3px 6px;font-size:12px"></td>';
        h += '<td style="padding:4px 6px"><button onclick="hwRuleDelete(\'units\','+i+')" style="background:#fce8e6;border:none;border-radius:6px;padding:3px 7px;cursor:pointer;font-size:13px;color:#c0392b">🗑️</button></td>';
        h += '</tr>';
      });
      h += '</table>';
      h += '<button onclick="hwRuleAdd(\'units\')" class="btn btn-s btn-sm" style="margin-top:8px;font-size:12px">+ Aggiungi unità</button>';

    } else if(tab === 'cats'){
      h += '<div style="font-size:11px;color:var(--txl);margin-bottom:8px">Parole-chiave nel nome prodotto che definiscono l\'unità di misura. Usate se nessuna unità è scritta esplicitamente.</div>';
      h += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
      h += '<tr style="background:var(--cd)"><th style="padding:5px 8px;text-align:left">Parola-chiave</th><th style="padding:5px 8px;text-align:left">Unità</th><th style="padding:5px 8px;text-align:left">Descrizione</th><th style="padding:5px 8px"></th></tr>';
      hwRules.cats.forEach(function(c, i){
        h += '<tr style="border-bottom:1px solid var(--cd)">';
        h += '<td style="padding:4px 8px"><input type="text" value="'+c.keyword+'" data-tab="cats" data-idx="'+i+'" data-field="keyword" onchange="hwRuleEdit(this)" style="width:100px;border:1.5px solid #ddd;border-radius:6px;padding:3px 6px;font-family:monospace;font-size:12px"></td>';
        h += '<td style="padding:4px 8px"><select data-tab="cats" data-idx="'+i+'" data-field="unit" onchange="hwRuleEdit(this)" style="border:1.5px solid #ddd;border-radius:6px;padding:3px 5px;font-size:12px"><option value="kg"'+(c.unit==='kg'?' selected':'')+'>kg</option><option value="pz"'+(c.unit==='pz'?' selected':'')+'>pz</option></select></td>';
        h += '<td style="padding:4px 8px"><input type="text" value="'+c.desc+'" data-tab="cats" data-idx="'+i+'" data-field="desc" onchange="hwRuleEdit(this)" style="width:100%;border:1.5px solid #ddd;border-radius:6px;padding:3px 6px;font-size:12px"></td>';
        h += '<td style="padding:4px 6px"><button onclick="hwRuleDelete(\'cats\','+i+')" style="background:#fce8e6;border:none;border-radius:6px;padding:3px 7px;cursor:pointer;font-size:13px;color:#c0392b">🗑️</button></td>';
        h += '</tr>';
      });
      h += '</table>';
      h += '<button onclick="hwRuleAdd(\'cats\')" class="btn btn-s btn-sm" style="margin-top:8px;font-size:12px">+ Aggiungi categoria</button>';

    } else if(tab === 'logic'){
      h += '<div style="font-size:11px;color:var(--txl);margin-bottom:8px">Regole di interpretazione automatica dei numeri. Attivale o disattivale secondo le tue esigenze.</div>';
      hwRules.logic.forEach(function(r, i){
        var chk = r.enabled ? 'checked' : '';
        h += '<div style="display:flex;align-items:center;gap:12px;padding:10px 8px;border-bottom:1px solid var(--cd)">';
        h += '<input type="checkbox" '+chk+' onchange="hwRuleToggleLogic('+i+',this.checked)" style="width:18px;height:18px;accent-color:var(--t);flex-shrink:0">';
        h += '<div style="flex:1;font-size:13px;color:var(--tx)">'+r.desc+'</div>';
        h += '</div>';
      });
    }

    el.innerHTML = h;
  }

  window.hwRuleEdit = function(inp){
    var tab   = inp.dataset.tab;
    var idx   = parseInt(inp.dataset.idx, 10);
    var field = inp.dataset.field;
    if(!hwRules || !hwRules[tab] || !hwRules[tab][idx]) return;
    var val = inp.value;
    if(field === 'factor') val = parseFloat(val) || 1;
    hwRules[tab][idx][field] = val;
    hwSaveRules();
  };
  window.hwRuleDelete = function(tab, idx){
    if(!hwRules || !hwRules[tab]) return;
    hwRules[tab].splice(idx, 1);
    hwSaveRules();
    hwRenderRulesTab(tab);
  };
  window.hwRuleAdd = function(tab){
    if(!hwRules || !hwRules[tab]) return;
    if(tab === 'units') hwRules.units.push({ abbr:'', unit:'kg', factor:1, desc:'' });
    if(tab === 'cats')  hwRules.cats.push({ keyword:'', unit:'kg', desc:'' });
    hwSaveRules();
    hwRenderRulesTab(tab);
    // Scroll to bottom
    setTimeout(function(){
      var el = document.getElementById('hw-rules-content');
      if(el) el.scrollTop = el.scrollHeight;
    }, 50);
  };
  window.hwRuleToggleLogic = function(idx, val){
    if(!hwRules || !hwRules.logic || !hwRules.logic[idx]) return;
    hwRules.logic[idx].enabled = val;
    hwSaveRules();
  };

  // ── REGOLA 2: unità di misura da categoria ──
  function hwGetCatUnit(productName){
    if(!productName) return null;
    if(!hwRules) hwLoadRules();
    var pn = productName.toLowerCase();
    // Prima: cerca nel catalogo prodotti
    var prod = products.find(function(p){
      return p.name.toLowerCase().includes(pn) || pn.includes(p.name.toLowerCase().split(' ')[0]);
    });
    if(prod) return prod.unit || null;
    // Poi: regole categorie configurabili
    var cats = hwRules.cats || [];
    for(var i=0; i<cats.length; i++){
      if(cats[i].keyword && pn.includes(cats[i].keyword.toLowerCase()))
        return cats[i].unit;
    }
    return null;
  }

  // ── PARSER QUANTITÀ — applica le 5 regole in ordine di priorità ──
  function hwParseQty(nomeLine, qtyLine, catUnit){
    if(!hwRules) hwLoadRules();
    var combined = (nomeLine + ' ' + qtyLine).trim();

    // Costruisci unitMap dalle regole configurabili
    var unitMap = {};
    (hwRules.units || []).forEach(function(u){
      if(u.abbr) unitMap[u.abbr] = { unit: u.unit, factor: parseFloat(u.factor)||1 };
    });

    // Regole logica
    var logic = {};
    (hwRules.logic || []).forEach(function(r){ logic[r.id] = r.enabled; });

    // ── REGOLA 5: pattern confezioni "N x Q [unità]" ──
    if(logic.nxq !== false){
      var confPattern = /(\d+)\s*(?:[a-zA-Z\u00C0-\u024F]+\s+)?[xX×]\s*(\d+(?:[.,]\d+)?)\s*([a-zA-Z.]*)/g;
      var confMatches = [];
      var m;
      confPattern.lastIndex = 0;
      while((m = confPattern.exec(combined)) !== null){
        var nConf = parseInt(m[1], 10);
        var qRaw  = parseFloat(m[2].replace(',','.'));
        var uRaw  = m[3].toLowerCase().replace(/\./g,'').trim();
        if(nConf > 0 && qRaw > 0) confMatches.push({ n:nConf, q:qRaw, u:uRaw });
      }
      if(confMatches.length > 0){
        var confezioni = [];
        var totalQty = 0;
        var resolvedUnit = catUnit || 'kg';
        confMatches.forEach(function(cm){
          var uKey = cm.u ? Object.keys(unitMap).find(function(k){ return cm.u.startsWith(k); }) : null;
          var uInfo = uKey ? unitMap[uKey] : null;
          var qty, unit;
          if(uInfo){ qty = cm.q * uInfo.factor; unit = uInfo.unit; resolvedUnit = unit; }
          else { qty = cm.q; unit = catUnit || (Number.isInteger(cm.q)?'pz':'kg'); resolvedUnit = unit; }
          for(var ci=0; ci<cm.n; ci++){ confezioni.push({qty:String(qty),unit:unit}); totalQty+=qty; }
        });
        return { confezioni:confezioni, totalQty:totalQty, unit:resolvedUnit };
      }
    }

    // ── Regola 4: numero intero PRIMA del nome → pz ──
    if(logic.leading_int !== false){
      var leadingInt = nomeLine.match(/^(\d+)\s+[a-zA-Z]/);
      if(leadingInt && !qtyLine.trim()){
        return { qty: parseInt(leadingInt[1], 10), unit: 'pz' };
      }
    }

    // ── Parsing singolo numero dalla colonna QTY ──
    var qtyRaw = qtyLine.trim();
    var qtyMatch = qtyRaw.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Z.]*)/);
    if(!qtyMatch || !qtyMatch[1]) return { qty:1, unit: catUnit||'pz' };

    var numVal  = parseFloat(qtyMatch[1].replace(',','.'));
    var unitStr = (qtyMatch[2]||'').toLowerCase().replace(/\./g,'').trim();

    // Regola 1: unità esplicita → massima priorità
    var uKey = Object.keys(unitMap).find(function(k){ return unitStr.startsWith(k); });
    if(uKey) return { qty: numVal * unitMap[uKey].factor, unit: unitMap[uKey].unit };

    // Regola 2: unità da categoria
    if(catUnit) return { qty:numVal, unit:catUnit };

    // Regola 3: decimale → kg, intero → pz
    var isDecimal = qtyMatch[1].includes('.') || qtyMatch[1].includes(',');
    if(isDecimal && logic.decimal_kg !== false)  return { qty:numVal, unit:'kg' };
    if(!isDecimal && logic.integer_pz !== false) return { qty:numVal, unit:'pz' };

    return { qty:numVal, unit:'kg' };
  }

  function hwParseZones(res){
    var d = { customerName:'', customerPhone:'', pv:'', date:'', orarioRitiro:'', consegna:false, notes:'', items:[] };

    // NOME
    if(res.nome){
      var nm = res.nome.replace(/[^a-zA-Z\u00C0-\u024F\s'\-]/g,' ').replace(/\s+/g,' ').trim();
      d.customerName = nm.toUpperCase();
    }

    // TELEFONO
    if(res.telefono){
      d.customerPhone = res.telefono.replace(/[^\d+]/g,'');
    }

    // PRODOTTI: colonna nome + colonna quantità — abbina riga per riga
    // REGOLA 6: riga qty senza nome corrispondente = confezione extra del prodotto soprastante
    var nomeLines = (res['prodotti-nome'] || '').split(/[\n\r]+/).map(function(l){ return l.trim(); });
    var qtyLines  = (res['prodotti-qty']  || '').split(/[\n\r]+/).map(function(l){ return l.trim(); });
    var maxLines  = Math.max(nomeLines.length, qtyLines.length);

    // Prima passata: costruisci una lista di {nome, qtys[]} raggruppando le qty orfane
    var prodGroups = []; // [{nome, qtys:[qtyLine, ...]}, ...]
    for(var li = 0; li < maxLines; li++){
      var nomeLine = nomeLines[li] || '';
      var qtyLine  = qtyLines[li]  || '';
      if(!nomeLine && !qtyLine) continue;

      var hasQty  = qtyLine.trim().length > 0;
      var hasNome = nomeLine.trim().length > 0;

      if(hasNome){
        // Nuova riga prodotto
        prodGroups.push({ nome: nomeLine, qtys: hasQty ? [qtyLine] : [] });
      } else if(hasQty && prodGroups.length > 0){
        // Regola 6: qty orfana → confezione aggiuntiva del prodotto precedente
        var logic6 = {};
        (hwRules && hwRules.logic || []).forEach(function(r){ logic6[r.id] = r.enabled; });
        if(logic6.orphan_qty !== false){
          prodGroups[prodGroups.length - 1].qtys.push(qtyLine);
        }
      }
    }

    // Seconda passata: per ogni gruppo genera l'item con le confezioni
    prodGroups.forEach(function(g, gi){
      if(!g.nome.trim()) return;

      var qtyNorm = function(s){ return s
        .replace(/[Oo](?=\d|\.|,)/g,'0')
        .replace(/[lIiJ](?=\d)/g,'1')
        .replace(/,(?=\d)/g,'.'); };
      var nomeNorm = g.nome.replace(/,(?=\d)/g,'.');

      var productName = g.nome.replace(/^\d+\s+/,'')
        .replace(/[^\w\s'\-\u00C0-\u024F]/g,' ').replace(/\s+/g,' ').trim();
      var catUnit = hwGetCatUnit(productName);

      if(g.qtys.length === 0){
        // Nessuna qty: inserisci con qty=1 e unità da categoria
        d.items.push({
          productId:   'hw_' + Date.now() + '_' + gi,
          productName: productName,
          qty:         '1',
          unit:        catUnit || 'pz',
          isCustom:    true
        });
        return;
      }

      if(g.qtys.length === 1){
        // Una sola qty: parsing normale
        var parsed = hwParseQty(nomeNorm, qtyNorm(g.qtys[0]), catUnit);
        if(parsed.confezioni && parsed.confezioni.length > 1){
          d.items.push({
            productId:   'hw_' + Date.now() + '_' + gi,
            productName: productName,
            qty:         String(parsed.totalQty),
            unit:        parsed.unit,
            confezioni:  parsed.confezioni,
            isCustom:    true
          });
        } else {
          d.items.push({
            productId:   'hw_' + Date.now() + '_' + gi,
            productName: productName,
            qty:         String(parsed.qty),
            unit:        parsed.unit,
            isCustom:    true
          });
        }
        return;
      }

      // Più qty (regola 6): costruisci confezioni
      var confezioni = [];
      var totalQty   = 0;
      var resolvedUnit = catUnit || 'kg';
      g.qtys.forEach(function(q){
        var p = hwParseQty(nomeNorm, qtyNorm(q), catUnit);
        if(p.confezioni){
          // La singola qty era già un gruppo N×Q
          p.confezioni.forEach(function(c){ confezioni.push(c); totalQty += parseFloat(c.qty)||0; });
          resolvedUnit = p.unit;
        } else {
          confezioni.push({ qty: String(p.qty), unit: p.unit });
          totalQty += parseFloat(p.qty)||0;
          resolvedUnit = p.unit;
        }
      });
      d.items.push({
        productId:   'hw_' + Date.now() + '_' + gi,
        productName: productName,
        qty:         String(totalQty),
        unit:        resolvedUnit,
        confezioni:  confezioni,
        isCustom:    true
      });
    });

    // ORARIO
    if(res.orario){
      var ot = res.orario.toLowerCase().replace(/\s+/g,' ').trim();
      if(/mat/i.test(ot))            d.orarioRitiro = 'Mattina';
      else if(/pom|aftern/i.test(ot)) d.orarioRitiro = 'Pomeriggio';
      else {
        var tm = ot.match(/(\d{1,2})[:\.\s](\d{2})/) || ot.match(/(\d{1,2})(\d{2})/);
        if(tm){
          var h = parseInt(tm[1],10), m = parseInt(tm[2],10);
          if(h>=0 && h<24 && m>=0 && m<60)
            d.orarioRitiro = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
        }
        if(!d.orarioRitiro && ot.length > 0) d.orarioRitiro = res.orario.trim();
      }
    }

    // NOTE
    if(res.note){
      if(/consegna|delivery/i.test(res.note)) d.consegna = true;
      d.notes = res.note.trim();
    }

    return d;
  }

  // ── MOSTRA RISULTATI NELLE ZONE ──
  function hwShowZoneResults(d, raw){
    showZoneResult('nome',          d.customerName  || raw.nome             || '');
    showZoneResult('telefono',      d.customerPhone || raw.telefono         || '');
    showZoneResult('prodotti-nome', raw['prodotti-nome'] || '');
    showZoneResult('prodotti-qty',  raw['prodotti-qty']  || '');
    showZoneResult('orario',        d.orarioRitiro  || raw.orario           || '');
    showZoneResult('note',          d.notes         || raw.note             || '');
  }

  function showZoneResult(name, text){
    var wrap = document.querySelector('[data-subzone="'+name+'"]')
             || document.querySelector('.hw-zone[data-zone="'+name+'"] .hw-zone-canvas-wrap');
    if(!wrap) return;
    var result = wrap.querySelector('.hw-zone-result');
    if(!result) return;
    if(text){ result.textContent = text; result.classList.add('show'); }
  }

  // ── APPLICA AL FORM ──
  window.hwApplyAll = function(){
    if(!hwParsed) return;
    var d = hwParsed;

    if(d.customerName){ var el=document.getElementById('f-name'); if(el){ el.value=d.customerName; if(window.fSuggest) fSuggest(d.customerName); } }
    if(d.customerPhone){ var el=document.getElementById('f-phone'); if(el) el.value=d.customerPhone; }
    if(d.date){ var el=document.getElementById('f-date'); if(el) el.value=d.date; }
    if(d.pv){
      var pvFound=PUNTI.find(function(p){ var vl=d.pv.toLowerCase(); return vl.includes(p.toLowerCase())||vl.includes(p.toLowerCase().split(' ')[0]); });
      if(pvFound && window.formSetPV) formSetPV(pvFound);
    }
    if(d.consegna){ var cb=document.getElementById('f-del'); if(cb&&!cb.checked){ cb.checked=true; if(window.fToggleDel) fToggleDel(); } }
    else if(d.orarioRitiro){
      if(d.orarioRitiro==='Mattina'||d.orarioRitiro==='Pomeriggio'){
        var slotBtn=document.getElementById(d.orarioRitiro==='Mattina'?'f-slot-mat':'f-slot-pom');
        if(slotBtn) slotBtn.click();
      } else {
        var ri=document.getElementById('f-orrit'); if(ri) ri.value=d.orarioRitiro;
      }
    }
    if(d.notes){ var el=document.getElementById('f-notes'); if(el) el.value=d.notes; }

    // PRODOTTI: inserisci come articoli custom direttamente in formItems
    // La griglia rimane NASCOSTA (non chiamiamo buildProdGrid)
    if(d.items && d.items.length){
      d.items.forEach(function(it){
        if(!it.productName || parseFloat(it.qty) <= 0) return;
        // Evita duplicati per nome
        formItems = formItems.filter(function(x){ return x.productName.toLowerCase() !== it.productName.toLowerCase(); });
        var item = {
          productId:   it.productId,
          productName: it.productName,
          qty:         String(it.qty),
          unit:        it.unit
        };
        // Confezioni multiple (regola 5)
        if(it.confezioni && it.confezioni.length > 1){
          item.confezioni = it.confezioni;
        }
        formItems.push(item);
      });
      if(window.fUpdateCart) fUpdateCart();
    }

    hwClose();
    showToast('✍️ Dati inseriti nel form!');
  };

  // Compatibilità
  window.hwToggleMode = window.hwOpen;
  window.hwApplyField = window.hwApplyAll;

})();
// ─────────────────────────────────────────────────

// ── ARTICOLO NON IN LISTA ──
window.fToggleCustom = function(){
  var row = document.getElementById('f-custom-row');
  if(!row) return;
  var isVisible = row.style.display !== 'none';
  row.style.display = isVisible ? 'none' : 'block';
  if(!isVisible){
    setTimeout(function(){
      var n = document.getElementById('f-custom-name');
      if(n) n.focus();
    }, 60);
  }
};

window.fAddCustom = function(){
  var nameEl = document.getElementById('f-custom-name');
  var qtyEl  = document.getElementById('f-custom-qty');
  var unitEl = document.getElementById('f-custom-unit');
  if(!nameEl || !qtyEl || !unitEl) return;
  var name = nameEl.value.trim();
  var qty  = parseFloat(qtyEl.value);
  var unit = unitEl.value || 'kg';
  if(!name){ nameEl.focus(); showToast('Inserisci il nome articolo'); return; }
  if(!qty || qty <= 0){ qtyEl.focus(); showToast('Inserisci una quantità valida'); return; }
  // Rimuovi eventuale voce precedente con lo stesso nome
  formItems = formItems.filter(function(x){ return x.productName.toLowerCase() !== name.toLowerCase(); });
  formItems.push({ productId: 'custom_' + Date.now(), productName: name, qty: String(qty), unit: unit });
  // Reset campi
  nameEl.value = ''; qtyEl.value = '';
  document.getElementById('f-custom-row').style.display = 'none';
  if(window.fUpdateCart) fUpdateCart();
  showToast('✅ Articolo aggiunto');
};

// Sincronizza prodotti e categorie default su Firebase (solo al primo avvio assoluto)
setTimeout(function(){
  if(window.fbSyncDefaults) window.fbSyncDefaults(products, categories);
}, 2000);
