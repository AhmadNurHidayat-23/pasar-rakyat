import {text,integer,date,fail} from './core/validate.js';
import {previous,today} from './repository.js';
export function find(s,kind,id){if(!['traders','kiosks','blocks','categories','leases'].includes(kind))fail('Jenis data tidak valid.');const row=s.get('SELECT * FROM '+kind+' WHERE id=?',integer(id,'ID',1));if(!row)fail('Data tidak ditemukan.',404);return row;}
export function master(s,kind,data,id=0){
 if(!['blocks','categories'].includes(kind))fail('Jenis data tidak valid.');
 const name=text(data.name,kind==='blocks'?'Nama blok':'Kategori usaha',80);if(id)find(s,kind,id);
 if(id)s.run('UPDATE '+kind+' SET name=? WHERE id=?',name,id);else s.run('INSERT INTO '+kind+'(name) VALUES(?)',name);
}
export function trader(s,data,id=0){
 if(id&&find(s,'traders',id).archived)fail('Pulihkan pedagang terlebih dahulu.');
 const category=integer(data.category_id,'Kategori usaha',1);find(s,'categories',category);
 const values=[text(data.code,'Kode pedagang',40).toUpperCase(),text(data.name,'Nama pedagang demonstrasi',100),text(data.business,'Nama usaha / dagangan'),category];
 if(id)s.run('UPDATE traders SET code=?,name=?,business=?,category_id=? WHERE id=?',...values,id);else s.run('INSERT INTO traders(code,name,business,category_id) VALUES(?,?,?,?)',...values);
}
export function kiosk(s,data,id=0){
 if(id&&find(s,'kiosks',id).archived)fail('Pulihkan kios terlebih dahulu.');
 const block=integer(data.block_id,'Blok',1);find(s,'blocks',block);
 const values=[text(data.code,'Kode kios',40).toUpperCase(),block,text(data.description??'','Keterangan kios',300,false)];
 if(id)s.run('UPDATE kiosks SET code=?,block_id=?,description=? WHERE id=?',...values,id);else s.run('INSERT INTO kiosks(code,block_id,description) VALUES(?,?,?)',...values);
}
function available(s,kiosk,start,end,exclude=0){if(s.get('SELECT id FROM leases WHERE kiosk_id=? AND canceled=0 AND id<>? AND starts_on<=? AND ends_on>=?',kiosk,exclude,end,start))fail('Kios sudah ditempati pada sebagian atau seluruh periode tersebut.',409);}
function event(s,id,action,note,user){s.run('INSERT INTO events(lease_id,action,note,actor_id) VALUES(?,?,?,?)',id,action,note,user.id);}
function placement(s,user,data,origin=null){
 const kiosk=integer(data.kiosk_id,'Kios',1),trader=integer(data.trader_id,'Pedagang',1),start=date(data.starts_on),end=date(data.ends_on),note=text(data.note,'Catatan penggunaan',1000);
 if(end<start)fail('Tanggal akhir harus pada atau setelah tanggal mulai.');
 if(find(s,'kiosks',kiosk).archived||find(s,'traders',trader).archived)fail('Pilih kios dan pedagang yang belum diarsipkan.');
 available(s,kiosk,start,end);
 const id=Number(s.run('INSERT INTO leases(kiosk_id,trader_id,starts_on,ends_on,note,origin_id,actor_id) VALUES(?,?,?,?,?,?,?)',kiosk,trader,start,end,note,origin,user.id).lastInsertRowid);
 event(s,id,origin?'Perpindahan masuk':'Penempatan dicatat',note,user);return id;
}
export const place=(s,user,data)=>s.transaction(()=>placement(s,user,data));
export function transfer(s,user,id,data){return s.transaction(()=>{
 const old=find(s,'leases',id),when=date(data.move_on),end=date(data.ends_on),target=integer(data.kiosk_id,'Kios tujuan',1),note=text(data.note,'Catatan perpindahan',1000);
 if(old.canceled||s.get('SELECT id FROM leases WHERE origin_id=? AND canceled=0',id))fail('Penempatan sudah dibatalkan atau sudah memiliki perpindahan lanjutan.');
 if(target===old.kiosk_id||when<old.starts_on||when>old.ends_on||end<when)fail('Pilih kios berbeda dan tanggal pindah di dalam periode asal, dengan tanggal akhir yang valid.');
 if(find(s,'kiosks',old.kiosk_id).archived)fail('Kios asal dalam arsip.');
 available(s,target,when,end);
 if(when===old.starts_on)s.run('UPDATE leases SET canceled=1 WHERE id=?',id);else s.run('UPDATE leases SET ends_on=? WHERE id=?',previous(when),id);
 event(s,id,'Perpindahan keluar','Rencana akhir semula '+old.ends_on+'. Pindah pada '+when+'. '+note,user);
 return placement(s,user,{kiosk_id:target,trader_id:old.trader_id,starts_on:when,ends_on:end,note},id);
 });}
export function cancel(s,user,id){s.transaction(()=>{const old=find(s,'leases',id);if(old.canceled)fail('Penempatan sudah dibatalkan.');s.run('UPDATE leases SET canceled=1 WHERE id=?',id);event(s,id,'Penempatan dibatalkan','Dibatalkan pengelola; periode dan catatan semula tetap tersimpan.',user);});}
export function remove(s,kind,id){s.transaction(()=>{
 find(s,kind,id);
 if(['traders','kiosks'].includes(kind)){const field=kind==='traders'?'trader_id':'kiosk_id';if(s.get('SELECT id FROM leases WHERE '+field+'=? AND canceled=0 AND ends_on>=?',id,today()))fail('Masih ada masa penggunaan saat ini atau mendatang. Selesaikan perpindahan/pembatalannya terlebih dahulu.');s.run('UPDATE '+kind+' SET archived=1 WHERE id=?',id);}
 else if(['blocks','categories'].includes(kind))s.run('DELETE FROM '+kind+' WHERE id=?',id);else fail('Tindakan tidak tersedia.');
 });}
