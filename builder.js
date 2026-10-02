'use strict';
let editId=null,editGroup=null,uploadImage='',imageRead=0;
function cleanQuestion(q){const {group,key,origin,...clean}=q;return clean;}
function validateMetadata(gs,ts){
 if(!Array.isArray(gs)||!ts||typeof ts!=='object'||Array.isArray(ts))throw new Error('Invalid category or focus metadata.');
 const ids=new Set(),names=new Set();
 for(const g of gs){if(!g||typeof g.id!=='string'||!/^[a-z0-9-]+$/.test(g.id)||typeof g.name!=='string'||!g.name.trim()||ids.has(g.id)||names.has(normalize(g.name)))throw new Error('Categories need unique IDs and names.');ids.add(g.id);names.add(normalize(g.name));}
 for(const [id,name] of Object.entries(ts))if(!/^[a-z0-9-]+$/.test(id)||typeof name!=='string'||!name.trim())throw new Error('Invalid focus name or ID.');
}
function availableParts(){return Catalog.forGroup($('draft-group').value);}
function syncParts(preferred){
 const ps=availableParts();$('draft-part').innerHTML=optionHTML(Object.fromEntries(ps.map(p=>[p.id,p.name])));
 if(!ps.length)$('draft-part').innerHTML='<option value="">General / unlisted subject</option>';
 if(ps.some(p=>p.id===preferred))$('draft-part').value=preferred;
 syncFamilies();if(!ps.length){$('custom-projection').checked=true;syncCustom();}
}
function syncFamilies(preferred){
 const part=availableParts().find(p=>p.id===$('draft-part').value);
 const families=[...new Set((part?.views||[]).map(v=>v.orientation))];
 $('projection-family-field').hidden=part?.kind==='topic';
 $('draft-orientation').innerHTML=optionHTML(Object.fromEntries(families.map(f=>[f,f])),'All families');
 if(preferred&&families.includes(preferred))$('draft-orientation').value=preferred;
 $('draft-orientation').disabled=part?.kind==='topic'||!part;
 syncProjections();
}
function syncProjections(preferred){
 const p=availableParts().find(p=>p.id===$('draft-part').value),family=$('draft-orientation').value;
 const views=(p?.views||[]).filter(v=>!family||v.orientation===family);
 $('draft-projection-select').innerHTML=optionHTML(Object.fromEntries(views.map(v=>[v.id,v.label])));
 if(!views.length){$('draft-projection-select').innerHTML='<option value="">Enter a topic below</option>';$('custom-projection').checked=true;}
 if(views.some(v=>v.id===preferred))$('draft-projection-select').value=preferred;
 projectionDetail();syncCustom();
}
function projectionDetail(){const p=availableParts().find(p=>p.id===$('draft-part').value),v=p?.views.find(v=>v.id===$('draft-projection-select').value);$('projection-detail').textContent=v?.detail||'';}
function syncCustom(){
 const custom=$('custom-projection').checked;$('custom-projection-fields').hidden=!custom;$('draft-projection').required=custom;
 $('draft-projection-select').disabled=custom;$('draft-orientation').disabled=custom||availableParts().find(p=>p.id===$('draft-part').value)?.kind==='topic'||!$('draft-part').value;
}
function choices(){return [...$('choice-editor').querySelectorAll('.choice-row')].map(row=>({text:row.querySelector('input[type=text]').value,correct:row.querySelector('input[type=radio]').checked}));}
function renderChoices(rows){
 $('choice-editor').innerHTML=rows.map((r,i)=>'<div class="choice-row"><label><input type="radio" name="correct-choice" value="'+i+'" '+(r.correct?'checked':'')+' aria-label="Mark choice '+(i+1)+' correct"></label><input type="text" value="'+esc(r.text)+'" aria-label="Choice '+(i+1)+'" placeholder="Choice '+(i+1)+'"><button type="button" data-remove="'+i+'" aria-label="Remove choice '+(i+1)+'" '+(rows.length<=2?'disabled':'')+'>×</button></div>').join('');
 $('add-choice').disabled=rows.length>=8;
 $('choice-editor').querySelectorAll('[data-remove]').forEach(btn=>btn.onclick=()=>{const rows=choices();rows.splice(Number(btn.dataset.remove),1);renderChoices(rows);});
}
function syncType(){const short=$('draft-type').value==='short';$('options-fields').hidden=short;$('short-fields').hidden=!short;$('draft-answer').required=short;}
function clearImage(){imageRead++;uploadImage='';$('draft-image-file').value='';$('draft-image-path').value='';$('draft-image-preview').hidden=true;$('save-draft').disabled=false;$('preview-question').disabled=false;}
function resetForm(){
 const g=$('draft-group').value,t=$('draft-topic').value;$('builder-form').reset();
 if(groups.some(x=>x.id===g))$('draft-group').value=g;if(TOPICS[t])$('draft-topic').value=t;
 editId=null;editGroup=null;clearImage();$('draft-image-alt').value='';$('draft-image-caption').value='';
 $('save-draft').textContent='Save to My questions';$('cancel-edit').hidden=true;$('builder-message').textContent='';
 renderChoices(Array.from({length:4},()=>({text:'',correct:false})));syncParts();syncType();
}
function selectedProjection(){
 const group=$('draft-group').value,part=availableParts().find(p=>p.id===$('draft-part').value);
 if($('custom-projection').checked){
  const label=$('draft-projection').value.trim();if(!label)throw new Error('Enter a custom projection or topic name.');
  // Exact standard names reuse the canonical ID instead of making a duplicate.
  for(const p of availableParts()){const view=p.views.find(v=>normalize(v.label)===normalize(label));if(view)return {projection:view.label,part:p.id,projectionId:view.id,customProjection:false};}
  if(!part)throw new Error('Choose a subcategory first.');return {projection:label,part:part.id,customProjection:true};
 }
 const view=part?.views?.find(v=>v.id===$('draft-projection-select').value);
 if(!view||part.group!==group)throw new Error('Select a body part and a projection, or choose an unlisted topic.');
 return {projection:view.label,part:part.id,projectionId:view.id,customProjection:false};
}
function buildDraft(){
 const q={id:editId||('q-'+newId()),group:$('draft-group').value,...selectedProjection(),topic:$('draft-topic').value,type:$('draft-type').value,prompt:$('draft-prompt').value.trim(),answer:'',explanation:$('draft-explanation').value.trim(),source:$('draft-source').value.trim()};
 if(q.type==='mcq'){const rows=choices();if(rows.some(r=>!r.text.trim()))throw new Error('Fill in each choice or remove unused choices.');const answer=rows.find(r=>r.correct);if(!answer)throw new Error('Select the circle beside the correct answer.');q.options=rows.map(r=>r.text.trim());q.answer=answer.text.trim();}
 else{q.answer=$('draft-answer').value.trim();q.acceptedAnswers=$('draft-aliases').value.split('\n').map(s=>s.trim()).filter(Boolean);}
 const src=uploadImage||$('draft-image-path').value.trim();if(src)q.image={src,alt:$('draft-image-alt').value.trim(),caption:$('draft-image-caption').value.trim()};
 if(editId){const previous=drafts.find(d=>d.id===editId&&d.group===editGroup);if(previous?.legacyGroup){q.legacyGroup=previous.legacyGroup;q.legacyId=previous.legacyId;}}
 validateQuestions([q]);return q;
}
function editDraft(id,g){
 const q=drafts.find(q=>q.id===id&&q.group===g);if(!q)return;
 $('draft-group').value=g;resetForm();editId=id;editGroup=g;
 for(const k of ['type','topic','prompt','answer','explanation','source'])$('draft-'+k).value=q[k]||'';
 $('draft-aliases').value=(q.acceptedAnswers||[]).join('\n');if(q.options)renderChoices(q.options.map(text=>({text,correct:text===q.answer})));
 let p=availableParts().find(p=>p.views?.some(v=>v.id===q.projectionId));
 let v=p?.views.find(v=>v.id===q.projectionId);
 if(!p)for(const candidate of availableParts()){const match=candidate.views.find(v=>normalize(v.label)===normalize(q.projection));if(match){p=candidate;v=match;break;}}
 if(p){$('custom-projection').checked=false;syncParts(p.id);syncFamilies(v.orientation);syncProjections(v.id);}
 else{syncParts(Catalog.part(q));$('custom-projection').checked=true;$('draft-projection').value=q.projection;syncCustom();}
 uploadImage=q.image?.src?.startsWith('data:')?q.image.src:'';
 $('draft-image-path').value=uploadImage?'':q.image?.src||'';$('draft-image-alt').value=q.image?.alt||'';$('draft-image-caption').value=q.image?.caption||'';
 $('draft-image-preview').hidden=!q.image;if(q.image){$('draft-image-preview').src=q.image.src;document.querySelector('.image-settings').open=true;}
 $('save-draft').textContent='Save changes';$('cancel-edit').hidden=false;syncType();showView('builder');$('draft-prompt').focus();
}
function deleteDraft(id,g){
 if(!confirm('Delete this personal question? The program bank will not change.'))return;
 drafts=drafts.filter(q=>!(q.id===id&&q.group===g));if(editId===id&&editGroup===g)resetForm();persistPersonal();refreshPersonalUI();
}
function renderDrafts(){
 const g=$('draft-group').value,active=drafts.filter(q=>q.group===g);
 $('draft-count').textContent=active.length;$('export-drafts').disabled=!active.length;$('preview-drafts').disabled=!active.length;
 $('draft-list').innerHTML=active.length?active.slice(0,20).map(q=>'<div class="draft-item"><span class="small muted">'+esc(q.projection)+'</span><p>'+esc(q.prompt)+'</p><button type="button" data-edit="'+esc(q.id)+'">Edit</button> <button type="button" data-delete="'+esc(q.id)+'">Delete</button></div>').join('')+(active.length>20?'<p class="small muted">Showing 20. Find all saved questions in My questions.</p>':''):'<p class="empty small">Your first question in this category will appear here.</p>';
 $('draft-list').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editDraft(b.dataset.edit,g));
 $('draft-list').querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteDraft(b.dataset.delete,g));
}
function renderPersonal(){
 Catalog.refillFilter('personal-part',$('personal-group').value);
 const s=normalize($('personal-search').value),g=$('personal-group').value;
 const found=drafts.filter(q=>(!g||q.group===g)&&Catalog.matches(q,$('personal-part').value)&&(!s||normalize([q.prompt,q.projection,q.answer].join(' ')).includes(s)));
 $('personal-count').textContent=found.length+' personal questions · '+drafts.length+' saved in total';$('personal-more').hidden=found.length<=personalLimit;
 $('personal-study').disabled=!drafts.length;$('backup-export').disabled=!drafts.length&&!customGroups.length&&!customParts.length&&!Object.keys(customTopics).length;
 $('personal-list').innerHTML=found.length?found.slice(0,personalLimit).map(q=>'<div class="personal-item"><div style="flex:1;min-width:0">'+questionDetail(personalQuestion(q))+'</div><div class="actions"><button data-edit="'+esc(q.id)+'" data-group="'+esc(q.group)+'">Edit</button><button data-delete="'+esc(q.id)+'" data-group="'+esc(q.group)+'">Delete</button></div></div>').join(''):'<div class="empty">No personal questions yet for these filters. Create one or copy a program question to start.</div>';
 $('personal-list').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editDraft(b.dataset.edit,b.dataset.group));
 $('personal-list').querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteDraft(b.dataset.delete,b.dataset.group));wireImages($('personal-list'));Progress.wire($('personal-list'),found.slice(0,personalLimit).map(personalQuestion));
}
function downloadJSON(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function metadataForUnknown(list){
 for(const q of list){
  if(!groups.some(g=>g.id===q.group)&&!customGroups.some(g=>g.id===q.group))customGroups.push({id:q.group,name:q.group,description:'Imported personal category'});
  if(!TOPICS[q.topic]&&!customTopics[q.topic])customTopics[q.topic]=q.topic.replace(/-/g,' ');
 }
}
function mergeQuestions(incoming){
 const overlaps=incoming.filter(q=>drafts.some(d=>d.id===q.id&&d.group===q.group)).length;
 if(overlaps&&!confirm('Replace '+overlaps+' personal questions with matching IDs? Other personal questions will stay.'))return false;
 const keys=new Set(incoming.map(q=>q.group+':'+q.id));drafts=drafts.filter(q=>!keys.has(q.group+':'+q.id)).concat(incoming);return true;
}
async function readImport(file){
 if(file.size>25*1024*1024)throw new Error('Choose a JSON file smaller than 25 MB.');
 return JSON.parse(await file.text());
}
function applyImported(){
 metadataForUnknown(drafts);refreshCatalogs();Catalog.all();Object.keys(TOPICS).forEach(t=>focus.add(t));refreshControls();syncParts();refreshPersonalUI();return persistPersonal();
}
$('draft-group').onchange=()=>{if(editId){editId=null;editGroup=null;$('save-draft').textContent='Save to My questions';$('cancel-edit').hidden=true;$('builder-message').textContent='Saving in this category creates a new question; the original stays in its category.';}$('custom-projection').checked=false;syncParts();renderDrafts();};
$('draft-part').onchange=()=>{$('custom-projection').checked=false;syncFamilies();};
$('draft-orientation').onchange=()=>syncProjections();
$('draft-projection-select').onchange=projectionDetail;
$('custom-projection').onchange=syncCustom;
$('draft-type').onchange=syncType;
$('add-choice').onclick=()=>{const rows=choices();if(rows.length<8){rows.push({text:'',correct:false});renderChoices(rows);}};
$('cancel-edit').onclick=resetForm;
$('remove-image').onclick=clearImage;
$('draft-image-path').oninput=()=>{imageRead++;uploadImage='';$('draft-image-file').value='';$('draft-image-preview').hidden=true;$('save-draft').disabled=false;$('preview-question').disabled=false;};
$('draft-image-file').onchange=async()=>{
 const file=$('draft-image-file').files[0];if(!file)return;
 const token=++imageRead;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){$('builder-message').textContent='Choose a JPG, PNG, or WebP smaller than 5 MB.';$('draft-image-file').value='';return;}
 $('save-draft').disabled=true;$('preview-question').disabled=true;
 try{const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});if(token!==imageRead)return;uploadImage=data;$('draft-image-path').value='';$('draft-image-preview').src=data;$('draft-image-preview').hidden=false;$('builder-message').textContent='Image attached.';}
 catch{if(token===imageRead)$('builder-message').textContent='Could not read this image.';}
 finally{if(token===imageRead){$('save-draft').disabled=false;$('preview-question').disabled=false;}}
};
$('builder-form').onsubmit=e=>{
 e.preventDefault();try{const q=buildDraft(),i=drafts.findIndex(d=>d.id===q.id&&d.group===q.group);if(i>=0)drafts[i]=q;else drafts.push(q);const saved=persistPersonal();resetForm();refreshPersonalUI();$('builder-message').textContent=saved?'Saved. This question is now available in My questions and personal practice.':storageWarning;}
 catch(err){$('builder-message').textContent=err.message;}
};
$('preview-question').onclick=()=>{try{const q=buildDraft();startSession([personalQuestion(q)],'practice',1,false,'preview');}catch(e){$('builder-message').textContent=e.message;}};
$('preview-drafts').onclick=()=>{const qs=drafts.filter(q=>q.group===$('draft-group').value).map(personalQuestion);startSession(qs,'practice',qs.length,false,'builder');};
$('export-drafts').onclick=()=>{const qs=drafts.filter(q=>q.group===$('draft-group').value);downloadJSON(qs.map(cleanQuestion),$('draft-group').value+'.json');$('draft-status').textContent='Exported '+qs.length+' questions. This category file replaces a published file when uploaded.';};
$('import-drafts').onchange=async()=>{
 const file=$('import-drafts').files[0];if(!file)return;
 try{const data=await readImport(file);if(!Array.isArray(data))throw new Error('Use Restore questions in My questions for a question backup. This importer accepts a category question array.');
 const qs=validateQuestions(data).map(q=>({...cleanQuestion(q),group:$('draft-group').value}));if(!mergeQuestions(qs))return;const saved=applyImported();$('draft-status').textContent='Imported '+qs.length+' questions into this personal category.'+(saved?'':' '+storageWarning);}
 catch(e){$('draft-status').textContent='Import failed: '+e.message;}finally{$('import-drafts').value='';}
};
$('personal-new').onclick=()=>{resetForm();showView('builder');};
$('personal-study').onclick=()=>{$('session-source').value='personal';Catalog.all();focus=new Set(Object.keys(TOPICS));$('images-only').checked=false;$('no-images-only').checked=false;$('study-filter').value='all';refreshControls();showView('practice');};
['personal-search','personal-group','personal-part'].forEach(id=>$(id).addEventListener(id==='personal-search'?'input':'change',()=>{personalLimit=50;renderPersonal();}));
$('personal-more').onclick=()=>{personalLimit+=50;renderPersonal();};
$('backup-export').onclick=()=>{downloadJSON({version:2,groups:groups.map(({id,name,description})=>({id,name,description})),focuses:TOPICS,subcategories:customParts,questions:drafts.map(q=>({...cleanQuestion(q),group:q.group}))},'positioning-personal-backup.json');$('personal-status').textContent='Question backup exported, including your questions, embedded images, categories, subcategories, and focuses. Separate image-path files must be copied separately.';};
$('backup-import').onchange=async()=>{
 const file=$('backup-import').files[0];if(!file)return;
 try{
  const d=await readImport(file);if(d.version!==2)throw new Error('Choose a version 2 personal backup.');
  validateMetadata(d.groups,d.focuses);validatePersonal(d.questions);Catalog.validate(d.subcategories||[]);
  if(!mergeQuestions(d.questions.map(q=>({...cleanQuestion(q),group:q.group}))))return;
  for(const p of d.subcategories||[]){const i=customParts.findIndex(x=>x.group===p.group&&x.id===p.id);const clean={id:p.id,name:p.name,group:p.group,kind:'topic',views:[]};if(i>=0)customParts[i]=clean;else customParts.push(clean);}
  for(const g of d.groups)if(!baseGroups.some(b=>b.id===g.id)){const i=customGroups.findIndex(c=>c.id===g.id);if(i>=0)customGroups[i]=g;else customGroups.push(g);}
  for(const [id,name] of Object.entries(d.focuses))if(!baseTopics[id])customTopics[id]=name;
  const saved=applyImported();$('personal-status').textContent='Restored '+d.questions.length+' questions. Other personal questions were kept.'+(saved?'':' '+storageWarning);
 }catch(e){$('personal-status').textContent='Restore failed: '+e.message;}finally{$('backup-import').value='';}
};
$('add-group').onclick=()=>{
 const name=$('new-group-name').value.trim();if(!name){$('catalog-status').textContent='Enter a category name.';return;}
 const duplicate=groups.find(g=>normalize(g.name)===normalize(name));if(duplicate){$('draft-group').value=duplicate.id;syncParts();renderDrafts();$('catalog-status').textContent='That category already exists. Selected it for you.';return;}
 const id='personal-'+newId();customGroups.push({id,name,description:'Personal category'});selected.add(id);refreshCatalogs();refreshControls();$('draft-group').value=id;syncParts();renderDrafts();const saved=persistPersonal();$('new-group-name').value='';$('catalog-status').textContent='Category added. Use an unlisted subject to start.'+(saved?'':' '+storageWarning);
};
$('add-focus').onclick=()=>{
 const name=$('new-focus-name').value.trim();if(!name){$('catalog-status').textContent='Enter a focus name.';return;}
 const duplicate=Object.entries(TOPICS).find(([,label])=>normalize(label)===normalize(name));if(duplicate){$('draft-topic').value=duplicate[0];$('catalog-status').textContent='That focus already exists. Selected it for you.';return;}
 const id='personal-'+newId();customTopics[id]=name;focus.add(id);refreshCatalogs();refreshControls();$('draft-topic').value=id;const saved=persistPersonal();$('new-focus-name').value='';$('catalog-status').textContent='Focus added.'+(saved?'':' '+storageWarning);
};
$('add-part').onclick=Catalog.add;
init();
