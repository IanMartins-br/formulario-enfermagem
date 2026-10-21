// API de dados clínicos desativada no modo sem login. Nunca exponha o banco D1 anonimamente.
export async function onRequest(){return new Response(JSON.stringify({error:"Armazenamento remoto desativado no modo sem login. Use o histórico local do aplicativo."}),{status:410,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}})}
