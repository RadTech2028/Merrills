'use strict';
// Data-driven reference/review. Compact virtual question records use the existing
// Progress store, backup format and authenticated cloud synchronization.
window.Guides=(()=>{
 const fields=[['key','Key distinction'],['position','Position'],['cr','Central ray'],['ir','Image receptor'],['collimation','Collimation'],['sid','SID'],['purpose','Purpose / anatomy'],['evaluation','Evaluation criteria'],['respiration','Respiration']];
 const questionCache=new WeakMap();
 const labels=Object.fromEntries(fields),host=()=>document.getElementById('guides-view');
 let data=null,pending=null,partId='',viewId='',overview=false,query='',review=null;
 let ui=Preferences.guideSettings(),selected=new Set(ui.selected),scope=ui.scope,revealed=new Set(),testTimer=null;
 function saveUI(patch={}){ui={...ui,...patch,selected:[...selected],scope};const saved=Preferences.setGuideSettings(ui);const status=$('guide-settings-status');if(status)status.textContent=saved?'Saved.':'Browser storage is unavailable. This layout applies for this visit only.';}
 function resetReveals(){revealed.clear();}
 function stopTestTimer(){clearInterval(testTimer);testTimer=null;}
 function testClock(){if(!review?.deadline||review.complete)return;const remaining=Math.max(0,Math.ceil((review.deadline-Date.now())/1000));const clock=$('guide-test-clock');if(clock)clock.textContent=Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0')+' remaining';if(!remaining){review.timedOut=true;stopTestTimer();renderComplete();}}
 const h=s=>esc(String(s??''));
 const list=value=>Array.isArray(value)?value:typeof value==='string'&&value.trim()?[value]:[];
 function values(view,field){return field==='cr'?[view.cr.angle,view.cr.target,...list(view.cr.notes)].filter(Boolean):list(view[field]);}
 function questions(part,view){if(questionCache.has(view))return questionCache.get(view);const result=fields.filter(([f])=>values(view,f).length).map(([f,title])=>({origin:'program',group:'guide:'+part.id,id:view.id+':'+f,part:part.id,projection:view.name,type:'short',prompt:part.name+' — '+view.name+' · '+title,answer:values(view,f).join('\n'),_part:part,_view:view,_field:f}));questionCache.set(view,result);return result;}
 function allQuestions(){return data?data.parts.flatMap(p=>p.views.flatMap(v=>questions(p,v))):[];}
 function stats(){
  if(!data)return {unique:0,projections:0,parts:[]};
  let unique=0,projections=0;
  const parts=data.parts.map(p=>{let completed=0;for(const v of p.views){const qs=questions(p,v);const success=qs.filter(q=>Progress.get(q)[1]>0).length;unique+=success;if(qs.length&&success===qs.length){completed++;projections++;}}return {id:p.id,name:p.name,total:p.views.length,completed};});
  return {unique,projections,parts};
 }
 function validate(input){
  if(input?.schemaVersion!==1||!Array.isArray(input.parts)||!input.parts.length)throw Error('Guide file has an unsupported format.');
  const partIds=new Set();
  for(const p of input.parts){
   if(!/^[a-z0-9-]+$/.test(p.id)||partIds.has(p.id)||typeof p.name!=='string'||!Array.isArray(p.views))throw Error('Invalid or duplicate guide part.');partIds.add(p.id);
   const ids=new Set();for(const v of p.views){
    if(!/^[a-z0-9-]+$/.test(v.id)||ids.has(v.id)||typeof v.name!=='string'||!v.cr||typeof v.cr.angle!=='string'||typeof v.cr.target!=='string'||!Array.isArray(v.evaluation)||!v.evaluation.length)throw Error('Invalid guide projection in '+p.name);ids.add(v.id);
    for(const f of ['key','position','ir','collimation','purpose','evaluation'])if(!Array.isArray(v[f])||!v[f].every(x=>typeof x==='string'&&x.trim()))throw Error('Invalid '+f+' in '+p.name+' / '+v.name);
   }
  }
  return input;
 }
 async function load(){
  if(data)return data;if(pending)return pending;
  pending=getJSON('./data/guides/projections.json?v=guides-1').then(validate).then(d=>{data=d;const first=d.parts.find(p=>p.views.length);partId=first?.id||'';viewId=first?.views[0]?.id||'';return d;}).finally(()=>{pending=null;});
  return pending;
 }
 async function open(){
  if(!data){host().innerHTML='<p role="status">Loading guides…</p>';try{await load();}catch(e){host().innerHTML='<h1>Guides</h1><p role="alert">'+h(e.message)+'</p><button id="guide-retry">Try again</button>';$('guide-retry').onclick=open;return;}}
  render();
 }
 window.addEventListener('positioning-preferences-changed',()=>{const next=Preferences.guideSettings();const changed=JSON.stringify(next)!==JSON.stringify(ui);ui=next;selected=new Set(ui.selected);scope=ui.scope;if(changed){resetReveals();if(data&&!host().hidden&&!review)render();}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)testClock();});
 document.addEventListener('click',event=>{const panel=host()?.querySelector('.guide-settings');if(panel?.open&&!panel.contains(event.target))panel.open=false;});
 function current(){const part=data.parts.find(p=>p.id===partId)||data.parts.find(p=>p.views.length);return {part,view:part?.views.find(v=>v.id===viewId)||part?.views[0]};}
 function bullets(items){return '<ul>'+items.map(s=>'<li>'+h(s)+'</li>').join('')+'</ul>';}
 function icon(name){
  const paths={key:'M12 3v4m0 10v4M3 12h4m10 0h4m-2.6-6.4-2.8 2.8m-7.2 7.2-2.8 2.8M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8',position:'M12 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm-6 4h12m-6-3v7m0 0-4 6m4-6 4 6',cr:'M4 4h5v5H4zM9 9l11 11m-9-3h6v-6',ir:'M5 2h14v20H5zM8 6h8m-8 3h8',collimation:'M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6',sid:'M3 5v14m18-14v14M4 12h16m-13-3-3 3 3 3m10-6 3 3-3 3',purpose:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',evaluation:'m3 6 2 2 4-5m3 3h9M3 12h5m4 0h9M3 18h5m4 0h9',respiration:'M12 3v8m0-3c-2-3-4-3-5 0l-3 9c0 4 6 3 6 0v-6m2-3c2-3 4-3 5 0l3 9c0 4-6 3-6 0v-6',settings:'M4 6h16M4 12h16M4 18h16M9 3v6m6 0v6m-7 0v6',test:'M8 3h8v3H8zM7 4H4v18h16V4h-3M8 11h8m-8 5h5'};
  return '<svg class="guide-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(paths[name]||paths.ir)+'"/></svg>';
 }
 function settings(){return '<details class="guide-settings"><summary aria-label="Guide settings">'+icon('settings')+'<span>Guide settings</span></summary><div><label class="guide-setting-check"><input id="guide-show-key" type="checkbox" '+(ui.showKey?'checked':'')+'>Show key distinction</label><p>Applies to guides, the overview and quick tests.</p><button id="guide-open-all">Expand all sections</button><button id="guide-close-all">Collapse all sections</button><hr><fieldset><legend>Quick-test criteria</legend>'+fields.map(([id,label])=>'<label><input type="checkbox" data-guide-field="'+id+'" '+(selected.has(id)?'checked':'')+' '+(id==='key'&&!ui.showKey?'disabled':'')+'>'+label+'</label>').join('')+'</fieldset><label for="guide-scope">Quick-test scope</label><select id="guide-scope"><option value="view">This projection</option><option value="part">This part</option><option value="all">All parts</option></select><p>Quick tests use your saved question count, timer, smart-review and shuffle settings. Reading and revealing answers never award XP.</p><button id="guide-global-settings">Open site settings</button><p id="guide-settings-status" role="status"></p></div></details>';}
 function footer(){return '<footer class="guide-common"><strong>For every projection</strong>'+bullets(list(data.commonEvaluation))+'<div class="guide-symbols"><span><b>⟂</b> perpendicular</span><span><b>∥</b> parallel</span><span><b>∠</b> angle</span><span><b>°</b> degrees</span><span><b>LW</b> lengthwise</span><span><b>CW</b> crosswise</span></div><p>CR central ray · IR image receptor · SID source-to-image distance</p><details><summary>Source & study notes</summary><p>'+h(data.source.title)+'. '+h(data.source.note)+'</p><p>References use PDF page numbers, not printed textbook pages. These are study notes; follow your program’s clinical procedures.</p></details></footer>';}
 function render(){
  if(!data)return;if(review){if(review.complete)renderComplete();else renderReview();return;}
  const {part,view}=current();if(!part||!view){host().innerHTML='<h1>Guides</h1><p>No projections have been added yet.</p>';return;}
  host().innerHTML='<div class="guide-heading"><div><div class="eyebrow">THE POSITIONING ATLAS</div><h1>Guides</h1><p>Your views, one detail at a time.</p></div>'+settings()+'</div><div class="guide-tabs" aria-label="Guide modes"><button id="guide-detail-tab" aria-pressed="'+(!overview&&ui.mode==='read')+'">'+icon('ir')+'Read</button><button id="guide-review-tab" aria-pressed="'+(!overview&&ui.mode==='review')+'">'+icon('purpose')+'Review</button><button id="guide-overview-tab" aria-pressed="'+overview+'">All projections</button><button class="primary" id="guide-start">'+icon('test')+'Quick test</button></div><div id="guide-content"></div>'+footer();
  $('guide-scope').value=scope;
  host().querySelectorAll('[data-guide-field]').forEach(el=>el.onchange=()=>{el.checked?selected.add(el.dataset.guideField):selected.delete(el.dataset.guideField);saveUI();});
  $('guide-scope').onchange=e=>{scope=e.target.value;saveUI();};
  $('guide-detail-tab').onclick=()=>{overview=false;saveUI({mode:'read'});resetReveals();render();};$('guide-review-tab').onclick=()=>{overview=false;saveUI({mode:'review'});resetReveals();render();};$('guide-overview-tab').onclick=()=>{overview=true;render();};$('guide-start').onclick=startReview;
  $('guide-show-key').onchange=e=>{saveUI({showKey:e.target.checked});resetReveals();render();};
  $('guide-open-all').onclick=()=>{saveUI({collapsed:[]});render();};$('guide-close-all').onclick=()=>{saveUI({collapsed:fields.map(([f])=>f)});render();};
  $('guide-global-settings').onclick=()=>{$('open-settings').click();};
  const panel=host().querySelector('.guide-settings');panel.onkeydown=e=>{if(e.key==='Escape'){panel.open=false;panel.querySelector('summary').focus();}};
  if(overview)renderOverview();else renderDetail(part,view);
 }
 function receptor(view){
  const text=values(view,'ir').join(' '),dimension=text.match(/(\d+)\s*×\s*(\d+)\s*in/),lw=/lengthwise/i.test(text),cw=/crosswise/i.test(text);
  const badge=(label,wide)=>'<span class="guide-ir-orientation" title="'+(wide?'Crosswise':'Lengthwise')+'"><svg viewBox="0 0 64 64" role="img" aria-label="'+(wide?'Crosswise':'Lengthwise')+' image receptor"><rect x="'+(wide?5:15)+'" y="'+(wide?15:5)+'" width="'+(wide?54:34)+'" height="'+(wide?34:54)+'" rx="3" fill="none" stroke="currentColor" stroke-width="1.7"/><text x="32" y="36" text-anchor="middle" fill="currentColor" font-size="14" font-family="inherit" font-weight="700">'+label+'</text></svg>'+(wide?'Crosswise':'Lengthwise')+'</span>';
  let notes=text;if(dimension&&!/\bor\b/i.test(text))notes=notes.replace(/^\s*\d+\s*×\s*\d+\s*in[.;]?\s*/,'').replace(/^(lengthwise|crosswise)[.;]?\s*/i,'');
  return '<div class="guide-ir-layout">'+(dimension?'<div class="guide-ir-size">'+h(dimension[1])+' × '+h(dimension[2])+'<small>inches</small></div>':'')+'<div class="guide-ir-orientations">'+(lw?badge('LW',false):'')+(cw?badge('CW',true):'')+'</div></div>'+(notes?'<p class="guide-ir-notes">'+h(notes)+'</p>':'');
 }
 function fieldBody(view,field){
  if(field==='ir')return receptor(view);
  if(field==='cr')return '<div class="guide-angle">'+h(view.cr.angle)+'</div><p><strong>Center</strong> '+h(view.cr.target)+'</p>'+bullets(list(view.cr.notes));
  return bullets(values(view,field));
 }
 function answerContent(view,field){
  const masked=ui.mode==='review'&&!revealed.has(field);
  return masked?'<div class="guide-masked"><span>Recall this detail first.</span><button data-guide-reveal="'+field+'">Show answer</button></div>':fieldBody(view,field)+(ui.mode==='review'?'<button class="guide-hide-answer" data-guide-hide="'+field+'">Hide answer</button>':'');
 }
 function section(view,field){
  if(!values(view,field).length||(field==='key'&&!ui.showKey))return '';
  return '<details class="guide-section '+(field==='key'?'guide-distinction':field==='cr'?'guide-cr':'')+'" data-guide-section="'+field+'" '+(ui.collapsed.includes(field)?'':'open')+'><summary>'+icon(field)+'<span>'+h(labels[field])+'</span></summary><div class="guide-section-body">'+answerContent(view,field)+'</div></details>';
 }
 function refreshAnswer(view,field){const node=host().querySelector('[data-guide-section="'+field+'"] .guide-section-body');if(node)node.innerHTML=answerContent(view,field);}
 function wireAnswers(view){
  host().querySelectorAll('[data-guide-reveal]').forEach(b=>b.onclick=()=>{const field=b.dataset.guideReveal;revealed.add(field);refreshAnswer(view,field);wireAnswers(view);host().querySelector('[data-guide-hide="'+field+'"]').focus({preventScroll:true});});
  host().querySelectorAll('[data-guide-hide]').forEach(b=>b.onclick=()=>{const field=b.dataset.guideHide;revealed.delete(field);refreshAnswer(view,field);wireAnswers(view);host().querySelector('[data-guide-reveal="'+field+'"]').focus({preventScroll:true});});
 }
 function renderDetail(part,view){
  $('guide-content').innerHTML='<div class="guide-selectors"><label>Part<select id="guide-part">'+data.parts.filter(p=>p.views.length).map(p=>'<option value="'+p.id+'">'+h(p.name)+'</option>').join('')+'</select></label><label>Projection / method<select id="guide-projection">'+part.views.map(v=>'<option value="'+v.id+'">'+h(v.name)+'</option>').join('')+'</select></label></div><div class="guide-title"><div><p class="small muted">'+h(part.region)+' / '+h(part.name)+'</p><h2>'+h(view.name)+'</h2></div><span class="small muted">'+(part.views.indexOf(view)+1)+' / '+part.views.length+'</span></div><div class="guide-reading-tools"><p>'+(ui.mode==='review'?'Answers are hidden. Reveal one section at a time; cautions stay visible.':'Tap a section heading to close or reopen it. Your layout stays saved.')+'</p><div>'+(ui.mode==='review'?'<button id="guide-reveal-all">Show all answers</button><button id="guide-hide-all">Hide all answers</button>':'')+'</div></div>'+section(view,'key')+galleries(view)+section(view,'cr')+'<div class="guide-criteria">'+['position','ir','collimation','purpose','evaluation','sid','respiration'].map(f=>section(view,f)).join('')+'</div>'+precautions(view)+'<div class="guide-bottom"><button id="guide-prev" '+(part.views.indexOf(view)===0?'disabled':'')+'>← Previous</button><span class="small muted">Merrill’s · PDF p. '+h(view.sourcePages.join(', '))+'</span><button id="guide-next" '+(part.views.indexOf(view)===part.views.length-1?'disabled':'')+'>Next →</button></div>';
  $('guide-part').value=part.id;$('guide-projection').value=view.id;
  $('guide-part').onchange=e=>{partId=e.target.value;viewId=data.parts.find(p=>p.id===partId).views[0].id;resetReveals();render();};
  $('guide-projection').onchange=e=>{viewId=e.target.value;resetReveals();render();};
  $('guide-prev').onclick=()=>navigate(-1);$('guide-next').onclick=()=>navigate(1);
  host().querySelectorAll('[data-guide-section]').forEach(el=>el.ontoggle=()=>{if(!el.isConnected)return;const f=el.dataset.guideSection,was=ui.collapsed.includes(f);if(was===!el.open)return;saveUI({collapsed:el.open?ui.collapsed.filter(k=>k!==f):[...ui.collapsed,f]});});
  wireAnswers(view);
  if($('guide-reveal-all'))$('guide-reveal-all').onclick=()=>{fields.forEach(([f])=>{revealed.add(f);refreshAnswer(view,f);});wireAnswers(view);};
  if($('guide-hide-all'))$('guide-hide-all').onclick=()=>{resetReveals();fields.forEach(([f])=>refreshAnswer(view,f));wireAnswers(view);};
  wireGalleries();
 }
 function navigate(delta){const {part,view}=current();const next=part.views[part.views.indexOf(view)+delta];if(next){viewId=next.id;resetReveals();render();$('guide-projection').focus();}}
 function precautions(view){return list(view.precautions).length?'<aside class="guide-precautions"><strong>Positioning caution</strong>'+bullets(view.precautions)+'</aside>':'';}
 function imagePath(src,folder){
  if(typeof src!=='string'||!src.trim())return '';
  src=src.trim().replace(/^\.\//,'');if(!src.startsWith(folder+'/'))src=folder+'/'+src;
  if(src.includes('..')||/[\\\x00-\x1f]/.test(src)||!/^\w[^:?#]*\.(png|jpe?g|webp|gif|avif)$/i.test(src))return '';
  return './'+src.split('/').map(encodeURIComponent).join('/');
 }
 function galleries(view){return '<div class="guide-galleries">'+[['patient','Patient position','Pimage'],['xray','Radiographs','Ximages']].map(([key,title,folder])=>{
  const entries=list(view.images?.[key]).map(item=>typeof item==='string'?{src:item,alt:title}:item).filter(item=>item&&imagePath(item.src,folder));
  return '<section class="guide-gallery"><div class="guide-gallery-heading"><h3>'+title+'</h3>'+(entries.length?'<span class="small muted">'+entries.length+' image'+(entries.length===1?'':'s')+'</span>':'')+'</div>'+(entries.length?'<div class="guide-gallery-controls"><button data-gallery-direction="-1" aria-label="Previous '+title.toLowerCase()+' image">←</button><span class="small muted">Swipe or scroll</span><button data-gallery-direction="1" aria-label="Next '+title.toLowerCase()+' image">→</button></div><div class="guide-image-track" tabindex="0" aria-label="'+title+' images">'+entries.map((im,i)=>'<figure><img src="'+h(imagePath(im.src,folder))+'" alt="'+h(im.alt||title+' '+(i+1))+'" loading="lazy" decoding="async"><figcaption>'+h(im.caption||'Image '+(i+1)+' of '+entries.length)+'</figcaption></figure>').join('')+'</div>':'<div class="guide-image-empty"><svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="7" y="7" width="34" height="34" rx="3"/><path d="m10 35 11-12 7 7 5-6 6 11M24 11v7m-3-3h6"/></svg><span>Images coming soon</span></div>')+'</section>';
 }).join('')+'</div>';}
 function wireGalleries(){host().querySelectorAll('.guide-gallery').forEach(g=>{const track=g.querySelector('.guide-image-track');if(!track)return;g.querySelectorAll('[data-gallery-direction]').forEach(b=>b.onclick=()=>track.scrollBy({left:track.clientWidth*Number(b.dataset.galleryDirection),behavior:document.documentElement.dataset.motion==='reduce'||matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));g.querySelectorAll('img').forEach(img=>img.onerror=()=>{const p=document.createElement('p');p.className='guide-image-empty';p.textContent='Image unavailable: '+img.getAttribute('alt');img.replaceWith(p);});});}
 function renderOverview(){
  $('guide-content').innerHTML='<label for="guide-search">Find a part, method or key detail</label><input id="guide-search" type="search" placeholder="Try mortise, Coyle or scaphoid…"><p class="small muted">Every part and projection in the guide collection. Select a view to open its full criteria.</p><div id="guide-overview-list"></div>';
  $('guide-search').value=query;$('guide-search').oninput=e=>{query=e.target.value;paintOverview();};paintOverview();
 }
 function paintOverview(){
  const needle=query.trim().toLowerCase();let count=0;
  $('guide-overview-list').innerHTML=data.parts.map(p=>{
   const views=p.views.filter(v=>[p.name,v.name,...(ui.showKey?v.key:[]),...(v.aliases||[]),v.cr.angle,v.cr.target].join(' ').toLowerCase().includes(needle));if(!views.length)return '';count+=views.length;
   return '<section class="guide-overview-part"><h2>'+h(p.name)+'</h2><div class="guide-table-wrap"><table><thead><tr><th>Projection</th><th>Central ray</th>'+(ui.showKey?'<th>Remember</th>':'')+'</tr></thead><tbody>'+views.map(v=>'<tr><th scope="row"><button class="text-button" data-guide-open="'+p.id+'/'+v.id+'">'+h(v.name)+'</button></th><td><strong>'+h(v.cr.angle)+'</strong><br>'+h(v.cr.target)+'</td>'+(ui.showKey?'<td>'+h(v.key.join(' '))+'</td>':'')+'</tr>').join('')+'</tbody></table></div></section>';
  }).join('')||'<p>No matching projections.</p>';
  $('guide-overview-list').querySelectorAll('[data-guide-open]').forEach(b=>b.onclick=()=>{[partId,viewId]=b.dataset.guideOpen.split('/');overview=false;resetReveals();render();host().scrollIntoView({block:'start'});});
 }
 function startReview(){
  const {part,view}=current();let pool=scope==='all'?allQuestions():scope==='part'?part.views.flatMap(v=>questions(part,v)):questions(part,view);
  pool=pool.filter(q=>selected.has(q._field)&&(q._field!=='key'||ui.showKey));
  if(!pool.length){let msg=$('guide-review-message');if(!msg){msg=document.createElement('p');msg.id='guide-review-message';msg.setAttribute('role','status');$('guide-content').before(msg);}msg.textContent='Select at least one available criterion in Guide settings.';return;}
  const prefs=Preferences.cloudSnapshot(),limit=prefs.all?pool.length:Math.min(pool.length,prefs.count);
  review={queue:Progress.pick(pool,limit,prefs.smart,prefs.shuffle),total:limit,done:0,attempts:0,revealed:false,deadline:prefs.timer?Date.now()+prefs.minutes*60000:0};renderReview();stopTestTimer();if(review.deadline)testTimer=setInterval(testClock,1000);
 }
 function renderReview(){
  const q=review.queue[0];
  if(!q){renderComplete();return;}
  const {part}=current();
  host().innerHTML='<div class="guide-heading"><div><div class="eyebrow">GUIDES / QUICK TEST</div><h1>Recall the criteria.</h1><p>'+review.done+' / '+review.total+' recalled · '+review.queue.length+' remaining</p><p id="guide-test-clock" role="timer"></p></div><button id="guide-exit">Finish test</button></div><progress class="guide-review-meter" value="'+review.done+'" max="'+review.total+'" aria-label="Criteria recalled"></progress><article class="guide-review-card"><p class="eyebrow">'+h(q._part.name)+'</p><h2>'+h(q._view.name)+'</h2><h3>'+h(labels[q._field])+'</h3><p class="small muted">Recall the answer, then reveal and check yourself.</p><button class="primary" id="guide-reveal">Reveal answer</button><div id="guide-answer" hidden>'+bullets(values(q._view,q._field))+'<div class="guide-review-actions"><button id="guide-again">Study again</button><button class="primary" id="guide-got">Got it ✓</button></div><p class="small muted">Self-assessment · “Study again” returns this criterion to the pile.</p>'+Progress.controls(q)+'</div></article>'+precautions(q._view)+'<p class="small muted">Merrill’s · PDF p. '+h(q._view.sourcePages.join(', '))+'</p>';
  $('guide-reveal').onclick=()=>{review.revealed=true;$('guide-answer').hidden=false;$('guide-reveal').hidden=true;Progress.wire($('guide-answer'),[q]);$('guide-got').focus();};
  $('guide-again').onclick=()=>assess(false);$('guide-got').onclick=()=>assess(true);
  $('guide-exit').onclick=endReview;testClock();
 }
 function assess(correct){
  if(!review?.revealed||review.timedOut)return;if(review.deadline&&Date.now()>=review.deadline){testClock();return;}review.revealed=false;const q=review.queue.shift();Progress.record(q,correct);review.attempts++;
  if(correct)review.done++;else review.queue.push(q);
  Progress.refreshAwards();renderReview();
 }
 function renderComplete(){
  stopTestTimer();review.complete=true;
  host().innerHTML='<div class="page-heading"><div class="eyebrow">GUIDES / QUICK TEST</div><h1>'+(review.timedOut?'Time is up.':'That set is done.')+'</h1><p>'+review.done+' / '+review.total+' criteria recalled in '+review.attempts+' attempts.</p></div><p>Your review history and earned badges are saved through the same progress system as your practice questions. Signed-in accounts will sync when connected.</p><button class="primary" id="guide-back">Back to guides</button> <button id="guide-progress">My progress</button>';
  window.dispatchEvent(new CustomEvent('positioning-session-complete',{detail:{source:'guides'}}));
  $('guide-back').onclick=()=>{review=null;render();};$('guide-progress').onclick=()=>{review=null;showView('progress');};
 }
 function endReview(){stopTestTimer();review=null;render();window.dispatchEvent(new CustomEvent('positioning-session-complete',{detail:{source:'guides'}}));}
 // Leaving a review preserves recorded answers and flushes the debounced cloud save.
 function leave(){resetReveals();if(review){stopTestTimer();review=null;window.dispatchEvent(new CustomEvent('positioning-session-complete',{detail:{source:'guides'}}));}}
 return {load,open,leave,stats,allQuestions,isReviewActive:()=>!!review&&!review.complete};
})();
