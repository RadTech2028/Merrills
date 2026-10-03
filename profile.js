'use strict';
const StudyProfile=(()=>{
 const key='positioning-profile-v1:'+location.pathname.replace(/\/?(?:index\.html)?$/,'/');
 const ranks=["Photon Scout", "Beam Explorer", "Collimation Cadet", "Projection Apprentice", "Anatomy Analyst", "Positioning Specialist", "Image Evaluator", "Exposure Expert", "Precision Master", "Imaging Elite", "Radiographic Legend"];
 let name='',lastXP=0;
 try{name=JSON.parse(localStorage.getItem(key)||'{}').name||'';}catch{}
 if(typeof name!=='string')name='';name=name.slice(0,32);
 function save(value){name=value.trim().slice(0,32);try{localStorage.setItem(key,JSON.stringify({name}));return true;}catch{return false;}}
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
 const host=document.getElementById('study-profile');if(!host)return;
 const s=levelFor(lastXP),pct=s.level===100?100:Math.floor(s.remaining/s.cost*100);
 host.innerHTML='<div class="profile-heading">'+badge(s.rank)+'<div><h2 id="profile-display"></h2><p>'+ranks[s.rank]+' · Level '+s.level+' / 100</p></div></div><div class="learning-meter" role="progressbar" aria-label="Progress toward next level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pct+'"><span style="width:'+pct+'%"></span></div><p class="small muted">'+lastXP.toLocaleString()+' total XP · '+(s.level===100?'Maximum rank reached':s.remaining+' / '+s.cost+' XP toward level '+(s.level+1))+'</p><form id="profile-form"><label for="profile-name">'+(name?'Profile name':'Create your study profile')+'</label><div class="profile-name-row"><input id="profile-name" maxlength="32" placeholder="Your name or nickname" required><button type="submit">'+(name?'Save name':'Create profile')+'</button></div></form><p id="profile-message" class="small" role="status"></p><p class="small muted">10 XP per correct answer or “Got it” flashcard, including previous saved answers. New ranks unlock every 10 levels, with a higher XP requirement each time. This is a local study profile saved in this browser.</p><details><summary>View all ranks</summary><div class="rank-grid">'+ranks.map((r,i)=>'<div class="rank-item">'+badge(i)+'<strong>'+r+'</strong><span class="small muted">Level '+(i===0?1:i*10)+'</span></div>').join('')+'</div></details>';
 document.getElementById('profile-display').textContent=name||'Your study profile';document.getElementById('profile-name').value=name;
 document.getElementById('profile-form').onsubmit=e=>{e.preventDefault();const value=document.getElementById('profile-name').value.trim();if(!value)return;const saved=save(value);paint();document.getElementById('profile-message').textContent=saved?'Profile saved.':'Browser storage is unavailable. Export your progress to keep a backup.';};
 }
 function render(rows){lastXP=0;for(const r of rows.values())lastXP+=r[1]*10;paint();}
 function restore(data){if(data&&typeof data.name==='string')save(data.name);}
 return {render,backup:()=>({name}),restore,levelFor};
})();
