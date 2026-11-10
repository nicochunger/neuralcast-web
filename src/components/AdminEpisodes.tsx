"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./AdminEpisodes.module.css";
import { EpisodeActivity, EpisodeJob, jobActive, operationText, pendingJob } from "./EpisodeActivity";

type Segment = { id:string; kind:"music"|"commentary"; artist?:string; title?:string; rationale?:string; script?:string; companion?:{title:string}; role?:string };
type Feedback = { overall:string; sections:Record<string,string>; research:boolean };
type Episode = { id:string; status:string; revision:string; episode_number:number|null; concept_hash:string; concept_approved:boolean; proposal:{title:string;premise:string;outline:string[];target_seconds:number;commentary_budget_seconds:number}; brief?:{instructions:string;initial_research:{url:string;claim:string}[]}; changes?:{segment_id:string;explanation:string}[]; songs:Segment[]; segments:Segment[]; feedback:Feedback; blockers:string[]; timing?:{estimated_total_seconds:number;spoken_words:number}; audio:null|{revision:string;render_hash:string;duration:number;current:boolean;chapters:{id:string;title:string;kind:string;start:number;end:number}[]}; history:{id:string;kind:string;created_at:string;manuscript_hash:string}[] };
type Job = EpisodeJob;
type View = {revision:string;weekly_enabled:boolean;target_minutes:number;ideas:{id:string;title:string;premise:string;angle:string;artists:string[]}[];episodes:{id:string;status:string;episode_number:number|null;title:string;managed?:boolean}[];episode:Episode|null;job:Job|null};
const emptyFeedback:Feedback={overall:"",sections:{},research:false};
const time=(s:number)=>`${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,"0")}`;
const label=(s:string)=>({brief_review:"Brief review",queued:"Approved · queued",manuscript_review:"Manuscript review",audio_review:"Audio review",published:"Published"}[s]??s);

export function AdminEpisodes(){
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
    if(!dirtyRef.current&&revisionRef.current!==key){setFeedback(data.episode?.feedback??emptyFeedback);setDescription(data.episode?.proposal.premise??"");revisionRef.current=key;}
    if(loadedStation.current!==station){setMinutes(data.target_minutes);loadedStation.current=station;}
    if(failures)setError(null);setView(data);failures=0;
    if(data.job?.status==="succeeded"&&data.job.episode_options?.request_id===pendingDevelop.current&&data.job.result?.episode_id){pendingDevelop.current="";setSelected(data.job.result.episode_id);return;}
    if(!selected&&data.episodes.length)setSelected(data.job?.progress?.episode_id??data.episodes.find(e=>e.managed&&e.status!=="published")?.id??data.episodes.find(e=>e.status==="published")?.id??data.episodes[0].id);
   }catch(cause){if(!stopped){setError(cause instanceof Error?cause.message:"Connection interrupted.");failures++;}}
   finally{if(!stopped)timer=setTimeout(refresh,Math.min(5000*2**failures,30000));}
  }
  void refresh();return()=>{stopped=true;clearTimeout(timer);controller?.abort();};
 },[base,selected,tick]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirtyRef.current||briefFeedback.trim())e.preventDefault();};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[briefFeedback]);
 useEffect(()=>{setHistory(null);setBriefFeedback("");},[station,selected]);
 useEffect(()=>{if(pendingScroll.current&&episode?.id===selected){scrollTo(pendingScroll.current);pendingScroll.current=null;}},[episode?.id,selected]);
 useEffect(()=>{const player=audio.current;return()=>{player?.pause();};},[station,selected,episode?.audio?.revision]);
 function edit(value:Feedback){setFeedback(value);setDirty(true);dirtyRef.current=true;}
 async function save(){if(!episode)return null;const e=await request(`${episode.id}/feedback`,"PUT",{revision:episode.revision,...feedback}) as Episode;
  dirtyRef.current=false;setDirty(false);revisionRef.current=`${e.id}:${e.revision}`;setView(v=>v?{...v,episode:e}:v);return e;
 }
 async function act(action:string){
  if(!view)return;setBusy(true);setError(null);setLocalJob(pendingJob(action,["ideas","develop"].includes(action)?null:episode?.id));
  try{
   const e=dirty?await save():episode;
   const started=await request("actions","POST",{action,episode_id:["ideas","develop"].includes(action)?null:e?.id,revision:["ideas","develop"].includes(action)?view.revision:e?.revision,topic,target_minutes:minutes,description:action==="publish"?description:"",render_hash:action==="publish"?e?.audio?.render_hash:null});
   if(action==="develop")pendingDevelop.current=started.request_id;
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
 async function weekly(enabled:boolean){if(!view)return;setBusy(true);setError(null);setLocalJob(pendingJob("schedule"));try{await request("schedule","PUT",{revision:view.revision,enabled,target_minutes:minutes});finishActivity();setTick(t=>t+1);}catch(c){failActivity(c,"Unable to save schedule.");}finally{setBusy(false);}}
 async function compare(key:string){setError(null);try{if(!key){setHistory(null);return;}const [kind,id]=key.split(":");const v=await request(`${episode!.id}/history/${kind}/${id}`);setHistory(v.segments);}catch(c){setError(c instanceof Error?c.message:"Unable to load comparison.");}}
 async function retry(){if(!activity)return;setBusy(true);setError(null);setLocalJob({...activity,status:"submitting",local:true,progress:{...activity.progress!,current:"Submitting retry request…",error:null}});try{const started=await request("retry","POST",{request_id:activity.episode_options?.request_id});setView(v=>v?{...v,job:{...activity,status:"running",job_id:started.job_id,accepted_at:new Date().toISOString(),started_at:null,finished_at:null,progress:{...activity.progress!,current:"Resuming the saved operation",error:null,steps:activity.progress!.steps.map(step=>step.status==="failed"?{...step,status:"pending"}:step)}}}:v);setLocalJob(null);setTick(t=>t+1);}catch(c){failActivity(c,"Unable to retry.");}finally{setBusy(false);}}
 function scrollTo(id:string){const node=document.getElementById(id);node?.scrollIntoView({behavior:"smooth",block:"start"});node?.focus({preventScroll:true});}
 function goToResult(id:string|null|undefined,target:string){if(id&&id!==selected){pendingScroll.current=target;setSelected(id);}else scrollTo(target);}
 function showProgress(){goToResult(activity?.progress?.episode_id,"episode-operation");}
 function showResult(){const id=activity?.progress?.episode_id||activity?.result?.episode_id;const action=activity?.progress?.action;if(action==="publish"&&id){router.push(`/episodes/${station}/${encodeURIComponent(id)}`);return;}const target=["ideas","weekly"].includes(action??"")?"episode-suggestions":action==="render"?"episode-audio-review":"episode-review";goToResult(id,target);}
 function activityLocation(){const action=activity?.progress?.action;return ["ideas","develop","weekly"].includes(action??"")?"ideas":action==="refine_brief"?"brief":action==="schedule"?"schedule":"episode";}
 function progressAt(location:string){if(!activity||activityLocation()!==location)return null;if(["brief","episode"].includes(location)&&activity.progress?.episode_id&&activity.progress.episode_id!==selected)return null;return <EpisodeActivity job={activity} disabled={busy||unsaved} onShow={showProgress} onResult={showResult} onRetry={()=>void retry()}/>;}
 function buttonText(action:string,idle:string){return activity?.progress?.action===action&&jobActive(activity)&&(!activity.progress.episode_id||activity.progress.episode_id===selected)?`${operationText(action)}…`:idle;}
 function timestamp(id:string){const t=time(audio.current?.currentTime??0);edit({...feedback,sections:{...feedback.sections,[id]:`${feedback.sections[id]||""}${feedback.sections[id]?"\n":""}At ${t}: `}});}
 return <section className={styles.workspace} aria-label="Episode creation and review">
  <header className={styles.header}><div><h2>Episodes</h2><p className={styles.muted}>Develop a story, shape the manuscript, and listen before publishing.</p></div>
   <label>Station<select value={station} disabled={busy||unsaved} onChange={e=>{audio.current?.pause();setStation(e.target.value);setSelected("");setView(null);setLocalJob(null);revisionRef.current="";setError(null);}}><option value="neuralforge">NeuralForge</option><option value="neuralcast">NeuralCast</option></select></label></header>
  {error&&<div className={`${styles.status} ${styles.error}`} role="alert">{error}</div>}
  {activity&&<EpisodeActivity job={activity} compact disabled={busy||unsaved} onShow={showProgress} onResult={showResult} onRetry={()=>void retry()}/>}
  <section id="episode-ideas" tabIndex={-1} className={styles.panel}><h3>Ideas for the next episode</h3><p className={styles.muted}>Ask for suggestions, or bring a topic of your own. Each idea becomes a brief for your approval.</p>
   <label>Your episode idea<textarea value={topic} onChange={e=>setTopic(e.target.value)} placeholder="For example: how changing a singer changes a band's identity…" maxLength={5000}/></label>
   <div className={`${styles.actions} ${styles.topicActions}`}><label>Approximate minutes<input type="number" min={10} max={120} value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/></label>
    <button disabled={disabled||!view||unsaved} onClick={()=>void act("ideas")}>{buttonText("ideas","Suggest topics")}</button><button className={styles.primary} disabled={disabled||!view||!topic.trim()||unsaved} onClick={()=>void act("develop")}>{buttonText("develop","Develop my idea")}</button></div>
   {progressAt("ideas")}
   <section className={styles.schedule} aria-label="Weekly preparation"><div><h4>Weekly preparation</h4><p className={styles.muted}>Sundays, {station==="neuralforge"?"13:00":"13:15"} Europe/Zurich</p></div>
    <div className={styles.scheduleControls}><label className={styles.check}><input type="checkbox" checked={view?.weekly_enabled??false} disabled={disabled||!view||unsaved} onChange={e=>void weekly(e.target.checked)}/><span>Enable weekly preparation</span></label>
     <button disabled={disabled||!view||unsaved||minutes===view.target_minutes} onClick={()=>void weekly(view!.weekly_enabled)}>{buttonText("schedule","Save weekly settings")}</button></div>
    <p className={styles.muted}>Suggests topics and writes one approved queued brief. It waits while a manuscript or recording needs your review.</p>
    {progressAt("schedule")}
   </section>
   <div id="episode-suggestions" tabIndex={-1} className={styles.ideas}>{view?.ideas.map(idea=><article className={styles.idea} key={idea.id}><h4>{idea.title}</h4><p>{idea.premise}</p><p className={styles.muted}>{idea.angle}</p><small>{idea.artists.join(" · ")}</small><p><button disabled={disabled} onClick={()=>setTopic(`${idea.title}\n\n${idea.premise}\n\n${idea.angle}`)}>Use this idea</button></p></article>)}</div>
  </section>

  <div className={styles.columns}><aside className={styles.panel}><h3>Your episodes</h3><div className={styles.list}>{view?.episodes.map(e=><button disabled={busy||unsaved} key={e.id} className={`${styles.episode} ${selected===e.id?styles.selected:""}`} onClick={()=>{setSelected(e.id);setError(null);}}><span>{e.episode_number?`${String(e.episode_number).padStart(3,"0")} · `:""}{e.title}</span><span className={styles.badge}>{label(e.status)}</span></button>)}</div>{view&&!view.episodes.length&&<p className={styles.muted}>Develop an idea to begin.</p>}</aside>
   <section id="episode-review" tabIndex={-1} className={styles.panel}>{!view?<p role="status">Loading episode workspace…</p>:!episode?<p>Select an episode to review its story.</p>:<>
    <span className={styles.badge}>{label(episode.status)}</span><h3>{episode.proposal.title}</h3><p className={styles.muted}>{episode.proposal.premise}</p>
    {!episode.segments.length?<><p className={styles.muted}>Target {time(episode.proposal.target_seconds)} · narration budget {time(episode.proposal.commentary_budget_seconds)}</p>
     <section className={styles.briefSection}><h4>Story outline</h4><ol>{episode.proposal.outline.map((line,i)=><li key={i}>{line}</li>)}</ol></section>
     <section className={styles.briefSection}><h4>Proposed recordings</h4><div className={styles.recordings}>{episode.songs.map((song,i)=><div className={styles.song} key={song.id}><strong>{i+1}</strong><div><p>{song.artist} — {song.title}</p><small>{song.rationale}</small></div></div>)}</div></section>
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
     {episode.audio&&<section id="episode-audio-review" tabIndex={-1} aria-label="Audio review"><h4>{episode.audio.current?"Recording for review":"Previous recording · manuscript has changed"}</h4><audio ref={audio} controls preload="none" src={`${base}/${episode.id}/audio/${episode.audio.revision}`}/><div className={styles.chapters}>{episode.audio.chapters.map(c=><button key={c.id} onClick={()=>{if(audio.current){audio.current.currentTime=c.start;void audio.current.play();}}}>{time(c.start)} · {c.title}</button>)}</div></section>}
     {!!episode.changes?.length&&<details><summary>Revision notes</summary><ul>{episode.changes.map(change=><li key={change.segment_id}><strong>{episode.segments.find(s=>s.id===change.segment_id)?.companion?.title||change.segment_id}:</strong> {change.explanation}</li>)}</ul></details>}
     {!published&&<label>Overall feedback<textarea disabled={disabled} value={feedback.overall} onChange={e=>edit({...feedback,overall:e.target.value})} placeholder="What should change? Mention anything you want to preserve." maxLength={5000}/></label>}
     <label>Compare with a saved manuscript<select defaultValue="" onChange={e=>void compare(e.target.value)}><option value="">Current manuscript only</option>{episode.history.map(h=><option key={`${h.kind}:${h.id}`} value={`${h.kind}:${h.id}`}>{new Date(h.created_at).toLocaleString()} · {h.kind}</option>)}</select></label>
     {episode.segments.map(s=>s.kind==="music"?<div className={styles.song} key={s.id}><span aria-hidden="true">♫</span><div><strong>{s.artist} — {s.title}</strong><p className={styles.muted}>Complete recording</p></div></div>:<article className={styles.passage} key={s.id}><div className={styles.row}><h4>{s.companion?.title||s.id}</h4><span className={styles.badge}>{s.role}</span></div><p className={styles.script}>{s.script}</p>
      {history&&history.find(old=>old.id===s.id)?.script!==s.script&&<details open><summary>Text in selected manuscript</summary><p className={`${styles.script} ${styles.previous}`}>{history.find(old=>old.id===s.id)?.script||"This passage was not present."}</p></details>}
      {!published&&<><label>Feedback on this passage<textarea disabled={disabled} maxLength={3000} value={feedback.sections[s.id]||""} onChange={e=>edit({...feedback,sections:{...feedback.sections,[s.id]:e.target.value}})}/></label>{episode.audio&&<button disabled={disabled} onClick={()=>timestamp(s.id)}>Add current playback time to feedback</button>}</>}
     </article>)}
     {!published?<>{episode.audio?.current&&<label>Publication description<textarea maxLength={5000} disabled={disabled} value={description} onChange={e=>setDescription(e.target.value)}/></label>}<label className={styles.check}><input type="checkbox" disabled={disabled} checked={feedback.research} onChange={e=>edit({...feedback,research:e.target.checked})}/><span>My feedback needs additional factual research</span></label><div className={styles.actions}><button disabled={disabled||!dirty} onClick={()=>void saveOnly()}>{buttonText("save_feedback","Save feedback")}</button><button disabled={disabled||(!feedback.overall.trim()&&!Object.values(feedback.sections).some(v=>v.trim()))} onClick={()=>void act("revise")}>{buttonText("revise","Apply feedback")}</button><button className={styles.primary} disabled={disabled||!!episode.blockers.length} onClick={()=>void act("render")}>{buttonText("render","Approve manuscript & render")}</button>{episode.audio?.current&&<button className={styles.primary} disabled={disabled||dirty} onClick={()=>void act("publish")}>{buttonText("publish","Publish reviewed audio")}</button>}</div><p className={styles.muted}>Approval applies to the exact manuscript or recording shown here. Publication makes the episode available on the website and RSS.</p></>:<Link href={`/episodes/${station}/${episode.id}`}>Open published episode</Link>}
    </>}
   </>}{progressAt("episode")}</section>
  </div>
 </section>;
}
