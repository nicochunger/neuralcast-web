// Local browser journey with synthetic data and audio; no model calls or station writes.
const assert=require('node:assert/strict'),{createServer}=require('node:http'),{spawn}=require('node:child_process'),{once}=require('node:events');
const {encode}=require('next-auth/jwt');
const {chromium}=require(process.env.EPISODE_PLAYWRIGHT_MODULE||'playwright');
const secret='offline-episode-admin-secret',token='offline-admin-token';
let phase='empty',feedback={overall:'',sections:{},research:false},revision=1,job=null,ideas=[],actions=[];
const before='Bienvenidos. Una historia sobre las voces que cambian una banda.',after='Bienvenidos. Hay voces que cambian nuestra manera de escuchar.';
const segments=()=>[{id:'opening',kind:'commentary',role:'opening',script:phase==='written'?before:after,companion:{title:'Una voz'}},{id:'song',kind:'music',artist:'Test artist',title:'Test song'},{id:'closing',kind:'commentary',role:'closing',script:'Gracias por acompañarnos.',companion:{title:'Hasta pronto'}}];
const episode=()=>phase==='empty'?null:{id:'test-story',status:phase==='brief'?'brief_review':phase==='audio'?'audio_review':phase==='published'?'published':'manuscript_review',revision:String(revision).padStart(64,'a'),episode_number:null,concept_hash:'a'.repeat(64),concept_approved:phase!=='brief',proposal:{title:'Una voz que cambia',premise:'La identidad de una banda cuando cambia su cantante.',outline:['Las personas','Una decisión'],target_seconds:1800,commentary_budget_seconds:600},brief:{instructions:'Conservar las canciones completas.',initial_research:[]},songs:[{id:'song',kind:'music',artist:'Test artist',title:'Test song',rationale:'Una canción para la historia.'}],segments:phase==='brief'?[]:segments(),feedback,blockers:[],changes:phase==='revised'?[{segment_id:'opening',explanation:'Se amplió el comienzo.'}]:[],timing:{spoken_words:250,estimated_total_seconds:1800},audio:['audio','published'].includes(phase)?{revision:'b'.repeat(64),render_hash:'c'.repeat(64),duration:20,current:true,chapters:[{id:'opening',title:'Una voz',kind:'commentary',start:0,end:10},{id:'closing',title:'Hasta pronto',kind:'commentary',start:10,end:20}]}:null,history:phase==='brief'?[]:[{id:'saved-run',kind:'editorial',created_at:'2026-11-09T12:00:00Z',manuscript_hash:'d'.repeat(64)}]};
const wav=Buffer.alloc(44+8000*20*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
const fixture=createServer(async(req,res)=>{
 try{
 if(req.headers.authorization!==`Bearer ${token}`){res.writeHead(401);res.end('{}');return;}
 const url=new URL(req.url,'http://fixture');const route=url.pathname;
 let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):{};
 res.setHeader('Content-Type','application/json');
 if(route==='/admin/capabilities'){res.end(JSON.stringify({stations:['neuralforge','neuralcast'],host_channels:[],archetypes:[],operations:{}}));return;}
 if(route.endsWith('/audio/'+'b'.repeat(64))){res.setHeader('Content-Type','audio/wav');res.setHeader('Accept-Ranges','bytes');res.end(wav);return;}
 if(route.includes('/history/')){res.end(JSON.stringify({segments:[{...segments()[0],script:before},...segments().slice(1)]}));return;}
 if(route.endsWith('/feedback')){assert.equal(body.revision,episode().revision);feedback={overall:body.overall,sections:body.sections,research:body.research};revision++;res.end(JSON.stringify(episode()));return;}
 if(route.endsWith('/actions')){
  actions.push(body);const id='request-'+actions.length;
  if(body.action==='ideas')ideas=[{id:'idea-1',title:'Una voz que cambia',premise:'La identidad de una banda.',angle:'Personas, decisiones y canciones.',artists:['Test artist']}];
  if(body.action==='develop')phase='brief';if(body.action==='write')phase='written';if(body.action==='revise')phase='revised';if(body.action==='render')phase='audio';if(body.action==='publish'){assert.equal(body.render_hash,'c'.repeat(64));phase='published';}
  revision++;job={job_id:id,status:'succeeded',episode_options:{request_id:id},result:{episode_id:phase==='empty'?undefined:'test-story'},log_tail:'Completed fixture operation.'};
  res.end(JSON.stringify({job_id:id,request_id:id}));return;
 }
 const e=episode();res.end(JSON.stringify({revision:'f'.repeat(64),weekly_enabled:false,target_minutes:30,ideas,episodes:e?[{id:e.id,title:e.proposal.title,status:e.status,episode_number:null,managed:true}]:[],episode:url.searchParams.has('episode_id')?e:null,job}));
 }catch(e){res.writeHead(500);res.end(JSON.stringify({detail:String(e)}));}
});
(async()=>{
 fixture.listen(0,'127.0.0.1');await once(fixture,'listening');const reservation=createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');const port=reservation.address().port;await new Promise(r=>reservation.close(r));
 const base=`http://localhost:${port}`;
 const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','localhost','--port',String(port)],{cwd:process.cwd(),env:{...process.env,HOST_ADMIN_BASE_URL:`http://127.0.0.1:${fixture.address().port}`,HOST_ADMIN_TOKEN:token,NEXTAUTH_SECRET:secret,NEXTAUTH_URL:base,ADMIN_EMAIL:'admin@example.test',ADMIN_PASSWORD_HASH:'fixture-only'},stdio:'ignore'});
 let browser,page;
 try{
  for(let i=0;i<100;i++){try{await fetch(base+'/login');break;}catch{await new Promise(r=>setTimeout(r,100));}}
  browser=await chromium.launch({args:['--no-sandbox']});const context=await browser.newContext({viewport:{width:1440,height:1050}});
  const jwt=await encode({secret,token:{name:'Test admin',email:'admin@example.test',isAdmin:true},maxAge:3600});
  await context.addCookies([{name:'next-auth.session-token',value:jwt,url:base}]);
  page=await context.newPage();page.on('response',async r=>{if(r.url().includes('/api/admin/episodes/')&&r.status()>=400)console.error('Admin response',r.status(),await r.text());});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/api/nowplaying/**',r=>r.fulfill({json:{}}));await page.route('**/api/host-companion/**',r=>r.fulfill({json:{}}));
  await page.goto(base+'/admin/episodes');await page.getByRole('heading',{name:'Episodes',exact:true}).waitFor();
  await page.getByRole('button',{name:'Suggest topics',exact:true}).click();await page.getByRole('button',{name:'Use this idea'}).waitFor();await page.getByRole('button',{name:'Use this idea'}).click();
  await page.getByRole('button',{name:'Develop my idea'}).click();await page.getByRole('button',{name:'Approve brief & generate manuscript'}).waitFor();
  await page.getByRole('button',{name:'Approve brief & generate manuscript'}).click();await page.getByLabel('Overall feedback',{exact:true}).waitFor();
  await page.getByLabel('Overall feedback',{exact:true}).fill('Start broader; keep the story.');
  await page.getByRole('button',{name:'Save feedback',exact:true}).click();await page.getByText('Feedback saved.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Apply feedback',exact:true}).click();await page.getByText(after,{exact:true}).waitFor();
  await page.getByText('Revision notes',{exact:true}).click();await page.getByText('Se amplió el comienzo.',{exact:false}).waitFor();
  await page.getByLabel('Compare with a saved manuscript').selectOption('editorial:saved-run');await page.getByText(before,{exact:true}).waitFor();
  await page.getByRole('button',{name:'Approve manuscript & render',exact:true}).click();await page.getByRole('heading',{name:'Recording for review'}).waitFor();
  await page.locator('#neuralcast-persistent-audio').evaluate(async(a,data)=>{a.src=URL.createObjectURL(new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],{type:'audio/wav'}));a.loop=true;await a.play();},wav.toString('base64'));
  await page.locator('section[aria-label="Audio review"] audio').evaluate(a=>a.play());await page.waitForFunction(()=>!document.querySelector('section[aria-label="Audio review"] audio').paused);
  assert.equal(await page.locator('#neuralcast-persistent-audio').evaluate(a=>a.paused),false);
  await page.evaluate(()=>{window.originalLive=document.querySelector('#neuralcast-persistent-audio');});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(process.env.EPISODE_SCREENSHOT_DIR)await page.screenshot({path:process.env.EPISODE_SCREENSHOT_DIR+'/episode-admin-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1050});if(process.env.EPISODE_SCREENSHOT_DIR)await page.screenshot({path:process.env.EPISODE_SCREENSHOT_DIR+'/episode-admin-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Publish reviewed audio',exact:true}).click();await page.getByRole('link',{name:'Open published episode'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Apply feedback',exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>window.originalLive===document.querySelector('#neuralcast-persistent-audio')),true);
  assert.equal(await page.locator('#neuralcast-persistent-audio').evaluate(a=>a.paused),false);
  assert.deepEqual(actions.map(a=>a.action),['ideas','develop','write','revise','render','publish']);
  assert.ok(actions[4].revision);assert.equal(errors.length,0,errors.join('\n'));
  console.log('Episode admin browser journey passed: ideas → brief → manuscript feedback → comparison → private audio → exact publication approval; mobile layout and persistent live audio verified.');
 }catch(e){console.error('Fixture phase',phase,'actions',actions);if(page){console.error((await page.locator('body').innerText()).slice(-7000));await page.screenshot({path:'/tmp/episode-admin-failure.png',fullPage:true});}throw e;}finally{await browser?.close();app.kill('SIGTERM');fixture.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
