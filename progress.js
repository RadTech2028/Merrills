'use strict';
// Compact per-question rows. No question text, answers, images, or attempt log is stored.
// [attempts, correct, lastSeen, localDay, correctStreakToday, outcome, state, bookmark, updated, contentHash]
const Progress=(()=>{
 // Keep v1 stored codes for backup compatibility: 1 = Learning, 3 = Learned.
 const states=['Learning','Learning','Learning','Learned'];
 const state=r=>r[6]===3?3:1;
 const prefix='positioning-progress-v1:'+location.pathname.replace(/\/?(?:index\.html)?$/,'/')+':';
 const MAX_BYTES=2*1024*1024,MAX_ROWS=15000;
 const rows=new Map(),sizes=new Map(),dirty=new Set(),hashes=new WeakMap();
 let bytes=0,warning='',listLimit=30;
 const key=q=>JSON.stringify([q.origin||'personal',q.group,q.id]);
 const day=(now=Date.now())=>{const d=new Date(now);return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate();};
 function hash(q){
  if(hashes.has(q))return hashes.get(q);
  const text=JSON.stringify([q.prompt,q.answer,q.acceptedAnswers||[],q.type]);let h=2166136261;
  for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);
  const value=h>>>0;hashes.set(q,value);return value;
 }
 function validKey(k){
  if(typeof k!=='string'||k.length>600)return false;
  try{const a=JSON.parse(k);return Array.isArray(a)&&a.length===3&&['program','personal'].includes(a[0])&&a.slice(1).every(s=>typeof s==='string'&&s.length>0)&&JSON.stringify(a)===k;}catch{return false;}
 }
 function validRow(r){
  return Array.isArray(r)&&r.length===10&&r.every(n=>Number.isSafeInteger(n)&&n>=0)&&r[1]<=r[0]&&r[4]<=r[1]&&r[5]<=2&&r[6]<states.length&&r[7]<=1&&r[9]<=4294967295&&r[0]<=1000000000&&r[2]<=8640000000000000&&r[8]<=8640000000000000;
 }
 function blank(q,previous){return [0,0,0,0,0,0,previous?.[6]===3?3:1,previous?.[7]||0,0,hash(q)];}
 function get(q){const r=rows.get(key(q))||(q.legacyGroup?rows.get(JSON.stringify([q.origin||'personal',q.legacyGroup,q.legacyId||q.id])):null);return r&&r[9]===hash(q)?r:blank(q,r);}
 function warn(message){warning=message;const el=$('progress-warning');if(el){el.hidden=!message;el.textContent=message;}}
 function acceptStored(k,raw){
  const old=sizes.get(k)||0;bytes-=old;sizes.delete(k);
  if(raw===null){if(!dirty.has(k))rows.delete(k);return;}
  const size=(prefix.length+k.length+raw.length)*2;bytes+=size;sizes.set(k,size);
  const r=JSON.parse(raw);if(!validKey(k)||!validRow(r))throw new Error('Invalid progress record');
  if(!dirty.has(k)||!rows.has(k)||r[8]>rows.get(k)[8])rows.set(k,r);
 }
 function load(){
  try{
   for(let i=0;i<localStorage.length;i++){
    const storedKey=localStorage.key(i);if(!storedKey?.startsWith(prefix))continue;
    try{acceptStored(storedKey.slice(prefix.length),localStorage.getItem(storedKey));}catch{warn('Some saved progress could not be read. Those records were left untouched.');}
   }
  }catch{warn('Browser storage is unavailable. Progress lasts for this visit only. Export a progress backup before leaving.');}
 }
 function latest(q){
  const k=key(q);
  try{const raw=localStorage.getItem(prefix+k);if(raw!==null)acceptStored(k,raw);}catch{}
  return [...get(q)];
 }
 function save(k,r){
  rows.set(k,r);dirty.add(k);
  if(!validKey(k)||!validRow(r)){warn('This question could not be saved to progress. Check its question ID and category.');return false;}
  const raw=JSON.stringify(r),size=(prefix.length+k.length+raw.length)*2;
  if(bytes-(sizes.get(k)||0)+size>MAX_BYTES||(!sizes.has(k)&&sizes.size>=MAX_ROWS)){
   warn('The progress storage limit has been reached. New changes are kept for this visit only. Export a progress backup before leaving.');return false;
  }
  try{
   localStorage.setItem(prefix+k,raw);bytes+=size-(sizes.get(k)||0);sizes.set(k,size);dirty.delete(k);
   if(!dirty.size&&warning.startsWith('Progress could not'))warn('');return true;
  }catch{warn('Progress could not be saved in this browser. Changes are kept for this visit only. Export a progress backup before leaving.');return false;}
 }
 function record(q,correct,skipped=false,now=Date.now()){
  if(session?.from==='preview')return;
  const r=latest(q),today=day(now);
  if(r[3]!==today)r[4]=0;
  r[0]=Math.min(1000000000,r[0]+1);if(correct)r[1]=Math.min(r[0],r[1]+1);
  r[2]=now;r[3]=today;r[4]=correct?Math.min(r[1],r[4]+1):0;r[5]=skipped?2:correct?1:0;r[8]=now;
  if(correct&&!skipped&&typeof Preferences!=='undefined'&&Preferences.autoLearn())r[6]=3;
  save(key(q),r);
 }
 function matches(q,filter){
  const r=get(q);
  if(filter==='unseen')return !r[0];
  if(filter==='attempted')return r[0]>0;
  if(filter==='bookmarked')return !!r[7];
  if(filter==='missed')return r[0]>0&&r[5]!==1;
  if(filter==='learning')return state(r)===1;
  if(filter==='learned')return state(r)===3;
  return true;
 }
 function weight(q,now=Date.now()){
  const r=get(q);let w=!r[0]?5:r[5]!==1?7:2;
  w*=state(r)===3?0.7:1.3;
  if(r[3]===day(now)&&r[4])w*=Math.pow(0.15,Math.min(3,r[4]));
  if(r[2]&&now-r[2]>=0&&now-r[2]<120000)w*=0.65;
  return w;
 }
 function pick(pool,limit,smart,doShuffle,now=Date.now()){
  const unique=[...new Map(pool.map(q=>[key(q),q])).values()];
  if(smart)return unique.map(q=>({q,rank:-Math.log(Math.max(Number.MIN_VALUE,Math.random()))/weight(q,now)})).sort((a,b)=>a.rank-b.rank).slice(0,limit).map(x=>x.q);
  return (doShuffle?shuffle(unique):unique).slice(0,limit);
 }
 function options(){return '<option value="all">All cards</option><option value="learning">Learning</option><option value="learned">Learned</option><option value="unseen">Not studied yet</option><option value="missed">Last missed / skipped</option><option value="bookmarked">Bookmarked</option>';}
 function controls(q,showStats=true){
  const r=get(q),k=esc(key(q)),learned=state(r)===3;
  return '<div class="card-progress" data-progress-key="'+k+'"><button type="button" class="card-learned" aria-label="Mark card learned" aria-pressed="'+learned+'">'+(learned?'Learned ✓':'Learning · Mark learned')+'</button><button type="button" class="card-bookmark" aria-pressed="'+!!r[7]+'">'+(r[7]?'Bookmarked':'Bookmark')+'</button>'+(showStats?'<span class="small muted">'+(r[0]?r[1]+' / '+r[0]+' correct or “Got it” · Last studied '+new Date(r[2]).toLocaleDateString():'Not studied yet')+'</span>':'')+'</div>';
 }
 function refreshAfterMark(){
  if(!$('progress-view').hidden)renderSummary();
  if(!$('practice-view').hidden)setup();
 }
 function wire(root,questions){
  const lookup=new Map(questions.map(q=>[key(q),q]));
  root.querySelectorAll('[data-progress-key]').forEach(el=>{
   const q=lookup.get(el.dataset.progressKey);if(!q)return;
   const learned=el.querySelector('.card-learned'),button=el.querySelector('.card-bookmark');
   learned.onclick=()=>{const r=latest(q);r[6]=state(r)===3?1:3;r[8]=Date.now();save(key(q),r);learned.textContent=r[6]===3?'Learned ✓':'Learning · Mark learned';learned.setAttribute('aria-pressed',String(r[6]===3));refreshAfterMark();};
   button.onclick=()=>{const r=latest(q);r[7]=r[7]?0:1;r[8]=Date.now();save(key(q),r);button.textContent=r[7]?'Bookmarked':'Bookmark';button.setAttribute('aria-pressed',String(!!r[7]));refreshAfterMark();};
  });
 }
 function summary(pool){
  let studied=0,today=0,bookmarks=0,learned=0;
  for(const q of pool){const r=get(q);if(r[0])studied++;if(r[0]&&r[3]===day())today++;if(r[7])bookmarks++;if(state(r)===3)learned++;}
  return {studied,today,bookmarks,learned};
 }
 function setup(){
  const pool=poolFor($('session-source').value).filter(q=>Catalog.include(q)&&focus.has(q.topic)&&(!$('images-only').checked||q.image)&&(!$('no-images-only').checked||!q.image));
  const s=summary(pool);$('setup-progress').textContent=s.studied+' of '+pool.length+' studied · '+s.today+' studied today · '+s.learned+' learned';
 }
 function renderCategoryBars(pool){
  const byGroup=new Map(groups.map(g=>[g.id,[]]));for(const q of pool)byGroup.get(q.group)?.push(q);
  $('category-progress').innerHTML=groups.map(g=>{
   const questions=byGroup.get(g.id)||[],s=summary(questions),total=questions.length,percent=total?Math.round(s.learned/total*100):0;
   const perPart=new Map(Catalog.forGroup(g.id).map(p=>[p.id,{name:p.name,total:0,learned:0}]));
   for(const q of questions){const item=perPart.get(Catalog.part(q));if(item){item.total++;if(state(get(q))===3)item.learned++;}}
   return '<article class="category-progress-card"><div class="category-progress-title"><h2>'+esc(g.name)+'</h2><strong>'+(total?percent+'%':'—')+'</strong></div><div class="learning-meter" role="progressbar" aria-label="'+esc(g.name)+' learned" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+percent+'"><span style="width:'+percent+'%"></span></div><p>'+(total?s.learned+' of '+total+' learned · '+s.studied+' studied':'No questions yet')+'</p><details><summary>By part / topic</summary><ul class="part-progress-list">'+[...perPart.values()].map(p=>'<li><span>'+esc(p.name)+'</span><span>'+p.learned+' / '+p.total+'</span></li>').join('')+'</ul></details></article>';
  }).join('');
 }
 function renderSummary(){
  const pool=poolFor('both'),s=summary(pool);
  renderCategoryBars(pool);StudyProfile.render(rows,pool);
  $('progress-summary').textContent=s.studied+' of '+pool.length+' questions studied · '+s.today+' today · '+s.bookmarks+' bookmarked · '+s.learned+' learned';
  $('progress-storage').textContent='Progress uses about '+Math.ceil(bytes/1024)+' KB of the 2 MB progress limit. '+rows.size+' compact records. Question images and personal question backups are separate.';
 }
 function render(){
  const pool=poolFor('both');renderSummary();refill('progress-group',groupOptions('All categories'));Catalog.refillFilter('progress-part',$('progress-group').value);
  const group=$('progress-group').value,filter=$('progress-filter').value,search=normalize($('progress-search').value);
  const found=pool.filter(q=>(!group||q.group===group)&&Catalog.matches(q,$('progress-part').value)&&matches(q,filter)&&(!search||normalize(q.prompt+' '+q.projection).includes(search))).sort((a,b)=>get(b)[8]-get(a)[8]);
  $('progress-count').textContent=found.length+' questions · showing '+Math.min(listLimit,found.length);$('progress-more').hidden=found.length<=listLimit;
  $('progress-list').innerHTML=found.slice(0,listLimit).map(q=>questionDetail(q)).join('')||'<p class="empty">No cards match these filters.</p>';
  wireImages($('progress-list'));wire($('progress-list'),found.slice(0,listLimit));
 }
 function backup(){return {app:'positioning-lab-progress',version:1,exportedAt:new Date().toISOString(),profile:StudyProfile.backup(),records:[...rows].map(([k,r])=>[k,[...r]])};}
 function validateBackup(data){
  if(!data||data.app!=='positioning-lab-progress'||data.version!==1||!Array.isArray(data.records)||data.records.length>MAX_ROWS)throw new Error('Choose a Positioning Lab progress backup (version 1).');
  let total=0;const seen=new Set();
  for(const pair of data.records){
   if(!Array.isArray(pair)||pair.length!==2||!validKey(pair[0])||!validRow(pair[1])||seen.has(pair[0]))throw new Error('This backup has invalid or duplicate progress records. Nothing was imported.');
   seen.add(pair[0]);total+=(prefix.length+pair[0].length+JSON.stringify(pair[1]).length)*2;
  }
  if(total>MAX_BYTES)throw new Error('This backup exceeds the 2 MB progress limit.');
  return data.records;
 }
 function restore(data){
  const incoming=validateBackup(data),updates=[];let projected=bytes,newCount=sizes.size;
  for(const [k,r] of incoming){
   try{const raw=localStorage.getItem(prefix+k);if(raw!==null)acceptStored(k,raw);}catch{}
   const old=rows.get(k);if(old&&old[8]>=r[8])continue;
   updates.push([k,r]);
  }
  projected=bytes;newCount=sizes.size;
  for(const [k,r] of updates){projected+=(prefix.length+k.length+JSON.stringify(r).length)*2-(sizes.get(k)||0);if(!sizes.has(k))newCount++;}
  if(projected>MAX_BYTES||newCount>MAX_ROWS)throw new Error('Combining these histories would exceed the progress limit. Nothing was imported.');
  let saved=0;
  for(const [k,r] of updates)if(save(k,[...r]))saved++;
  StudyProfile.restore(data.profile);
  return {merged:updates.length,saved};
 }
 function init(){
  load();
  for(const id of ['study-filter','bank-progress','progress-filter'])$(id).innerHTML=options();
  $('study-filter').onchange=updateSetup;
  $('bank-progress').onchange=()=>{browseLimit=50;renderBank();};
  ['progress-group','progress-part','progress-filter','progress-search'].forEach(id=>$(id).addEventListener(id==='progress-search'?'input':'change',()=>{listLimit=30;render();}));
  $('progress-more').onclick=()=>{listLimit+=30;render();};
  $('progress-export').onclick=()=>{downloadJSON(backup(),'positioning-progress-'+day()+'.json');$('progress-status').textContent='Progress backup exported. Use the question backup in My questions to save personal question content too.';};
  $('progress-import').onchange=async()=>{
   const file=$('progress-import').files[0];if(!file)return;
   try{
    if(file.size>6*1024*1024)throw new Error('Choose a progress backup smaller than 6 MB.');
    const result=restore(JSON.parse(await file.text()));
    $('progress-status').textContent=result.saved===result.merged?'Restored '+result.saved+' newer records. Existing newer progress was kept.':result.saved+' of '+result.merged+' records saved. Export a backup before leaving; some changes remain only for this visit.';
    render();updateSetup();
   }catch(e){$('progress-status').textContent='Restore failed: '+e.message;}finally{$('progress-import').value='';}
  };
  window.addEventListener('storage',event=>{
   if(event.key===null){rows.clear();sizes.clear();bytes=0;warn('Browser data was cleared in another tab. Reload before studying.');return;}
   if(!event.key.startsWith(prefix))return;
   try{acceptStored(event.key.slice(prefix.length),event.newValue);if(!$('practice-view').hidden)updateSetup();if(!$('progress-view').hidden)render();}catch{warn('A progress update from another tab could not be read.');}
  });
 }
 return {init,get,key,day,record,matches,weight,pick,controls,wire,setup,render,backup,validateBackup,restore,summary};
})();
Progress.init();
