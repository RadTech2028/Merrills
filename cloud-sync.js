/* Optional cloud sync; authentication credentials exist in memory only. */
'use strict';
const CloudSync=(()=>{
 const cfg=window.POSITIONING_CLOUD||{},path=location.pathname.replace(/\/?(?:index\.html)?$/,'/'),prefix='positioning-progress-v1:'+path+':',ownerKey='positioning-cloud-owner-v1:'+path;
 const prefKey='positioning-preferences-v1:'+path,badgeKey='positioning-achievements-v1:'+path;
 let token='',nonce='',user=null,bridge=null,bridgeOrigin='',channel='',frame=null,connecting=null,busy=false,applying=false,approved=false,base=null,revision=0,lastSync='',timer=null,retry=15000,generation=0,dbPromise=null;
 const pending=new Map(),el=id=>document.getElementById(id);
 const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(24)),n=>n.toString(16).padStart(2,'0')).join('');
 function status(message){if(el('cloud-status'))el('cloud-status').textContent=message;}
 function storageOwner(){return localStorage.getItem(ownerKey)||'';}
 function idle(){return !$('app').hidden&&!document.hidden&&!(session&&!session.finished)&&$('builder-view').hidden&&!document.querySelector('dialog[open]');}
 function database(){return dbPromise||(dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open('positioning-cloud-cache-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('Browser recovery storage is unavailable. Cloud sync is paused.'));}));}
 async function dbGet(key){const db=await database();return new Promise((resolve,reject)=>{const r=db.transaction('state').objectStore('state').get(path+key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
 async function dbPut(key,value){const db=await database();return new Promise((resolve,reject)=>{const t=db.transaction('state','readwrite');t.objectStore('state').put(value,path+key);t.oncomplete=resolve;t.onerror=()=>reject(Error('Recovery storage is full. Export a backup before syncing.'));t.onabort=()=>reject(Error('Recovery storage is unavailable.'));});}
 function snapshot(){const p=Progress.backup();return CloudModel.validate({schemaVersion:1,progress:Object.fromEntries(p.records),preferences:Preferences.cloudSnapshot(),achievements:p.profile.achievements||[],personal:{version:2,questions:structuredClone(drafts),groups:structuredClone(customGroups),subcategories:structuredClone(customParts),focuses:structuredClone(customTopics)}});}
 function validateForApp(d){CloudModel.validate(d);validatePersonal(d.personal.questions);validateMetadata(d.personal.groups,d.personal.focuses);Catalog.validate(d.personal.subcategories);Progress.validateBackup({app:'positioning-lab-progress',version:1,records:Object.entries(d.progress)});}
 async function recover(local,remote){await dbPut('recovery',{createdAt:new Date().toISOString(),local,cloud:remote});}
 function apply(d){
  validateForApp(d);const writes=new Map([[prefKey,JSON.stringify(d.preferences)],[badgeKey,JSON.stringify(d.achievements)],['positioning-personal-v2',JSON.stringify(d.personal)]]);
  for(const [k,r] of Object.entries(d.progress))writes.set(prefix+k,JSON.stringify(r));
  const before=new Map();for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(prefix)||writes.has(k))before.set(k,localStorage.getItem(k));}
  applying=true;
  try{
   for(const k of before.keys())if(k.startsWith(prefix)&&!writes.has(k))localStorage.removeItem(k);
   for(const [k,v] of writes)localStorage.setItem(k,v);
  }catch(e){for(const k of writes.keys())try{if(before.has(k))localStorage.setItem(k,before.get(k));else localStorage.removeItem(k);}catch{}for(const [k,v] of before)try{localStorage.setItem(k,v);}catch{}applying=false;throw Error('Local storage is full. A recovery copy was saved; export it before continuing.');}
  try{
   drafts=structuredClone(d.personal.questions);customGroups=structuredClone(d.personal.groups);customParts=structuredClone(d.personal.subcategories);customTopics=structuredClone(d.personal.focuses);
   refreshCatalogs();selected=new Set([...selected].filter(id=>groups.some(g=>g.id===id)));for(const g of groups)if(g.id.startsWith('personal-'))selected.add(g.id);
   focus=new Set([...focus,...Object.keys(TOPICS)]);refreshControls();refreshPersonalUI();
   Preferences.cloudReload();StudyProfile.cloudReload();Progress.cloudReload();updateSetup();if(!$('progress-view').hidden)Progress.render();if(!$('browse-view').hidden)renderBank();
  }finally{applying=false;}
 }
 function connect(){
  if(bridge)return Promise.resolve();if(connecting)return connecting;
  connecting=new Promise((resolve,reject)=>{
   channel=random();frame=document.createElement('iframe');frame.hidden=true;frame.title='Google cloud sync bridge';frame.referrerPolicy='no-referrer';frame.src=cfg.deploymentUrl+'?channel='+channel;
   const timeout=setTimeout(()=>{connecting=null;window.removeEventListener('message',listener);frame?.remove();reject(Error('Could not connect to Apps Script. Check the deployment permissions or try another browser.'));},25000);
   const listener=event=>{
    const m=event.data;if(!m||m.channel!==channel||m.type!=='ready'||!/^https:\/\/([a-z0-9-]+-)?script\.googleusercontent\.com$/.test(event.origin))return;
    bridge=event.source;bridgeOrigin=event.origin;clearTimeout(timeout);window.removeEventListener('message',listener);resolve();
   };
   window.addEventListener('message',listener);document.body.append(frame);
  });return connecting;
 }
 window.addEventListener('message',event=>{
  if(event.source!==bridge||event.origin!==bridgeOrigin)return;const m=event.data;if(!m||m.channel!==channel||m.type!=='response')return;const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timeout);p.resolve(m.result);
 });
 async function request(action,extra={}){
  if(!navigator.onLine)throw Error('Offline. Progress is saved on this device.');await connect();
  const result=await new Promise((resolve,reject)=>{const id=random();const timeout=setTimeout(()=>{pending.delete(id);reject(Error('Cloud request timed out. Your local progress is safe.'));},45000);pending.set(id,{resolve,timeout});bridge.postMessage({type:'request',channel,id,request:{action,token,nonce,...extra}},bridgeOrigin);});
  if(result.error==='AUTH'){token='';approved=false;throw Error('Google sign-in expired. Sign in again to sync; local progress is safe.');}
  if(!result.ok&&result.error!=='CONFLICT')throw Error('Sync error ('+(result.error||'UNAVAILABLE')+'). Your local progress is safe.');return result;
 }
 function showAccount(){el('cloud-account').textContent=user?(user.name||user.email)+' · Google Account':'Progress is saved on this device.';el('cloud-signout').hidden=!user;el('cloud-now').hidden=!user;el('cloud-last').textContent=lastSync?'Last sync: '+new Date(lastSync).toLocaleString():'';}
 function counts(d){return Object.keys(d?.progress||{}).length+' question records · '+(d?.achievements||[]).length+' badges · '+(d?.personal?.questions||[]).length+' personal questions';}
 async function choose(local,remote,other){
  const dialog=el('cloud-choice');el('cloud-local-summary').textContent=counts(local);el('cloud-remote-summary').textContent=counts(remote);
  el('cloud-choice-note').textContent=other?'This device still contains another account’s data. Use cloud to switch safely. Merge or Use this device will deliberately import that data into the newly selected account.':'Choose how to combine this device with your Google account. Merge keeps both histories; concurrent counts use the higher value to avoid duplicate XP.';
  return new Promise(resolve=>{let done=false;const finish=value=>{if(done)return;done=true;dialog.close();resolve(value);};for(const b of dialog.querySelectorAll('[data-cloud-choice]'))b.onclick=()=>finish(b.dataset.cloudChoice);dialog.oncancel=e=>{e.preventDefault();finish('cancel');};dialog.showModal();dialog.querySelector('[data-cloud-choice="'+(other?'cloud':'merge')+'"]').focus();});
 }
 async function initial(credential){
  if(busy)return;if(!idle()){status('Finish the session or close the editor/dialog, then sign in.');return;}
  busy=true;approved=false;const gen=++generation;
  try{
   token=credential;status('Connecting…');const cloud=await request('load');if(gen!==generation)return;
   if(!idle())throw Error('Close the current session or dialog and sign in again.');user=cloud.user;showAccount();const owner=storageOwner(),saved=await dbGet('baseline');let local=snapshot(),remote=cloud.data||CloudModel.empty(),target;
   if(owner===user.sub&&saved?.owner===user.sub){lastSync=saved.lastSync||'';base=saved.data;target=CloudModel.merge(base,local,remote);}
   else{const choice=await choose(local,remote,!!owner&&owner!==user.sub);if(choice==='cancel'){token='';user=null;showAccount();status('Cloud connection cancelled. Local progress is unchanged.');return;}local=snapshot();target=choice==='cloud'?remote:choice==='local'?local:CloudModel.merge(null,local,remote);}
   if(gen!==generation)return;validateForApp(target);await recover(local,remote);
   if(!CloudModel.equal(snapshot(),local))throw Error('Local data changed during sign-in. Please sign in again to import the latest copy.');
   // Store pending import before changing local data; a failed upload can be retried safely.
   await dbPut('baseline',{owner:user.sub,data:remote,revision:cloud.revision});localStorage.setItem(ownerKey,user.sub);
   apply(target);base=remote;revision=cloud.revision;approved=true;status('Saving…');
  }catch(e){status(e.message);}finally{busy=false;showAccount();}
  if(approved)sync();
 }
 async function sync(){
  if(!token||!approved||busy)return;if(!idle()){status(navigator.onLine?'Saved locally. Sync resumes after your session or editor closes.':'Offline. Progress is saved on this device.');return;}
  const gen=generation;busy=true;
  try{
   if(storageOwner()!==user.sub)throw Error('The account on this device changed in another tab. Sign in again.');
   if(Date.now()>=user.expiresAt){token='';approved=false;throw Error('Google sign-in expired. Sign in again to sync.');}
   status('Saving…');
   for(let attempt=0;attempt<3;attempt++){
    const cloud=await request('load');if(gen!==generation)return;
    if(!idle()){status('Saved locally. Cloud sync will resume when you finish.');return;}
    const local=snapshot(),remote=cloud.data||CloudModel.empty();const merged=CloudModel.merge(base,local,remote);validateForApp(merged);
    let result={ok:true,revision:cloud.revision,updatedAt:cloud.updatedAt};
    if(!CloudModel.equal(merged,remote))result=await request('save',{baseRevision:cloud.revision,data:merged});
    if(gen!==generation)return;if(result.error==='CONFLICT')continue;
    // Do not overwrite edits made while the request was in flight.
    if(!idle()||!CloudModel.equal(snapshot(),local)){status('New local changes are waiting to sync.');schedule();return;}
    if(!CloudModel.equal(local,merged)){await recover(local,remote);if(!idle()||!CloudModel.equal(snapshot(),local)){schedule();return;}apply(merged);}
    base=merged;revision=result.revision;lastSync=new Date().toISOString();await dbPut('baseline',{owner:user.sub,data:base,revision,lastSync});retry=15000;status('Synced');showAccount();return;
   }
   throw Error('Another device is saving. Retrying shortly.');
  }catch(e){status(e.message);if(token&&approved){clearTimeout(timer);timer=setTimeout(sync,retry);retry=Math.min(300000,retry*2);}}
  finally{busy=false;}
 }
 function schedule(){if(applying||!approved)return;status('Changes saved locally. Waiting to sync…');clearTimeout(timer);timer=setTimeout(sync,10000);}
 function signout(){generation++;token='';user=null;approved=false;base=null;clearTimeout(timer);window.google?.accounts.id.disableAutoSelect();showAccount();status('Signed out. This device keeps its local progress.');}
 let gisLoaded=false;
 async function login(){
  try{
   if(!cfg.enabled)throw Error('Google sync has not been configured yet.');
   if(!idle())throw Error('Finish the current session or close the editor/dialog before signing in.');
   if(!gisLoaded){status('Loading Google sign-in…');await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.onload=resolve;s.onerror=()=>reject(Error('Google sign-in could not load. Check your connection.'));document.head.append(s);});gisLoaded=true;}
   nonce=random();google.accounts.id.initialize({client_id:cfg.clientId,nonce,auto_select:false,callback:result=>initial(result.credential)});el('cloud-google-button').replaceChildren();google.accounts.id.renderButton(el('cloud-google-button'),{theme:'outline',size:'large',text:'signin_with',width:240});status('Choose your Google account to connect.');
  }catch(e){status(e.message);}
 }
 async function exportRecovery(){try{const saved=await dbGet('recovery');if(!saved)throw Error('No recovery copy has been needed yet.');downloadJSON({app:'positioning-cloud-recovery',version:1,...saved},'positioning-cloud-recovery.json');status('Recovery copy exported. It includes the device and cloud versions before import.');}catch(e){status(e.message);}}
 async function restoreRecovery(){
  try{if(!idle())throw Error('Finish your session or close the editor first.');const saved=await dbGet('recovery');if(!saved)throw Error('No recovery copy is available.');if(!confirm('Restore this device’s pre-sync copy and sign out? The cloud copy will stay unchanged.'))return;signout();apply(saved.local);localStorage.removeItem(ownerKey);await dbPut('baseline',null);status('Pre-sync device copy restored. Sign in to choose how to reconnect.');}catch(e){status(e.message);}
 }
 function init(){
  const host=document.createElement('section');host.className='panel cloud-panel';host.setAttribute('aria-label','Google cloud save');host.innerHTML='<h2>Cloud save</h2><p id="cloud-account">Progress is saved on this device.</p><div class="actions"><button id="cloud-login">Sign in with Google</button><button id="cloud-now" hidden>Sync now</button><button id="cloud-signout" hidden>Sign out</button></div><div id="cloud-google-button"></div><p id="cloud-status" role="status">Optional. Connect Google to carry your progress between devices.</p><p id="cloud-last" class="small muted"></p><details><summary>Recovery and privacy</summary><p class="small muted">Your saved progress, preferences, badges, and personal questions are stored in the site owner’s private Google Sheet when you connect. Sign-out stops syncing but keeps this device’s copy. Google credentials are never stored. A recovery copy is kept before imports. <a href="./privacy.html" target="_blank" rel="noopener">Privacy</a></p><div class="actions"><button id="cloud-recovery">Export recovery copy</button><button id="cloud-restore">Restore pre-sync device copy</button></div></details>';
  $('progress-view').insertBefore(host,$('study-profile'));
  const dialog=document.createElement('dialog');dialog.id='cloud-choice';dialog.className='preferences-dialog';dialog.setAttribute('aria-labelledby','cloud-choice-title');dialog.innerHTML='<h2 id="cloud-choice-title">Connect your progress</h2><p id="cloud-choice-note"></p><h3>This device</h3><p id="cloud-local-summary"></p><h3>Google cloud</h3><p id="cloud-remote-summary"></p><p class="small muted">A recovery copy is saved before applying your choice. Use cloud replaces the device copy. Use this device replaces the cloud copy after a version check.</p><div class="actions"><button data-cloud-choice="merge" class="primary">Merge progress</button><button data-cloud-choice="cloud">Use cloud</button><button data-cloud-choice="local">Use this device</button><button data-cloud-choice="cancel">Cancel</button></div>';document.body.append(dialog);
  el('cloud-login').onclick=login;el('cloud-now').onclick=()=>{if(!approved)login();else sync();};el('cloud-signout').onclick=signout;el('cloud-recovery').onclick=exportRecovery;el('cloud-restore').onclick=restoreRecovery;
  if(!cfg.enabled){el('cloud-login').disabled=true;status('Google cloud save is not enabled yet. Local study and backups work normally.');}
  window.addEventListener('positioning-data-changed',schedule);window.addEventListener('online',()=>sync());window.addEventListener('offline',()=>{if(user)status('Offline. Progress is saved on this device.');});
  window.addEventListener('storage',e=>{if(e.key===ownerKey&&user&&e.newValue!==user.sub){signout();status('Account changed in another tab. Reload before studying.');}else if(e.key?.startsWith('positioning-'))schedule();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});setInterval(()=>{if(approved&&!document.hidden)sync();},120000);
 }
 document.addEventListener('DOMContentLoaded',init,{once:true});return {sync};
})();
