'use strict';
const StudyProfile=(()=>{
 const key='positioning-profile-v1:'+location.pathname.replace(/\/?(?:index\.html)?$/,'/');
 const ranks=["Photon Scout", "Beam Explorer", "Collimation Cadet", "Projection Apprentice", "Anatomy Analyst", "Positioning Specialist", "Image Evaluator", "Exposure Expert", "Precision Master", "Imaging Elite", "Radiographic Legend"];
 let name=Preferences.getName(),lastXP=0;
 // Migrate the old separate profile name once. An existing display name wins.
 try{
  const legacy=JSON.parse(localStorage.getItem(key)||'null');
  if(legacy){
   const chosen=name||(typeof legacy.name==='string'?legacy.name:'');
   if(Preferences.setName(chosen))localStorage.removeItem(key);
  }
 }catch{}
 function save(value){return Preferences.setName(value);}
 const achievementKey='positioning-achievements-v1:'+location.pathname.replace(/\/?(?:index\.html)?$/,'/');
 const milestones=[['first',1,25,'First exposure','correct'],['correct25',25,75,'Beam builder','correct'],['correct100',100,200,'Exposure streak','correct'],['correct500',500,500,'Image archive','correct'],['correct1000',1000,1000,'Thousand exposures','correct'],['learn10',10,100,'Focused learner','learned'],['learn50',50,250,'Positioning pathway','learned'],['learn100',100,500,'Knowledge collimator','learned'],['images25',25,200,'Image detective','images']];
 milestones.push(...[["correct10", 10, 40, "Warm-up exposure", "correct"], ["correct50", 50, 125, "Steady beam", "correct"], ["correct250", 250, 350, "Exposure navigator", "correct"], ["correct2500", 2500, 1500, "Beam veteran", "correct"], ["correct5000", 5000, 2500, "Exposure legend", "correct"], ["learn25", 25, 150, "Positioning foundation", "learned"], ["learn250", 250, 900, "Knowledge archive", "learned"], ["learn500", 500, 1500, "Master positioning", "learned"], ["images1", 1, 25, "First image", "images"], ["images10", 10, 100, "Image scout", "images"], ["images50", 50, 350, "Image analyst", "images"], ["images100", 100, 600, "Image master", "images"], ["unique25", 25, 100, "Broad beam", "unique"], ["unique100", 100, 300, "Study explorer", "unique"], ["unique250", 250, 600, "Question navigator", "unique"], ["unique500", 500, 1000, "Wide-field expert", "unique"]]);
 milestones.push(['guide1',1,25,'First positioning review','guideUnique'],['guide25',25,100,'Criteria scout','guideUnique'],['guide100',100,300,'Criteria specialist','guideUnique'],['guide500',500,750,'Positioning archive','guideUnique'],['guideComplete1',1,100,'Complete view','guideProjections'],['guideComplete10',10,300,'Projection rounds','guideProjections'],['guideComplete50',50,750,'Atlas navigator','guideProjections']);
 let earned=new Set(),guideProgressHTML='',achievementHTML='',bonusXP=0,awardStorageError=false;
 function validAward(id){return typeof id==='string'&&id.length<=240&&(milestones.some(m=>m[0]===id)||id.startsWith('category:'));}
 try{const saved=JSON.parse(localStorage.getItem(achievementKey)||'[]');if(Array.isArray(saved))earned=new Set(saved.filter(validAward).slice(0,1000));}catch{}
 function saveAwards(){try{localStorage.setItem(achievementKey,JSON.stringify([...earned]));awardStorageError=false;window.dispatchEvent(new Event('positioning-data-changed'));}catch{awardStorageError=true;}}
 function achievementIcon(kind){
  const center=kind==='category'?'<path d="m22 32 7 7 14-16"/>':kind==='images'?'<rect x="20" y="20" width="24" height="24" rx="2"/><circle cx="27" cy="27" r="2"/><path d="m22 40 8-9 5 5 5-6 3 10"/>':(kind==='learned'||kind==='guideUnique'||kind==='guideProjections')?'<path d="M32 23c-5-4-10-4-15-2v22c5-2 10-2 15 2 5-4 10-4 15-2V21c-5-2-10-2-15 2Zm0 0v22"/>':'<path d="M21 26v-5h5m12 0h5v5M21 38v5h5m12 0h5v-5M32 26v12m-6-6h12"/>';
  return '<svg width="56" height="56" viewBox="0 0 64 64" aria-hidden="true"><g fill="none" stroke="var(--blue)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="m32 4 24 14v28L32 60 8 46V18Z"/><path d="m32 10 19 11v22L32 54 13 43V21Z" opacity=".45"/>'+center+'</g></svg>';
 }
 function achievements(rows,pool){
  const guideStats=window.Guides?.stats()||{unique:0,projections:0,parts:[]};
  guideProgressHTML=guideStats.parts.length?'<details class="panel" style="margin-top:20px"><summary>Guide review progress · '+guideStats.projections+' projections fully reviewed</summary><p class="small muted">Each bar counts projections with every available criterion recalled correctly at least once.</p><div class="category-progress-grid">'+guideStats.parts.filter(p=>p.total>0).map(p=>'<article class="panel"><strong>'+esc(p.name)+'</strong><p class="small muted">'+p.completed+' / '+p.total+' projections</p><progress style="width:100%;accent-color:var(--blue)" aria-label="'+esc(p.name)+' guides reviewed" value="'+p.completed+'" max="'+p.total+'"></progress></article>').join('')+'</div></details>':'';
  const totals={correct:0,learned:0,images:0,unique:0,guideUnique:guideStats.unique,guideProjections:guideStats.projections};for(const row of rows.values())totals.correct+=row[1];
  const seen=new Set(),valid=pool.filter(q=>{
   const k=Progress.key(q);if(seen.has(k))return false;
   if(!q.prompt?.trim()||!q.answer?.trim()||!['mcq','short'].includes(q.type))return false;
   if(q.type==='mcq'&&(!Array.isArray(q.options)||q.options.length<2||!q.options.includes(q.answer)))return false;
   seen.add(k);return true;
  });
  for(const q of valid){const row=Progress.get(q);if(row[1]>0)totals.unique++;if(row[6]===3)totals.learned++;if(q.image&&row[1]>0)totals.images++;}
  const cards=[...milestones].sort((a,b)=>a[4].localeCompare(b[4])||a[1]-b[1]).map(([id,target,xp,title,kind])=>({id,target,xp,title,kind,value:totals[kind],description:kind==='guideUnique'?'different guide criteria recalled':kind==='guideProjections'?'projections with every criterion recalled':kind==='correct'?'correct answers':kind==='learned'?'cards learned':kind==='unique'?'different questions correct':'different image questions correct'}));
  for(const group of groups){
   const questions=valid.filter(q=>q.origin==='program'&&q.group===group.id);
   if(!questions.length||failedGroups.some(message=>message.startsWith(group.name+':')))continue;
   cards.push({id:'category:'+group.id,target:questions.length,value:questions.filter(q=>Progress.get(q)[6]===3).length,xp:300,title:group.name+' complete',kind:'category',description:'program cards learned'});
  }
  for(const part of guideStats.parts)if(part.total>0)cards.push({id:'category:guide:'+part.id,target:part.total,value:part.completed,xp:300,title:part.name+' guides complete',kind:'category',description:'projections fully reviewed'});
  let changed=false;for(const card of cards)if(card.target>0&&card.value>=card.target&&!earned.has(card.id)&&earned.size<1000){earned.add(card.id);changed=true;}
  if(changed)saveAwards();
  bonusXP=[...earned].reduce((sum,id)=>sum+(id.startsWith('category:')?300:milestones.find(m=>m[0]===id)?.[2]||0),0);
  achievementHTML='<h3 style="margin-top:24px">Milestone badges</h3><p class="small muted">'+earned.size+' earned · '+bonusXP.toLocaleString()+' bonus XP. Each badge awards its bonus once and stays earned. Question-category badges require every valid program card Learned. Guide-part badges require every available criterion in every projection recalled correctly; empty parts never qualify.</p><div class="rank-grid">'+cards.map(c=>'<article class="rank-item" style="padding:12px;border:1px solid var(--line);border-radius:12px;'+(earned.has(c.id)?'':'opacity:.65')+'">'+achievementIcon(c.kind)+'<strong>'+esc(c.title)+'</strong><span class="small">'+(earned.has(c.id)?'Earned · +'+c.xp+' XP':'Locked · '+c.xp+' XP')+'</span><span class="small muted">'+Math.min(c.value,c.target)+' / '+c.target+' '+c.description+'</span></article>').join('')+'</div>'+(awardStorageError?'<p class="small">Badge storage is unavailable. Export a progress backup to keep your awards.</p>':'');
 }

 function levelFor(xp){let level=1,remaining=xp;while(level<100){const cost=100*(1+Math.floor(level/10));if(remaining<cost)break;remaining-=cost;level++;}return {level,remaining,cost:100*(1+Math.floor(level/10)),rank:Math.floor(level/10)};}
 function badge(rank){
  // Small inline vectors: no image downloads, textures, or animation.
  let frame=rank<2?'<circle cx="50" cy="50" r="23"/>':'<path d="M50 23 73 36v28L50 77 27 64V36Z"/>';
  if(rank>=1)frame+='<path d="M32 39v-7h7m22 0h7v7M32 61v7h7m22 0h7v-7"/>';
  if(rank>=3)frame+='<path d="M50 17 79 33v34L50 83 21 67V33Z" stroke-width="1.5"/>';
  if(rank>=4)frame+='<path d="m18 39-7 11 7 11m64-22 7 11-7 11"/>';
  if(rank>=5)frame+='<path d="M50 5v7m-8-5 2 7m14-7-2 7M50 88v7m-8-2 2-7m14 7-2-7" stroke-width="1.5"/>';
  if(rank>=6)frame+='<path d="m38 18-17 7-5 9v32l9 12 14 9m23-69 17 7 5 9v32l-9 12-14 9"/>';
  if(rank>=7)frame+='<path d="m10 37-7 13 7 13m80-26 7 13-7 13M24 22l5-5h6m41 5-5-5h-6M24 78l5 5h6m41-5-5 5h-6" stroke-width="1.5"/>';
  if(rank>=8)frame+='<circle cx="50" cy="50" r="43" pathLength="100" stroke-dasharray="8 4.5" stroke-width="1" opacity=".65"/>';
  if(rank>=9)frame+='<path d="m19 28-8-8 15 3m55 5 8-8-15 3M19 72l-8 8 15-3m55-5 8 8-15-3M40 12 50 2l10 10M40 88l10 10 10-10"/>';
  if(rank===10)frame+='<path d="M27 12 31 19M73 12 69 19M27 88 31 81M73 88 69 81M3 32l8 4m86-4-8 4M3 68l8-4m86 4-8-4" stroke-width="1.5"/><path d="m50 25 3 5-3 5-3-5Zm0 40 3 5-3 5-3-5Z" fill="var(--blue)" stroke="none"/>';
  return '<svg viewBox="0 0 100 100" width="76" height="76" aria-hidden="true" focusable="false"><circle cx="50" cy="50" r="20" fill="var(--selected)"/><g fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+frame+'<path d="M50 42v16m-8-8h16" stroke-width="2.5"/></g></svg>';
 }

 function paint(){
 name=Preferences.getName();
 const host=document.getElementById('study-profile');if(!host)return;
 const s=levelFor(lastXP),pct=s.level===100?100:Math.floor(s.remaining/s.cost*100);
 host.innerHTML='<div class="profile-heading">'+badge(s.rank)+'<div><h2 id="profile-display"></h2><p>'+ranks[s.rank]+' · Level '+s.level+' / 100</p></div></div><div class="learning-meter" role="progressbar" aria-label="Progress toward next level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pct+'"><span style="width:'+pct+'%"></span></div><p class="small muted">'+lastXP.toLocaleString()+' total XP · '+(s.level===100?'Maximum rank reached':s.remaining+' / '+s.cost+' XP toward level '+(s.level+1))+'</p><form id="profile-form"><label for="profile-name">'+(name?'Profile name':'Create your study profile')+'</label><div class="profile-name-row"><input id="profile-name" maxlength="32" placeholder="Your name or nickname" required><button type="submit">'+(name?'Save name':'Create profile')+'</button></div></form><p id="profile-message" class="small" role="status"></p><p class="small muted">10 XP per correct answer or “Got it” flashcard, including previous saved answers. New ranks unlock every 10 levels, with a higher XP requirement each time. This is a local study profile saved in this browser.</p><details><summary>View all ranks</summary><div class="rank-grid">'+ranks.map((r,i)=>'<div class="rank-item">'+badge(i)+'<strong>'+r+'</strong><span class="small muted">Level '+(i===0?1:i*10)+'</span></div>').join('')+'</div></details>';
 host.insertAdjacentHTML('beforeend',guideProgressHTML+achievementHTML);
 document.getElementById('profile-display').textContent=name||'Your study profile';document.getElementById('profile-name').value=name;
 document.getElementById('profile-form').onsubmit=e=>{e.preventDefault();const value=document.getElementById('profile-name').value.trim();if(!value)return;const saved=save(value);paint();document.getElementById('profile-message').textContent=saved?'Profile saved.':'Browser storage is unavailable. Export your progress to keep a backup.';};
 }
 function render(rows,pool=[]){achievements(rows,pool);lastXP=bonusXP;for(const r of rows.values())lastXP+=r[1]*10;paint();}
 function restore(data){if(data&&typeof data.name==='string')save(data.name);if(Array.isArray(data?.achievements)){for(const id of data.achievements)if(validAward(id)&&earned.size<1000)earned.add(id);saveAwards();}}
 window.addEventListener('positioning-name-changed',()=>{if(document.getElementById('profile-form'))paint();});
 function cloudReload(){const list=JSON.parse(localStorage.getItem(achievementKey)||'[]');earned=new Set(Array.isArray(list)?list.filter(validAward).slice(0,1000):[]);name=Preferences.getName();}
 return {cloudReload,render,backup:()=>({name:Preferences.getName(),achievements:[...earned]}),restore,levelFor};
})();
