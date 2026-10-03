'use strict';
// Load appearance before the stylesheets to avoid a bright flash on dark-theme visits.
const Preferences=(()=>{
 const key='positioning-preferences-v1:'+location.pathname.replace(/\/?(?:index\.html)?$/,'/');
 const defaults={version:1,theme:'system',accent:'blue',text:'standard',density:'comfortable',motion:false,name:'',mode:'practice',source:'program',images:'all',all:false,count:10,smart:true,autoLearn:false,shuffle:true,timer:false,minutes:10,welcomed:false};
 const choices={theme:['system','light','dark','sepia'],accent:['blue','teal','purple','amber'],text:['standard','large','extra'],density:['comfortable','compact'],mode:['practice','exam','cards'],source:['program','personal','both'],images:['all','only','none']};
 const dark=window.matchMedia('(prefers-color-scheme: dark)');
 let prefs={...defaults},storageError=false,step=0,returnFocus=null,lockedScroll=0,locking=false;
 const el=id=>document.getElementById(id);
 function sanitize(input){
  const clean={...defaults};if(!input||typeof input!=='object')return clean;
  for(const [k,values] of Object.entries(choices))if(values.includes(input[k]))clean[k]=input[k];
  for(const k of ['motion','all','smart','autoLearn','shuffle','timer','welcomed'])if(typeof input[k]==='boolean')clean[k]=input[k];
  for(const k of ['count','minutes'])if(Number.isSafeInteger(input[k])&&input[k]>=1&&(k!=='minutes'||input[k]<=180))clean[k]=input[k];
  if(typeof input.name==='string')clean.name=input.name.trim().slice(0,32);
  return clean;
 }
 try{prefs=sanitize(JSON.parse(localStorage.getItem(key)||'null'));}catch{storageError=true;}
 function status(message='Settings saved.'){const text=storageError?'Browser storage is unavailable. These settings apply for this visit only.':message;for(const id of ['preferences-status','welcome-status'])if(el(id))el(id).textContent=text;}
 function persist(){try{localStorage.setItem(key,JSON.stringify(prefs));storageError=false;}catch{storageError=true;}status();}
 function appearance(){
  const root=document.documentElement,theme=prefs.theme==='system'?(dark.matches?'dark':'light'):prefs.theme;
  root.dataset.theme=theme;root.dataset.accent=prefs.accent;root.dataset.text=prefs.text;root.dataset.density=prefs.density;root.dataset.motion=prefs.motion?'reduce':'normal';
  const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content={light:'#f5f7fb',dark:'#121922',sepia:'#f2eadb'}[theme];
  const greeting=el('personal-greeting');if(greeting){greeting.hidden=!prefs.name;greeting.textContent=prefs.name?'Welcome back, '+prefs.name+'.':'';}
 }
 appearance();if(dark.addEventListener)dark.addEventListener('change',appearance);else if(dark.addListener)dark.addListener(appearance);
 function study(){
  if(!el('session-mode'))return;
  for(const [id,value] of [['session-mode',prefs.mode],['session-source',prefs.source],['session-size',prefs.all?'all':'custom'],['custom-session-size',prefs.count],['timer-minutes',prefs.minutes]])el(id).value=String(value);
  for(const [id,value] of [['smart-review',prefs.smart],['shuffle',prefs.shuffle],['timer-enabled',prefs.timer],['images-only',prefs.images==='only'],['no-images-only',prefs.images==='none']])el(id).checked=value;
  el('timer-settings').hidden=!prefs.timer;el('custom-size-settings').hidden=prefs.all;
  if(!el('app').hidden){renderGroups();updateSetup();}
 }
 function ready(){study();appearance();}
 function lock(){if(locking)return;locking=true;lockedScroll=window.scrollY;document.body.classList.add('dialog-open');document.body.style.top='-'+lockedScroll+'px';}
 function unlock(){if(!locking||document.querySelector('dialog[open]'))return;locking=false;document.body.classList.remove('dialog-open');document.body.style.top='';window.scrollTo({top:lockedScroll,behavior:'instant'});}
 function open(dialog){returnFocus=document.activeElement;lock();dialog.showModal();}
 function closed(){if(document.querySelector('dialog[open]'))return;unlock();if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});}
 function visibility(){el('pref-count-field').hidden=prefs.all;el('pref-minutes-field').hidden=!prefs.timer;}
 function populate(){
  for(const k of Object.keys(choices))el('pref-'+k).value=prefs[k];
  for(const k of ['motion','all','smart','autoLearn','shuffle','timer'])el('pref-'+k).checked=prefs[k];
  for(const k of ['name','count','minutes'])el('pref-'+k).value=prefs[k];
  for(const k of ['count','minutes'])el('pref-'+k).setAttribute('aria-invalid','false');
  visibility();status('Changes save automatically.');
 }
 function change(k){
  const input=el('pref-'+k);let value=input.type==='checkbox'?input.checked:input.value;
  if(['count','minutes'].includes(k)){
   value=Number(value);if(!Number.isSafeInteger(value)||value<1||(k==='minutes'&&value>180)){input.setAttribute('aria-invalid','true');el('preferences-status').textContent=k==='minutes'?'Enter a whole number of minutes from 1 to 180.':'Enter a whole number of questions greater than zero.';return;}input.setAttribute('aria-invalid','false');
  }
  if(k==='name')value=value.trim().slice(0,32);
  prefs[k]=value;appearance();visibility();persist();
  if(['mode','source','images','all','count','smart','shuffle','timer','minutes'].includes(k))study();
 }
 function tour(){
  el('welcome-step').textContent='QUICK START · '+(step+1)+' OF 3';el('welcome-back').hidden=step===0;el('welcome-next').textContent=step===2?'Start studying':'Next';
  const pages=[
   '<div class="tour-symbol" aria-hidden="true">01</div><h2 id="welcome-title">Study the parts you need.</h2><p>Choose a category, then open <strong>Choose parts / topics</strong> to narrow it down. Pick your focus, question count, and whether to include images.</p><p class="small muted">Use Practice for immediate feedback, Test for feedback at the end, or Flashcards to check yourself.</p>',
   '<div class="tour-symbol" aria-hidden="true">02</div><h2 id="welcome-title">Keep track as you go.</h2><p><strong>Smart review</strong> gives more attention to new and missed questions. Mark a card <strong>Learned</strong> when you feel ready, or bookmark it for later.</p><label class="checkline"><input id="welcome-auto-learn" type="checkbox"> Automatically mark correct answers as learned</label><p class="small muted">Also applies to “Got it” on flashcards. You can change this in Settings anytime.</p><p class="small muted">Progress and personal questions stay in this browser. Back them up from My progress and My questions before changing devices or clearing browser data.</p>',
   '<div class="tour-symbol" aria-hidden="true">03</div><h2 id="welcome-title">Choose your look.</h2><p>Pick a theme and accent color. You can change these, text size, and study defaults in <strong>Settings</strong> anytime.</p><fieldset class="tour-palette"><legend>Theme</legend><div class="theme-choices">'+[['system','Device'],['light','Light'],['dark','Dark'],['sepia','Sepia']].map(([value,label])=>'<button type="button" data-tour-theme="'+value+'" aria-pressed="'+(prefs.theme===value)+'">'+label+'</button>').join('')+'</div></fieldset><fieldset class="tour-palette"><legend>Accent color</legend><div class="accent-choices">'+choices.accent.map(value=>'<button type="button" data-tour-accent="'+value+'" aria-pressed="'+(prefs.accent===value)+'"><span class="accent-dot '+value+'" aria-hidden="true"></span>'+value[0].toUpperCase()+value.slice(1)+'</button>').join('')+'</div></fieldset>'
  ];
  el('welcome-content').innerHTML=pages[step];
  const autoLearn=el('welcome-auto-learn');if(autoLearn){autoLearn.checked=prefs.autoLearn;autoLearn.onchange=()=>{prefs.autoLearn=autoLearn.checked;persist();};}
  document.querySelectorAll('.tour-dots span').forEach((dot,index)=>dot.classList.toggle('current',index===step));
  for(const field of ['theme','accent'])el('welcome-content').querySelectorAll('[data-tour-'+field+']').forEach(button=>button.onclick=()=>{
   prefs[field]=button.dataset[field==='theme'?'tourTheme':'tourAccent'];appearance();persist();
   el('welcome-content').querySelectorAll('[data-tour-'+field+']').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  });
  el('welcome-content').focus({preventScroll:true});
 }
 function finish(){prefs.welcomed=true;persist();el('welcome-dialog').close();}
 function showTour(){step=0;open(el('welcome-dialog'));tour();if(storageError)status();}
 function init(){
  appearance();study();
  el('open-settings').onclick=()=>{populate();open(el('settings-dialog'));el('settings-close').focus();};
  el('settings-close').onclick=()=>el('settings-dialog').close();
  for(const id of ['settings-dialog','welcome-dialog'])el(id).addEventListener('close',closed);
  el('welcome-dialog').addEventListener('cancel',event=>{event.preventDefault();finish();});
  for(const k of [...Object.keys(choices),'motion','all','smart','autoLearn','shuffle','timer','name','count','minutes'])el('pref-'+k).addEventListener('change',()=>change(k));
  el('welcome-next').onclick=()=>{if(step===2)finish();else{step++;tour();}};
  el('welcome-back').onclick=()=>{if(step){step--;tour();}};
  el('welcome-skip').onclick=finish;
  el('replay-tour').onclick=()=>{el('settings-dialog').close();showTour();returnFocus=el('open-settings');};
  el('reset-preferences').onclick=()=>{if(!confirm('Reset appearance and study settings? Your questions and progress will be kept.'))return;const welcomed=prefs.welcomed;prefs={...defaults,welcomed};appearance();study();populate();persist();};
  el('use-session-defaults').onclick=()=>{
   const size=el('session-size').value,count=Number(size==='custom'?el('custom-session-size').value:size),minutes=Number(el('timer-minutes').value);
   if(size!=='all'&&(!Number.isSafeInteger(count)||count<1)){status('Set a valid question count in Practice first.');return;}
   if(el('timer-enabled').checked&&(!Number.isSafeInteger(minutes)||minutes<1||minutes>180)){status('Set a timer between 1 and 180 minutes in Practice first.');return;}
   prefs={...prefs,mode:el('session-mode').value,source:el('session-source').value,images:el('images-only').checked?'only':el('no-images-only').checked?'none':'all',all:size==='all',count:size==='all'?prefs.count:count,smart:el('smart-review').checked,shuffle:el('shuffle').checked,timer:el('timer-enabled').checked,minutes:el('timer-enabled').checked?minutes:prefs.minutes};populate();persist();
  };
  if(!prefs.welcomed)showTour();
 }
 document.addEventListener('DOMContentLoaded',init,{once:true});
 return {ready,autoLearn:()=>prefs.autoLearn};
})();
