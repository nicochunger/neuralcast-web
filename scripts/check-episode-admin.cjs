// Exercise the real admin proxy with isolated authentication and upstream responses.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript');
const file=path.join(__dirname,'../src/app/api/admin/episodes/[station]/[...action]/route.ts');
const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let session=null,calls=[],upstream=async()=>Response.json({episode:null});const out={};
vm.runInNewContext(source,{exports:out,require(name){if(name==='next/server')return{NextResponse:{json:(value,init)=>Response.json(value,init)}};if(name==='@/lib/auth')return{getAuthSession:async()=>session};if(name==='@/lib/episodeAdmin')return{episodeAdminRequest:async(route,init)=>{calls.push({route,init});return upstream();}};throw Error(name);},Response,Request,Headers,URL,AbortSignal,Buffer},{filename:file});
const ctx=(action=['state'],station='neuralforge')=>({params:Promise.resolve({station,action})});
const req=(method='GET',body,headers={},suffix='')=>new Request('https://radio.test/api/admin/episodes/neuralforge/state'+suffix,{method,body,headers});
(async()=>{
 assert.equal((await out.GET(req(),ctx())).status,401);session={user:{isAdmin:false}};
 assert.equal((await out.GET(req(),ctx())).status,401);session={user:{isAdmin:true}};
 assert.equal((await out.GET(req(),ctx(['state'],'unknown'))).status,404);
 assert.equal((await out.GET(req(),ctx(['arbitrary','path']))).status,404);
 assert.equal((await out.POST(req('POST','{}'),ctx(['actions']))).status,403);
 assert.equal((await out.GET(req('GET',undefined,{},'?episode_id=../escape'),ctx())).status,400);
 const body=JSON.stringify({revision:'a'.repeat(64),overall:'Keep the aside.',sections:{opening:'Give the listener more context.'},research:false});
 const saved=await out.PUT(req('PUT',body,{Origin:'https://radio.test'}),ctx(['story','feedback']));
 assert.equal(saved.status,200);assert.equal(calls.at(-1).route,'neuralforge/story/feedback');assert.equal(calls.at(-1).init.body,body);
 await out.GET(req('GET',undefined,{},'?episode_id=story'),ctx());assert.equal(calls.at(-1).route,'neuralforge?episode_id=story');
 assert.equal((await out.POST(req('POST','x'.repeat(256001),{Origin:'https://radio.test'}),ctx(['actions']))).status,413);
 upstream=async()=>new Response('audio',{status:206,headers:{'Content-Type':'audio/mpeg','Content-Range':'bytes 0-4/20','Accept-Ranges':'bytes'}});
 const audio=await out.GET(req('GET',undefined,{Range:'bytes=0-4'}),ctx(['story','audio','b'.repeat(64)]));
 assert.equal(audio.status,206);assert.equal(await audio.text(),'audio');assert.equal(audio.headers.get('Cache-Control'),'private, no-store');assert.equal(calls.at(-1).init.headers.get('range'),'bytes=0-4');
 assert.equal((await out.GET(req(),ctx(['story','audio','../escape']))).status,404);
 upstream=async()=>Response.json({segments:[]});assert.equal((await out.GET(req(),ctx(['story','history','editorial','run-a']))).status,200);
 upstream=async()=>{throw Error('private authentication details');};const failure=await out.GET(req(),ctx());assert.equal(failure.status,502);assert.ok(!(await failure.text()).includes('authentication details'));
 console.log('Episode admin proxy checks passed: authentication, exact feedback, approved paths, Origin, body bounds, private ranges and safe errors.');
})().catch(e=>{console.error(e);process.exitCode=1;});
