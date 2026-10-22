/* Formulário clínico: lesões independentes e avaliação de dor EVA/PAINAD. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const woundDefs=[
 ["woundLocation","Localização anatômica da lesão","Descreva o local e a lateralidade"],
 ["woundSize","Dimensões e profundidade","Comprimento, largura, profundidade ou impossibilidade de mensurar"],
 ["woundBed","Leito, bordas e pele perilesional","Tecidos observados, bordas, pele ao redor"],
 ["woundExudate","Exsudato, odor e sinais observados","Quantidade, aspecto, odor e demais achados"],
 ["woundCare","Coberturas e cuidados realizados","Limpeza, cobertura e intervenções efetivamente realizadas"]
];
const painad=[
 {id:"respiration",name:"Respiração",items:["Normal, independente de vocalizações","Respiração ocasionalmente trabalhosa ou hiperventilação breve","Respiração ruidosa/trabalhosa, hiperventilação prolongada ou Cheyne-Stokes"]},
 {id:"vocalization",name:"Vocalização negativa",items:["Nenhuma","Gemidos ocasionais ou fala baixa em tom negativo","Chamados angustiados repetidos, gemidos fortes ou choro"]},
 {id:"face",name:"Expressão facial",items:["Sorridente ou sem expressão particular","Tristeza, medo ou franzir o rosto","Careta de dor"]},
 {id:"body",name:"Linguagem corporal",items:["Relaxado(a)","Tenso(a), inquietação, andar agitado ou mexer-se constantemente","Rigidez, punhos cerrados, joelhos recolhidos, afastar/empurrar ou agressividade"]},
 {id:"consolability",name:"Consolabilidade",items:["Sem necessidade de consolo","Acalma com voz, toque ou distração","Não é possível consolar, distrair ou tranquilizar"]}
];
const oldValues=window.values,oldFill=window.fill,oldGenerateText=window.generateText;
if(typeof oldValues!=="function"||typeof oldFill!=="function"||typeof oldGenerateText!=="function")return;
const examination=$("exam");
const oldPain=$("pain");
if(oldPain)oldPain.closest(".field").classList.add("legacy-clinical-hidden");
$("woundfields").classList.add("legacy-clinical-hidden");
const pane=$("lesionsPane");
pane.insertAdjacentHTML("beforeend",'<div class="wound-intro"><p class="muted">Preencha as informações de cada lesão separadamente. Cada ficha aparecerá individualmente no relatório.</p><span id="woundCount" class="wound-count"></span></div><div id="woundsList" class="wounds-list"></div><button type="button" id="addWound" class="secondary wound-add">+ Adicionar outra lesão</button>');
examination.insertAdjacentHTML("afterend",
 '<div class="pain-assessment"><div class="pain-heading"><h3>Avaliação da dor</h3><span class="clinical-hint">Selecione a escala aplicável</span></div><div class="field"><label for="painScale">Escala utilizada</label><select id="painScale"><option value="">Selecione EVA ou PAINAD...</option><option value="eva">EVA — intensidade informada pela pessoa (0 a 10)</option><option value="painad">PAINAD — avaliação comportamental (0 a 10)</option></select></div>'+
 '<div id="evaPane" class="pain-pane hidden"><p class="muted">Solicite que a pessoa informe a intensidade da dor. 0 significa sem dor e 10 a pior dor imaginável.</p><div class="pain-score-row"><strong id="evaValue">0</strong><span>/ 10</span><span id="evaText" class="pain-state">Sem dor</span></div><input id="evaSlider" class="pain-slider" type="range" min="0" max="10" step="1" value="0" aria-label="Intensidade da dor pela EVA"><div class="pain-range-labels"><span>0 · Sem dor</span><span>10 · Pior dor imaginável</span></div></div>'+
 '<div id="painadPane" class="pain-pane hidden"><p class="muted">Para pessoas com demência avançada ou dificuldade de comunicar a dor. Observe em repouso e durante o movimento. Pontue cada um dos cinco comportamentos de 0 a 2.</p><div class="painad-fields" id="painadFields"></div><div class="pain-total"><div class="pain-score-row"><strong id="painadValue">—</strong><span>/ 10</span><span id="painadText" class="pain-state">Preencha os cinco critérios</span></div><input id="painadSlider" class="pain-slider" type="range" min="0" max="10" step="1" value="0" disabled aria-label="Total automático da PAINAD"><div class="pain-range-labels"><span>0 · Sem sinais observáveis</span><span>10 · Maior pontuação observada</span></div><p class="clinical-hint">O total PAINAD é calculado automaticamente. Não substitui a avaliação clínica.</p></div></div></div>'
);
$("painadFields").innerHTML=painad.map(d=>'<div class="painad-domain"><label for="painad-'+d.id+'">'+esc(d.name)+' <span>0–2 pontos</span></label><select id="painad-'+d.id+'" data-painad="'+d.id+'"><option value="">Selecione o comportamento observado...</option>'+d.items.map((opt,n)=>'<option value="'+n+'">'+n+' — '+esc(opt)+'</option>').join("")+'</select></div>').join("");
const emptyWound=()=>Object.fromEntries(woundDefs.map(([k])=>[k,""]));
function updateWoundHeaders(){
 const cards=Array.from($("woundsList").children);
 cards.forEach((card,i)=>{
  card.querySelector(".wound-title").textContent="Lesão "+String(i+1).padStart(2,"0");
  card.querySelectorAll("[data-wound-field]").forEach(input=>{const label=input.closest(".field").querySelector("label");const field=woundDefs.find(x=>x[0]===input.dataset.woundField);if(field)label.textContent=field[1]+" — Lesão "+(i+1)});
 });
 $("woundCount").textContent=cards.length+" "+(cards.length===1?"lesão cadastrada":"lesões cadastradas");
 $("addWound").disabled=cards.length>=30;
}
function addWound(info={},focus=false){
 if($("woundsList").children.length>=30)return;
 const block=document.createElement("section");
 block.className="wound-card";
 block.innerHTML='<div class="wound-card-head"><div><span class="wound-kicker">Avaliação individual</span><h4 class="wound-title"></h4></div><button type="button" class="wound-remove" data-remove-wound title="Remover esta lesão">Remover lesão</button></div><div class="grid wound-card-grid">'+woundDefs.map(([key,label,placeholder])=>'<div class="field wide"><label>'+esc(label)+'</label><textarea data-wound-field="'+key+'" rows="3" maxlength="3000" placeholder="'+esc(placeholder)+'"></textarea></div>').join("")+'</div>';
 $("woundsList").appendChild(block);
 block.querySelectorAll("[data-wound-field]").forEach(input=>input.value=String(info?.[input.dataset.woundField]??""));
 updateWoundHeaders();
 if(focus)block.querySelector("textarea")?.focus({preventScroll:false});
}
function renderWounds(wounds){
 $("woundsList").replaceChildren();
 (Array.isArray(wounds)?wounds:[]).slice(0,30).forEach(w=>addWound(w));
 if(!$("woundsList").children.length&&$("lesions").checked)addWound();
 updateWoundHeaders();
}
function allWounds(){
 return Array.from($("woundsList").children).map(node=>Object.fromEntries(woundDefs.map(([name])=>[name,node.querySelector('[data-wound-field="'+name+'"]')?.value.trim().slice(0,3000)||""])));
}
function toggleWoundsEnhanced(){
 pane.classList.toggle("hidden",!$("lesions").checked);
 if($("lesions").checked&&!$("woundsList").children.length)addWound();
}
window.toggleWounds=toggleWoundsEnhanced;
$("lesions").onchange=toggleWoundsEnhanced;
$("addWound").addEventListener("click",()=>addWound({},true));
$("woundsList").addEventListener("click",ev=>{
 const button=ev.target.closest("[data-remove-wound]");
 if(!button)return;
 const card=button.closest(".wound-card");
 if(Array.from(card.querySelectorAll("textarea")).some(x=>x.value.trim())&&!confirm("Remover esta lesão e os dados preenchidos?"))return;
 card.remove();
 if(!$("woundsList").children.length&&$("lesions").checked)addWound();
 updateWoundHeaders();
});
const intensity=n=> n===0?"Sem dor":n<=3?"Dor leve":n<=6?"Dor moderada":"Dor intensa";
function updateEva(){
 const value=Number($("evaSlider").value);
 $("evaValue").textContent=String(value);
 $("evaText").textContent=intensity(value);
 $("evaSlider").style.setProperty("--pain-percent",value*10+"%");
 if($("painScale").value==="eva")$("pain").value=String(value);
}
function selectedPainad(){
 const obj={};for(const item of painad){const s=$("painad-"+item.id).value;obj[item.id]=/^[012]$/.test(s)?Number(s):null}return obj;
}
function updatePainad(){
 const obj=selectedPainad(),score=Object.values(obj);
 const ready=score.every(v=>v!==null),total=ready?score.reduce((a,b)=>a+b,0):null;
 $("painadValue").textContent=ready?String(total):"—";
 $("painadText").textContent=ready?String(total)+" pontos":(score.filter(v=>v!==null).length)+"/5 critérios preenchidos";
 $("painadSlider").value=String(total??0);
 $("painadSlider").style.setProperty("--pain-percent",(total??0)*10+"%");
 if($("painScale").value==="painad")$("pain").value=ready?String(total):"";
 return {ready,total,items:obj};
}
function switchPain(){
 const scale=$("painScale").value;
 $("evaPane").classList.toggle("hidden",scale!=="eva");
 $("painadPane").classList.toggle("hidden",scale!=="painad");
 $("pain").value="";
 if(scale==="eva")updateEva();
 if(scale==="painad")updatePainad();
}
$("painScale").addEventListener("change",switchPain);
$("evaSlider").addEventListener("input",updateEva);
$("painadFields").addEventListener("change",updatePainad);
function readPain(){
 const scale=$("painScale").value;
 if(scale==="eva")return {painScale:"eva",pain:String($("evaSlider").value),painadScores:null};
 if(scale==="painad"){
  const p=updatePainad();
  if(!p.ready)throw Error("Para registrar a PAINAD, preencha os cinco critérios observacionais (0 a 2 pontos cada).");
  return {painScale:"painad",pain:String(p.total),painadScores:p.items};
 }
 return {painScale:"",pain:"",painadScores:null};
}
window.values=function(){
 const v=oldValues();
 for(const [key] of woundDefs)delete v[key];
 Object.assign(v,readPain());
 v.wounds=v.lesions?allWounds():[];
 return v;
};
window.fill=function(v){
 oldFill(v);
 const legacy=woundDefs.some(([key])=>String(v[key]||"").trim())?[Object.fromEntries(woundDefs.map(([k])=>[k,String(v[k]||"")]))]:[];
 const list=Array.isArray(v.wounds)?v.wounds:legacy;
 $("lesions").checked=!!(v.lesions||list.length);
 renderWounds(list);
 toggleWoundsEnhanced();
 const scale=v.painScale==="painad"?"painad":v.painScale==="eva"?"eva":(v.pain!==undefined&&v.pain!==null&&v.pain!==""?"eva":"");
 $("painScale").value=scale;
 $("evaSlider").value=String(Math.max(0,Math.min(10,Number(v.pain)||0)));
 for(const d of painad){const x=v.painadScores?.[d.id];$("painad-"+d.id).value=x===0||x===1||x===2?String(x):""}
 switchPain();
};
window.resetClinicalAssessment=function(){
 $("lesions").checked=false;
 $("woundsList").replaceChildren();
 pane.classList.add("hidden");
 updateWoundHeaders();
 $("painScale").value="";
 $("evaSlider").value="0";
 $("painadFields").querySelectorAll("select").forEach(s=>s.value="");
 $("pain").value="";
 switchPain();
};
window.generateText=function(v){
 const sections=oldGenerateText(v);
 const oldIdx=sections.findIndex(x=>x[0]==="AVALIAÇÃO DE LESÕES");
 if(oldIdx>=0)sections.splice(oldIdx,1);
 const wounds=Array.isArray(v.wounds)&&v.wounds.length?v.wounds:(v.lesions&&woundDefs.some(([key])=>v[key])?[Object.fromEntries(woundDefs.map(([key])=>[key,v[key]||""]))]:[]);
 const physical=sections.find(x=>x[0]==="EXAME FÍSICO");
 if(physical){
  physical[1]=physical[1].filter(x=>!/^Dor:\s/.test(x));
  if(v.pain!==""&&v.pain!==undefined&&v.pain!==null)physical[1].push("Dor — "+(v.painScale==="painad"?"PAINAD":"EVA")+": "+v.pain+"/10");
 }
 const after=sections.findIndex(x=>x[0]==="EXAME FÍSICO")+1;
 let offset=0;
 if(v.painScale==="painad"&&v.painadScores){
  sections.splice(after+offset,0,["PAINAD — AVALIAÇÃO COMPORTAMENTAL",painad.map(d=>{
   const score=Number(v.painadScores[d.id]);return d.name+": "+score+"/2 — "+d.items[score];
  })]);offset++;
 }
 if(v.lesions&&wounds.length){
  sections.splice(after+offset,0,...wounds.map((w,i)=>["AVALIAÇÃO DE LESÃO "+(i+1),woundDefs.map(([key,label])=>label+": "+String(w[key]||"Não informado"))]));
 }
 return sections;
};
renderWounds([]);
switchPain();
})();
