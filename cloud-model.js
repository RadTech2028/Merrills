/* Shared document and merge rules. No network or browser dependencies. */
(function(root){
 'use strict';
 const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const copy=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
 const empty=()=>({schemaVersion:1,progress:{},preferences:{},achievements:[],personal:{version:2,questions:[],groups:[],subcategories:[],focuses:{}}});
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 function validate(d){
  if(!d||d.schemaVersion!==1||!d.progress||typeof d.progress!=='object'||Array.isArray(d.progress)||!d.preferences||typeof d.preferences!=='object'||Array.isArray(d.preferences)||!Array.isArray(d.achievements)||!d.personal)throw Error('Unsupported cloud document.');
  if(Object.keys(d.progress).length>15000||d.achievements.length>1000)throw Error('Cloud document is too large.');
  for(const [k,r] of Object.entries(d.progress)){
   const a=JSON.parse(k);if(k.length>600||!Array.isArray(a)||a.length!==3||!['program','personal'].includes(a[0])||!a.slice(1).every(v=>typeof v==='string'&&v.length)||JSON.stringify(a)!==k)throw Error('Invalid question key.');
   if(!Array.isArray(r)||r.length!==10||!r.every(n=>Number.isSafeInteger(n)&&n>=0)||r[1]>r[0]||r[4]>r[1]||r[5]>2||r[6]>3||r[7]>1||r[9]>4294967295||r[0]>1e9||r[2]>8640000000000000||r[8]>8640000000000000)throw Error('Invalid progress row.');
  }
  if(d.achievements.some(v=>typeof v!=='string'||v.length>240))throw Error('Invalid badges.');
  if(d.personal.version!==2||!Array.isArray(d.personal.questions)||!Array.isArray(d.personal.groups)||!Array.isArray(d.personal.subcategories)||!d.personal.focuses||typeof d.personal.focuses!=='object'||Array.isArray(d.personal.focuses))throw Error('Invalid personal bank.');
  for(const list of [d.personal.questions,d.personal.groups,d.personal.subcategories]){const ids=new Set();for(const v of list){if(!v||typeof v.id!=='string'||!v.id||v.id.length>600)throw Error('Invalid personal ID.');const id=JSON.stringify([v.group||'',v.id]);if(ids.has(id))throw Error('Duplicate personal ID.');ids.add(id);}}
  if(JSON.stringify(d).length>2500000)throw Error('Cloud save exceeds 2.5 million characters. Export large embedded images and use image paths. Nothing was uploaded.');
  return d;
 }
 function fields(base,local,remote){const out=Object.create(null);for(const k of new Set([...Object.keys(base||{}),...Object.keys(local||{}),...Object.keys(remote||{})])){if(['__proto__','constructor','prototype'].includes(k))continue;const v=eq(local?.[k],base?.[k])?remote?.[k]:local?.[k];if(v!==undefined)out[k]=copy(v);}return out;}
 function rows(base,local,remote){const out=Object.create(null);for(const k of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])){
  const b=base[k],l=local[k],r=remote[k];let v;
  if(eq(l,b))v=r;else if(eq(r,b)||eq(l,r))v=l;else if(!l)v=r;else if(!r)v=l;else {
   v=copy(l[8]>=r[8]?l:r);
   if(l[9]===r[9]){v[0]=Math.max(l[0],r[0]);v[1]=Math.max(l[1],r[1]);v[2]=Math.max(l[2],r[2]);if(l[3]===r[3])v[4]=Math.max(l[4],r[4]);}
  }
  if(v!==undefined)out[k]=copy(v);
 }return out;}
 function listMerge(b,l,r,questions){
  const key=v=>JSON.stringify([v.group||'',v.id]);const bm=Object.fromEntries(b.map(v=>[key(v),v])),lm=Object.fromEntries(l.map(v=>[key(v),v])),rm=Object.fromEntries(r.map(v=>[key(v),v]));const out=fields(bm,lm,rm);
  if(questions)for(const [k,rv] of Object.entries(rm)){if(lm[k]&&!eq(lm[k],rv)&&!eq(lm[k],bm[k])&&!eq(rv,bm[k])){let suffix=2166136261;for(const ch of JSON.stringify(rv))suffix=Math.imul(suffix^ch.charCodeAt(0),16777619);const alternative={...copy(rv),id:rv.id+'-cloud-'+(suffix>>>0).toString(16)};out[key(alternative)]=alternative;}}
  return Object.values(out);
 }
 function merge(base,local,remote){base=base||empty();validate(local);validate(remote);const out=empty();out.progress=rows(base.progress,local.progress,remote.progress);out.preferences=fields(base.preferences,local.preferences,remote.preferences);out.achievements=[...new Set([...local.achievements,...remote.achievements])].sort();for(const k of ['questions','groups','subcategories'])out.personal[k]=listMerge(base.personal[k]||[],local.personal[k],remote.personal[k],k==='questions');out.personal.focuses=fields(base.personal.focuses,local.personal.focuses,remote.personal.focuses);return validate(out);}
 root.CloudModel={empty,validate,merge,equal:eq};
})(typeof globalThis!=='undefined'?globalThis:this);
