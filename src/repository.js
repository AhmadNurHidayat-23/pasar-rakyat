import {date} from './core/validate.js';
export const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'});
export const days=(a,b)=>(Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000;
export const previous=date=>new Date(Date.parse(date+'T00:00:00Z')-86400000).toISOString().slice(0,10);
export function leases(store){return store.all('SELECT l.*,k.code kiosk,b.name block,t.name trader,t.code trader_code,t.business FROM leases l JOIN kiosks k ON k.id=l.kiosk_id JOIN blocks b ON b.id=k.block_id JOIN traders t ON t.id=l.trader_id ORDER BY l.starts_on DESC,l.id DESC');}
export function snapshot(store,filters={}){
 const asOf=date(filters.as_of||today()),all=leases(store),q=String(filters.q||'').toLowerCase().trim().slice(0,120);
 const kiosks=store.all('SELECT k.*,b.name block FROM kiosks k JOIN blocks b ON b.id=k.block_id WHERE k.archived=? ORDER BY b.name,k.code',filters.archived==='1'?1:0).map(k=>{
  const occupancy=all.find(l=>l.kiosk_id===k.id&&!l.canceled&&l.starts_on<=asOf&&l.ends_on>=asOf)||null;
  return {...k,occupancy,status:occupancy?'Terisi':'Kosong'};
 }).filter(k=>(!filters.block_id||String(k.block_id)===String(filters.block_id))&&(!q||[k.code,k.block,k.occupancy?.trader||''].some(v=>v.toLowerCase().includes(q)))&&(!filters.status||k.status===filters.status));
 const ids=new Set(kiosks.filter(k=>!k.archived).map(k=>k.id));
 const expiring=all.filter(l=>ids.has(l.kiosk_id)&&!l.canceled&&l.starts_on<=asOf&&l.ends_on>=asOf&&days(asOf,l.ends_on)<=30).map(l=>({...l,daysLeft:days(asOf,l.ends_on)})).sort((a,b)=>a.ends_on.localeCompare(b.ends_on));
 const traders=store.all('SELECT t.*,c.name category FROM traders t JOIN categories c ON c.id=t.category_id WHERE t.archived=? ORDER BY t.name',filters.trader_archived==='1'?1:0).filter(t=>(!q||[t.name,t.code,t.business].some(v=>v.toLowerCase().includes(q)))&&(!filters.category_id||String(t.category_id)===String(filters.category_id)));
 return {asOf,kiosks,traders,leases:all,expiring,blocks:store.all('SELECT * FROM blocks ORDER BY name'),categories:store.all('SELECT * FROM categories ORDER BY name'),allKiosks:store.all('SELECT k.id,k.code,b.name block FROM kiosks k JOIN blocks b ON b.id=k.block_id WHERE k.archived=0 ORDER BY b.name,k.code'),allTraders:store.all('SELECT id,code,name FROM traders WHERE archived=0 ORDER BY name'),summary:{total:kiosks.length,occupied:kiosks.filter(k=>k.occupancy).length,vacant:kiosks.filter(k=>!k.occupancy).length,expiring:expiring.length}};
}
