'use strict';
const StudyProfile=(()=>{
 const key='positioning-profile-v1:'+location.pathname.replace(/\/?(?:index\.html)?$/,'/');
 const ranks=['Starter','Explorer','Learner','Practitioner','Achiever','Specialist','Strategist','Expert','Champion','Elite','Legend'];
 let name='',lastXP=0;
 try{name=JSON.parse(localStorage.getItem(key)||'{}').name||'';}catch{}
 if(typeof name!=='string')name='';name=name.slice(0,32);
 function save(value){name=value.trim().slice(0,32);try{localStorage.setItem(key,JSON.stringify({name}));return true;}catch{return false;}}
 function levelFor(xp){let level=1,remaining=xp;while(level<100){const cost=100*(1+Math.floor(level/10));if(remaining<cost)break;remaining-=cost;level++;}return {level,remaining,cost:100*(1+Math.floor(level/10)),rank:Math.floor(level/10)};}
 function badge(rank){return '<svg viewBox="0 0 64 72" width="58" height="66" aria-hidden="true"><path d="M32 3 59 14v23c0 16-27 32-27 32S5 53 5 37V14Z" fill="var(--selected)" stroke="var(--blue)" stroke-width="3"/><path d="m18 25 14-9 14 9M18 43l14 9 14-9" fill="none" stroke="var(--blue)" stroke-width="2"/><text x="32" y="41" text-anchor="middle" fill="var(--ink)" font-size="19" font-weight="700">'+(rank===10?'★':rank+1)+'</text></svg>';}
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
