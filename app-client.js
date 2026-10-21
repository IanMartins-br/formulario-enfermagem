
(()=>{
"use strict";
const el=id=>document.getElementById(id);
const E=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const STORE="enf_offline_v5";
const uid=()=>crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2);
function initializeLocalStore(){
 let s=null;
 try{s=JSON.parse(localStorage.getItem(STORE)||"null")}catch(e){}
 if(s&&Array.isArray(s.patients)&&Array.isArray(s.visits))return s;
 s={patients:[],visits:[],settings:{},version:5};
 try{
  const prior=JSON.parse(localStorage.getItem("enf_visits_v3")||"[]");
  const cfg=JSON.parse(localStorage.getItem("enf_config_v3")||"{}");
  if(cfg&&typeof cfg==="object"&&!Array.isArray(cfg))s.settings=cfg;
  if(Array.isArray(prior)){
   const map=new Map();
   for(const item of prior){
    if(!item||typeof item!=="object"||!item.value||typeof item.value!=="object")continue;
    const v=item.value;
    const key=String(v.record||v.name||"").trim();
    if(!key)continue;
    let p=map.get(key);
    if(!p){
     p={id:uid(),name:String(v.name||"Sem nome"),record:String(v.record||key),birth:String(v.birth||""),location:String(v.location||""),informant:String(v.informant||"")};
     map.set(key,p);s.patients.push(p);
    }
    s.visits.push({id:String(item.id||uid()),patient_id:p.id,created:String(item.created||new Date().toISOString()),value:{...v,name:p.name,record:p.record,birth:p.birth}});
   }
  }
 }catch(e){}
 try{localStorage.setItem(STORE,JSON.stringify(s))}catch(e){}
 return s;
}
let store=initializeLocalStore();
function persistLocal(){
 try{localStorage.setItem(STORE,JSON.stringify(store))}
 catch(e){throw Error("Armazenamento do dispositivo cheio ou indisponível. Exporte um backup.")};
}
const api=async(path,opts={})=>{const r=await fetch("/api"+path,{credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json"},...opts});let j;try{j=await r.json()}catch(e){throw Error("Resposta inválida do servidor.")}if(!r.ok)throw Error(j.error||"Falha de comunicação");return j};
let patients=[],selected="",historyPatient="",busy=false,ready=false;
const getPatient=id=>patients.find(p=>p.id===id);
const age=s=>{if(!s)return"";const d=new Date(s+"T12:00:00"),n=new Date();let a=n.getFullYear()-d.getFullYear();if(n.getMonth()<d.getMonth()||(n.getMonth()===d.getMonth()&&n.getDate()<d.getDate()))a--;return a>=0?a:""};
function toast(msg,error=false){const t=document.createElement("div");t.className="status-banner";t.textContent=msg;if(error){t.style.background="#fff1ed";t.style.color="#9a4234";t.style.borderColor="#e5b8a8"}document.querySelector("main section").prepend(t);setTimeout(()=>t.remove(),6000)}
function initializeUI(){
const nav=el("nav"),button=document.createElement("button");button.dataset.page="patients";button.textContent="♙ Pacientes";nav.insertBefore(button,nav.children[1]);button.onclick=()=>page("patients");
const pane=document.createElement("div");pane.id="patientsPage";pane.className="hidden noprint";
pane.innerHTML='<div class="topline"><div><h1>Pacientes</h1><p class="muted">Cadastre uma única vez e acompanhe os atendimentos.</p></div><button id="addPatient">+ Cadastrar paciente</button></div><div class="card"><div class="field"><label>Buscar paciente</label><input id="patientSearch" placeholder="Nome ou prontuário"></div><div class="patient-list" id="patientList" style="margin-top:15px"></div></div><div class="card hidden" id="patientEditor"><h2>Cadastro do paciente</h2><form id="patientForm"><div class="grid"><div class="field wide"><label>Nome completo *</label><input id="peName" maxlength="200" required></div><div class="field"><label>Nº do prontuário *</label><input id="peRecord" maxlength="80" required></div><div class="field"><label>Data de nascimento *</label><input type="date" id="peBirth" required></div><div class="field"><label>Local de atendimento</label><input id="peLocation"></div><div class="field"><label>Informante habitual</label><input id="peInformant"></div><div class="field"><label>WhatsApp do paciente (opcional)</label><input id="peWhatsapp" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="(31) 99999-9999"></div></div><div class="actions"><button type="submit" id="savePatient">Salvar paciente</button><button type="button" class="light" id="cancelPatient">Cancelar</button></div></form></div>';
el("historyPage").before(pane);
const picker=document.createElement("div");picker.id="patientPicker";picker.className="card noprint";
picker.innerHTML='<h2>Paciente deste atendimento</h2><div class="patient-toolbar"><div class="field"><label>Selecionar paciente cadastrado *</label><select id="patientSelect"><option value="">Selecione...</option></select></div><button type="button" class="light" id="patientShortcut">+ Cadastrar</button></div><p class="muted">Nome, nascimento, idade e prontuário são preenchidos automaticamente.</p>';
el("recordForm").before(picker);
for(const id of ["name","birth","record","age"])el(id).readOnly=true;
el("addPatient").onclick=()=>editPatient();
el("cancelPatient").onclick=()=>el("patientEditor").classList.add("hidden");
el("patientShortcut").onclick=()=>editPatient();
el("patientSearch").oninput=renderPatientList;
el("patientList").onclick=e=>{const b=e.target.closest("[data-id]");if(b){historyPatient=b.dataset.id;page("history")}};
el("patientForm").onsubmit=savePatient;
el("peWhatsapp").addEventListener("input",e=>{const d=e.target.value.replace(/\D/g,"").slice(0,11);e.target.value=d.length<=2?"("+d:d.length<=7?"("+d.slice(0,2)+") "+d.slice(2):"("+d.slice(0,2)+") "+d.slice(2,7)+"-"+d.slice(7)});
el("patientSelect").onchange=()=>choosePatient(el("patientSelect").value,true);
el("historyPage").querySelector("h1").textContent="Histórico por paciente";
/* Mantém o botão de exportação para evitar erro na inicialização. */
el("search").placeholder="Buscar por nome ou prontuário";
el("search").oninput=renderHistory;
for(const id of ["dateFrom","dateTo","resetFilter"])el(id).parentElement.style.display="none";
el("historyList").onclick=historyEvent;
el("save").style.display="none";
el("generate").textContent="Gerar modelo e salvar no histórico";
el("generate").onclick=generateSave;
el("print").textContent="Visualizar prévia";
el("print").onclick=previewDraft;
el("printPreview").textContent="Salvar como PDF";
el("clearBtn").onclick=()=>{if(!confirm("Começar novo atendimento? Os dados não salvos serão descartados."))return;el("recordForm").reset();el("date").value=new Date().toLocaleDateString("en-CA");choosePatient(selected,false);el("lesions").checked=false;toggleWounds()};
el("saveSettings").onclick=saveSettingsRemote;
el("exportBackup").onclick=()=>{if(!ready)return;download("backup-enfermagem-"+new Date().toISOString().slice(0,10)+".json",JSON.stringify({patients,visits:rows,settings},null,2),"application/json")};
el("importBtn").textContent="Importar backup JSON";
el("importFile").onchange=async function(evt){
 const file=evt.target.files?.[0];if(!file)return;
 try{
  const imported=JSON.parse(await file.text());
  const people=imported.patients||[];
  const visits=imported.visits||imported.rows||[];
  if(!Array.isArray(people)||!Array.isArray(visits))throw Error("Formato de arquivo inválido.");
  if(!confirm("Importar "+people.length+" pacientes e "+visits.length+" atendimentos do backup? Os existentes serão preservados."))return;
  const outcome=await api("/migrate",{method:"POST",body:JSON.stringify({patients:people,visits})});
  await refresh();historyPatient="";page("patients");toast("Importação concluída: "+outcome.patients+" pacientes e "+outcome.visits+" atendimentos.");
 }catch(e){toast("Não foi possível importar: "+e.message,true)}
 finally{evt.target.value=""}
};
el("settingsPage").querySelector(".card:last-child").insertAdjacentHTML("beforeend",'<p class="muted">Acesso protegido por PIN. Os registros são sincronizados pelo banco D1, com acompanhamento de alterações administrativas.</p>');
el("document").parentElement.classList.add("doc-preview-frame");
el("previewPage").querySelector(".actions").insertAdjacentHTML("beforeend",'<span id="printNotice" class="muted">Prévia em A4, antes de gerar o arquivo PDF.</span>');
el("back").textContent="← Voltar";
el("nav").querySelectorAll("button").forEach(b=>{if(b.dataset.page==="form")b.textContent="✎ Atendimento";if(b.dataset.page==="history")b.textContent="▤ Histórico";if(b.dataset.page==="charts")b.textContent="▥ Gráficos";if(b.dataset.page==="settings")b.textContent="⚙ Ajustes"});
document.querySelector("header .tag").textContent="Acesso restrito";
}
function editPatient(p){
page("patients");el("patientEditor").classList.remove("hidden");
el("patientForm").dataset.edit=p?.id||"";
el("peName").value=p?.name||"";el("peRecord").value=p?.record||"";el("peRecord").readOnly=!!p;el("peBirth").value=p?.birth||"";el("peLocation").value=p?.location||"";el("peInformant").value=p?.informant||"";el("peWhatsapp").value=p?.whatsapp||"";
el("patientEditor").scrollIntoView({behavior:"smooth",block:"start"});
}
async function savePatient(ev){
ev.preventDefault();if(busy)return;
const payload={id:el("patientForm").dataset.edit||undefined,name:el("peName").value.trim(),record:el("peRecord").value.trim(),birth:el("peBirth").value,location:el("peLocation").value.trim(),informant:el("peInformant").value.trim(),whatsapp:el("peWhatsapp").value.trim()};
busy=true;el("savePatient").disabled=true;
try{const d=await api("/patients",{method:"POST",body:JSON.stringify(payload)});await refresh();el("patientEditor").classList.add("hidden");selected=d.id;choosePatient(d.id,false);toast("Paciente cadastrado no banco de dados.");page("form")}
catch(e){toast(e.message,true)}finally{busy=false;el("savePatient").disabled=false}
}
function renderPatientList(){
const q=el("patientSearch").value.trim().toLowerCase(),set=patients.filter(p=>(p.name+" "+p.record).toLowerCase().includes(q));
el("patientList").innerHTML=set.length?set.map(p=>'<button class="patient-card" data-id="'+E(p.id)+'"><strong>'+E(p.name)+'</strong><small>Prontuário '+E(p.record)+' · Nascimento '+E(dateBR(p.birth))+'</small><small>'+rows.filter(r=>r.patient_id===p.id).length+' atendimentos</small></button>').join(""):'<div class="empty">Nenhum paciente cadastrado ou localizado.</div>';
}
function updatePicker(){
el("patientSelect").innerHTML='<option value="">Selecione o paciente...</option>'+patients.map(p=>'<option value="'+E(p.id)+'">'+E(p.name)+' — '+E(p.record)+'</option>').join("");
if(getPatient(selected))el("patientSelect").value=selected;
}
function choosePatient(id,reset){
const p=getPatient(id);if(!p){selected="";el("patientSelect").value="";return}
if(reset){const date=el("date").value;el("recordForm").reset();el("date").value=date||new Date().toLocaleDateString("en-CA");el("lesions").checked=false;toggleWounds()}
selected=p.id;el("patientSelect").value=p.id;currentId=null;
for(const [k,v] of Object.entries({name:p.name,birth:p.birth,record:p.record,age:age(p.birth),location:p.location||"",informant:p.informant||""}))el(k).value=v;
}
function visitData(){const p=getPatient(selected);if(!p)throw Error("Selecione um paciente cadastrado.");const v=values();if(!v.date)throw Error("Preencha a data do atendimento.");return v}
function previewDraft(){try{const v=visitData();renderDoc(v);previewId=null;page("preview");toast("Prévia sem salvar; use Gerar modelo para registrar o atendimento.")}catch(e){toast(e.message,true)}}
async function generateSave(){
if(busy)return;let v;try{v=visitData()}catch(e){toast(e.message,true);return}
busy=true;el("generate").disabled=true;
try{const d=await api("/visits",{method:"POST",body:JSON.stringify({patient_id:selected,value:v})});await refresh();previewId=d.id;renderDoc(d.visit.value);page("preview");toast("Visita salva no histórico do paciente.")}
catch(e){toast("Não foi possível salvar: "+e.message,true)}
finally{busy=false;el("generate").disabled=false}
}
function renderHistory(){
const root=el("historyList"),q=el("search").value.trim().toLowerCase();
if(!historyPatient){const set=patients.filter(p=>(p.name+" "+p.record).toLowerCase().includes(q));root.innerHTML='<p class="muted">Escolha o paciente para abrir seu histórico de visitas por data.</p>'+(set.length?set.map(p=>'<button class="patient-card" data-patient="'+E(p.id)+'" style="width:100%;margin-bottom:9px"><strong>'+E(p.name)+'</strong><small>Prontuário '+E(p.record)+' · '+rows.filter(r=>r.patient_id===p.id).length+' atendimentos</small></button>').join(""):'<div class="empty">Nenhum paciente encontrado</div>');return}
const p=getPatient(historyPatient);if(!p){historyPatient="";renderHistory();return}
const list=rows.filter(r=>r.patient_id===historyPatient).sort((a,b)=>String(b.value.date).localeCompare(String(a.value.date))||String(b.created).localeCompare(String(a.created)));
let byDate={};for(const r of list){const date=r.value.date||"Sem data";(byDate[date]??=[]).push(r)}
root.innerHTML='<button class="light" data-back="1">← Todos os pacientes</button><h2 style="margin-top:18px">'+E(p.name)+'</h2><p class="muted">Prontuário '+E(p.record)+' · '+list.length+' visitas</p><button class="secondary" data-new="'+E(p.id)+'">+ Novo atendimento</button>'+(list.length?Object.entries(byDate).map(([d,recs])=>'<div class="history-group-header">'+E(dateBR(d))+'</div>'+recs.map((r,i)=>'<div class="record-item"><div><strong>Atendimento '+(i+1)+'</strong><small>Registro em '+E(new Date(r.created||Date.now()).toLocaleString("pt-BR"))+'</small></div><div class="actions"><button class="light" data-local-preview="'+E(r.id)+'">Prévia / PDF</button><button class="secondary" data-reuse="'+E(r.id)+'">Reutilizar</button></div></div>').join("")).join(""):'<div class="empty">Nenhuma visita registrada para este paciente.</div>');
}
function historyEvent(ev){
const b=ev.target.closest("button");if(!b)return;
if(b.dataset.back){historyPatient="";renderHistory();return}
if(b.dataset.patient){historyPatient=b.dataset.patient;renderHistory();return}
if(b.dataset.new){choosePatient(b.dataset.new,true);page("form");return}
const id=b.dataset.localPreview||b.dataset.reuse,r=rows.find(x=>x.id===id);if(!r)return;
if(b.dataset.localPreview){renderDoc(r.value);previewId=r.id;page("preview");return}
choosePatient(r.patient_id,true);
for(const [k,v] of Object.entries(r.value)){const f=el(k);if(!f||["name","birth","record","age"].includes(k))continue;if(f.type==="checkbox")f.checked=!!v;else if("value" in f)f.value=String(v??"")}
toggleWounds();page("form");toast("Dados recuperados. Gerar modelo criará novo atendimento, sem apagar o anterior.");
}
function renderProfessionalDoc(v){
const info=[["Paciente",v.name],["Prontuário",v.record],["Nascimento",dateBR(v.birth)],["Idade",v.age?v.age+" anos":""],["Data da visita",dateBR(v.date)],["Local",v.location],["Informante",v.informant]];
const data=info.map(([label,value])=>'<div><small>'+E(label)+'</small>'+E(value||"Não informado")+'</div>').join("");
const content=generateText(v).filter(s=>s[0]!=="IDENTIFICAÇÃO"&&s[0]!=="RESPONSÁVEIS").map(([title,paragraphs])=>'<div class="doc-section"><h3>'+E(title)+'</h3>'+paragraphs.map(str=>{const t=String(str||""),pos=t.indexOf(": ");return pos>0&&pos<58?'<p><strong>'+E(t.slice(0,pos+1))+'</strong> '+E(t.slice(pos+2))+'</p>':'<p>'+E(t)+'</p>'}).join("")+'</div>').join("");
el("document").innerHTML='<div class="doc-head"><div><div class="doc-brand">Assistência domiciliar · Enfermagem</div><h2>Relatório de Enfermagem</h2><p class="doc-subtitle">Avaliação, diagnóstico, planejamento e evolução</p></div><span class="doc-badge">REGISTRO CLÍNICO</span></div><div class="doc-patient-grid">'+data+'</div>'+content+'<div class="doc-signature"><div class="signature-columns"><div><div class="sig-line"></div><p><strong>'+E(settings.nurse||'[Nome completo da enfermeira]')+'</strong><br>Enfermeira · COREN-MG '+E(settings.coren||'[nº]')+'</p></div><div><div class="sig-line"></div><p><strong>'+E(settings.supervisor||'[Nome completo da supervisão]')+'</strong><br>Supervisão · Enfermeira · COREN-MG '+E(settings.superCoren||'[nº]')+'</p></div></div></div><div class="doc-footer">Documento para revisão e assinatura profissional. Campos ausentes não indicam achados normais.</div>';
}
const previousPage=page;page=function(name){
el("patientsPage").classList.toggle("hidden",name!=="patients");
if(name==="patients"){["form","history","charts","settings","preview"].forEach(x=>el(x+"Page").classList.add("hidden"));document.querySelectorAll("#nav button").forEach(b=>b.classList.toggle("active",b.dataset.page==="patients"));renderPatientList();window.scrollTo(0,0)}
else{previousPage(name);el("patientsPage").classList.add("hidden");if(name==="history")renderHistory()}
};
renderDoc=renderProfessionalDoc;
async function refresh(){
const [p,v,s]=await Promise.all([api("/patients"),api("/visits"),api("/settings")]);
patients=p.patients||[];rows=v.visits||[];settings=s.settings||{};updatePicker();renderPatientList();
settingFields.forEach(([k])=>el(k).value=settings[k]||"");
}
async function saveSettingsRemote(){
const o={};settingFields.forEach(([k])=>o[k]=el(k).value.trim());
try{await api("/settings",{method:"POST",body:JSON.stringify(o)});settings=o;toast("Configuração salva com segurança no servidor.")}catch(e){toast(e.message,true)}
}

window.ENF_APP={
 start:async()=>{initializeUI();await refresh();ready=true;historyPatient="";page("patients");},
 refresh,
 getLegacy:()=>store,
 importLegacy:async()=>{const p=store.patients||[],v=store.visits||[];if(!p.length&&!v.length)return {patients:0,visits:0};const result=await api("/migrate",{method:"POST",body:JSON.stringify({patients:p,visits:v})});await refresh();return result;},
 getSnapshot:()=>({patients,visits:rows,settings})
};
})();
