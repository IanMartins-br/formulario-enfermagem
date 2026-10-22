// Protected clinical records API - Cloudflare Pages + D1.
// PINs are salted and PBKDF2-hashed with a server-side secret, never saved in plain text.
const reply=(obj,status=200,extra={})=>new Response(JSON.stringify(obj),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store, private","x-content-type-options":"nosniff",...extra}});
const id=()=>crypto.randomUUID();
const hex=b=>Array.from(new Uint8Array(b)).map(n=>n.toString(16).padStart(2,"0")).join("");
const randomHex=n=>hex(crypto.getRandomValues(new Uint8Array(n)));
const sha=async s=>hex(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)));
const validPin=p=>typeof p==="string"&&/^[0-9]{6}$/.test(p);
const validName=n=>typeof n==="string"&&/^[a-z0-9._-]{3,30}$/.test(n);
const clean=(v,n=255)=>typeof v==="string"?v.trim().slice(0,n):"";
const secureEqual=(a,b)=>{if(!a||!b||a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0};
async function pinHash(pin,salt,secret){const base=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret+":"+pin),"PBKDF2",false,["deriveBits"]);return hex(await crypto.subtle.deriveBits({name:"PBKDF2",salt:new Uint8Array(salt.match(/.{2}/g).map(x=>parseInt(x,16))),iterations:100000,hash:"SHA-256"},base,256))}
const tokenCookie=req=>(req.headers.get("cookie")||"").split(";").map(s=>s.trim()).find(s=>s.startsWith("enf_session="))?.slice(12)||"";
const secureOrigin=req=>{const origin=req.headers.get("origin");return origin===new URL(req.url).origin || (!origin&&["same-origin","none"].includes(req.headers.get("sec-fetch-site")))};
async function input(req){let txt=await req.text();if(txt.length>850000)throw Error("large");let j=JSON.parse(txt);if(!j||typeof j!=="object"||Array.isArray(j))throw Error("invalid");return j}
async function log(db,actor,action,target){await db.prepare("INSERT INTO audit_events (id,actor_id,action,record_id) VALUES (?,?,?,?)").bind(id(),actor,action,target||null).run()}
async function auth(req,db){const t=tokenCookie(req);if(!/^[a-f0-9]{64}$/.test(t))return null;return db.prepare("SELECT a.id,a.username,a.display_name,a.role,a.must_change FROM staff_sessions s JOIN staff_accounts a ON a.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND a.active=1").bind(await sha(t),new Date().toISOString()).first()}
async function newSession(db,u){const token=randomHex(32);await db.prepare("INSERT INTO staff_sessions(token_hash,user_id,expires_at) VALUES (?,?,?)").bind(await sha(token),u.id,new Date(Date.now()+8*3600000).toISOString()).run();return token}
const cookie=t=>"enf_session="+t+"; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age="+(t?28800:0);
async function failCount(db,key,limit){const r=await db.prepare("SELECT attempts,last_attempt FROM staff_login_attempts WHERE attempt_key=?").bind(key).first();return !!(r&&r.attempts>=limit&&Date.now()-new Date(r.last_attempt).getTime()<1800000)}
async function addFailure(db,key){const now=new Date().toISOString(),r=await db.prepare("SELECT attempts,last_attempt FROM staff_login_attempts WHERE attempt_key=?").bind(key).first();const n=r&&Date.now()-new Date(r.last_attempt).getTime()<1800000?r.attempts+1:1;await db.prepare("INSERT INTO staff_login_attempts(attempt_key,attempts,last_attempt) VALUES(?,?,?) ON CONFLICT(attempt_key) DO UPDATE SET attempts=excluded.attempts,last_attempt=excluded.last_attempt").bind(key,n,now).run()}
async function login(req,db,secret){const b=await input(req),username=clean(b.username,30).toLowerCase(),pin=b.pin;const ipkey=await sha("ip:"+(req.headers.get("cf-connecting-ip")||"na")),accountkey=await sha("user:"+username);if(await failCount(db,ipkey,8)||await failCount(db,accountkey,6))return reply({error:"Muitas tentativas. Aguarde 30 minutos."},429);
if(!validName(username)||!validPin(pin))return reply({error:"Usuário ou PIN inválido."},401);
// Rename the existing owner account on the first login attempt using the new username.
if(username==="mari"){
 await db.prepare("UPDATE staff_accounts SET username='mari', display_name='Mari', updated_at=CURRENT_TIMESTAMP WHERE id='ian-admin' AND username='ian' AND NOT EXISTS(SELECT 1 FROM staff_accounts WHERE username='mari')").run();
}
const user=await db.prepare("SELECT id,username,display_name,role,active,must_change,pin_salt,pin_hash FROM staff_accounts WHERE username=?").bind(username).first();
let verified=false;if(user&&user.active){verified=secureEqual(await pinHash(pin,user.pin_salt,secret),user.pin_hash)}
if(!verified){await addFailure(db,ipkey);await addFailure(db,accountkey);return reply({error:"Usuário ou PIN inválido."},401)}
await db.prepare("DELETE FROM staff_login_attempts WHERE attempt_key IN (?,?)").bind(ipkey,accountkey).run();await db.prepare("DELETE FROM staff_sessions WHERE user_id=? AND expires_at<?").bind(user.id,new Date().toISOString()).run();
const tok=await newSession(db,user);await log(db,user.id,"login",null);
return reply({ok:true,user:{id:user.id,username:user.username,name:user.display_name,role:user.role,mustChange:!!user.must_change}},200,{"set-cookie":cookie(tok)});
}
const deny=()=>reply({error:"Acesso não autorizado. Faça login."},401);
const forbidden=()=>reply({error:"Ação permitida somente ao administrador."},403);
const docSafe=v=>{
 let output={};
 const woundKeys=["woundLocation","woundSize","woundBed","woundExudate","woundCare"];
 const painadKeys=["respiration","vocalization","face","body","consolability"];
 for(const [k,x] of Object.entries(v)){
  if(k==="__proto__"||k==="constructor"||k==="prototype")continue;
  if(k==="wounds"&&Array.isArray(x)){
   output.wounds=x.slice(0,30).map(w=>{
    const item={};
    if(w&&typeof w==="object"&&!Array.isArray(w))for(const key of woundKeys)item[key]=clean(w[key],3000);
    return item;
   });
  }else if(k==="painadScores"&&x&&typeof x==="object"&&!Array.isArray(x)){
   const item={};for(const key of painadKeys){
    const n=x[key];if(Number.isInteger(n)&&n>=0&&n<=2)item[key]=n;
   }
   output.painadScores=item;
  }else if(typeof x==="string")output[k]=x.slice(0,8000);
  else if(typeof x==="boolean")output[k]=x;
 }
 return output;
};
export async function onRequest({request,env}){
 const path=new URL(request.url).pathname.replace(/\/$/,""),method=request.method;
 if(!env.DB||!env.APP_SETUP_KEY)return reply({error:"Configuração segura de banco/autenticação ausente."},503);
 if(!["GET","POST"].includes(method))return reply({error:"Método não permitido."},405);
 if(method==="POST"&&!secureOrigin(request))return reply({error:"Origem não autorizada."},403);
 try{
 const db=env.DB,secret=env.APP_SETUP_KEY;
 if(path==="/api/login"&&method==="POST")return await login(request,db,secret);
 if(path==="/api/health"&&method==="GET")return reply({ok:true,authentication:"required"});
 const user=await auth(request,db);if(!user)return deny();
 if(path==="/api/me"&&method==="GET")return reply({user:{id:user.id,username:user.username,name:user.display_name,role:user.role,mustChange:!!user.must_change}});
 if(path==="/api/logout"&&method==="POST"){await db.prepare("DELETE FROM staff_sessions WHERE token_hash=?").bind(await sha(tokenCookie(request))).run();return reply({ok:true},200,{"set-cookie":cookie("")})}
 if(path==="/api/my-pin"&&method==="POST"){const b=await input(request);if(!validPin(b.currentPin)||!validPin(b.newPin)||b.currentPin===b.newPin)return reply({error:"Informe PIN atual e novo PIN de 6 números, diferentes."},400);
 const old=await db.prepare("SELECT pin_salt,pin_hash FROM staff_accounts WHERE id=?").bind(user.id).first();if(!secureEqual(await pinHash(b.currentPin,old.pin_salt,secret),old.pin_hash))return reply({error:"PIN atual incorreto."},403);
 const salt=randomHex(16),hash=await pinHash(b.newPin,salt,secret);
 await db.prepare("UPDATE staff_accounts SET pin_salt=?,pin_hash=?,must_change=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(salt,hash,user.id).run();
 await log(db,user.id,"pin_changed",user.id);return reply({ok:true});}
 if(user.must_change)return reply({error:"Troque seu PIN temporário antes de continuar.",mustChange:true},403);
 if(path==="/api/users"&&method==="GET"){if(user.role!=="admin")return forbidden();const r=await db.prepare("SELECT id,username,display_name AS name,role,active,must_change,created_at FROM staff_accounts ORDER BY role ASC, username ASC").all();return reply({users:r.results})}
 if(path==="/api/users"&&method==="POST"){if(user.role!=="admin")return forbidden();const b=await input(request);const username=clean(b.username,30).toLowerCase(),name=clean(b.name,120);
 if(!validName(username)||!name||!validPin(b.pin))return reply({error:"Informe nome, usuário (3 a 30 letras/números) e PIN de 6 dígitos."},400);
 const exists=await db.prepare("SELECT id FROM staff_accounts WHERE username=?").bind(username).first();if(exists)return reply({error:"Esse nome de usuário já existe."},409);
 const uid=id(),salt=randomHex(16),hash=await pinHash(b.pin,salt,secret);
 await db.prepare("INSERT INTO staff_accounts(id,username,display_name,role,pin_salt,pin_hash,active,must_change) VALUES(?,?,?,'staff',?,?,1,1)").bind(uid,username,name,salt,hash).run();await log(db,user.id,"user_created",uid);return reply({ok:true,id:uid});}
 if(path==="/api/users/manage"&&method==="POST"){if(user.role!=="admin")return forbidden();const b=await input(request),uid=clean(b.id,64);const target=await db.prepare("SELECT id,role FROM staff_accounts WHERE id=?").bind(uid).first();if(!target)return reply({error:"Usuário não encontrado."},404);
 if(target.role==="admin"||uid===user.id)return reply({error:"Não é possível alterar o administrador."},403);
 if(b.action==="set-active"){await db.prepare("UPDATE staff_accounts SET active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(b.active===true?1:0,uid).run();if(b.active!==true)await db.prepare("DELETE FROM staff_sessions WHERE user_id=?").bind(uid).run();await log(db,user.id,b.active===true?"user_enabled":"user_disabled",uid);return reply({ok:true})}
 if(b.action==="reset-pin"&&validPin(b.pin)){const salt=randomHex(16),hash=await pinHash(b.pin,salt,secret);await db.prepare("UPDATE staff_accounts SET pin_salt=?,pin_hash=?,must_change=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(salt,hash,uid).run();await db.prepare("DELETE FROM staff_sessions WHERE user_id=?").bind(uid).run();await log(db,user.id,"pin_reset",uid);return reply({ok:true})}
 return reply({error:"Ação inválida."},400);
 }
 if(path==="/api/patients"&&method==="GET"){const r=await db.prepare("SELECT id,record_number AS record,full_name AS name,birth_date AS birth,location,informant,phone_number AS whatsapp,created_at FROM patients ORDER BY full_name COLLATE NOCASE LIMIT 5000").all();return reply({patients:r.results})}
 if(path==="/api/patients"&&method==="POST"){const b=await input(request),name=clean(b.name,200),record=clean(b.record,80),birth=clean(b.birth,10),phone=clean(b.whatsapp,20);if(!name||!record||!/^\d{4}-\d{2}-\d{2}$/.test(birth))return reply({error:"Informe nome, número do prontuário e nascimento."},400);
 const rid=clean(b.id,64);const old=rid?await db.prepare("SELECT id FROM patients WHERE id=?").bind(rid).first():null;
 if(old){
 const dup=await db.prepare("SELECT id FROM patients WHERE record_number=? AND id<>?").bind(record,rid).first();
 if(dup)return reply({error:"Esse número de prontuário já pertence a outro paciente."},409);
 await db.prepare("UPDATE patients SET record_number=?,full_name=?,birth_date=?,location=?,informant=?,phone_number=? WHERE id=?").bind(record,name,birth,clean(b.location,200),clean(b.informant,160),phone,rid).run();
 await log(db,user.id,"patient_updated",rid);
 return reply({ok:true,id:rid,updated:true});
}
 const dup=await db.prepare("SELECT id FROM patients WHERE record_number=?").bind(record).first();if(dup)return reply({error:"Número de prontuário já utilizado."},409);
 const nid=id();await db.prepare("INSERT INTO patients(id,record_number,full_name,birth_date,location,informant,phone_number) VALUES(?,?,?,?,?,?,?)").bind(nid,record,name,birth,clean(b.location,200),clean(b.informant,160),phone).run();await log(db,user.id,"patient_created",nid);return reply({ok:true,id:nid});
 }
 if(path==="/api/visits/archived"&&method==="GET"){
 if(user.role!=="admin")return forbidden();
 const q=clean(new URL(request.url).searchParams.get("patient"),64);
 const sql="SELECT id,patient_id,visit_date,deleted_at,deletion_reason,created_at FROM clinical_visits WHERE deleted_at IS NOT NULL"+(q?" AND patient_id=?":"")+" ORDER BY deleted_at DESC LIMIT 500";
 const result=q?await db.prepare(sql).bind(q).all():await db.prepare(sql).all();
 return reply({visits:result.results});
 }
 if(path==="/api/visits/archive"&&method==="POST"){
 if(user.role!=="admin")return forbidden();
 const b=await input(request),visitId=clean(b.id,64),reason=clean(b.reason,300);
 if(!visitId||reason.length<5)return reply({error:"Selecione um atendimento e informe o motivo da exclusão (mínimo 5 caracteres)."},400);
 const existing=await db.prepare("SELECT id,deleted_at FROM clinical_visits WHERE id=?").bind(visitId).first();
 if(!existing)return reply({error:"Atendimento não encontrado."},404);
 if(existing.deleted_at)return reply({error:"Esse atendimento já foi removido do histórico."},409);
 const result=await db.prepare("UPDATE clinical_visits SET deleted_at=?,deleted_by=?,deletion_reason=? WHERE id=? AND deleted_at IS NULL").bind(new Date().toISOString(),user.id,reason,visitId).run();
 if(!result.meta?.changes)return reply({error:"Não foi possível atualizar o atendimento. Atualize o histórico."},409);
 await log(db,user.id,"visit_archived",visitId);
 return reply({ok:true,id:visitId,message:"Atendimento retirado do histórico. O administrador pode restaurá-lo."});
 }
 if(path==="/api/visits/restore"&&method==="POST"){
 if(user.role!=="admin")return forbidden();
 const b=await input(request),visitId=clean(b.id,64);
 if(!visitId)return reply({error:"Informe o atendimento."},400);
 const result=await db.prepare("UPDATE clinical_visits SET deleted_at=NULL,deleted_by=NULL,deletion_reason=NULL WHERE id=? AND deleted_at IS NOT NULL").bind(visitId).run();
 if(!result.meta?.changes)return reply({error:"Atendimento não encontrado na lixeira."},404);
 await log(db,user.id,"visit_restored",visitId);
 return reply({ok:true,id:visitId});
 }
 if(path==="/api/visits"&&method==="GET"){const q=new URL(request.url).searchParams.get("patient");let r=q?await db.prepare("SELECT id,patient_id,visit_date,document_json,created_at,revision,corrected_at FROM clinical_visits WHERE patient_id=? AND deleted_at IS NULL ORDER BY visit_date DESC,created_at DESC LIMIT 1500").bind(q).all():await db.prepare("SELECT id,patient_id,visit_date,document_json,created_at,revision,corrected_at FROM clinical_visits WHERE deleted_at IS NULL ORDER BY visit_date DESC,created_at DESC LIMIT 1500").all();return reply({visits:r.results.map(x=>({id:x.id,patient_id:x.patient_id,created:x.created_at,revision:x.revision||1,corrected_at:x.corrected_at,value:JSON.parse(x.document_json)}))})}

 if(path==="/api/visits/revisions"&&method==="GET"){
  const visitId=clean(new URL(request.url).searchParams.get("id"),64);
  if(!visitId)return reply({error:"Atendimento não informado."},400);
  const visit=await db.prepare("SELECT id,patient_id,revision,corrected_at,deleted_at FROM clinical_visits WHERE id=?").bind(visitId).first();
  if(!visit||visit.deleted_at)return reply({error:"Atendimento não encontrado."},404);
  const r=await db.prepare("SELECT r.revision,r.previous_document_json,r.reason,r.changed_at,a.display_name AS edited_by FROM clinical_visit_revisions r LEFT JOIN staff_accounts a ON a.id=r.edited_by WHERE r.visit_id=? ORDER BY r.revision DESC").bind(visitId).all();
  return reply({revision:visit.revision||1,corrected_at:visit.corrected_at,history:r.results.map(x=>({revision:x.revision-1,reason:x.reason,changed_at:x.changed_at,edited_by:x.edited_by||"Profissional",value:JSON.parse(x.previous_document_json)}))});
 }
 if(path==="/api/visits/update"&&method==="POST"){
  const b=await input(request),visitId=clean(b.id,64),reason=clean(b.reason,500);
  const expectedRevision=b.expectedRevision;
  if(!visitId||reason.length<5||!Number.isInteger(expectedRevision)||expectedRevision<1)return reply({error:"Informe um atendimento válido, sua versão atual e o motivo da correção (mínimo 5 caracteres)."},400);
  if(!b.value||typeof b.value!=="object"||Array.isArray(b.value)||!/^\d{4}-\d{2}-\d{2}$/.test(b.value.date||""))return reply({error:"Preencha uma data válida para o atendimento."},400);
  const visit=await db.prepare("SELECT id,patient_id,revision,deleted_at FROM clinical_visits WHERE id=?").bind(visitId).first();
  if(!visit||visit.deleted_at)return reply({error:"Atendimento não encontrado ou excluído."},404);
  if(visit.revision!==expectedRevision)return reply({error:"Este relatório foi atualizado em outro acesso. Atualize o histórico antes de salvar."},409);
  const patient=await db.prepare("SELECT record_number,full_name,birth_date,location,informant FROM patients WHERE id=?").bind(visit.patient_id).first();
  if(!patient)return reply({error:"Paciente deste relatório não localizado."},404);
  const v=docSafe(b.value);
  Object.assign(v,{name:patient.full_name,record:patient.record_number,birth:patient.birth_date,location:v.location||patient.location||"",informant:v.informant||patient.informant||""});
  const now=new Date().toISOString(),newRevision=expectedRevision+1;
  const statements=[
   db.prepare("INSERT INTO clinical_visit_revisions(id,visit_id,revision,previous_document_json,new_document_json,edited_by,reason,changed_at) SELECT ?,id,?,document_json,?,?,?,? FROM clinical_visits WHERE id=? AND revision=? AND deleted_at IS NULL").bind(id(),newRevision,JSON.stringify(v),user.id,reason,now,visitId,expectedRevision),
   db.prepare("UPDATE clinical_visits SET document_json=?,visit_date=?,revision=revision+1,corrected_at=?,corrected_by=? WHERE id=? AND revision=? AND deleted_at IS NULL").bind(JSON.stringify(v),v.date,now,user.id,visitId,expectedRevision)
  ];
  const [saved,updated]=await db.batch(statements);
  if(saved.meta?.changes!==1||updated.meta?.changes!==1)return reply({error:"Relatório atualizado em outra sessão. Atualize o histórico e tente novamente."},409);
  try{await log(db,user.id,"visit_corrected",visitId)}catch(e){console.warn("visit correction audit log unavailable")}
  return reply({ok:true,id:visitId,revision:newRevision,corrected_at:now,visit:{id:visitId,patient_id:visit.patient_id,revision:newRevision,corrected_at:now,value:v}});
 }
 if(path==="/api/visits"&&method==="POST"){const b=await input(request),patientId=clean(b.patient_id,64),p=await db.prepare("SELECT id,record_number,full_name,birth_date,location,informant FROM patients WHERE id=?").bind(patientId).first();if(!p)return reply({error:"Paciente não cadastrado."},400);
 if(!b.value||typeof b.value!=="object"||Array.isArray(b.value)||!/^\d{4}-\d{2}-\d{2}$/.test(b.value.date||""))return reply({error:"Atendimento ou data inválida."},400);
 const v=docSafe(b.value);Object.assign(v,{name:p.full_name,record:p.record_number,birth:p.birth_date,location:v.location||p.location||"",informant:v.informant||p.informant||""});
 const nid=id();await db.prepare("INSERT INTO clinical_visits(id,patient_id,visit_date,document_json) VALUES(?,?,?,?)").bind(nid,p.id,v.date,JSON.stringify(v)).run();await log(db,user.id,"visit_created",nid);return reply({ok:true,id:nid,visit:{id:nid,patient_id:p.id,value:v}})}
 if(path==="/api/settings"&&method==="GET"){const r=await db.prepare("SELECT settings_json FROM app_settings WHERE user_id=?").bind(user.id).first();return reply({settings:r?JSON.parse(r.settings_json):{}})}
 if(path==="/api/settings"&&method==="POST"){const b=await input(request),o={};for(const k of ["nurse","coren","supervisor","superCoren"])o[k]=clean(b[k],200);await db.prepare("INSERT INTO app_settings(user_id,settings_json) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET settings_json=excluded.settings_json,updated_at=CURRENT_TIMESTAMP").bind(user.id,JSON.stringify(o)).run();await log(db,user.id,"settings_updated",null);return reply({ok:true})}
 if(path==="/api/migrate"&&method==="POST"){
 if(user.role!=="admin")return forbidden();
 const b=await input(request),people=Array.isArray(b.patients)?b.patients:[],visits=Array.isArray(b.visits)?b.visits:[];
 if(people.length>300||visits.length>800)return reply({error:"Faça a migração em lotes menores."},413);
 let countP=0,countV=0;
 for(const p of people){if(!p||!clean(p.name,200)||!clean(p.record,80))continue;const prev=await db.prepare("SELECT id FROM patients WHERE record_number=?").bind(clean(p.record,80)).first();if(prev)continue;
 const pid=validName(p.id)?p.id:id(); // Don't trust local ids: import by record number, not by submitted identifier.
 await db.prepare("INSERT OR IGNORE INTO patients(id,record_number,full_name,birth_date,location,informant,phone_number) VALUES(?,?,?,?,?,?,?)").bind(id(),clean(p.record,80),clean(p.name,200),clean(p.birth,10),clean(p.location,200),clean(p.informant,160),clean(p.whatsapp,20)).run();countP++;
 }
 for(const v of visits){if(!v||!v.value||typeof v.value!=="object")continue;const orig=people.find(p=>p.id===v.patient_id),number=clean(orig?.record||v.value.record,80);if(!number)continue;const target=await db.prepare("SELECT id,full_name,record_number,birth_date FROM patients WHERE record_number=?").bind(number).first();if(!target)continue;
 const origId=clean(v.id,64);if(!origId||!/^[a-zA-Z0-9-]{10,64}$/.test(origId))continue;const existing=await db.prepare("SELECT id FROM clinical_visits WHERE id=?").bind(origId).first();if(existing)continue;
 const value=docSafe(v.value);if(!/^\d{4}-\d{2}-\d{2}$/.test(value.date||""))continue;Object.assign(value,{name:target.full_name,record:target.record_number,birth:target.birth_date});
 await db.prepare("INSERT OR IGNORE INTO clinical_visits(id,patient_id,visit_date,document_json) VALUES(?,?,?,?)").bind(origId,target.id,value.date,JSON.stringify(value)).run();countV++;
 }
 await log(db,user.id,"legacy_import",null);return reply({ok:true,patients:countP,visits:countV});
 }
 return reply({error:"Operação não encontrada."},404);
 }catch(e){console.error("ENF_API_FAILURE",{route:path,kind:e?.name||"Error",detail:String(e?.message||e).slice(0,220)});if(String(e).includes("large"))return reply({error:"Dados enviados ultrapassam o limite."},413);if(String(e).includes("UNIQUE constraint"))return reply({error:"Registro já existe."},409);if(path==="/api/login")return reply({error:"Erro interno na autenticação. Verifique a configuração e tente novamente.",code:"AUTH_INTERNAL"},500);return reply({error:"Falha na operação. Tente novamente.",code:"REQUEST_INTERNAL"},500)}
}