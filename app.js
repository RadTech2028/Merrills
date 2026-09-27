'use strict';
const $ = id => document.getElementById(id);
const TOPICS = {'central-ray':'Central ray','positioning':'Positioning','purpose':'Purpose','evaluation':'Evaluation criteria'};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize = s => String(s).normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g,' ');
const shuffle = list => { const a=[...list]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a; };
const safeImage = s => typeof s==='string' && ((/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=\s]+$/i.test(s)) || (/^https:\/\//i.test(s)) || (!/^[a-z][a-z\d+.-]*:|^\/\/|[\\<>]/i.test(s) && s.trim().length>0));
let groups=[], bank=[], selected=new Set(), focus=new Set(Object.keys(TOPICS)), session=null, drafts=[], editId=null, uploadImage='', browseLimit=50, failedGroups=[];
function options(obj,all){return (all?'<option value="">'+all+'</option>':'')+Object.entries(obj).map(([v,t])=>'<option value="'+esc(v)+'">'+esc(t)+'</option>').join('');}
function groupOptions(all){return options(Object.fromEntries(groups.map(g=>[g.id,g.name])),all);}
function validateQuestions(data) {
 if(!Array.isArray(data)) throw new Error('The question file must contain a JSON array.');
 const ids=new Set();
 data.forEach((q,i)=>{
  const at='Question '+(i+1)+': ';
  if(!q||typeof q!=='object')throw new Error(at+'expected an object.');
  for(const k of ['id','projection','prompt','answer','explanation'])if(typeof q[k]!=='string'||!q[k].trim())throw new Error(at+k+' is required.');
  if(ids.has(q.id))throw new Error(at+'duplicate ID '+q.id);ids.add(q.id);
  if(!TOPICS[q.topic])throw new Error(at+'unknown topic.');
  if(!['mcq','short'].includes(q.type))throw new Error(at+'type must be mcq or short.');
  if(q.type==='mcq'&&(!Array.isArray(q.options)||q.options.length<2||q.options.length>8||q.options.some(o=>typeof o!=='string'||!o.trim())||new Set(q.options.map(normalize)).size!==q.options.length||!q.options.includes(q.answer)))throw new Error(at+'provide 2–8 unique choices and an answer that matches a choice exactly.');
  if(q.acceptedAnswers && (!Array.isArray(q.acceptedAnswers)||q.acceptedAnswers.some(a=>typeof a!=='string')))throw new Error(at+'acceptedAnswers must be an array of strings.');
  if(q.image&&(!safeImage(q.image.src)||typeof q.image.alt!=='string'||!q.image.alt.trim()))throw new Error(at+'provide a safe image path and image description.');
 });
 return data;
}
async function getJSON(path){const r=await fetch(path,{cache:'no-cache'});if(!r.ok)throw new Error('Could not load '+path+' (HTTP '+r.status+').');return r.json();}
async function init(){
 try{
  groups=await getJSON('./data/groups.json');
  if(!Array.isArray(groups)||!groups.length)throw new Error('No anatomy groups found.');
  const seen=new Set();
  groups.forEach(g=>{if(!g.id||!g.name||!g.file||seen.has(g.id))throw new Error('Each group needs a unique id, name, and file.');seen.add(g.id);});
  const loaded=await Promise.allSettled(groups.map(async g=>validateQuestions(await getJSON('./'+g.file)).map(q=>({...q,group:g.id,key:g.id+':'+q.id}))));
  loaded.forEach((r,i)=>{if(r.status==='fulfilled')bank.push(...r.value);else failedGroups.push(groups[i].name+': '+r.reason.message);});
  if(!bank.length)throw new Error(failedGroups.join(' '));
  selected=new Set(groups.map(g=>g.id));
  $('bank-count').textContent=bank.length;
  $('group-grid').innerHTML=groups.map((g,i)=>'<label class="group-card"><div class="group-top"><span class="group-number">'+String(i+1).padStart(2,'0')+'</span><input type="checkbox" checked value="'+esc(g.id)+'" aria-label="'+esc(g.name)+'"></div><strong>'+esc(g.name)+'</strong><small>'+esc(g.description||'')+'</small><span class="count">'+bank.filter(q=>q.group===g.id).length+' questions</span></label>').join('');
  $('focus-list').innerHTML=Object.entries(TOPICS).map(([k,v])=>'<label class="chip"><input type="checkbox" checked value="'+k+'">'+v+'</label>').join('');
  $('bank-group').innerHTML=groupOptions('All anatomy');$('draft-group').innerHTML=groupOptions();
  $('bank-topic').innerHTML=options(TOPICS,'All topics');$('draft-topic').innerHTML=options(TOPICS);
  try {const stored=JSON.parse(localStorage.getItem('positioning-drafts-v1')||'[]');if(Array.isArray(stored)){stored.forEach(q=>validateQuestions([q]));drafts=stored;}}catch{ $('draft-status').textContent='Saved drafts could not be read. Import your last exported file to recover them.'; }
  $('loading').hidden=!failedGroups.length;if(failedGroups.length){$('loading').classList.add('error');$('loading').textContent='Some groups could not load: '+failedGroups.join(' ');}
  $('app').hidden=false;updateSetup();renderBank();renderDrafts();
 }catch(e){$('loading').classList.add('error');$('loading').textContent=e.message+' Serve the folder using GitHub Pages or a local web server, then reload.';}
}
function showView(view){
 ['practice','quiz','results','browse','builder'].forEach(v=>$(v+'-view').hidden=v!==view);
 document.querySelectorAll('.nav').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);b.setAttribute('aria-current',b.dataset.view===view?'page':'false');});
 if(view==='browse')renderBank();if(view==='builder')renderDrafts();
 window.scrollTo({top:0});$('main').focus({preventScroll:true});
}
function matching(){return bank.filter(q=>selected.has(q.group)&&focus.has(q.topic)&&(!$('images-only').checked||q.image));}
function updateSetup(){
 const n=matching().length;$('match-count').textContent=n;$('start').disabled=!n;
 const count=$('session-size').value==='all'?n:Math.min(n,Number($('session-size').value));
 $('session-hint').textContent=n?'You’ll study '+count+' question'+(count===1?'':'s')+'.':'Choose an anatomy group and a focus with available questions.';
 $('image-count').textContent='('+bank.filter(q=>selected.has(q.group)&&focus.has(q.topic)&&q.image).length+' available)';
 $('toggle-groups').textContent=selected.size===groups.length?'Clear all':'Select all';
 $('start').firstChild.textContent=({'practice':'Start practice ','exam':'Start test ','cards':'Start flashcards '})[$('session-mode').value];
}
function startSession(pool,mode,limit,doShuffle,from='practice'){
 const items=(doShuffle?shuffle(pool):[...pool]).slice(0,limit).map(q=>({...q,options:q.options?(doShuffle?shuffle(q.options):[...q.options]):undefined}));
 if(!items.length)return;
 session={items,mode,index:0,responses:[],checked:false,revealed:false,from};showView('quiz');renderQuiz();
}
function imageHTML(q){
 if(!q.image)return '';
 return '<button class="image-button" type="button" aria-label="Enlarge question image"><img class="question-image" src="'+esc(q.image.src)+'" alt="'+esc(q.image.alt)+'"></button><p class="image-caption">'+esc(q.image.caption||'Question image')+' · Click to enlarge</p>';
}
function wireImages(root){
 root.querySelectorAll('.image-button').forEach(btn=>{
  const img=btn.querySelector('img');
  img.addEventListener('error',()=>{btn.disabled=true;btn.insertAdjacentHTML('afterend','<p class="error notice">Image unavailable. Check the file path or URL.</p>');},{once:true});
  btn.onclick=()=>{$('large-image').src=img.src;$('large-image').alt=img.alt;$('image-dialog').showModal();};
 });
}
function renderQuiz(){
 const {items,index,mode}=session,q=items[index];
 $('quiz-view').innerHTML='<div class="quiz-wrap"><div class="quiz-header"><button id="exit-session" class="text-button">← End session</button><span class="muted small">'+(mode==='cards'?'FLASHCARDS':mode==='exam'?'TEST':'PRACTICE')+' · '+(index+1)+' / '+items.length+'</span></div><div class="progress-track" role="progressbar" aria-label="Session progress" aria-valuemin="0" aria-valuemax="'+items.length+'" aria-valuenow="'+index+'"><div class="progress-fill" style="width:'+(index/items.length*100)+'%"></div></div><div class="question-card"><div class="question-tags"><span class="pill">'+esc(groups.find(g=>g.id===q.group)?.name||'Draft group')+'</span><span class="pill">'+esc(TOPICS[q.topic])+'</span>'+(session.from==='builder'?'<span class="pill">Draft preview</span>':'')+'</div><h1>'+esc(q.prompt)+'</h1>'+imageHTML(q)+(mode==='cards'?'<button id="reveal" class="primary">Reveal answer</button><div id="card-answer" hidden></div>':'<form id="answer-form">'+(q.type==='mcq'?'<fieldset class="options" style="border:0;padding:0;margin:0"><legend class="skip">Choose one answer</legend>'+q.options.map((a,i)=>'<label class="option"><input type="radio" name="answer" value="'+i+'" required><span>'+esc(a)+'</span></label>').join('')+'</fieldset>':'<label for="short-answer">Your answer</label><input id="short-answer" name="shortAnswer" autocomplete="off" required><p class="small muted">Case and extra spaces do not matter. Accepted wording is set by the question author.</p>')+'<div class="actions"><button type="submit" class="primary" id="submit-answer">'+(mode==='exam'?'Save answer':'Check answer')+'</button><button type="button" id="skip-question">Skip</button></div></form>')+'<div id="feedback" role="status"></div><div class="actions"><button id="next-question" class="primary" hidden>'+(index===items.length-1?'See results':'Next question →')+'</button></div></div></div>';
 $('exit-session').onclick=()=>{if(confirm('End this session? Results will include only the questions you answered or skipped.'))renderResults();};
 wireImages($('quiz-view'));
 if(mode==='cards')$('reveal').onclick=()=>{
  session.revealed=true;$('reveal').hidden=true;$('card-answer').hidden=false;
  $('card-answer').innerHTML='<div class="feedback"><strong>'+esc(q.answer)+'</strong><p>'+esc(q.explanation)+'</p><p class="small muted">'+esc(q.source||'')+'</p></div><div class="actions"><button id="card-again">Study again</button><button id="card-known" class="primary">Got it</button></div>';
  $('card-again').onclick=()=>recordCard(false);$('card-known').onclick=()=>recordCard(true);
 };else{
  $('answer-form').onsubmit=e=>{e.preventDefault();checkAnswer();};
  $('skip-question').onclick=()=>checkAnswer(true);
 }
 $('next-question').onclick=nextQuestion;
}
function recordCard(correct){if(session.checked)return;session.checked=true;session.responses.push({q:session.items[session.index],answer:correct?'Got it':'Study again',correct,skipped:false});nextQuestion();}
function checkAnswer(skipped=false){
 if(session.checked)return;
 const q=session.items[session.index];let answer='';
 if(!skipped){if(q.type==='mcq'){const input=document.querySelector('input[name="answer"]:checked');if(!input)return;answer=q.options[Number(input.value)];}else{answer=$('short-answer').value.trim();if(!answer)return;}}
 const correct=!skipped&&(q.type==='mcq'?answer===q.answer:[q.answer,...(q.acceptedAnswers||[])].some(a=>normalize(a)===normalize(answer)));
 session.checked=true;session.responses.push({q,answer,correct,skipped});
 $('answer-form').querySelectorAll('input,button').forEach(el=>el.disabled=true);
 if(session.mode==='practice'){
  document.querySelectorAll('.option').forEach((el,i)=>{if(q.options[i]===q.answer)el.classList.add('correct');else if(q.options[i]===answer)el.classList.add('incorrect');});
  $('feedback').innerHTML='<div class="feedback '+(correct?'':'wrong')+'"><strong>'+(skipped?'Skipped':correct?'Correct':'Not quite')+'</strong><p>Answer: '+esc(q.answer)+'</p><p>'+esc(q.explanation)+'</p><p class="small muted">'+esc(q.source||'')+'</p></div>';
 }else $('feedback').textContent=skipped?'Question skipped.':'Answer saved. Feedback appears in your results.';
 $('next-question').hidden=false;$('next-question').focus();
}
function nextQuestion(){session.index++;session.checked=false;session.revealed=false;if(session.index>=session.items.length)renderResults();else renderQuiz();}
function reviewHTML(r){
 return '<details class="review-item"><summary><span class="'+(r.correct?'status-good':'status-bad')+'">'+(r.correct?'✓':'○')+'</span> '+esc(r.q.prompt)+'</summary>'+imageHTML(r.q)+'<p><strong>Your response:</strong> '+esc(r.skipped?'Skipped':r.answer)+'</p><p><strong>Answer:</strong> '+esc(r.q.answer)+'</p><p>'+esc(r.q.explanation)+'</p><p class="muted small">'+esc(r.q.source||'')+'</p></details>';
}
function renderResults(){
 const rs=session.responses,correct=rs.filter(r=>r.correct).length,missed=rs.filter(r=>!r.correct);
 showView('results');
 $('results-view').innerHTML='<div class="quiz-wrap"><div class="eyebrow">SESSION / RESULTS</div><h1>'+(rs.length?'Keep building your recall.':'Session ended.')+'</h1><div class="results-score">'+(rs.length?Math.round(correct/rs.length*100)+'%':'—')+'</div><p class="muted">'+correct+' of '+rs.length+' '+(session.mode==='cards'?'cards marked “Got it” (self-assessed)':'answered or skipped questions correct')+' · '+(session.items.length-rs.length)+' not attempted</p><div class="actions"><button id="new-session" class="primary">Back to '+(session.from==='builder'?'builder':'setup')+'</button><button id="retry-missed" '+(!missed.length?'disabled':'')+'>Review '+missed.length+' missed</button></div><div class="section-line second"><h2>Session review</h2></div>'+rs.map(reviewHTML).join('')+'</div>';
 $('new-session').onclick=()=>{const from=session.from;session=null;showView(from);};
 $('retry-missed').onclick=()=>startSession(missed.map(r=>r.q),session.mode,missed.length,true,session.from);
 wireImages($('results-view'));
}
function renderBank(){
 const search=normalize($('bank-search').value),group=$('bank-group').value,topic=$('bank-topic').value;
 const found=bank.filter(q=>(!group||q.group===group)&&(!topic||q.topic===topic)&&(!search||normalize([q.prompt,q.projection,q.answer,q.explanation].join(' ')).includes(search)));
 $('browse-count').textContent=found.length+' questions · showing '+Math.min(browseLimit,found.length);$('bank-more').hidden=found.length<=browseLimit;
 $('bank-list').innerHTML=found.length?found.slice(0,browseLimit).map(q=>'<details class="review-item"><summary>'+esc(q.prompt)+'</summary><p class="small muted">'+esc(q.projection)+' · '+esc(TOPICS[q.topic])+'</p>'+imageHTML(q)+'<p><strong>Answer:</strong> '+esc(q.answer)+'</p><p>'+esc(q.explanation)+'</p><p class="small muted">'+esc(q.source||'')+'</p></details>').join(''):'<div class="empty">No questions match these filters.</div>';
 wireImages($('bank-list'));
}
function persistDrafts(){try{localStorage.setItem('positioning-drafts-v1',JSON.stringify(drafts));return true;}catch{$('draft-status').textContent='Browser storage is full or unavailable. Your drafts are still here for this visit. Export now to keep them.';return false;}}
function cleanQuestion(q){const {group,key,...clean}=q;return clean;}
function renderDrafts(){
 const active=drafts.filter(q=>q.group===$('draft-group').value);
 $('draft-count').textContent=active.length;$('export-drafts').disabled=!active.length;$('preview-drafts').disabled=!active.length;
 $('draft-list').innerHTML=active.length?active.map(q=>'<div class="draft-item"><span class="small muted">'+esc(q.projection)+'</span><p>'+esc(q.prompt)+'</p><button type="button" data-edit="'+esc(q.id)+'">Edit</button> <button type="button" data-delete="'+esc(q.id)+'">Delete</button></div>').join(''):'<p class="empty small">No drafts in this group yet.</p>';
 $('draft-list').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editDraft(b.dataset.edit));
 $('draft-list').querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{if(confirm('Delete this draft question?')){drafts=drafts.filter(q=>!(q.id===b.dataset.delete&&q.group===$('draft-group').value));if(editId===b.dataset.delete)resetForm();persistDrafts();renderDrafts();}});
}
function resetForm(){
 const g=$('draft-group').value;$('builder-form').reset();$('draft-group').value=g;editId=null;uploadImage='';$('draft-image-preview').hidden=true;$('save-draft').textContent='Add to draft bank';$('cancel-edit').hidden=true;syncType();
}
function syncType(){const short=$('draft-type').value==='short';$('options-fields').hidden=short;$('aliases-fields').hidden=!short;$('draft-answer').previousElementSibling.innerHTML='Correct answer'+(short?'':' <span class="muted small">(match one choice exactly)</span>');}
function editDraft(id){
 const q=drafts.find(q=>q.id===id&&q.group===$('draft-group').value);if(!q)return;editId=id;
 for(const [field,key] of [['projection','projection'],['type','type'],['topic','topic'],['prompt','prompt'],['answer','answer'],['explanation','explanation'],['source','source']])$('draft-'+field).value=q[key]||'';
 $('draft-options').value=(q.options||[]).join('\n');$('draft-aliases').value=(q.acceptedAnswers||[]).join('\n');
 uploadImage=q.image?.src?.startsWith('data:')?q.image.src:'';$('draft-image-path').value=uploadImage?'':q.image?.src||'';$('draft-image-alt').value=q.image?.alt||'';$('draft-image-caption').value=q.image?.caption||'';$('draft-image-file').value='';
 $('draft-image-preview').hidden=!q.image;if(q.image)$('draft-image-preview').src=q.image.src;
 $('save-draft').textContent='Save changes';$('cancel-edit').hidden=false;syncType();$('draft-prompt').focus();
}
function buildDraft(){
 const q={id:editId||('q-'+crypto.randomUUID()),group:$('draft-group').value,projection:$('draft-projection').value.trim(),topic:$('draft-topic').value,type:$('draft-type').value,prompt:$('draft-prompt').value.trim(),answer:$('draft-answer').value.trim(),explanation:$('draft-explanation').value.trim(),source:$('draft-source').value.trim()};
 if(q.type==='mcq')q.options=$('draft-options').value.split('\n').map(s=>s.trim()).filter(Boolean);
 else q.acceptedAnswers=$('draft-aliases').value.split('\n').map(s=>s.trim()).filter(Boolean);
 const src=uploadImage||$('draft-image-path').value.trim();
 if(src)q.image={src,alt:$('draft-image-alt').value.trim(),caption:$('draft-image-caption').value.trim()};
 validateQuestions([q]);return q;
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{if(session&&!$('quiz-view').hidden&&!confirm('Leave this session and discard its progress?'))return;session=null;showView(b.dataset.view);});
$('group-grid').onchange=e=>{if(e.target.checked)selected.add(e.target.value);else selected.delete(e.target.value);updateSetup();};
$('focus-list').onchange=e=>{if(e.target.checked)focus.add(e.target.value);else focus.delete(e.target.value);updateSetup();};
$('toggle-groups').onclick=()=>{selected=selected.size===groups.length?new Set():new Set(groups.map(g=>g.id));$('group-grid').querySelectorAll('input').forEach(el=>el.checked=selected.has(el.value));updateSetup();};
['session-size','session-mode','images-only'].forEach(id=>$(id).onchange=updateSetup);
$('start').onclick=()=>{const pool=matching();startSession(pool,$('session-mode').value,$('session-size').value==='all'?pool.length:Number($('session-size').value),$('shuffle').checked);};
['bank-search','bank-group','bank-topic'].forEach(id=>$(id).addEventListener(id==='bank-search'?'input':'change',()=>{browseLimit=50;renderBank();}));
$('bank-more').onclick=()=>{browseLimit+=50;renderBank();};
$('close-image').onclick=()=>$('image-dialog').close();
$('draft-type').onchange=syncType;
$('draft-group').onchange=()=>{resetForm();renderDrafts();};
$('cancel-edit').onclick=resetForm;
$('remove-image').onclick=()=>{uploadImage='';$('draft-image-file').value='';$('draft-image-path').value='';$('draft-image-preview').hidden=true;};
$('draft-image-file').onchange=async()=>{
 const file=$('draft-image-file').files[0];if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){$('builder-message').textContent='Choose a JPG, PNG, or WebP smaller than 5 MB.';$('draft-image-file').value='';return;}
 $('save-draft').disabled=true;
 try {uploadImage=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});$('draft-image-path').value='';$('draft-image-preview').src=uploadImage;$('draft-image-preview').hidden=false;$('builder-message').textContent='Image attached.';}
 catch{$('builder-message').textContent='Could not read that image.';}
 finally{$('save-draft').disabled=false;}
};
$('draft-image-path').oninput=()=>{uploadImage='';$('draft-image-file').value='';$('draft-image-preview').hidden=true;};
$('builder-form').onsubmit=e=>{
 e.preventDefault();try{
 const q=buildDraft(),idx=drafts.findIndex(d=>d.group===q.group&&d.id===q.id);
 if(idx>=0)drafts[idx]=q;else drafts.push(q);
 const saved=persistDrafts();resetForm();renderDrafts();$('builder-message').textContent=saved?'Saved to your local draft bank.':'Added for this visit. Export now to keep it.';
 }catch(err){$('builder-message').textContent=err.message;}
};
$('export-drafts').onclick=()=>{
 const active=drafts.filter(q=>q.group===$('draft-group').value);if(!active.length)return;
 const blob=new Blob([JSON.stringify(active.map(cleanQuestion),null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=$('draft-group').value+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('draft-status').textContent='Exported '+active.length+' questions. Upload this file to share them.';
};
$('preview-drafts').onclick=()=>{const qs=drafts.filter(q=>q.group===$('draft-group').value);startSession(qs,'practice',qs.length,false,'builder');};
$('import-drafts').onchange=async()=>{
 const file=$('import-drafts').files[0];if(!file)return;
 try{
  if(file.size>25*1024*1024)throw new Error('Import a JSON file smaller than 25 MB.');
  const incoming=validateQuestions(JSON.parse(await file.text())),g=$('draft-group').value;
  const collisions=incoming.filter(q=>drafts.some(d=>d.group===g&&d.id===q.id)).length;
  if(collisions&&!confirm('Replace '+collisions+' existing draft questions with matching IDs?'))return;
  const ids=new Set(incoming.map(q=>q.id));drafts=drafts.filter(d=>d.group!==g||!ids.has(d.id)).concat(incoming.map(q=>({...cleanQuestion(q),group:g})));
  const saved=persistDrafts();renderDrafts();$('draft-status').textContent='Imported '+incoming.length+' questions into '+groups.find(x=>x.id===g).name+'.'+(saved?'':' Export now; browser storage is unavailable.');
 }catch(err){$('draft-status').textContent='Import failed: '+err.message;}finally{$('import-drafts').value='';}
};
init();
