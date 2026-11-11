"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./AdminEpisodes.module.css";
import { EpisodeActivity, EpisodeJob, jobActive, operationText, pendingJob } from "./EpisodeActivity";

type Segment = { id:string; kind:"music"|"commentary"; artist?:string; title?:string; rationale?:string; script?:string; companion?:{title:string}; role?:string; sources?:{url:string;claim:string}[] };
type Feedback = { overall:string; sections:Record<string,string>; research:boolean };
type Episode = { id:string; status:string; revision:string; episode_number:number|null; concept_hash:string; concept_approved:boolean; archived?:boolean; production_notes?:string[]; listening_notes?:{segment_id:string;note:string}[]; applied_feedback?:Feedback; voice_directions?:string; proposal:{title:string;premise:string;outline:string[];target_seconds:number;commentary_budget_seconds:number}; brief?:{instructions:string;initial_research:{url:string;claim:string}[]}; changes?:{segment_id:string;explanation:string}[]; songs:Segment[]; segments:Segment[]; feedback:Feedback; blockers:string[]; timing?:{estimated_total_seconds:number;spoken_words:number}; audio:null|{revision:string;render_hash:string;duration:number;current:boolean;chapters:{id:string;title:string;kind:string;start:number;end:number}[]}; history:{id:string;kind:string;created_at:string;manuscript_hash:string}[] };
type Job = EpisodeJob;
type View = {revision:string;weekly_enabled:boolean;target_minutes:number;ideas:{id:string;title:string;premise:string;angle:string;artists:string[]}[];episodes:{id:string;status:string;episode_number:number|null;title:string;managed?:boolean;archived?:boolean}[];episode:Episode|null;job:Job|null};
const emptyFeedback:Feedback={overall:"",sections:{},research:false};
const time=(s:number)=>`${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,"0")}`;
const label=(s:string)=>({brief_review:"Brief review",queued:"Approved · queued",manuscript_review:"Manuscript review",audio_review:"Audio review",published:"Published"}[s]??s);

function difference(before:string,after:string){const a=before.split(/(\s+)/),b=after.split(/(\s+)/);let start=0,end=0;while(start<a.length&&start<b.length&&a[start]===b[start])start++;while(end<a.length-start&&end<b.length-start&&a[a.length-1-end]===b[b.length-1-end])end++;return <>{b.slice(0,start).join("")}<del>{a.slice(start,a.length-end).join("")}</del><mark>{b.slice(start,b.length-end).join("")}</mark>{end?b.slice(b.length-end).join(""):""}</>;}
export function AdminEpisodes(){
 const [delivery,setDelivery]=useState("");
 const [showNew,setShowNew]=useState(false),[showArchived,setShowArchived]=useState(false),[weeklyMinutes,setWeeklyMinutes]=useState(45),[saved,setSaved]=useState(""),[editing,setEditing]=useState<string|null>(null),[editText,setEditText]=useState(""),[playback,setPlayback]=useState(0);
 const draftKey=useRef("");
 const router=useRouter(), pendingScroll=useRef<string|null>(null);
 const [station,setStation]=useState("neuralforge"),[selected,setSelected]=useState("");
 const [view,setView]=useState<View|null>(null),[feedback,setFeedback]=useState<Feedback>(emptyFeedback);
 const [description,setDescription]=useState(""),[briefFeedback,setBriefFeedback]=useState("");
 const [topic,setTopic]=useState(""),[minutes,setMinutes]=useState(45),[busy,setBusy]=useState(false);
 const [localJob,setLocalJob]=useState<Job|null>(null);
 const [error,setError]=useState<string|null>(null),[tick,setTick]=useState(0);
 const [dirty,setDirty]=useState(false),[history,setHistory]=useState<Segment[]|null>(null);
 const dirtyRef=useRef(false),revisionRef=useRef(""),loadedStation=useRef(""),pendingDevelop=useRef("");
 const audio=useRef<HTMLAudioElement>(null);
 const base=`/api/admin/episodes/${station}`;
 const episode=view?.episode, running=jobActive(view?.job);
 const remoteIsNewer=running&&view?.job&&localJob&&Date.parse(view.job.accepted_at||"")>Date.parse(localJob.accepted_at||"");
 const activity=remoteIsNewer?view!.job:localJob??view?.job;
 const disabled=busy||running, published=episode?.status==="published", unsaved=dirty||!!briefFeedback.trim();
 async function request(path:string,method="GET",body?:unknown){
  const r=await fetch(`${base}/${path}`,{method,headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined,cache:"no-store",signal:AbortSignal.timeout(25000)});
  const result=await r.json();if(!r.ok)throw new Error(result.detail||result.error||"The request failed.");return result;
 }
 useEffect(()=>{
  let stopped=false,timer:ReturnType<typeof setTimeout>,controller:AbortController;let failures=0;
  async function refresh(){
   controller=new AbortController();
   try{
    const r=await fetch(`${base}/state${selected?`?episode_id=${selected}`:""}`,{cache:"no-store",signal:controller.signal});
    const v=await r.json();if(!r.ok)throw new Error(v.detail||v.error||"Unable to load episodes.");if(stopped)return;
    const data=v as View,key=data.episode?`${data.episode.id}:${data.episode.revision}`:"";
    if(dirtyRef.current&&revisionRef.current!==key){setView(v=>v?{...v,job:data.job}:v);setError("This episode changed in another session. Your unsaved feedback is preserved; copy it before reloading.");return;}
    if(!dirtyRef.current&&revisionRef.current!==key){setFeedback(data.episode?.feedback??emptyFeedback);setDelivery(data.episode?.voice_directions??"");if(draftKey.current!==`${station}:${data.episode?.id??"new"}`){const k=`${station}:${data.episode?.id??"new"}`;draftKey.current=k;try{const d=JSON.parse(localStorage.getItem(`episode-draft:${k}`)||"null");setDescription(d?.description??data.episode?.proposal.premise??"");setBriefFeedback(d?.briefFeedback??"");if(d?.feedback){setFeedback(d.feedback);const pending=!!d.feedback.overall.trim()||Object.values(d.feedback.sections).some(v=>String(v).trim());setDirty(pending);dirtyRef.current=pending;}}catch{setDescription(data.episode?.proposal.premise??"");}}revisionRef.current=key;}
    if(loadedStation.current!==station){setMinutes(data.target_minutes);setWeeklyMinutes(data.target_minutes);loadedStation.current=station;}
    if(failures)setError(null);setView(data);failures=0;
    if(data.job?.status==="succeeded"&&data.job.episode_options?.request_id===pendingDevelop.current&&data.job.result?.episode_id){pendingDevelop.current="";setSelected(data.job.result.episode_id);return;}
    if(!selected&&data.episodes.length)setSelected(data.job?.progress?.episode_id??data.episodes.find(e=>e.managed&&e.status!=="published")?.id??data.episodes.find(e=>e.status==="published")?.id??data.episodes[0].id);
   }catch(cause){if(!stopped){setError(cause instanceof Error?cause.message:"Connection interrupted.");failures++;}}
   finally{if(!stopped)timer=setTimeout(refresh,Math.min(5000*2**failures,30000));}
  }
  void refresh();return()=>{stopped=true;clearTimeout(timer);controller?.abort();};
 },[base,selected,tick]);
 useEffect(()=>{try{setTopic(localStorage.getItem(`episode-topic:${station}`)||"");}catch{}},[station]);
 function updateTopic(value:string){setTopic(value);try{localStorage.setItem(`episode-topic:${station}`,value);}catch{}}
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirtyRef.current||briefFeedback.trim())e.preventDefault();};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[briefFeedback]);
 useEffect(()=>{setHistory(null);},[station,selected]);
 useEffect(()=>{if(!episode||draftKey.current!==`${station}:${episode.id}`)return;try{localStorage.setItem(`episode-draft:${station}:${episode.id}`,JSON.stringify({description,briefFeedback,feedback}));setSaved("Draft saved on this browser");}catch{setSaved("Unable to save draft on this browser");}},[description,briefFeedback,feedback,episode?.id,station]);
 useEffect(()=>{if(pendingScroll.current&&episode?.id===selected){scrollTo(pendingScroll.current);pendingScroll.current=null;}},[episode?.id,selected]);
 useEffect(()=>{const player=audio.current;return()=>{player?.pause();};},[station,selected,episode?.audio?.revision]);
 function edit(value:Feedback){setFeedback(value);setDirty(true);dirtyRef.current=true;}
 async function save(){if(!episode)return null;const e=await request(`${episode.id}/feedback`,"PUT",{revision:episode.revision,...feedback}) as Episode;
  dirtyRef.current=false;setDirty(false);revisionRef.current=`${e.id}:${e.revision}`;setView(v=>v?{...v,episode:e}:v);return e;
 }
 async function act(action:string){
  if(!view)return;if(["render","publish"].includes(action)&&(feedback.overall.trim()||Object.values(feedback.sections).some(v=>v.trim()))){setError("Apply or discard pending feedback before approval.");return;}setBusy(true);setError(null);setLocalJob(pendingJob(action,["ideas","develop"].includes(action)?null:episode?.id));
  try{
   const e=dirty?await save():episode;
   const started=await request("actions","POST",{action,episode_id:["ideas","develop"].includes(action)?null:e?.id,revision:["ideas","develop"].includes(action)?view.revision:e?.revision,topic,target_minutes:minutes,description:action==="publish"?description:"",render_hash:action==="publish"?e?.audio?.render_hash:null});
   if(action==="develop")pendingDevelop.current=started.request_id;
   if(action==="revise"){dirtyRef.current=false;setDirty(false);}
   setView(v=>v?{...v,job:{...pendingJob(action,["ideas","develop"].includes(action)?null:e?.id),local:false,job_id:started.job_id,status:"running",episode_options:{request_id:started.request_id}}}:v);setLocalJob(null);
   setTick(t=>t+1);
  }catch(cause){failActivity(cause,"Unable to start operation.");}finally{setBusy(false);}
 }
 async function refineBrief(){
  if(!view||!episode||!briefFeedback.trim())return;setBusy(true);setError(null);setLocalJob(pendingJob("refine_brief",episode.id));
  try{
   const started=await request("actions","POST",{action:"develop",episode_id:episode.id,revision:episode.revision,topic:briefFeedback.trim(),target_minutes:Math.round(episode.proposal.target_seconds/60)});
   setView(v=>v?{...v,job:{...pendingJob("refine_brief",episode.id),local:false,job_id:started.job_id,status:"running",episode_options:{request_id:started.request_id}}}:v);setLocalJob(null);
   setBriefFeedback("");setTick(t=>t+1);
  }catch(c){failActivity(c,"Unable to revise brief.");}finally{setBusy(false);}
 }
 function finishActivity(){setLocalJob(j=>j?{...j,status:"succeeded",finished_at:new Date().toISOString()}:j);}
 function failActivity(cause:unknown,fallback:string){setLocalJob(j=>j?{...j,status:"failed",finished_at:new Date().toISOString(),progress:{...j.progress!,current:"The request could not be completed",error:cause instanceof Error?cause.message:fallback}}:j);}
 async function saveOnly(){setBusy(true);setError(null);setLocalJob(pendingJob("save_feedback",episode?.id));try{await save();finishActivity();}catch(c){failActivity(c,"Unable to save feedback.");}finally{setBusy(false);}}
 async function weekly(enabled:boolean){if(!view)return;setBusy(true);setError(null);setLocalJob(pendingJob("schedule"));try{await request("schedule","PUT",{revision:view.revision,enabled,target_minutes:weeklyMinutes});finishActivity();setTick(t=>t+1);}catch(c){failActivity(c,"Unable to save schedule.");}finally{setBusy(false);}}
 async function compare(key:string){setError(null);try{if(!key){setHistory(null);return;}const [kind,id]=key.split(":");const v=await request(`${episode!.id}/history/${kind}/${id}`);setHistory(v.segments);}catch(c){setError(c instanceof Error?c.message:"Unable to load comparison.");}}
 async function retry(){if(!activity)return;setBusy(true);setError(null);setLocalJob({...activity,status:"submitting",local:true,progress:{...activity.progress!,current:"Submitting retry request…",error:null}});try{const started=await request("retry","POST",{request_id:activity.episode_options?.request_id});setView(v=>v?{...v,job:{...activity,status:"running",job_id:started.job_id,accepted_at:new Date().toISOString(),started_at:null,finished_at:null,progress:{...activity.progress!,current:"Resuming the saved operation",error:null,steps:activity.progress!.steps.map(step=>step.status==="failed"?{...step,status:"pending"}:step)}}}:v);setLocalJob(null);setTick(t=>t+1);}catch(c){failActivity(c,"Unable to retry.");}finally{setBusy(false);}}
 function scrollTo(id:string){const node=document.getElementById(id);node?.scrollIntoView({behavior:"smooth",block:"start"});node?.focus({preventScroll:true});}
 function goToResult(id:string|null|undefined,target:string){if(id&&id!==selected){pendingScroll.current=target;setSelected(id);}else scrollTo(target);}
 function showProgress(){goToResult(activity?.progress?.episode_id,"episode-operation");}
 function showResult(){const id=activity?.progress?.episode_id||activity?.result?.episode_id;const action=activity?.progress?.action;if(action==="publish"&&id){router.push(`/episodes/${station}/${encodeURIComponent(id)}`);return;}if(["ideas","weekly","develop"].includes(action??""))setShowNew(true);const target=["ideas","weekly"].includes(action??"")?"episode-suggestions":action==="render"?"episode-audio-review":"episode-review";goToResult(id,target);}
 function activityLocation(){const action=activity?.progress?.action;return ["ideas","develop","weekly"].includes(action??"")?"ideas":action==="refine_brief"?"brief":action==="schedule"?"schedule":"episode";}
 function progressAt(location:string){if(!activity||activityLocation()!==location)return null;if(["brief","episode"].includes(location)&&activity.progress?.episode_id&&activity.progress.episode_id!==selected)return null;return <EpisodeActivity job={activity} disabled={busy||unsaved} onShow={showProgress} onResult={showResult} onRetry={()=>void retry()}/>;}
 function buttonText(action:string,idle:string){return activity?.progress?.action===action&&jobActive(activity)&&(!activity.progress.episode_id||activity.progress.episode_id===selected)?`${operationText(action)}…`:idle;}
 function acceptEpisode(e:Episode){revisionRef.current=`${e.id}:${e.revision}`;setView(v=>v?{...v,episode:e,episodes:v.episodes.map(item=>item.id===e.id?{...item,archived:e.archived}:item)}:v);}
 async function archiveEpisode(){if(!episode)return;try{const updated=await request(`${episode.id}/review`,"PUT",{revision:episode.revision,archived:!episode.archived});acceptEpisode(updated);setTick(t=>t+1);}catch(e){setError(String(e));}}
 async function stopJob(){try{const r=await request("stop","POST",{request_id:view?.job?.episode_options?.request_id});setError(r.status);}catch(e){setError(String(e));}}
 async function saveDelivery(){if(!episode)return;try{const current=dirty?await save():episode;const updated=await request(`${episode.id}/review`,"PUT",{revision:current?.revision,delivery});acceptEpisode(updated);setTick(t=>t+1);}catch(e){setError(String(e));}}
 async function savePassage(id:string){if(!episode)return;setBusy(true);try{const current=dirty?await save():episode;const updated=await request(`${episode.id}/review`,"PUT",{revision:current?.revision,segment_id:id,script:editText});acceptEpisode(updated);setEditing(null);setTick(t=>t+1);}catch(e){setError(String(e));}finally{setBusy(false);}}
 function timestamp(id:string){const panel=document.querySelector<HTMLDetailsElement>(`#passage-${id} details[data-feedback]`);if(panel)panel.open=true;const t=time(audio.current?.currentTime??0);edit({...feedback,sections:{...feedback.sections,[id]:`${feedback.sections[id]||""}${feedback.sections[id]?"\n":""}At ${t}: `}});}
 return <section className={styles.workspace} aria-label="Episode creation and review">
  <header className={styles.header}><div><h2>Episodes</h2><p className={styles.muted}>Develop a story, shape the manuscript, and listen before publishing.</p></div>
   <label>Station<select value={station} disabled={busy||unsaved} onChange={e=>{audio.current?.pause();setStation(e.target.value);setSelected("");setView(null);setLocalJob(null);revisionRef.current="";setError(null);}}><option value="neuralforge">NeuralForge</option><option value="neuralcast">NeuralCast</option></select></label></header>
  {error&&<div className={`${styles.status} ${styles.error}`} role="alert">{error}</div>}
  {activity&&<EpisodeActivity job={activity} compact disabled={busy||unsaved} onShow={showProgress} onResult={showResult} onRetry={()=>void retry()}/>}


  {running&&["ideas","develop","refine_brief","write","revise","render"].includes(activity?.progress?.action??"")&&<button onClick={()=>void stopJob()}>Stop after current stage</button>}
  <div className={styles.columns}><aside className={styles.panel}><h3>Your episodes</h3><button onClick={()=>{setShowNew(true);setTimeout(()=>scrollTo("episode-ideas"),50);}}>New episode</button><label className={styles.check}><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/>Show archived drafts</label><div className={styles.list}>{view?.episodes.filter(e=>showArchived||!e.archived).map(e=><button disabled={busy||unsaved} key={e.id} className={`${styles.episode} ${selected===e.id?styles.selected:""}`} onClick={()=>{setSelected(e.id);setError(null);}}><span>{e.episode_number?`${String(e.episode_number).padStart(3,"0")} · `:""}{e.title}</span><span className={styles.badge}>{label(e.status)}</span></button>)}</div>{view&&!view.episodes.length&&<p className={styles.muted}>Develop an idea to begin.</p>}</aside>
   <section id="episode-review" tabIndex={-1} className={styles.panel}>{!view?<p role="status">Loading episode workspace…</p>:!episode?<p>Select an episode to review its story.</p>:<>
    <nav className={styles.steps} aria-label="Episode workflow">{["Brief","Manuscript","Audio","Publication"].map((step,i)=><span key={step} aria-current={i===(published?3:episode.audio?.current?2:episode.segments.length?1:0)?"step":undefined}>{i+1}. {step}</span>)}</nav>
    <p className={styles.muted}>{saved}</p>
    {!published&&<button disabled={disabled||dirty} onClick={()=>void archiveEpisode()}>{episode.archived?"Restore draft":"Archive draft"}</button>}

    <span className={styles.badge}>{label(episode.status)}</span><h3>{episode.proposal.title}</h3><p className={styles.muted}>{episode.proposal.premise}</p>
    {episode.segments.length>0&&episode.brief&&<details className={styles.briefSection}><summary>Approved brief, recordings and sources</summary><p>{episode.brief.instructions}</p><ol>{episode.proposal.outline.map((v,i)=><li key={i}>{v}</li>)}</ol>{episode.songs.map(song=><div key={song.id}><p>{song.artist} — {song.title}</p><audio controls preload="none" src={`${base}/${episode.id}/recording/${song.id}`}/></div>)}<ul>{episode.brief.initial_research.map((source,i)=><li key={i}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.claim}</a></li>)}</ul></details>}
    {!!episode.production_notes?.length&&<details><summary>Recording checks before rendering ({episode.production_notes.length})</summary><ul>{episode.production_notes.map((note,i)=><li key={i}>{note}</li>)}</ul></details>}
    {!!episode.listening_notes?.length&&<details><summary>Listening checks ({episode.listening_notes.length})</summary><ul>{episode.listening_notes.map((note,i)=><li key={i}>{note.note}</li>)}</ul></details>}
    {episode.status==="queued"&&<p>{view.weekly_enabled?"Queued for the next Sunday preparation, after pending reviews are complete.":"Queued · weekly preparation is disabled. You can generate the manuscript now."}</p>}
    {!episode.segments.length?<><p className={styles.muted}>Target {time(episode.proposal.target_seconds)} · narration budget {time(episode.proposal.commentary_budget_seconds)}</p>
     <section className={styles.briefSection}><h4>Story outline</h4><ol>{episode.proposal.outline.map((line,i)=><li key={i}>{line}</li>)}</ol></section>
     <section className={styles.briefSection}><h4>Proposed recordings</h4><div className={styles.recordings}>{episode.songs.map((song,i)=><div className={styles.song} key={song.id}><strong>{i+1}</strong><div><p>{song.artist} — {song.title}</p><small>{song.rationale}</small><audio controls preload="none" src={`${base}/${episode.id}/recording/${song.id}`}/></div></div>)}</div></section>
     {episode.brief&&<details className={styles.briefSection}><summary>Writing brief and research</summary><p className={styles.script}>{episode.brief.instructions}</p><ul>{episode.brief.initial_research.map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.claim}</a></li>)}</ul></details>}
     <section className={styles.briefFeedback} aria-label="Brief feedback"><label htmlFor="brief-feedback">Feedback on this brief</label><p className={styles.muted} id="brief-feedback-help">What would you like to change or keep? Your feedback revises this episode’s brief and proposed songs.</p>
      <textarea id="brief-feedback" aria-describedby="brief-feedback-help" value={briefFeedback} disabled={disabled} onChange={e=>{setBriefFeedback(e.target.value);}} placeholder="For example: keep the main theme, but focus more on the personal conflict and add more background before introducing the bands." maxLength={5000}/>
      <div className={styles.actions}><button disabled={disabled||!briefFeedback.trim()} onClick={()=>void refineBrief()}>{buttonText("refine_brief","Apply feedback")}</button></div>
      {progressAt("brief")}
     </section>
     <section className={styles.approval}><h4>Ready to write?</h4><p className={styles.muted}>{briefFeedback.trim()?"Apply or clear your feedback before approving the brief.":"Approve this brief to generate the manuscript now, or queue it for weekly preparation."}</p>
      <div className={styles.approvalActions}><button disabled={disabled||!!briefFeedback.trim()||episode.concept_approved} onClick={()=>void act("queue")}>{buttonText("queue","Approve brief & queue")}</button><button className={styles.primary} disabled={disabled||!!briefFeedback.trim()} onClick={()=>void act("write")}>{buttonText("write",episode.concept_approved?"Generate manuscript":"Approve brief & generate manuscript")}</button></div>
     </section></>:<>
     {episode.timing&&<p className={styles.muted}>{episode.timing.spoken_words} spoken words · estimated episode {time(episode.timing.estimated_total_seconds)}</p>}
     {episode.blockers.length>0&&<div className={`${styles.status} ${styles.error}`}><strong>Questions to resolve before rendering</strong><ul>{episode.blockers.map((b,i)=><li key={i}>{b}</li>)}</ul></div>}
     {episode.audio&&<section id="episode-audio-review" tabIndex={-1} className={styles.audioReview} aria-label="Audio review"><h4>{episode.audio.current?"Recording for review":"Previous recording · changes await rendering"}</h4><audio ref={audio} onTimeUpdate={e=>setPlayback(e.currentTarget.currentTime)} controls preload="none" src={`${base}/${episode.id}/audio/${episode.audio.revision}`}/><button disabled={disabled} onClick={()=>{const c=episode.audio?.chapters.find(c=>c.kind==="commentary"&&c.start<=playback&&c.end>playback);if(c){timestamp(c.id);scrollTo(`passage-${c.id}`);}else{const chapter=episode.audio?.chapters.find(c=>c.start<=playback&&c.end>playback);edit({...feedback,overall:`${feedback.overall}${feedback.overall?"\n":""}At ${time(playback)}${chapter?` (${chapter.title})`:""}: `});scrollTo("overall-feedback");}}}>Comment at {time(playback)}</button><div className={styles.chapters}>{episode.audio.chapters.map(c=><button key={c.id} onClick={()=>{if(audio.current){audio.current.currentTime=c.start;void audio.current.play();}}}>{time(c.start)} · {c.title}</button>)}</div></section>}
     {episode.audio&&!published&&<details><summary>Voice and pronunciation feedback</summary><p>These instructions affect episode narration only. Save them, then render a new recording for review. The manuscript is preserved.</p><textarea aria-label="Voice directions" value={delivery} onChange={e=>setDelivery(e.target.value)}/><button disabled={disabled} onClick={()=>void saveDelivery()}>Save voice directions</button></details>}{(!!episode.applied_feedback?.overall||Object.values(episode.applied_feedback?.sections||{}).some(Boolean))&&<details><summary>Applied feedback</summary><p>{episode.applied_feedback?.overall}</p><ul>{Object.entries(episode.applied_feedback?.sections||{}).map(([id,note])=><li key={id}>{episode.segments.find(s=>s.id===id)?.companion?.title||id}: {note}</li>)}</ul></details>}{!!episode.changes?.length&&<details><summary>Revision notes</summary><ul>{episode.changes.map(change=><li key={change.segment_id}><strong>{episode.segments.find(s=>s.id===change.segment_id)?.companion?.title||change.segment_id}:</strong> {change.explanation}</li>)}</ul></details>}
     {!published&&<div><label htmlFor="overall-feedback">Overall feedback</label><textarea id="overall-feedback" disabled={disabled} value={feedback.overall} onChange={e=>edit({...feedback,overall:e.target.value})} placeholder="What should change? Mention anything you want to preserve." maxLength={5000}/></div>}
     <nav className={styles.chapters}>{episode.segments.filter(s=>s.kind==="commentary").map(s=><button key={s.id} onClick={()=>scrollTo(`passage-${s.id}`)}>{s.companion?.title||s.id}</button>)}</nav><label>Compare with a saved manuscript<select defaultValue="" onChange={e=>void compare(e.target.value)}><option value="">Current manuscript only</option>{episode.history.map(h=><option key={`${h.kind}:${h.id}`} value={`${h.kind}:${h.id}`}>{new Date(h.created_at).toLocaleString()} · Saved manuscript</option>)}</select></label>
     {episode.segments.map(s=>s.kind==="music"?<div className={styles.song} key={s.id}><span aria-hidden="true">♫</span><div><strong>{s.artist} — {s.title}</strong><p className={styles.muted}>Complete recording</p></div></div>:<article id={`passage-${s.id}`} tabIndex={-1} className={styles.passage} key={s.id}><div className={styles.row}><h4>{s.companion?.title||s.id}</h4><span className={styles.badge}>{s.role}</span></div><p className={styles.script}>{s.script}</p>{!published&&<button disabled={disabled} onClick={()=>{setEditing(s.id);setEditText(s.script||"");}}>Edit passage</button>}{editing===s.id&&<div><textarea aria-label="Passage text" value={editText} onChange={e=>setEditText(e.target.value)}/><button onClick={()=>void savePassage(s.id)}>Save correction</button><button onClick={()=>setEditing(null)}>Cancel edit</button></div>}{!!s.sources?.length&&<details><summary>Sources</summary><ul>{s.sources.map((source,i)=><li key={i}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.claim}</a></li>)}</ul></details>}
      {history&&history.find(old=>old.id===s.id)?.script!==s.script&&<details open><summary>Text in selected manuscript</summary><p className={`${styles.script} ${styles.previous}`}>{history.find(old=>old.id===s.id)?.script||"This passage was not present."}</p><p>Highlighted changes:</p><p className={styles.script}>{difference(history.find(old=>old.id===s.id)?.script||"",s.script||"")}</p></details>}
      {!published&&<details data-feedback><summary>Add feedback on this passage</summary><label>Feedback on this passage<textarea disabled={disabled} maxLength={3000} value={feedback.sections[s.id]||""} onChange={e=>edit({...feedback,sections:{...feedback.sections,[s.id]:e.target.value}})}/></label>{episode.audio&&<button disabled={disabled} onClick={()=>timestamp(s.id)}>Add current playback time to feedback</button>}</details>}
     </article>)}
     {!published?<>{episode.audio?.current&&<section className={styles.publication}><h4>Publication preview</h4><img src={`/api/admin/episodes/${station}/cover`} alt={`${station} podcast cover`} width={160} height={160}/><p>{description}</p><p>{episode.proposal.title} · {episode.episode_number?`Episode ${episode.episode_number}`:"Episode number assigned on publication"} · {time(episode.audio.duration)}</p><p>Website and RSS · Chapters shown in the review player above</p><label>Publication description<textarea maxLength={5000} disabled={disabled} value={description} onChange={e=>setDescription(e.target.value)}/></label></section>}<label className={styles.check}><input type="checkbox" disabled={disabled} checked={feedback.research} onChange={e=>edit({...feedback,research:e.target.checked})}/><span>My feedback needs additional factual research</span></label><p className={styles.muted}>{feedback.overall.trim()||Object.values(feedback.sections).some(v=>v.trim())?"Pending feedback · apply it and review the result before approval":"No pending feedback"}</p><button disabled={disabled} onClick={()=>edit(emptyFeedback)}>Discard pending feedback</button><div className={`${styles.actions} ${styles.reviewActions}`}><button disabled={disabled||!dirty} onClick={()=>void saveOnly()}>{buttonText("save_feedback","Save feedback")}</button><button disabled={disabled||(!feedback.overall.trim()&&!Object.values(feedback.sections).some(v=>v.trim()))} onClick={()=>void act("revise")}>{buttonText("revise","Apply feedback")}</button>{!episode.audio?.current&&<button className={styles.primary} disabled={disabled||!!episode.blockers.length||!!feedback.overall.trim()||Object.values(feedback.sections).some(v=>v.trim())} onClick={()=>void act("render")}>{buttonText("render","Approve manuscript & render")}</button>}{episode.audio?.current&&<button className={styles.primary} disabled={disabled||dirty||!!feedback.overall.trim()||Object.values(feedback.sections).some(v=>v.trim())} onClick={()=>void act("publish")}>{buttonText("publish","Publish reviewed audio")}</button>}</div><p className={styles.muted}>Approval applies to the exact manuscript or recording shown here. Publication makes the episode available on the website and RSS.</p></>:<Link href={`/episodes/${station}/${episode.id}`}>Open published episode</Link>}
    </>}
   </>}{progressAt("episode")}</section>
  </div>
  <details open={showNew} onToggle={e=>setShowNew(e.currentTarget.open)} id="episode-ideas" className={styles.panel}><summary>New episode · ideas and topics</summary><p className={styles.muted}>Ask for suggestions, or bring a topic of your own. Each idea becomes a brief for your approval.</p>
   <label htmlFor="episode-topic">Your episode idea</label><textarea id="episode-topic" value={topic} onChange={e=>updateTopic(e.target.value)} placeholder="For example: how changing a singer changes a band's identity…" maxLength={5000}/>
   <div className={`${styles.actions} ${styles.topicActions}`}><label>Approximate minutes<input type="number" min={10} max={120} value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/></label>
    <button disabled={disabled||!view||unsaved} onClick={()=>void act("ideas")}>{buttonText("ideas","Suggest topics")}</button><button className={styles.primary} disabled={disabled||!view||!topic.trim()||unsaved} onClick={()=>void act("develop")}>{buttonText("develop","Develop my idea")}</button></div>
   {progressAt("ideas")}

   <div id="episode-suggestions" tabIndex={-1} className={styles.ideas}>{view?.ideas.map(idea=><details className={styles.idea} key={idea.id}><summary>{idea.title}</summary><div className={styles.ideaBody}><p>{idea.premise}</p><p className={styles.muted}>{idea.angle}</p><small>{idea.artists.join(" · ")}</small><div className={styles.actions}><button disabled={disabled} onClick={()=>updateTopic(`${idea.title}\n\n${idea.premise}\n\n${idea.angle}`)}>Use this idea</button></div></div></details>)}</div>
  </details>
   <details className={styles.schedule} aria-label="Weekly preparation"><summary>Weekly preparation settings</summary><div><p className={styles.muted}>Sundays, {station==="neuralforge"?"13:00":"13:15"} Europe/Zurich</p></div>
    <div className={styles.scheduleControls}><label className={styles.check}><input type="checkbox" checked={view?.weekly_enabled??false} disabled={disabled||!view||unsaved} onChange={e=>void weekly(e.target.checked)}/><span>Enable weekly preparation</span></label>
     <button disabled={disabled||!view||unsaved||weeklyMinutes===view.target_minutes} onClick={()=>void weekly(view!.weekly_enabled)}>{buttonText("schedule","Save weekly settings")}</button></div>
    <p className={styles.muted}>Suggests topics and writes one approved queued brief. It waits while a manuscript or recording needs your review.</p>
    <label>Weekly episode duration<input type="number" min={10} max={120} value={weeklyMinutes} onChange={e=>setWeeklyMinutes(Number(e.target.value))}/></label>{progressAt("schedule")}
   </details>
 </section>;
}
