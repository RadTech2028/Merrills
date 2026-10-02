'use strict';
// projections.json is the shared subcategory catalog. Questions refer to its part IDs.
const Catalog=(()=>{
 let entries=[],owners=new Map(),labels=new Map();
 const chosen=new Map(),expanded=new Set();
 const pair=(g,p)=>JSON.stringify([g,p]);
 function part(q){return owners.get(pair(q.group,q.projectionId))||q.part||labels.get(pair(q.group,normalize(q.projection||'')))||'general';}
 function forGroup(group){return entries.filter(p=>p.group===group);}
 function migratePersonal(){
  const used=new Set(drafts.filter(q=>q.group==='pathology').map(q=>q.id));
  for(const q of drafts)if(q.group==='trauma'){
   q.legacyGroup='trauma';q.legacyId=q.id;q.group='pathology';
   if(used.has(q.id)){q.id='trauma-'+q.id;while(used.has(q.id))q.id='trauma-'+q.id;}used.add(q.id);
   if(!q.part||['fractures','dislocation'].includes(q.part))q.part='fractures-dislocations';
  }
  customGroups=customGroups.filter(g=>g.id!=='trauma');
  customParts=customParts.map(p=>p.group==='trauma'?{...p,group:'pathology'}:p);
 }
 function rebuild(){
  entries=[...parts,...customParts.filter(p=>!parts.some(base=>base.group===p.group&&base.id===p.id)).map(p=>({...p,kind:'topic',views:[]}))];
  owners=new Map();labels=new Map();
  for(const p of entries)for(const v of p.views||[]){owners.set(pair(p.group,v.id),p.id);labels.set(pair(p.group,normalize(v.label)),p.id);}
  for(const q of [...bank,...drafts]){
   const id=part(q);if(!entries.some(p=>p.group===q.group&&p.id===id))entries.push({id,group:q.group,name:id==='general'?'General / not assigned':id.replace(/-/g,' '),kind:'topic',views:[]});
  }
  for(const g of groups)if(!forGroup(g.id).length)entries.push({id:'general',group:g.id,name:'General',kind:'topic',views:[]});
 }
 function sync(){for(const g of groups)if(!chosen.has(g.id))chosen.set(g.id,new Set(selected.has(g.id)?forGroup(g.id).map(p=>p.id):[]));}
 function all(on=true){for(const g of groups)chosen.set(g.id,new Set(on?forGroup(g.id).map(p=>p.id):[]));selected=new Set(on?groups.map(g=>g.id):[]);}
 function include(q){return selected.has(q.group)&&!!chosen.get(q.group)?.has(part(q));}
 function label(q){return forGroup(q.group).find(p=>p.id===part(q))?.name||part(q);}
 function renderGroups(){
  sync();const pool=poolFor($('session-source').value),counts=new Map();
  for(const q of pool){const k=pair(q.group,part(q));counts.set(k,(counts.get(k)||0)+1);}
  $('group-grid').innerHTML=groups.map((g,i)=>{
   const ps=forGroup(g.id),selection=chosen.get(g.id),allChecked=ps.every(p=>selection.has(p.id));
   const n=ps.reduce((sum,p)=>sum+(counts.get(pair(g.id,p.id))||0),0),picked=ps.filter(p=>selection.has(p.id)).length;
   return '<section class="group-card category-select"><label class="category-heading"><span class="group-number">'+String(i+1).padStart(2,'0')+'</span><input data-category="'+esc(g.id)+'" type="checkbox" '+(allChecked?'checked':'')+' aria-label="Select all '+esc(g.name)+'"><strong>'+esc(g.name)+'</strong></label><small>'+esc(g.description||'Personal category')+'</small><span class="count">'+(n?n+' questions':'Ready for questions')+'</span><details data-parts-panel="'+esc(g.id)+'" '+(expanded.has(g.id)?'open':'')+'><summary>Choose parts / topics <span class="muted">'+picked+' / '+ps.length+'</span></summary><div class="part-choices">'+ps.map(p=>'<label><input type="checkbox" data-category="'+esc(g.id)+'" data-part="'+esc(p.id)+'" '+(selection.has(p.id)?'checked':'')+'><span>'+esc(p.name)+'</span><small>'+(counts.get(pair(g.id,p.id))||0)+'</small></label>').join('')+'</div></details></section>';
  }).join('');
  $('group-grid').querySelectorAll('input[data-category]:not([data-part])').forEach(el=>{const ps=forGroup(el.dataset.category),set=chosen.get(el.dataset.category);el.indeterminate=set.size>0&&!ps.every(p=>set.has(p.id));});
  $('group-grid').querySelectorAll('[data-parts-panel]').forEach(el=>el.ontoggle=()=>{if(el.open)expanded.add(el.dataset.partsPanel);else expanded.delete(el.dataset.partsPanel);});
 }
 function change(target){
  const g=target.dataset.category;if(!g)return;
  if(target.dataset.part){const set=chosen.get(g)||new Set();target.checked?set.add(target.dataset.part):set.delete(target.dataset.part);chosen.set(g,set);if(set.size)selected.add(g);else selected.delete(g);expanded.add(g);}
  else{chosen.set(g,new Set(target.checked?forGroup(g).map(p=>p.id):[]));if(target.checked)selected.add(g);else selected.delete(g);}
  const p=target.dataset.part;renderGroups();updateSetup();
  const matches=$('group-grid').querySelectorAll('input[data-category]');
  for(const el of matches)if(el.dataset.category===g&&el.dataset.part===p){el.focus({preventScroll:true});break;}
 }
 function fullySelected(){sync();return groups.every(g=>selected.has(g.id)&&forGroup(g.id).every(p=>chosen.get(g.id).has(p.id)));}
 function options(group){return '<option value="">All parts / topics</option>'+entries.filter(p=>!group||p.group===group).map(p=>'<option value="'+esc(pair(p.group,p.id))+'">'+esc((group?'':(groups.find(g=>g.id===p.group)?.name||p.group)+' · ')+p.name)+'</option>').join('');}
 function refillFilter(id,group){refill(id,options(group));}
 function matches(q,value){return !value||pair(q.group,part(q))===value;}
 function validate(list){
  if(!Array.isArray(list))throw new Error('Subcategories must be an array.');
  const seen=new Set();for(const p of list){if(!p||typeof p.id!=='string'||!/^[a-z0-9-]+$/.test(p.id)||typeof p.group!=='string'||!/^[a-z0-9-]+$/.test(p.group)||typeof p.name!=='string'||!p.name.trim()||seen.has(pair(p.group,p.id)))throw new Error('Subcategories need unique IDs, a category, and a name.');seen.add(pair(p.group,p.id));}
 }
 function add(){
  const group=$('draft-group').value,name=$('new-part-name').value.trim();if(!group||!name){$('catalog-status').textContent='Choose a category and enter a subcategory name.';return;}
  const existing=forGroup(group).find(p=>normalize(p.name)===normalize(name));if(existing){$('catalog-status').textContent='That subcategory already exists.';syncParts(existing.id);return;}
  const id='part-'+newId();customParts.push({id,name,group,kind:'topic',views:[]});refreshCatalogs();sync();chosen.get(group).add(id);selected.add(group);refreshControls();syncParts(id);const saved=persistPersonal();$('new-part-name').value='';$('catalog-status').textContent='Subcategory added. Enter a topic or projection for it.'+(saved?'':' '+storageWarning);
 }
 return {migratePersonal,part,forGroup,rebuild,sync,all,include,label,renderGroups,change,fullySelected,refillFilter,matches,validate,add};
})();
