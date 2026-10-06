'use strict';
// Data-driven reference/review. Compact virtual question records use the existing
// Progress store, backup format and authenticated cloud synchronization.
window.Guides=(()=>{
 const fields=[['key','Key distinction'],['position','Position'],['cr','Central ray'],['ir','Image receptor'],['collimation','Collimation'],['sid','SID'],['purpose','Purpose / anatomy'],['evaluation','Evaluation criteria'],['respiration','Respiration']];
 const questionCache=new WeakMap();
 const labels=Object.fromEntries(fields),host=()=>document.getElementById('guides-view');
 let data=null,pending=null,partId='',viewId='',overview=false,query='',review=null;
 let selected=new Set(['position','cr','evaluation']),scope='part';
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
 function current(){const part=data.parts.find(p=>p.id===partId)||data.parts.find(p=>p.views.length);return {part,view:part?.views.find(v=>v.id===viewId)||part?.views[0]};}
 function bullets(items){return '<ul>'+items.map(s=>'<li>'+h(s)+'</li>').join('')+'</ul>';}
 function settings(){return '<details class="guide-settings"><summary aria-label="Review settings">⚙ <span>Review settings</span></summary><div><fieldset><legend>What to review</legend>'+fields.map(([id,label])=>'<label><input type="checkbox" data-guide-field="'+id+'" '+(selected.has(id)?'checked':'')+'>'+label+'</label>').join('')+'</fieldset><label for="guide-scope">Include</label><select id="guide-scope"><option value="view">This projection</option><option value="part">This part</option><option value="all">All parts</option></select><p class="small muted">Missed criteria return until you get them. Each “Got it” is self-assessed and earns the usual 10 XP.</p></div></details>';}
 function footer(){return '<footer class="guide-common"><strong>For every projection</strong>'+bullets(list(data.commonEvaluation))+'<p>'+h(data.symbols)+'</p><details><summary>Source & study notes</summary><p>'+h(data.source.title)+'. '+h(data.source.note)+'</p><p>References use PDF page numbers, not printed textbook pages. These are study notes; follow your program’s clinical procedures.</p></details></footer>';}
 function render(){
  if(!data)return;if(review){renderReview();return;}
  const {part,view}=current();if(!part||!view){host().innerHTML='<h1>Guides</h1><p>No projections have been added yet.</p>';return;}
  host().innerHTML='<div class="guide-heading"><div><div class="eyebrow">REFERENCE / POSITIONING</div><h1>Guides</h1><p>Find a view. Focus on what makes it different.</p></div>'+settings()+'</div><div class="guide-tabs" aria-label="Guide pages"><button id="guide-detail-tab" aria-pressed="'+!overview+'">Projection guide</button><button id="guide-overview-tab" aria-pressed="'+overview+'">All projections</button><button class="primary" id="guide-start">Start review</button></div><div id="guide-content"></div>'+footer();
  $('guide-scope').value=scope;
  host().querySelectorAll('[data-guide-field]').forEach(el=>el.onchange=()=>{el.checked?selected.add(el.dataset.guideField):selected.delete(el.dataset.guideField);});
  $('guide-scope').onchange=e=>{scope=e.target.value;};
  $('guide-detail-tab').onclick=()=>{overview=false;render();};$('guide-overview-tab').onclick=()=>{overview=true;render();};$('guide-start').onclick=startReview;
  if(overview)renderOverview();else renderDetail(part,view);
 }
 function renderDetail(part,view){
  $('guide-content').innerHTML='<div class="guide-selectors"><label>Part<select id="guide-part">'+data.parts.filter(p=>p.views.length).map(p=>'<option value="'+p.id+'">'+h(p.name)+'</option>').join('')+'</select></label><label>Projection / method<select id="guide-projection">'+part.views.map(v=>'<option value="'+v.id+'">'+h(v.name)+'</option>').join('')+'</select></label></div><div class="guide-title"><div><p class="small muted">'+h(part.region)+' / '+h(part.name)+'</p><h2>'+h(view.name)+'</h2></div><span class="small muted">'+(part.views.indexOf(view)+1)+' of '+part.views.length+'</span></div><div class="guide-distinction"><strong>Key distinction</strong>'+bullets(view.key)+'</div>'+galleries(view)+'<div class="guide-cr"><h3>Central ray</h3><div class="guide-angle">'+h(view.cr.angle)+'</div><p><strong>Center:</strong> '+h(view.cr.target)+'</p>'+bullets(list(view.cr.notes))+'</div><div class="guide-criteria">'+[['position','Position'],['ir','Image receptor'],['collimation','Collimation'],['purpose','Purpose / anatomy'],['evaluation','Evaluation criteria'],['sid','SID'],['respiration','Respiration']].filter(([f])=>values(view,f).length).map(([f,title])=>'<article><h3>'+title+'</h3>'+bullets(values(view,f))+'</article>').join('')+'</div>'+precautions(view)+'<div class="guide-bottom"><button id="guide-prev" '+(part.views.indexOf(view)===0?'disabled':'')+'>← Previous</button><span class="small muted">Merrill’s · PDF p. '+h(view.sourcePages.join(', '))+'</span><button id="guide-next" '+(part.views.indexOf(view)===part.views.length-1?'disabled':'')+'>Next →</button></div>';
  $('guide-part').value=part.id;$('guide-projection').value=view.id;
  $('guide-part').onchange=e=>{partId=e.target.value;viewId=data.parts.find(p=>p.id===partId).views[0].id;render();};
  $('guide-projection').onchange=e=>{viewId=e.target.value;render();};
  $('guide-prev').onclick=()=>navigate(-1);$('guide-next').onclick=()=>navigate(1);
  wireGalleries();
 }
 function navigate(delta){const {part,view}=current();const next=part.views[part.views.indexOf(view)+delta];if(next){viewId=next.id;render();$('guide-projection').focus();}}
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
 function wireGalleries(){host().querySelectorAll('.guide-gallery').forEach(g=>{const track=g.querySelector('.guide-image-track');if(!track)return;g.querySelectorAll('[data-gallery-direction]').forEach(b=>b.onclick=()=>track.scrollBy({left:track.clientWidth*Number(b.dataset.galleryDirection),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));g.querySelectorAll('img').forEach(img=>img.onerror=()=>{const p=document.createElement('p');p.className='guide-image-empty';p.textContent='Image unavailable: '+img.getAttribute('alt');img.replaceWith(p);});});}
 function renderOverview(){
  $('guide-content').innerHTML='<label for="guide-search">Find a part, method or key detail</label><input id="guide-search" type="search" placeholder="Try mortise, Coyle or scaphoid…"><p class="small muted">Every part and projection in the guide collection. Select a view to open its full criteria.</p><div id="guide-overview-list"></div>';
  $('guide-search').value=query;$('guide-search').oninput=e=>{query=e.target.value;paintOverview();};paintOverview();
 }
 function paintOverview(){
  const needle=query.trim().toLowerCase();let count=0;
  $('guide-overview-list').innerHTML=data.parts.map(p=>{
   const views=p.views.filter(v=>[p.name,v.name,...v.key,...(v.aliases||[]),v.cr.angle,v.cr.target].join(' ').toLowerCase().includes(needle));if(!views.length)return '';count+=views.length;
   return '<section class="guide-overview-part"><h2>'+h(p.name)+'</h2><div class="guide-table-wrap"><table><thead><tr><th>Projection</th><th>Central ray</th><th>Remember</th></tr></thead><tbody>'+views.map(v=>'<tr><th scope="row"><button class="text-button" data-guide-open="'+p.id+'/'+v.id+'">'+h(v.name)+'</button></th><td><strong>'+h(v.cr.angle)+'</strong><br>'+h(v.cr.target)+'</td><td>'+h(v.key.join(' '))+'</td></tr>').join('')+'</tbody></table></div></section>';
  }).join('')||'<p>No matching projections.</p>';
  $('guide-overview-list').querySelectorAll('[data-guide-open]').forEach(b=>b.onclick=()=>{[partId,viewId]=b.dataset.guideOpen.split('/');overview=false;render();host().scrollIntoView({block:'start'});});
 }
 function startReview(){
  const {part,view}=current();let pool=scope==='all'?allQuestions():scope==='part'?part.views.flatMap(v=>questions(part,v)):questions(part,view);
  pool=pool.filter(q=>selected.has(q._field));
  if(!pool.length){let msg=$('guide-review-message');if(!msg){msg=document.createElement('p');msg.id='guide-review-message';msg.setAttribute('role','status');$('guide-content').before(msg);}msg.textContent='Select at least one available criterion in Review settings.';return;}
  review={queue:Progress.pick(pool,pool.length,true,true),total:pool.length,done:0,attempts:0,revealed:false};renderReview();
 }
 function renderReview(){
  const q=review.queue[0];
  if(!q){renderComplete();return;}
  const {part}=current();
  host().innerHTML='<div class="guide-heading"><div><div class="eyebrow">GUIDES / REVIEW MODE</div><h1>Recall the criteria.</h1><p>'+review.done+' / '+review.total+' recalled · '+review.queue.length+' remaining</p></div><button id="guide-exit">Finish review</button></div><progress class="guide-review-meter" value="'+review.done+'" max="'+review.total+'" aria-label="Criteria recalled"></progress><article class="guide-review-card"><p class="eyebrow">'+h(q._part.name)+'</p><h2>'+h(q._view.name)+'</h2><h3>'+h(labels[q._field])+'</h3><p class="small muted">Recall the answer, then reveal and check yourself.</p><button class="primary" id="guide-reveal">Reveal answer</button><div id="guide-answer" hidden>'+bullets(values(q._view,q._field))+'<div class="guide-review-actions"><button id="guide-again">Study again</button><button class="primary" id="guide-got">Got it ✓</button></div><p class="small muted">Self-assessment · “Study again” returns this criterion to the pile.</p>'+Progress.controls(q)+'</div></article>'+precautions(q._view)+'<p class="small muted">Merrill’s · PDF p. '+h(q._view.sourcePages.join(', '))+'</p>';
  $('guide-reveal').onclick=()=>{review.revealed=true;$('guide-answer').hidden=false;$('guide-reveal').hidden=true;Progress.wire($('guide-answer'),[q]);$('guide-got').focus();};
  $('guide-again').onclick=()=>assess(false);$('guide-got').onclick=()=>assess(true);
  $('guide-exit').onclick=endReview;
 }
 function assess(correct){
  if(!review?.revealed)return;review.revealed=false;const q=review.queue.shift();Progress.record(q,correct);review.attempts++;
  if(correct)review.done++;else review.queue.push(q);
  Progress.refreshAwards();renderReview();
 }
 function renderComplete(){
  host().innerHTML='<div class="page-heading"><div class="eyebrow">GUIDES / REVIEW COMPLETE</div><h1>That set is done.</h1><p>'+review.done+' criteria recalled in '+review.attempts+' attempts.</p></div><p>Your review history and earned badges are saved through the same progress system as your practice questions. Signed-in accounts will sync when connected.</p><button class="primary" id="guide-back">Back to guides</button> <button id="guide-progress">My progress</button>';
  window.dispatchEvent(new CustomEvent('positioning-session-complete',{detail:{source:'guides'}}));
  $('guide-back').onclick=()=>{review=null;render();};$('guide-progress').onclick=()=>{review=null;showView('progress');};
 }
 function endReview(){review=null;render();window.dispatchEvent(new CustomEvent('positioning-session-complete',{detail:{source:'guides'}}));}
 // Leaving a review preserves recorded answers and flushes the debounced cloud save.
 function leave(){if(review){review=null;window.dispatchEvent(new CustomEvent('positioning-session-complete',{detail:{source:'guides'}}));}}
 return {load,open,leave,stats,allQuestions,isReviewActive:()=>!!review?.queue.length};
})();
