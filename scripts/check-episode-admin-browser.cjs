// Local browser journey with synthetic data and audio; no model calls or station writes.
const assert=require('node:assert/strict'),{createServer}=require('node:http'),{spawn}=require('node:child_process'),{once}=require('node:events');
const {encode}=require('next-auth/jwt');
const {chromium}=require(process.env.EPISODE_PLAYWRIGHT_MODULE||'playwright');
const secret='offline-episode-admin-secret',token='offline-admin-token';
let phase='empty',feedback={overall:'',sections:{},research:false},revision=1,job=null,ideas=[],actions=[],briefRefined=false,retries=0,archived=false,editedOpening=null;
const before='Bienvenidos. Una historia sobre las voces que cambian una banda.',after='Bienvenidos. Hay voces que cambian nuestra manera de escuchar.';
const segments=()=>[{id:'opening',kind:'commentary',role:'opening',script:editedOpening||(phase==='written'?before:after),companion:{title:'Una voz'}},{id:'song',kind:'music',artist:'Test artist',title:'Test song'},{id:'closing',kind:'commentary',role:'closing',script:'Gracias por acompañarnos.',companion:{title:'Hasta pronto'}}];
const episode=()=>phase==='empty'?null:{id:'test-story',archived,production_notes:['Verify the chosen recording.'],listening_notes:[{segment_id:'opening',note:'Check the opening pacing.'}],voice_directions:'',status:phase==='brief'?'brief_review':phase==='audio'?'audio_review':phase==='published'?'published':'manuscript_review',revision:String(revision).padStart(64,'a'),episode_number:null,concept_hash:'a'.repeat(64),concept_approved:phase!=='brief',proposal:{title:'Una voz que cambia',premise:briefRefined?'La decisión personal detrás de una voz nueva.':'La identidad de una banda cuando cambia su cantante.',outline:['Las personas','Una decisión'],target_seconds:1800,commentary_budget_seconds:600},brief:{instructions:'Conservar las canciones completas.',initial_research:[]},songs:[{id:'song',kind:'music',artist:'Test artist',title:'Test song',rationale:'Una canción para la historia.'}],segments:phase==='brief'?[]:segments(),feedback,blockers:[],changes:phase==='revised'?[{segment_id:'opening',explanation:'Se amplió el comienzo.'}]:[],timing:{spoken_words:250,estimated_total_seconds:1800},audio:['audio','published'].includes(phase)?{revision:'b'.repeat(64),render_hash:'c'.repeat(64),duration:20,current:true,chapters:[{id:'opening',title:'Una voz',kind:'commentary',start:0,end:10},{id:'closing',title:'Hasta pronto',kind:'commentary',start:10,end:20}]}:null,history:phase==='brief'?[]:[{id:'saved-run',kind:'editorial',created_at:'2026-11-09T12:00:00Z',manuscript_hash:'d'.repeat(64)}]};
const wav=Buffer.alloc(44+8000*20*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
const fixture=createServer(async(req,res)=>{
 try{
 if(req.headers.authorization!==`Bearer ${token}`){res.writeHead(401);res.end('{}');return;}
 const url=new URL(req.url,'http://fixture');const route=url.pathname;
 if(route.endsWith('/cover')){res.setHeader('Content-Type','image/png');res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6ioAAAAASUVORK5CYII=','base64'));return;}
 let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):{};
 res.setHeader('Content-Type','application/json');
 if(route==='/admin/capabilities'){res.end(JSON.stringify({stations:['neuralforge','neuralcast'],host_channels:[],archetypes:[],operations:{}}));return;}
 if(route.endsWith('/audio/'+'b'.repeat(64))){res.setHeader('Content-Type','audio/wav');res.setHeader('Accept-Ranges','bytes');res.end(wav);return;}
 if(route.includes('/history/')){res.end(JSON.stringify({segments:[{...segments()[0],script:before},...segments().slice(1)]}));return;}
 if(route.endsWith('/review')){if(body.segment_id)editedOpening=body.script;else if(body.archived!==undefined)archived=body.archived;revision++;res.end(JSON.stringify(episode()));return;}
 if(route.endsWith('/retry')){assert.equal(body.request_id,job.episode_options.request_id);retries++;job={...job,job_id:job.job_id+'-retry',status:'running',finished_at:null,progress:{...job.progress,current:'Fact review',error:null,steps:job.progress.steps.map(s=>({...s,status:s.status==='failed'?'running':s.status}))}};res.end(JSON.stringify({job_id:job.job_id,request_id:body.request_id}));return;}
 if(route.endsWith('/feedback')){assert.equal(body.revision,episode().revision);feedback={overall:body.overall,sections:body.sections,research:body.research};revision++;res.end(JSON.stringify(episode()));return;}
 if(route.endsWith('/actions')){
  actions.push(body);const id='request-'+actions.length;
  if(body.action==='ideas')ideas=[{id:'idea-1',title:'Una voz que cambia',premise:'La identidad de una banda.',angle:'Personas, decisiones y canciones.',artists:['Test artist']},{id:'idea-2',title:'Otra forma de escuchar',premise:'Una decisión musical.',angle:'Escenarios y canciones.',artists:['Another artist']},{id:'idea-3',title:'El siguiente capítulo',premise:'Una historia conectada.',angle:'Recuerdos y nuevos caminos.',artists:['Third artist']}];
  if(body.action==='develop'){if(body.episode_id){assert.equal(body.episode_id,'test-story');assert.equal(body.topic,'Keep the theme, but focus more on the personal conflict.');assert.equal(body.target_minutes,30);briefRefined=true;}phase='brief';}if(body.action==='write')phase='written';if(body.action==='revise'){phase='revised';editedOpening=null;feedback={overall:'',sections:{},research:false};}if(body.action==='render')phase='audio';if(body.action==='publish'){assert.equal(body.render_hash,'c'.repeat(64));phase='published';}
  const action=body.action==='develop'&&body.episode_id?'refine_brief':body.action;
  const ids=action==='write'?['write','factual_support','narrative_continuity','conversational_voice','edit']:action==='render'?['narration','mix','upload']:['work'];
  const labels={write:'Research and draft',factual_support:'Fact review',narrative_continuity:'Story review',conversational_voice:'Voice review',edit:'Final edit',narration:'Generating voice',mix:'Assembling audio',upload:'Uploading private preview',work:'Working on the request'};
  revision++;job={job_id:id,status:'running',accepted_at:new Date().toISOString(),started_at:new Date().toISOString(),episode_options:{request_id:id},result:{episode_id:phase==='empty'?undefined:'test-story'},progress:{action,episode_id:body.episode_id??(body.action==='develop'?'test-story':null),current:labels[ids[0]],steps:ids.map((key,i)=>({id:key,label:labels[key],status:i?'pending':'running'}))},log_tail:'Running fixture operation.'};

  res.end(JSON.stringify({job_id:id,request_id:id}));return;
 }
 const e=episode();res.end(JSON.stringify({revision:'f'.repeat(64),weekly_enabled:false,target_minutes:30,ideas,episodes:e?[{id:e.id,title:e.proposal.title,archived:e.archived,status:e.status,episode_number:null,managed:true}]:[],episode:url.searchParams.has('episode_id')?e:null,job}));
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
  async function finish(action){
    for(let i=0;i<500&&job?.progress?.action!==action;i++)await new Promise(r=>setTimeout(r,10));
    assert.equal(job?.progress?.action,action);
    await page.locator(`#episode-operation[data-action="${action}"]`).waitFor();
    assert.equal(await page.getByRole('button',{name:'View progress',exact:true}).count(),1);
    assert.ok(await page.locator('#episode-operation').getByText(/Elapsed/).count());
    job.status='succeeded';job.finished_at=new Date().toISOString();job.progress.steps.forEach(s=>s.status='succeeded');job.log_tail='Completed fixture operation.';
    await page.waitForFunction(()=>!document.querySelector('#episode-operation')?.textContent.includes('Work continues in the background.'));
  }
  await page.getByText('New episode · ideas and topics',{exact:true}).click();
  await page.getByRole('button',{name:'Suggest topics',exact:true}).click();await finish('ideas');
  const suggestions=page.locator('#episode-suggestions details');
  assert.equal(await suggestions.count(),3);
  assert.equal(await page.locator('#episode-suggestions details[open]').count(),0,'Ideas should start collapsed');
  await suggestions.first().locator('summary').focus();await page.keyboard.press('Enter');
  await suggestions.first().getByRole('button',{name:'Use this idea'}).waitFor();
  const rows=await suggestions.evaluateAll(items=>items.map(item=>{const r=item.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,bottom:r.bottom};}));
  assert.ok(rows.every((row,i)=>Math.abs(row.x-rows[0].x)<1&&Math.abs(row.width-rows[0].width)<1&&(!i||row.y>=rows[i-1].bottom)),'Ideas must stack vertically');
  await suggestions.first().locator('summary').click();assert.equal(await page.locator('#episode-suggestions details[open]').count(),0);
  await suggestions.first().locator('summary').click();await suggestions.first().getByRole('button',{name:'Use this idea'}).click();
  const topicButtons=await Promise.all(['Suggest topics','Develop my idea'].map(name=>page.getByRole('button',{name,exact:true}).boundingBox()));
  assert.ok(Math.abs((topicButtons[0].y+topicButtons[0].height)-(topicButtons[1].y+topicButtons[1].height))<2,'Topic buttons should align');
  await page.getByRole('button',{name:'Develop my idea'}).click();await finish('develop');await page.getByRole('button',{name:'Approve brief & generate manuscript'}).waitFor();
  await page.getByRole('button',{name:'Archive draft',exact:true}).click();await page.getByRole('button',{name:'Restore draft',exact:true}).waitFor();
  await page.getByRole('button',{name:'Restore draft',exact:true}).click();await page.getByRole('button',{name:'Archive draft',exact:true}).waitFor();
  const createdActions=actions.length;
  await page.reload();await page.getByLabel('Feedback on this brief',{exact:true}).waitFor();
  assert.equal(actions.length,createdActions,'Opening an existing brief must not regenerate it');
  assert.equal(await page.getByText('La identidad de una banda cuando cambia su cantante.',{exact:true}).count(),1);
  assert.equal(await page.getByRole('button',{name:'Apply feedback',exact:true}).isDisabled(),true);
  await page.getByText('New episode · ideas and topics',{exact:true}).click();
  await page.getByLabel('Your episode idea',{exact:true}).fill('An unrelated new episode idea');
  await page.getByLabel('Approximate minutes',{exact:true}).fill('45');
  await page.getByLabel('Feedback on this brief',{exact:true}).fill('Keep the theme, but focus more on the personal conflict.');
  assert.equal(await page.getByRole('button',{name:'Approve brief & generate manuscript'}).isDisabled(),true);
  await page.waitForTimeout(5200);
  assert.equal(await page.getByLabel('Feedback on this brief',{exact:true}).inputValue(),'Keep the theme, but focus more on the personal conflict.');
  await page.getByRole('button',{name:'Apply feedback',exact:true}).scrollIntoViewIfNeeded();
  if(process.env.EPISODE_SCREENSHOT_DIR)await page.screenshot({path:process.env.EPISODE_SCREENSHOT_DIR+'/episode-brief-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const mobileTopicButtons=await Promise.all(['Suggest topics','Develop my idea'].map(name=>page.getByRole('button',{name,exact:true}).boundingBox()));
  assert.ok(Math.abs(mobileTopicButtons[0].y-mobileTopicButtons[1].y)<2&&Math.abs(mobileTopicButtons[0].height-mobileTopicButtons[1].height)<2,'Mobile topic buttons should align and have equal height');
  if(process.env.EPISODE_SCREENSHOT_DIR)await page.screenshot({path:process.env.EPISODE_SCREENSHOT_DIR+'/episode-brief-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1050});
  await page.getByRole('button',{name:'Apply feedback',exact:true}).click();await finish('refine_brief');await page.getByText('La decisión personal detrás de una voz nueva.',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Feedback on this brief',{exact:true}).inputValue(),'');
  assert.equal(actions.at(-1).episode_id,'test-story','Feedback must update the selected episode');
  await page.getByRole('button',{name:'Approve brief & generate manuscript'}).click();
  await page.locator('#episode-operation[data-action="write"]').waitFor();
  const submitted=actions.length;await page.reload();await page.locator('#episode-operation[data-action="write"]').waitFor();
  assert.equal(actions.length,submitted,'Reloading must reconnect to the running job without submitting another');
  job.progress.steps.forEach(s=>s.status=s.id==='write'?'succeeded':s.id==='edit'?'pending':'running');job.progress.current='Fact review, Story review, Voice review';
  await page.getByRole('button',{name:'View progress',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#episode-operation')?.textContent.includes('Fact review, Story review, Voice review'));
  assert.equal(await page.locator('#episode-operation li[data-state="running"]').count(),3);
  const strip=page.getByLabel('Current operation',{exact:true});await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));
  const stripBounds=await strip.boundingBox();assert.ok(stripBounds.y>=0&&stripBounds.y<250,'Operation summary must remain visible while scrolling');
  if(process.env.EPISODE_SCREENSHOT_DIR)await page.screenshot({path:process.env.EPISODE_SCREENSHOT_DIR+'/episode-running-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(process.env.EPISODE_SCREENSHOT_DIR)await page.screenshot({path:process.env.EPISODE_SCREENSHOT_DIR+'/episode-running-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1050});
  job.status='failed';job.finished_at=new Date().toISOString();job.progress.current='Failed during Fact review';job.progress.error='Fact review could not finish; completed stages were retained.';job.progress.steps.forEach(s=>s.status=s.id==='factual_support'?'failed':s.id==='edit'?'pending':'succeeded');
  await page.locator('#episode-operation').getByText('Fact review could not finish; completed stages were retained.',{exact:true}).waitFor();
  const retryResponse=page.waitForResponse(r=>r.url().endsWith('/retry')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Retry saved operation',exact:true}).click();await retryResponse;
  await page.waitForFunction(()=>document.querySelector('#episode-operation')?.textContent.includes('Work continues in the background.'));
  assert.equal(retries,1);assert.equal(actions.length,submitted,'Retry must resume the saved request');
  assert.equal(await page.locator('#episode-operation li[data-state="succeeded"]').count(),3);
  await finish('write');await page.locator('#episode-operation').getByRole('button',{name:'Read manuscript',exact:true}).click();
  await page.getByLabel('Overall feedback',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Edit passage',exact:true}).first().click();
  await page.getByLabel('Passage text',{exact:true}).fill('Una historia concreta sobre las voces de una banda.');
  await page.getByRole('button',{name:'Save correction',exact:true}).click();await page.getByLabel('Passage text',{exact:true}).waitFor({state:'hidden'});await page.getByText('Una historia concreta sobre las voces de una banda.',{exact:true}).waitFor();
  await page.getByLabel('Overall feedback',{exact:true}).fill('Start broader; keep the story.');
  await page.getByRole('button',{name:'Save feedback',exact:true}).click();await page.locator('#episode-operation').getByText('Feedback saved.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Apply feedback',exact:true}).click();await finish('revise');await page.getByText(after,{exact:true}).waitFor();
  await page.getByText('Revision notes',{exact:true}).click();await page.getByText('Se amplió el comienzo.',{exact:false}).waitFor();
  await page.getByLabel('Compare with a saved manuscript').selectOption('editorial:saved-run');await page.getByText(before,{exact:true}).waitFor();
  await page.getByRole('button',{name:'Approve manuscript & render',exact:true}).click();await finish('render');await page.getByRole('heading',{name:'Recording for review'}).waitFor();
  await page.locator('#neuralcast-persistent-audio').evaluate(async(a,data)=>{a.src=URL.createObjectURL(new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],{type:'audio/wav'}));a.loop=true;await a.play();},wav.toString('base64'));
  await page.locator('section[aria-label="Audio review"] audio').evaluate(a=>a.play());await page.waitForFunction(()=>!document.querySelector('section[aria-label="Audio review"] audio').paused);
  assert.equal(await page.locator('#neuralcast-persistent-audio').evaluate(a=>a.paused),false);
  await page.evaluate(()=>{window.originalLive=document.querySelector('#neuralcast-persistent-audio');});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(process.env.EPISODE_SCREENSHOT_DIR)await page.screenshot({path:process.env.EPISODE_SCREENSHOT_DIR+'/episode-admin-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1050});if(process.env.EPISODE_SCREENSHOT_DIR)await page.screenshot({path:process.env.EPISODE_SCREENSHOT_DIR+'/episode-admin-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Publish reviewed audio',exact:true}).click();await finish('publish');await page.getByRole('link',{name:'Open published episode'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Apply feedback',exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>window.originalLive===document.querySelector('#neuralcast-persistent-audio')),true);
  assert.equal(await page.locator('#neuralcast-persistent-audio').evaluate(a=>a.paused),false);
  assert.deepEqual(actions.map(a=>a.action),['ideas','develop','develop','write','revise','render','publish']);
  assert.ok(actions.find(a=>a.action==='render').revision);assert.equal(errors.length,0,errors.join('\n'));
  console.log('Episode admin browser journey passed: ideas → saved brief → specific brief feedback → manuscript feedback → comparison → private audio → exact publication approval; collapsible stacked ideas, mobile layout and persistent live audio verified.');
 }catch(e){console.error('Fixture phase',phase,'actions',actions);if(page){console.error('TEXTAREAS',await page.locator('textarea').evaluateAll(xs=>xs.map(x=>({html:x.outerHTML,labels:Array.from(x.labels||[]).map(l=>l.textContent)}))));console.error((await page.locator('body').innerText()).slice(-7000));await page.screenshot({path:'/tmp/episode-admin-failure.png',fullPage:true});}throw e;}finally{await browser?.close();app.kill('SIGTERM');fixture.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
