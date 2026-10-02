'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const newId=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
const normalize=s=>String(s).normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g,' ');
const shuffle=list=>{const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const safeImage=s=>typeof s==='string'&&(/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=\s]+$/i.test(s)||/^https:\/\//i.test(s)||(!/^[a-z][a-z\d+.-]*:|^\/\/|[\\<>]/i.test(s)&&!!s.trim()));
let TOPICS={},groups=[],baseGroups=[],baseTopics={},parts=[],bank=[],drafts=[],customGroups=[],customParts=[],customTopics={},selected=new Set(),focus=new Set(),session=null,timerHandle=null,browseLimit=50,personalLimit=50,failedGroups=[],storageWarning='';
const optionHTML=(obj,all)=>(all?'<option value="">'+esc(all)+'</option>':'')+Object.entries(obj).map(([v,t])=>'<option value="'+esc(v)+'">'+esc(t)+'</option>').join('');
const groupOptions=all=>optionHTML(Object.fromEntries(groups.map(g=>[g.id,g.name])),all);
const labelTopic=id=>TOPICS[id]||id;
const questionKey=q=>JSON.stringify([q.origin||'personal',q.group,q.id]);
function validateQuestions(data){
 if(!Array.isArray(data))throw new Error('Expected a JSON array of questions.');
 const seen=new Set();
 for(const [i,q] of data.entries()){
  const at='Question '+(i+1)+': ';
  if(!q||typeof q!=='object')throw new Error(at+'expected an object.');
  for(const k of ['id','projection','topic','prompt','answer','explanation'])if(typeof q[k]!=='string'||!q[k].trim())throw new Error(at+k+' is required.');
  if(seen.has(q.id))throw new Error(at+'duplicate ID '+q.id);seen.add(q.id);
  if(!['mcq','short'].includes(q.type))throw new Error(at+'type must be mcq or short.');
  if(q.type==='mcq'&&(!Array.isArray(q.options)||q.options.length<2||q.options.length>8||q.options.some(o=>typeof o!=='string'||!o.trim())||new Set(q.options.map(normalize)).size!==q.options.length||!q.options.includes(q.answer)))throw new Error(at+'enter 2–8 unique choices and select a correct answer.');
  if(q.part!==undefined&&(typeof q.part!=='string'||!q.part.trim()))throw new Error(at+'part must be a subcategory ID.');
  if(q.projectionId!==undefined&&typeof q.projectionId!=='string')throw new Error(at+'projectionId must be text.');
  if(q.acceptedAnswers&&(!Array.isArray(q.acceptedAnswers)||q.acceptedAnswers.some(a=>typeof a!=='string')))throw new Error(at+'acceptedAnswers must contain text values.');
  if(q.image&&(!safeImage(q.image.src)||typeof q.image.alt!=='string'||!q.image.alt.trim()))throw new Error(at+'an image needs a safe path and a description.');
 }
 return data;
}
function validatePersonal(list){
 if(!Array.isArray(list))throw new Error('Personal questions must be an array.');
 const seen=new Set();
 for(const q of list){validateQuestions([q]);if(typeof q.group!=='string'||!q.group)throw new Error('Every personal question needs a group.');
 const key=q.group+':'+q.id;if(seen.has(key))throw new Error('Duplicate personal question ID within a category.');seen.add(key);}
 return list;
}
async function getJSON(path){const r=await fetch(path,{cache:'no-cache'});if(!r.ok)throw new Error('Could not load '+path+' (HTTP '+r.status+').');return r.json();}
function personalQuestion(q){return {...q,origin:'personal'};}
function poolFor(source){return source==='personal'?drafts.map(personalQuestion):source==='both'?[...bank,...drafts.map(personalQuestion)]:bank;}
function refreshCatalogs(){
 Catalog.migratePersonal();
 groups=[...baseGroups,...customGroups.filter(g=>!baseGroups.some(b=>b.id===g.id))];TOPICS={...baseTopics,...customTopics};
 for(const q of drafts){
  if(!groups.some(g=>g.id===q.group)){const g={id:q.group,name:q.group,description:'Personal category'};customGroups.push(g);groups.push(g);}
  if(!TOPICS[q.topic]){TOPICS[q.topic]=q.topic.replace(/-/g,' ');customTopics[q.topic]=TOPICS[q.topic];}
 }
 for(const q of bank)if(!TOPICS[q.topic])TOPICS[q.topic]=q.topic.replace(/-/g,' ');
 Catalog.rebuild();
}
function persistPersonal(){
 try{localStorage.setItem('positioning-personal-v2',JSON.stringify({version:2,questions:drafts,groups:customGroups,subcategories:customParts,focuses:customTopics}));storageWarning='';return true;}
 catch{storageWarning='Browser storage is full or unavailable. Changes remain for this visit. Export a full backup now to keep them.';['personal-status','draft-status','builder-message'].forEach(id=>$(id).textContent=storageWarning);return false;}
}
async function init(){
 try{
  [baseGroups,baseTopics,parts]=await Promise.all([getJSON('./data/groups.json'),getJSON('./data/focuses.json'),getJSON('./data/projections.json')]);
  if(!Array.isArray(baseGroups)||!baseGroups.length)throw new Error('No categories found.');
  const seen=new Set();baseGroups.forEach(g=>{if(!g.id||!g.name||!g.file||seen.has(g.id))throw new Error('Categories need unique IDs, names, and paths.');seen.add(g.id);});
  const loaded=await Promise.allSettled(baseGroups.map(async g=>validateQuestions(await getJSON('./'+g.file)).map(q=>({...q,group:g.id,origin:'program'}))));
  loaded.forEach((r,i)=>{if(r.status==='fulfilled')bank.push(...r.value);else failedGroups.push(baseGroups[i].name+': '+r.reason.message);});
  try{
   const saved=localStorage.getItem('positioning-personal-v2');
   if(saved){const d=JSON.parse(saved);validatePersonal(d.questions);validateMetadata(d.groups||[],d.focuses||{});drafts=d.questions;customGroups=d.groups||[];customTopics=d.focuses||{};Catalog.validate(d.subcategories||[]);customParts=d.subcategories||[];}
   else{const old=JSON.parse(localStorage.getItem('positioning-drafts-v1')||'[]');validatePersonal(old);drafts=old;if(old.length)persistPersonal();}
  }catch(e){storageWarning='Saved personal data could not be read. Your stored copy has not been deleted. Restore an exported backup. '+e.message;$('personal-status').textContent=storageWarning;}
  refreshCatalogs();selected=new Set(groups.map(g=>g.id));focus=new Set(Object.keys(TOPICS));
  refreshControls();resetForm();refreshPersonalUI();
  $('loading').hidden=!failedGroups.length;if(failedGroups.length){$('loading').classList.add('error');$('loading').textContent='Some program categories could not load: '+failedGroups.join(' ');}
  $('app').hidden=false;
 }catch(e){$('loading').classList.add('error');$('loading').textContent=e.message+' Reload the page after checking the data files.';}
}
function refill(id,html){const old=$(id).value;$(id).innerHTML=html;if([...$(id).options].some(o=>o.value===old))$(id).value=old;}
function refreshControls(){
 Catalog.sync();$('bank-count').textContent=bank.length;
 for(const id of ['bank-group','personal-group'])refill(id,groupOptions('All categories'));
 refill('draft-group',groupOptions());refill('bank-topic',optionHTML(TOPICS,'All focuses'));refill('draft-topic',optionHTML(TOPICS));
 $('focus-list').innerHTML=Object.entries(TOPICS).map(([id,name])=>'<label class="chip"><input type="checkbox" value="'+esc(id)+'" '+(focus.has(id)?'checked':'')+'>'+esc(name)+'</label>').join('');
 renderGroups();updateSetup();renderBank();
}
function renderGroups(){Catalog.renderGroups();}
function showView(view){
 ['practice','quiz','results','browse','personal','builder','progress'].forEach(v=>$(v+'-view').hidden=v!==view);
 document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false');});
 if(view==='practice')updateSetup();if(view==='progress')Progress.render();if(view==='browse')renderBank();if(view==='personal')renderPersonal();if(view==='builder')renderDrafts();
 window.scrollTo({top:0});$('main').focus({preventScroll:true});
}
function matching(){return poolFor($('session-source').value).filter(q=>Catalog.include(q)&&focus.has(q.topic)&&(!$('images-only').checked||q.image)&&(!$('no-images-only').checked||!q.image)&&Progress.matches(q,$('study-filter').value));}
function sessionLimit(available){
 if($('session-size').value==='all')return available;
 const requested=Number($('session-size').value==='custom'?$('custom-session-size').value:$('session-size').value);
 return Number.isSafeInteger(requested)&&requested>0?Math.min(available,requested):null;
}
function updateSetup(){
 Progress.setup();
 const n=matching().length,count=sessionLimit(n),custom=$('session-size').value==='custom';
 $('custom-size-settings').hidden=!custom;
 $('custom-session-size').setAttribute('aria-invalid',String(custom&&count===null));
 $('match-count').textContent=n;$('start').disabled=!n||count===null;
 const requested=Number(custom?$('custom-session-size').value:$('session-size').value);
 $('session-hint').textContent=count===null?'Enter a whole number of questions greater than zero.':!n?'No questions match. Try another source, category, focus, or image filter.':requested>n?'Only '+n+' matching question'+(n===1?' is':'s are')+' available. You’ll study all '+n+'.':'You’ll study '+count+' question'+(count===1?'':'s')+'.';
 const eligible=poolFor($('session-source').value).filter(q=>Catalog.include(q)&&focus.has(q.topic));
 const imageCount=eligible.filter(q=>q.image).length;
 $('image-count').textContent='('+imageCount+' available)';
 $('no-image-count').textContent='('+(eligible.length-imageCount)+' available)';
 $('toggle-groups').textContent=Catalog.fullySelected()?'Clear all':'Select all';
 $('start').firstChild.textContent=({practice:'Start practice ',exam:'Start test ',cards:'Start flashcards '})[$('session-mode').value];
}
function stopTimer(){if(timerHandle!==null)clearInterval(timerHandle);timerHandle=null;}
function currentQuestion(){return session.mode==='cards'?session.queue[0]:session.items[session.index];}
function timerExpired(){if(session&&!session.finished&&session.deadline&&Date.now()>=session.deadline){finishSession('time');return true;}return false;}
function updateTimer(){
 if(!session||session.finished)return;
 if(timerExpired())return;
 const el=$('session-clock');if(!el||!session.deadline)return;
 const secs=Math.max(0,Math.ceil((session.deadline-Date.now())/1000));
 el.textContent=Math.floor(secs/60)+':'+String(secs%60).padStart(2,'0')+' left';el.classList.toggle('urgent',secs<=60);
}
function startSession(pool,mode,limit,doShuffle,from='practice',minutes=0){
 stopTimer();
 const items=Progress.pick(pool,limit,from==='practice'&&$('smart-review').checked,doShuffle).map(q=>({...q,options:q.options?(doShuffle?shuffle(q.options):[...q.options]):undefined}));
 if(!items.length)return;
 session={items,mode,index:0,queue:[...items],mastered:new Set(),responses:[],attempts:0,checked:false,from,finished:false,notice:'',deadline:minutes?Date.now()+minutes*60000:null};
 showView('quiz');renderQuiz();if(minutes){updateTimer();timerHandle=setInterval(updateTimer,250);}
}
function imageHTML(q){
 if(!q.image)return '';
 return '<button class="image-button" type="button" aria-label="Enlarge question image"><img class="question-image" loading="lazy" src="'+esc(q.image.src)+'" alt="'+esc(q.image.alt)+'"></button><p class="image-caption">'+esc(q.image.caption||'Question image')+' · Click to enlarge</p>';
}
function wireImages(root){
 root.querySelectorAll('.image-button').forEach(btn=>{const img=btn.querySelector('img');img.addEventListener('error',()=>{btn.disabled=true;btn.insertAdjacentHTML('afterend','<p class="error notice">Image unavailable. Check its file path or URL.</p>');},{once:true});btn.onclick=()=>{$('large-image').src=img.src;$('large-image').alt=img.alt;$('image-dialog').showModal();};});
}
function renderQuiz(){
 if(!session||session.finished)return;
 const q=currentQuestion(),{mode,items,index}=session;
 const done=mode==='cards'?session.mastered.size:index;
 const status=mode==='cards'?done+' / '+items.length+' mastered · '+session.queue.length+' left':(index+1)+' / '+items.length;
 $('quiz-view').innerHTML='<div class="quiz-wrap"><div class="quiz-header"><button id="exit-session" class="text-button">← End session</button><span class="muted small">'+(mode==='cards'?'FLASHCARDS':mode==='exam'?'TEST':'PRACTICE')+' · '+status+'</span>'+(session.deadline?'<span id="session-clock" class="timer-display" role="timer" aria-label="Session time remaining"></span>':'')+'</div><div class="progress-track" role="progressbar" aria-label="Session progress" aria-valuemin="0" aria-valuemax="'+items.length+'" aria-valuenow="'+done+'"><div class="progress-fill" style="width:'+(done/items.length*100)+'%"></div></div>'+(session.notice?'<p class="requeue-note" role="status">'+esc(session.notice)+'</p>':'')+'<div class="question-card"><div class="question-tags"><span class="pill">'+esc(groups.find(g=>g.id===q.group)?.name||'Personal category')+'</span><span class="pill">'+esc(labelTopic(q.topic))+'</span><span class="pill">'+(q.origin==='program'?'Program bank':session.from==='preview'?'Unsaved preview':'My questions')+'</span></div><h1>'+esc(q.prompt)+'</h1>'+imageHTML(q)+(mode==='cards'?'<button id="reveal" class="primary">Reveal answer</button><div id="card-answer" hidden></div>':'<form id="answer-form">'+(q.type==='mcq'?'<fieldset class="options" style="border:0;padding:0;margin:0"><legend class="skip">Choose one answer</legend>'+q.options.map((a,i)=>'<label class="option"><input type="radio" name="answer" value="'+i+'" required><span>'+esc(a)+'</span></label>').join('')+'</fieldset>':'<label for="short-answer">Your answer</label><input id="short-answer" autocomplete="off" required><p class="small muted">Case and extra spaces do not matter. Accepted wording is set by the author.</p>')+'<div class="actions"><button type="submit" class="primary">'+(mode==='exam'?'Save answer':'Check answer')+'</button><button type="button" id="skip-question">Skip</button></div></form>')+'<div id="feedback" role="status"></div><div class="actions"><button id="next-question" class="primary" hidden>'+(index===items.length-1?'See results':'Next question →')+'</button></div></div></div>';
 $('exit-session').onclick=()=>{if(confirm('End this session and view your progress?'))finishSession('ended');};
 wireImages($('quiz-view'));
 if(session.from!=='preview'){$('feedback').insertAdjacentHTML('afterend',Progress.controls(q,false));Progress.wire($('quiz-view'),[q]);}
 if(mode==='cards')$('reveal').onclick=()=>{if(timerExpired())return;$('reveal').hidden=true;$('card-answer').hidden=false;$('card-answer').innerHTML='<div class="feedback"><strong>'+esc(q.answer)+'</strong><p>'+esc(q.explanation)+'</p><p class="small muted">'+esc(q.source||'')+'</p></div><div class="actions"><button id="card-again">Study again</button><button id="card-known" class="primary">Got it</button></div>';$('card-again').onclick=()=>recordCard(false);$('card-known').onclick=()=>recordCard(true);};
 else{$('answer-form').onsubmit=e=>{e.preventDefault();checkAnswer();};$('skip-question').onclick=()=>checkAnswer(true);}
 $('next-question').onclick=nextQuestion;updateTimer();
}
function recordCard(correct){
 if(!session||session.finished||session.checked||timerExpired())return;
 session.checked=true;const q=session.queue.shift(),key=questionKey(q);session.attempts++;Progress.record(q,correct);
 const response={q,answer:correct?'Got it':'Study again',correct,skipped:false};
 const previous=session.responses.findIndex(r=>questionKey(r.q)===key);if(previous>=0)session.responses[previous]=response;else session.responses.push(response);
 if(correct){session.mastered.add(key);session.notice='';}else{session.queue.push(q);session.notice=session.queue.length===1?'This is your last remaining card. It will repeat until you mark “Got it”.':'Card returned to the end of the pile. It will come back until you mark “Got it”.';}
 session.checked=false;if(session.queue.length)renderQuiz();else finishSession('complete');
}
function checkAnswer(skipped=false){
 if(!session||session.finished||session.checked||timerExpired())return;
 const q=currentQuestion();let answer='';
 if(!skipped){if(q.type==='mcq'){const input=document.querySelector('input[name="answer"]:checked');if(!input)return;answer=q.options[Number(input.value)];}else{answer=$('short-answer').value.trim();if(!answer)return;}}
 const correct=!skipped&&(q.type==='mcq'?answer===q.answer:[q.answer,...(q.acceptedAnswers||[])].some(a=>normalize(a)===normalize(answer)));
 session.checked=true;session.responses.push({q,answer,correct,skipped});Progress.record(q,correct,skipped);
 $('answer-form').querySelectorAll('input,button').forEach(el=>el.disabled=true);
 if(session.mode==='practice'){
 document.querySelectorAll('.option').forEach((el,i)=>{if(q.options[i]===q.answer)el.classList.add('correct');else if(q.options[i]===answer)el.classList.add('incorrect');});
 $('feedback').innerHTML='<div class="feedback '+(correct?'':'wrong')+'"><strong>'+(skipped?'Skipped':correct?'Correct':'Not quite')+'</strong><p>Answer: '+esc(q.answer)+'</p><p>'+esc(q.explanation)+'</p><p class="small muted">'+esc(q.source||'')+'</p></div>';
 }else $('feedback').textContent=skipped?'Question skipped.':'Answer saved. Feedback appears in your results.';
 $('next-question').hidden=false;$('next-question').focus();
}
function nextQuestion(){if(!session||session.finished||timerExpired())return;session.index++;session.checked=false;if(session.index>=session.items.length)finishSession('complete');else renderQuiz();}
function finishSession(reason){
 if(!session||session.finished)return;stopTimer();session.finished=true;session.reason=reason;
 const latest=new Map(session.responses.map(r=>[questionKey(r.q),r]));
 session.review=session.items.map(q=>latest.get(questionKey(q))||{q,answer:'Not attempted',correct:false,unattempted:true});
 renderResults();
}
function reviewHTML(r){return '<details class="review-item"><summary><span class="'+(r.correct?'status-good':'status-bad')+'">'+(r.correct?'✓':'○')+'</span> '+esc(r.q.prompt)+'</summary>'+imageHTML(r.q)+'<p><strong>Your response:</strong> '+esc(r.unattempted?'Not attempted':r.skipped?'Skipped':r.answer)+'</p><p><strong>Answer:</strong> '+esc(r.q.answer)+'</p><p>'+esc(r.q.explanation)+'</p><p class="muted small">'+esc(r.q.source||'')+'</p>'+(session.from==='preview'?'':Progress.controls(r.q))+'</details>';}
function renderResultReview(){
 const shown=session.review.slice(0,session.reviewLimit||50);
 $('result-review-list').innerHTML=shown.map(reviewHTML).join('');
 $('result-review-more').hidden=shown.length>=session.review.length;
 wireImages($('result-review-list'));Progress.wire($('result-review-list'),shown.map(r=>r.q));
}
function renderResults(){
 const rs=session.review,correct=rs.filter(r=>r.correct).length,missed=rs.filter(r=>!r.correct),unattempted=rs.filter(r=>r.unattempted).length,isCards=session.mode==='cards';
 showView('results');
 $('results-view').innerHTML='<div class="quiz-wrap"><div class="eyebrow">SESSION / RESULTS</div><h1>'+(session.reason==='time'?'Time’s up.':isCards&&!missed.length?'Every card mastered.':'Session complete.')+'</h1><div class="results-score">'+Math.round(correct/rs.length*100)+'%</div><p class="muted">'+correct+' of '+rs.length+' '+(isCards?'cards marked “Got it” (self-assessed)':'questions correct')+' · '+unattempted+' not attempted'+(isCards?' · '+session.attempts+' card reviews':'')+'</p><div class="actions"><button id="new-session" class="primary">Back to '+(['builder','preview'].includes(session.from)?'builder':'setup')+'</button><button id="retry-missed" '+(!missed.length?'disabled':'')+'>'+(isCards?'Continue '+missed.length+' remaining':'Review '+missed.length+' missed / unfinished')+'</button></div><div class="section-line second"><h2>Session review</h2></div>'+'<div id="result-review-list"></div><button id="result-review-more" hidden>Show 50 more</button></div>';
 $('new-session').onclick=()=>{const from=['builder','preview'].includes(session.from)?'builder':'practice';session=null;showView(from);};
 $('retry-missed').onclick=()=>startSession(missed.map(r=>r.q),session.mode,missed.length,true,session.from);
 renderResultReview();$('result-review-more').onclick=()=>{session.reviewLimit=(session.reviewLimit||50)+50;renderResultReview();};
}
function questionDetail(q,allowCopy=false){
 return '<details class="review-item"><summary>'+esc(q.prompt)+'<span class="origin-badge">'+(q.origin==='program'?'Program':'Personal')+'</span></summary><p class="small muted">'+esc(Catalog.label(q))+' · '+esc(q.projection)+' · '+esc(labelTopic(q.topic))+(q.customProjection?' · Custom':'')+'</p>'+imageHTML(q)+'<p><strong>Answer:</strong> '+esc(q.answer)+'</p><p>'+esc(q.explanation)+'</p><p class="small muted">'+esc(q.source||'')+'</p>'+Progress.controls(q)+(allowCopy&&q.origin==='program'?'<button class="copy-program" data-key="'+esc(questionKey(q))+'">Copy to My questions</button>':'')+'</details>';
}
function renderBank(){
 Catalog.refillFilter('bank-part',$('bank-group').value);
 const search=normalize($('bank-search').value),g=$('bank-group').value,t=$('bank-topic').value;
 const found=poolFor($('bank-source').value).filter(q=>(!g||q.group===g)&&(!t||q.topic===t)&&(!search||normalize([q.prompt,q.projection,q.answer,q.explanation].join(' ')).includes(search))&&Catalog.matches(q,$('bank-part').value)&&Progress.matches(q,$('bank-progress').value));
 $('browse-count').textContent=found.length+' questions · showing '+Math.min(browseLimit,found.length);$('bank-more').hidden=found.length<=browseLimit;
 $('bank-list').innerHTML=found.length?found.slice(0,browseLimit).map(q=>questionDetail(q,true)).join(''):'<div class="empty">No questions match these filters.</div>';wireImages($('bank-list'));Progress.wire($('bank-list'),found.slice(0,browseLimit));
 $('bank-list').querySelectorAll('.copy-program').forEach(btn=>btn.onclick=()=>{const q=bank.find(q=>questionKey(q)===btn.dataset.key);if(!q)return;const copy={...cleanQuestion(q),group:q.group,id:'q-'+newId()};drafts.push(copy);persistPersonal();refreshPersonalUI();btn.textContent='Copied to My questions';btn.disabled=true;});
}
function refreshPersonalUI(){refreshCatalogs();renderGroups();updateSetup();renderDrafts();renderPersonal();}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{if(session&&!session.finished&&!confirm('Leave this session? Saved answers and card marks will be kept; the unfinished session will end.'))return;stopTimer();session=null;showView(b.dataset.view);});
$('group-grid').onchange=e=>Catalog.change(e.target);
$('focus-list').onchange=e=>{if(e.target.checked)focus.add(e.target.value);else focus.delete(e.target.value);updateSetup();};
$('toggle-groups').onclick=()=>{Catalog.all(!Catalog.fullySelected());renderGroups();updateSetup();};
['session-size','session-mode'].forEach(id=>$(id).onchange=updateSetup);
$('custom-session-size').oninput=updateSetup;
['images-only','no-images-only'].forEach((id,index,ids)=>$(id).onchange=()=>{if($(id).checked)$(ids[1-index]).checked=false;updateSetup();});
$('session-source').onchange=()=>{renderGroups();updateSetup();};
$('timer-enabled').onchange=()=>$('timer-settings').hidden=!$('timer-enabled').checked;
$('start').onclick=()=>{
 const minutes=$('timer-enabled').checked?Number($('timer-minutes').value):0;
 if($('timer-enabled').checked&&(!Number.isFinite(minutes)||minutes<1||minutes>180||!Number.isInteger(minutes))){$('session-hint').textContent='Choose a whole number of minutes between 1 and 180.';return;}
 const pool=matching(),limit=sessionLimit(pool.length);
 if(limit===null||!pool.length){updateSetup();return;}
 startSession(pool,$('session-mode').value,limit,$('shuffle').checked,'practice',minutes);
};
['bank-search','bank-group','bank-part','bank-topic','bank-source'].forEach(id=>$(id).addEventListener(id==='bank-search'?'input':'change',()=>{browseLimit=50;renderBank();}));
$('bank-more').onclick=()=>{browseLimit+=50;renderBank();};
$('close-image').onclick=()=>$('image-dialog').close();
document.addEventListener('visibilitychange',updateTimer);
window.addEventListener('pagehide',stopTimer);
window.addEventListener('pageshow',()=>{if(session&&!session.finished&&session.deadline){updateTimer();if(!session.finished&&timerHandle===null)timerHandle=setInterval(updateTimer,250);}});
