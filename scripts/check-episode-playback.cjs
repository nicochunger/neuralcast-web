const assert=require('node:assert/strict'),{createServer}=require('node:http'),{spawn}=require('node:child_process'),{once}=require('node:events');
const {chromium}=require(process.env.EPISODE_PLAYWRIGHT_MODULE || 'playwright');
// Locally generated PCM tone; no station media or copyrighted audio is used.
const samples = 8000 * 40;
const song = Buffer.alloc(44 + samples * 2);
song.write('RIFF', 0); song.writeUInt32LE(song.length - 8, 4); song.write('WAVEfmt ', 8);
song.writeUInt32LE(16, 16); song.writeUInt16LE(1, 20); song.writeUInt16LE(1, 22);
song.writeUInt32LE(8000, 24); song.writeUInt32LE(16000, 28); song.writeUInt16LE(2, 32);
song.writeUInt16LE(16, 34); song.write('data', 36); song.writeUInt32LE(samples * 2, 40);
for (let i = 0; i < samples; i++) song.writeInt16LE(Math.round(500 * Math.sin(i * Math.PI * 440 / 8000)), 44 + i * 2);
const episode={id:'test-journey',station:'neuralforge',channel:'neuralforge-es',language:'es-AR',title:'A musical journey',description:'Discover the stories behind the music.',published_at:'2026-10-15T12:00:00Z',duration:40,revision:'a'.repeat(64),audio_url:'/public/episodes/neuralforge/test-journey/audio',transcript:'An introduction. A conclusion.',chapters:[
{id:'intro',kind:'commentary',start:0,end:10,title:'Introduction',summary:'Meet the host.',transcript:'An introduction.'},
{id:'song',kind:'music',start:10,end:30,title:'Test song',artist:'Test artist',rationale:'A musical example.',art_url:'/public/episodes/neuralforge/test-journey/art/song'},
{id:'outro',kind:'commentary',start:30,end:40,title:'Conclusion',summary:'The closing story.',transcript:'A conclusion.'}]};
const newer={...episode,id:'next-journey',title:'A second journey',published_at:'2026-10-16T12:00:00Z'};
const cast={...episode,id:'cast-journey',station:'neuralcast',channel:'neuralcast-es',title:'A NeuralCast journey'};
let unavailable=false;
const fixture=createServer((req,res)=>{
const path=new URL(req.url,'http://fixture').pathname;
if(path.endsWith('/audio')){const r=/bytes=(\d+)-(\d*)/.exec(req.headers.range||'');if(r){const a=Number(r[1]),b=r[2]?Math.min(Number(r[2]),song.length-1):song.length-1;res.writeHead(206,{'Content-Type':'audio/wav','Accept-Ranges':'bytes','Content-Range':`bytes ${a}-${b}/${song.length}`,'Content-Length':b-a+1});res.end(song.subarray(a,b+1));}else{res.writeHead(200,{'Content-Type':'audio/wav','Content-Length':song.length,'Accept-Ranges':'bytes'});res.end(song);}return;}
if(path.includes('/art/')){res.writeHead(404);res.end();return;}
res.setHeader('Content-Type','application/json');if(unavailable){res.writeHead(503);res.end('{}');return;}
if(path==='/public/episodes'){res.end(JSON.stringify({episodes:[newer,episode,cast]}));return;}
if(path==='/public/episodes/neuralforge/test-journey'){res.end(JSON.stringify(episode));return;}
res.writeHead(404);res.end('{}');});
(async()=>{fixture.listen(0,'127.0.0.1');await once(fixture,'listening');const reservation=createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');const port=reservation.address().port;await new Promise(r=>reservation.close(r));
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{cwd:process.cwd(),env:{...process.env,HOST_ADMIN_BASE_URL:`http://127.0.0.1:${fixture.address().port}`,HOST_ADMIN_TOKEN:'offline-token'},stdio:'ignore'});let browser;
try{const base=`http://127.0.0.1:${port}`;for(let n=0;n<100;n++){try{await fetch(base+'/episodes');break;}catch{await new Promise(r=>setTimeout(r,100));}}
assert.equal((await fetch(base+'/episodes/neuralforge/unknown')).status,404);
browser=await chromium.launch({args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1440,height:1050}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/api/**',r=>r.fulfill({json:{}}));await page.route('**/listen/**',r=>r.fulfill({contentType:'audio/wav',body:song}));
await page.goto(base+'/episodes');await page.getByRole('heading',{name:'A musical journey'}).waitFor();
const series=page.getByRole('navigation',{name:'Choose your podcast'});
assert.equal(await page.getByRole('link',{name:'Podcasts',exact:true}).getAttribute('aria-current'),'page');
assert.equal(await series.getByRole('link').count(),2);
assert.equal(await page.getByText('Both stations',{exact:true}).count(),0);
const firstRow=page.getByRole('listitem').filter({has:page.getByRole('heading',{name:/A musical journey/})});
assert.equal(await firstRow.locator('h3 [aria-label="Episode 1"]').textContent(),'#1 · ');
assert.equal(await firstRow.getByRole('button').count(),0);
assert.equal(await page.getByRole('heading',{name:'Podcasts',exact:true}).count(),0);
const sharedTitle=page.getByRole('heading',{name:'Real music. A voice of its own.',exact:true});
assert.ok((await sharedTitle.boundingBox()).y < (await page.getByRole('navigation',{name:'Listen',exact:true}).boundingBox()).y);
assert.ok(await firstRow.locator('img').evaluate(img=>Math.abs(img.getBoundingClientRect().height-img.closest('a').getBoundingClientRect().height)<=2));
const secondRow=page.getByRole('listitem').filter({has:page.getByRole('heading',{name:/A second journey/})});
assert.equal(await secondRow.locator('h3 [aria-label="Episode 2"]').textContent(),'#2 · ');
if(process.env.EPISODE_SCREENSHOT_DIR) await page.screenshot({path:`${process.env.EPISODE_SCREENSHOT_DIR}/podcasts-desktop.png`,fullPage:true});
await page.setViewportSize({width:390,height:844});
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
if(process.env.EPISODE_SCREENSHOT_DIR) await page.screenshot({path:`${process.env.EPISODE_SCREENSHOT_DIR}/podcasts-mobile.png`,fullPage:true});
await page.setViewportSize({width:1440,height:1050});
await series.getByRole('link',{name:'NeuralCast Podcasts',exact:true}).click();
await page.waitForURL(base+'/episodes?station=neuralcast');
await page.getByRole('heading',{name:/A NeuralCast journey/}).waitFor();
assert.equal(await page.getByRole('heading',{name:/A musical journey/}).count(),0);
assert.equal(await page.getByRole('listitem').locator('h3 [aria-label="Episode 1"]').textContent(),'#1 · ');
await series.getByRole('link',{name:'NeuralForge Podcasts',exact:true}).click();await page.getByRole('heading',{name:'A musical journey'}).click();
await page.getByRole('region',{name:'A musical journey',exact:true}).getByRole('button',{name:'Play',exact:true}).waitFor();assert.equal(await page.locator('#neuralcast-episode-audio').evaluate(audio=>audio.paused),true);assert.equal(await page.getByRole('button',{name:/Listen live/}).count(),0);await page.evaluate(()=>window.__liveElement=document.querySelector('#neuralcast-persistent-audio'));
const episodePlayer=page.getByRole('region',{name:'A musical journey',exact:true});
assert.equal(await episodePlayer.getByRole('button',{name:/Mute|Unmute|Start over/}).count(),0);
assert.equal(await episodePlayer.evaluate(element=>getComputedStyle(element).backgroundImage),'none');
const playWidth=(await episodePlayer.getByRole('button',{name:'Play',exact:true}).boundingBox()).width;
await episodePlayer.getByRole('button',{name:'Play',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#neuralcast-episode-audio').paused);
assert.equal((await episodePlayer.getByRole('button',{name:'Pause',exact:true}).boundingBox()).width,playWidth);
const timeline=episodePlayer.locator('.trackProgress');
const times=timeline.locator('.trackProgressTimes');
const bar=timeline.locator('.trackProgressBar');
assert.ok((await times.boundingBox()).y>(await bar.boundingBox()).y);
assert.ok((await times.locator('span').first().boundingBox()).x<(await times.locator('span').last().boundingBox()).x);
const volumeSlider=episodePlayer.getByRole('slider',{name:'Volume',exact:true});
await volumeSlider.focus();await volumeSlider.press('Home');await volumeSlider.press('ArrowRight');
await page.waitForFunction(()=>Math.abs(document.querySelector('#neuralcast-episode-audio').volume-.01)<.001);
await volumeSlider.press('End');
const seekSlider=episodePlayer.getByRole('slider',{name:'Playback position',exact:true});
const seekBounds=await seekSlider.boundingBox();
await seekSlider.click({position:{x:seekBounds.width/2,y:seekBounds.height/2}});
await page.waitForFunction(()=>{const position=document.querySelector('#neuralcast-episode-audio').currentTime;return position>=19&&position<=22;});
await page.getByRole('button',{name:'Jump to Test song',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#neuralcast-episode-audio').currentTime>=10);
assert.equal(await page.locator('li[aria-current="step"]').first().getByRole('heading').textContent(),'Test song');
await page.getByRole('button',{name:'Pause',exact:true}).click();const paused=await page.locator('#neuralcast-episode-audio').evaluate(a=>a.currentTime);await page.waitForTimeout(350);assert.equal(await page.locator('#neuralcast-episode-audio').evaluate(a=>a.currentTime),paused);
await page.getByRole('region',{name:'A musical journey',exact:true}).getByRole('button',{name:'Play',exact:true}).click();await page.getByRole('link',{name:/All episodes/}).click();await page.waitForURL(base+'/episodes?station=neuralforge');
assert.equal(await page.evaluate(()=>document.querySelector('#neuralcast-persistent-audio')===window.__liveElement),true);assert.equal(await page.locator('#neuralcast-episode-audio').evaluate(a=>a.paused),false);
await page.getByRole('link',{name:'A musical journey ↗',exact:true}).click();await page.waitForURL(base+'/episodes/neuralforge/test-journey');
await page.getByRole('link',{name:'Live radio',exact:true}).click();await page.waitForURL(base+'/');
await page.getByRole('heading',{name:'Real music. A voice of its own.',exact:true}).waitFor();
assert.equal(await page.locator('#neuralcast-episode-audio').evaluate(audio=>audio.paused),false);
await page.getByRole('button',{name:'Play NeuralForge',exact:true}).click();
await page.waitForFunction(()=>document.querySelector('#neuralcast-episode-audio').paused&&!document.querySelector('#neuralcast-persistent-audio').paused);
await page.getByRole('link',{name:'Podcasts',exact:true}).click();await page.getByRole('heading',{name:/A musical journey/}).click();
await page.getByRole('region',{name:'A musical journey',exact:true}).getByRole('button',{name:'Play',exact:true}).waitFor();
await page.getByRole('region',{name:'A musical journey',exact:true}).getByRole('button',{name:'Play',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#neuralcast-episode-audio').paused&&document.querySelector('#neuralcast-persistent-audio').paused);
await page.getByRole('button',{name:/Read.*transcript/}).click();await page.getByText('An introduction. A conclusion.',{exact:true}).waitFor();
await page.getByRole('button',{name:'Pause',exact:true}).click();await page.evaluate(() => window.scrollTo(0, 0)); if (process.env.EPISODE_SCREENSHOT_DIR) await page.screenshot({path:`${process.env.EPISODE_SCREENSHOT_DIR}/episode-desktop.png`,fullPage:true});
await page.reload();await page.getByRole('region',{name:'A musical journey',exact:true}).getByRole('button',{name:'Play',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#neuralcast-episode-audio').currentTime>=10);
await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:/^Episode guide/}).click();await page.locator('dialog[open]').waitFor();
await page.locator('dialog').getByRole('button',{name:'Jump to Conclusion',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#neuralcast-episode-audio').currentTime>=30);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.locator('dialog img').evaluate(img=>img.decode());await page.evaluate(() => window.scrollTo(0, 0)); if (process.env.EPISODE_SCREENSHOT_DIR) await page.screenshot({path:`${process.env.EPISODE_SCREENSHOT_DIR}/episode-mobile.png`,fullPage:true});await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
for(const width of [320,800,1440]){await page.setViewportSize({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
assert.deepEqual(errors,[]);unavailable=true;await page.goto(base+'/episodes');await page.getByText('Episodes are temporarily unavailable. Please try again shortly.',{exact:true}).waitFor();
console.log('Episode browser checks passed: shared title hierarchy, inline numbering, full-height artwork, explicit episode navigation, independent podcast selection, playback, chapter seeking/highlighting, persistent navigation, exclusive live/episode playback, transcript, reload resume, mobile dialog, responsive layouts, service failure.');
}finally{if(browser)await browser.close();app.kill('SIGTERM');await once(app,'exit');await new Promise(r=>fixture.close(r));}})().catch(e=>{console.error(e);process.exit(1)});
