(()=>{
"use strict";
const $=id=>document.getElementById(id),E=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const call=async(path,opts={})=>{const r=await fetch("/api"+path,{credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json"},...opts});let data;try{data=await r.json()}catch(e){throw Error("Resposta inválida do servidor.")}if(!r.ok)throw Error(data.error||"Falha ao comunicar com o servidor");return data};
const post=(path,body)=>call(path,{method:"POST",body:JSON.stringify(body)});
let current=null,busy=false,adminPage=null,adminNav=null;
function overlayMarkup(){
 let overlay=$("loginOverlay");if(overlay)overlay.remove();
 overlay=document.createElement("div");overlay.id="loginOverlay";overlay.className="login-shell";
 overlay.innerHTML='<div class="login-card"><div class="login-symbol">✚</div><span class="login-label">ENFERMAGEM · ACESSO RESTRITO</span><h1>Bem-vindo</h1><p>Entre com seu usuário e PIN de seis dígitos para acessar os registros.</p><form id="userLoginForm" autocomplete="on"><div class="field"><label for="loginUsername">Usuário</label><input id="loginUsername" type="text" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="30" required autocomplete="username" placeholder="Seu usuário"></div><div class="field"><label for="loginPin">PIN de 6 números</label><input id="loginPin" type="password" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" minlength="6" required autocomplete="current-password" placeholder="••••••"></div><div id="loginFeedback" class="login-feedback" role="status"></div><button id="loginSubmit" type="submit" class="login-main-button">Entrar</button></form><div class="login-small-note">Os acessos são cadastrados pelo administrador. Se você esqueceu seu PIN, solicite a redefinição.</div></div>';
 document.body.append(overlay);
 $("userLoginForm").onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;$("loginSubmit").disabled=true;$("loginFeedback").textContent="";
 try{const res=await post("/login",{username:$("loginUsername").value.trim().toLowerCase(),pin:$("loginPin").value});current=res.user;if(current.mustChange)showPinChange(true);else await enterApp()}
 catch(err){$("loginFeedback").textContent=err.message;$("loginFeedback").className="login-feedback error"}finally{busy=false;if($("loginSubmit"))$("loginSubmit").disabled=false}};
}
function showPinChange(force){
 const overlay=$("loginOverlay")||document.createElement("div");if(!overlay.id){overlay.id="loginOverlay";overlay.className="login-shell";document.body.append(overlay)}
 overlay.innerHTML='<div class="login-card"><div class="login-symbol">✚</div><span class="login-label">SEGURANÇA DA CONTA</span><h1>Alterar PIN</h1><p>'+ (force?"Troque seu PIN temporário antes de continuar.":"Crie um novo PIN de acesso.") +'</p><form id="changePinForm"><div class="field"><label>PIN atual</label><input type="password" inputmode="numeric" maxlength="6" minlength="6" pattern="[0-9]{6}" id="currentPin" autocomplete="current-password" required></div><div class="field"><label>Novo PIN (6 dígitos)</label><input type="password" inputmode="numeric" maxlength="6" minlength="6" pattern="[0-9]{6}" id="newPin" autocomplete="new-password" required></div><div class="field"><label>Confirme o novo PIN</label><input type="password" inputmode="numeric" maxlength="6" minlength="6" pattern="[0-9]{6}" id="confirmPin" autocomplete="new-password" required></div><div id="pinFeedback" class="login-feedback" role="status"></div><button type="submit" class="login-main-button">Salvar novo PIN</button></form>'+(force?'':'<button class="auth-close" id="cancelChange" type="button">Cancelar</button>')+'</div>';
 if(!force)$("cancelChange").onclick=()=>overlay.remove();
 $("changePinForm").onsubmit=async e=>{e.preventDefault();const prev=$("currentPin").value,now=$("newPin").value;if(now!==$("confirmPin").value){$("pinFeedback").textContent="Os dois PINs não conferem.";return}
 const btn=e.target.querySelector("button");btn.disabled=true;$("pinFeedback").textContent="";
 try{await post("/my-pin",{currentPin:prev,newPin:now});current.mustChange=false;if(force)await enterApp();else{overlay.remove();alert("PIN atualizado com sucesso.")}}
 catch(err){$("pinFeedback").textContent=err.message}
 finally{btn.disabled=false}
 };
}
async function enterApp(){
 if(!$("patientsPage")){await window.ENF_APP.start()}else await window.ENF_APP.refresh();
 document.documentElement.classList.add("enf-authenticated");
 $("loginOverlay")?.remove();
 addAccountUI();
 if(current.role==="admin")await loadUsers();
}
function createPanel(){
 const aside=$("nav"),navBtn=document.createElement("button");navBtn.type="button";navBtn.textContent="♧ Usuários";navBtn.dataset.page="users";navBtn.id="usersNav";
 aside.insertBefore(navBtn,aside.lastElementChild);adminNav=navBtn;
 const pane=document.createElement("div");pane.id="usersPage";pane.className="hidden noprint";
 pane.innerHTML='<div class="topline"><div><h1>Gestão de acessos</h1><p class="muted">Cadastre quem pode entrar e gerencie os PINs dos usuários.</p></div></div><div class="card"><h2>Novo usuário</h2><form id="staffForm"><div class="grid"><div class="field"><label>Nome completo</label><input id="staffName" maxlength="120" required placeholder="Nome da enfermeira"></div><div class="field"><label>Usuário de acesso</label><input id="staffUsername" minlength="3" maxlength="30" autocomplete="off" pattern="[a-zA-Z0-9._-]{3,30}" autocapitalize="none" required placeholder="Ex.: mariana"></div><div class="field"><label>PIN inicial (6 números)</label><input id="staffPin" type="password" inputmode="numeric" maxlength="6" minlength="6" pattern="[0-9]{6}" required autocomplete="new-password" placeholder="••••••"></div></div><div class="actions"><button type="submit" id="staffCreate">Criar acesso</button></div><p class="muted">O usuário deverá trocar esse PIN no primeiro acesso. Nunca envie o PIN em grupos ou locais públicos.</p><div id="staffMessage" role="status"></div></form></div><div class="card"><h2>Usuários cadastrados</h2><div id="staffList" class="listing"><p class="muted">Carregando…</p></div></div>';
 $("settingsPage").before(pane);adminPage=pane;
 navBtn.addEventListener("click",()=>{for(const id of ["formPage","patientsPage","historyPage","chartsPage","settingsPage","previewPage"])$(id)?.classList.add("hidden");pane.classList.remove("hidden");aside.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===navBtn));window.scrollTo(0,0);loadUsers()});
 aside.addEventListener("click",e=>{if(e.target.closest("button")!==navBtn)pane.classList.add("hidden")});
 $("staffForm").onsubmit=async e=>{e.preventDefault();const button=$("staffCreate");button.disabled=true;$("staffMessage").textContent="";
 try{const data={name:$("staffName").value.trim(),username:$("staffUsername").value.trim().toLowerCase(),pin:$("staffPin").value};await post("/users",data);$("staffForm").reset();$("staffMessage").textContent="Usuário criado. Entregue o PIN temporário diretamente à pessoa.";await loadUsers()}catch(err){$("staffMessage").textContent=err.message}finally{button.disabled=false}};
 $("staffList").addEventListener("click",async e=>{const b=e.target.closest("[data-action]");if(!b)return;const action=b.dataset.action,target=b.dataset.id;if(!target)return;
 let body={id:target};
 if(action==="reset-pin"){const pin=prompt("Novo PIN temporário de 6 números:");if(pin===null)return;if(!/^[0-9]{6}$/.test(pin)){alert("Digite exatamente 6 números.");return}body={...body,action:"reset-pin",pin};}
 else {body={...body,action:"set-active",active:action==="enable"};if(!confirm(action==="enable"?"Reativar este usuário?":"Bloquear o acesso deste usuário?"))return}
 b.disabled=true;try{await post("/users/manage",body);await loadUsers()}catch(err){alert(err.message)}finally{b.disabled=false}
 });
}
async function loadUsers(){
 if(!current||current.role!=="admin"||!$("staffList"))return;
 try{const data=await call("/users");$("staffList").innerHTML=data.users.map(u=>'<div class="item staff-item"><div><strong>'+E(u.name)+'</strong><small>@'+E(u.username)+' · '+(u.role==="admin"?"Administrador":"Usuário")+' · '+(u.active?"Ativo":"Bloqueado")+(u.must_change?" · PIN temporário":"")+'</small></div><div class="staff-actions">'+(u.role==="admin"?'<span class="tag">ADM</span>':'<button class="light" type="button" data-action="reset-pin" data-id="'+E(u.id)+'">Redefinir PIN</button><button class="secondary" type="button" data-action="'+(u.active?"disable":"enable")+'" data-id="'+E(u.id)+'">'+(u.active?"Bloquear":"Ativar")+'</button>')+'</div></div>').join("")}
 catch(err){$("staffList").textContent=err.message}
}
function addAccountUI(){
 if($("logoutBtn"))return;
 const wrapper=document.createElement("div");wrapper.className="card noprint";
 wrapper.innerHTML='<h2>Minha conta</h2><p class="muted">Conectado como <strong id="accountName"></strong>.</p><div class="actions"><button type="button" class="light" id="myPinBtn">Alterar meu PIN</button><button type="button" class="secondary" id="logoutBtn">Sair da conta</button></div>';
 $("settingsPage").append(wrapper);
 $("accountName").textContent=current.name+" ( "+current.username+" )";
 $("myPinBtn").onclick=()=>showPinChange(false);
 $("logoutBtn").onclick=async()=>{try{await post("/logout",{})}catch(e){}location.reload()};
 if(current.role==="admin"&&!$("usersPage")){
  createPanel();
  const oldRecords=window.ENF_APP.getLegacy(),p=oldRecords.patients||[],v=oldRecords.visits||[];
  const container=document.createElement("div");container.className="card noprint";container.id="legacyImportCard";
  container.innerHTML='<h2>Importar histórico anterior</h2><p class="muted">Encontramos '+p.length+' pacientes e '+v.length+' atendimentos no armazenamento antigo deste navegador. Você pode trazê-los para o banco D1 sem apagar os registros existentes.</p><button type="button" class="light" id="legacyImportBtn">Importar deste navegador</button>';
  $("settingsPage").append(container);
  $("legacyImportBtn").onclick=async()=>{if(!confirm("Importar histórico do navegador para o banco online? Registros antigos serão preservados."))return;const b=$("legacyImportBtn");b.disabled=true;try{const result=await window.ENF_APP.importLegacy();alert("Importados: "+result.patients+" pacientes e "+result.visits+" atendimentos.")}catch(e){alert(e.message)}finally{b.disabled=false}};
 }else if(current.role!=="admin"){
  $("importBtn").disabled=true;$("importBtn").title="A importação de backup é exclusiva do administrador";
 }
}
async function boot(){
 try{const response=await call("/me");current=response.user;if(current.mustChange)showPinChange(true);else await enterApp()}
 catch(e){overlayMarkup()}
}
boot();
})();