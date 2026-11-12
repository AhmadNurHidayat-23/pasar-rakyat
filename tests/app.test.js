import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Store} from '../src/core/db.js';
import {setup,day,period} from './support.js';

test('CRUD pedagang, blok, kategori dan kios serta validasi relasi',async()=>{
 const e=await setup();try{const a=await e.login('admin'),s=await e.login('petugas');
  for(const kind of ['blocks','categories']){assert.equal((await e.request(kind,'POST',{name:'Tambahan'},a)).status,201);assert.equal((await e.request(kind+'/2','PUT',{name:'Diubah'},a)).status,200);assert.equal((await e.request(kind+'/2','DELETE',{},a)).status,200);}
  assert.equal((await e.request('traders','POST',{code:'PDG-03',name:'Nama contoh',business:'Usaha contoh',category_id:1},s)).status,201);
  assert.equal((await e.request('traders/3','PUT',{code:'PDG-03',name:'Diubah',business:'Usaha contoh',category_id:1},s)).status,200);
  assert.equal((await e.request('traders/3','DELETE',{},s)).status,200);
  assert.equal((await e.request('traders/3/restore','POST',{},a)).status,200);
  assert.equal((await e.request('kiosks','POST',{code:'A-03',block_id:1,description:'Kios baru'},a)).status,201);
  assert.equal((await e.request('kiosks/3','PUT',{code:'A-03A',block_id:1,description:'Diubah'},a)).status,200);
  assert.equal((await e.request('kiosks/3','DELETE',{},a)).status,200);assert.equal((await e.request('kiosks/3/restore','POST',{},a)).status,200);
  assert.equal((await e.request('kiosks','POST',{code:'a-03a',block_id:1},a)).status,409);
  assert.ok([400,409].includes((await e.request('blocks/1','DELETE',{},a)).status));
  assert.equal((await e.request('traders','POST',{code:'INVALID',name:'',business:'Usaha',category_id:1},a)).status,400);
 }finally{await e.stop();}
});
test('periode inklusif menolak bentrok, membolehkan hari setelah akhir, dan status menurut tanggal',async()=>{
 const e=await setup();try{const a=await e.login('admin');
  assert.equal((await e.request('leases','POST',period(),a)).status,201);
  assert.equal((await e.request('leases','POST',period({trader_id:2,starts_on:day(20),ends_on:day(30)}),a)).status,409);
  assert.equal((await e.request('leases','POST',period({trader_id:2,starts_on:day(21),ends_on:day(30)}),a)).status,201);
  let state=await (await e.request('state?as_of='+day(),'GET',undefined,a)).json();assert.equal(state.kiosks[0].occupancy.trader_id,1);assert.equal(state.summary.occupied,1);assert.equal(state.summary.vacant,1);
  state=await (await e.request('state?as_of='+day(22),'GET',undefined,a)).json();assert.equal(state.kiosks[0].occupancy.trader_id,2);
  assert.equal((await e.request('leases','POST',period({starts_on:day(5),ends_on:day(4)}),a)).status,400);
 }finally{await e.stop();}
});
test('perpindahan menutup asal, membuka tujuan dan menyimpan jejak tanpa fork',async()=>{
 const e=await setup();try{const a=await e.login('admin');await e.request('leases','POST',period(),a);
  const move=await e.request('leases/1/transfer','POST',{kiosk_id:2,move_on:day(),ends_on:day(20),note:'Pindah untuk pengujian'},a);assert.equal(move.status,200);
  const state=await (await e.request('state','GET',undefined,a)).json();assert.equal(state.kiosks[0].status,'Kosong');assert.equal(state.kiosks[1].occupancy.trader_id,1);
  assert.equal(e.store.get('SELECT ends_on FROM leases WHERE id=1').ends_on,day(-1));assert.equal(e.store.get('SELECT origin_id FROM leases WHERE id=2').origin_id,1);
  assert.equal((await (await e.request('leases/1/events','GET',undefined,a)).json()).length,2);
  assert.equal((await e.request('leases/1/transfer','POST',{kiosk_id:2,move_on:day(-1),ends_on:day(10),note:'Tidak boleh fork'},a)).status,400);
 }finally{await e.stop();}
});
test('perpindahan gagal membatalkan seluruh perubahan asal dan riwayat',async()=>{
 const e=await setup();try{const a=await e.login('admin');await e.request('leases','POST',period(),a);
  e.store.db.exec("CREATE TRIGGER reject_transfer BEFORE INSERT ON leases WHEN NEW.origin_id IS NOT NULL BEGIN SELECT RAISE(ABORT,'Kegagalan uji'); END");
  assert.equal((await e.request('leases/1/transfer','POST',{kiosk_id:2,move_on:day(),ends_on:day(20),note:'Harus rollback'},a)).status,400);
  assert.equal(e.store.get('SELECT ends_on FROM leases WHERE id=1').ends_on,day(20));assert.equal(e.store.get('SELECT count(*) n FROM events').n,1);assert.equal(e.store.get('SELECT count(*) n FROM leases').n,1);
 }finally{await e.stop();}
});
test('24 permintaan bersamaan hanya mengisi satu kios sekali; trigger dan restart SQLite',async()=>{
 const file=path.join(mkdtempSync(path.join(tmpdir(),'pasar-test-')),'app.sqlite');let e=await setup(file),auth;
 try{auth=await e.login('admin');const results=await Promise.all(Array.from({length:24},(_,i)=>e.request('leases','POST',period({trader_id:i%2+1}),auth)));assert.equal(results.filter(r=>r.status===201).length,1);assert.equal(results.filter(r=>r.status===409).length,23);
  const other=new Store(file);try{assert.throws(()=>other.run('INSERT INTO leases(kiosk_id,trader_id,starts_on,ends_on,note,actor_id) VALUES(1,2,?,?,?,1)',day(),day(4),'Uji langsung database'),/berbenturan/);}finally{other.close();}
 }finally{await e.stop();}
 e=await setup(file);try{assert.equal((await e.request('state','GET',undefined,auth)).status,200);assert.equal(e.store.get('SELECT count(*) n FROM leases').n,1);assert.equal(e.store.get('PRAGMA integrity_check').integrity_check,'ok');assert.deepEqual(e.store.all('PRAGMA foreign_key_check'),[]);}finally{await e.stop();}
});
test('pengingat nyata, pencarian/filter dan ekspor okupansi sesuai tanggal',async()=>{
 const e=await setup();try{const a=await e.login('admin');await e.request('leases','POST',period({ends_on:day(5)}),a);
  let state=await (await e.request('state?as_of='+day(),'GET',undefined,a)).json();assert.equal(state.expiring[0].daysLeft,5);
  state=await (await e.request('state?as_of='+day(6),'GET',undefined,a)).json();assert.equal(state.expiring.length,0);assert.equal(state.summary.occupied,0);
  state=await (await e.request('state?q=A-01&status=Terisi&block_id=1','GET',undefined,a)).json();assert.equal(state.kiosks.length,1);
  assert.equal((await (await e.request('state?q=tidakada','GET',undefined,a)).json()).kiosks.length,0);
  const exported=await e.request('export?as_of='+day(),'GET',undefined,a);assert.equal(exported.status,200);assert.match(await exported.text(),/Pedagang Contoh 1/);
 }finally{await e.stop();}
});
test('izin, CSRF, sesi terpisah, pembatalan dan arsip menjaga penempatan',async()=>{
 const e=await setup();try{const a=await e.login('admin'),s=await e.login('petugas');
  assert.equal((await e.request('state')).status,401);assert.equal((await e.request('state','GET',undefined,{cookie:a.cookie.replace('pasar_rakyat_session','app_session')})).status,401);
  assert.equal((await e.request('kiosks','POST',{code:'X',block_id:1},s)).status,403);assert.equal((await e.request('leases','POST',period(),{cookie:s.cookie})).status,403);
  assert.equal((await e.request('leases','POST',period(),{...s,Origin:'https://lain.example'})).status,403);
  await e.request('leases','POST',period(),s);assert.equal((await e.request('traders/1','DELETE',{},s)).status,400);assert.equal((await e.request('kiosks/1','DELETE',{},a)).status,400);
  assert.equal((await e.request('leases/1/cancel','POST',{},s)).status,403);assert.equal((await e.request('leases/1/cancel','POST',{},a)).status,200);
  assert.equal((await e.request('traders/1','DELETE',{},s)).status,200);assert.equal((await e.request('kiosks/1','DELETE',{},a)).status,200);
  assert.equal(e.store.get('SELECT count(*) n FROM leases').n,1);assert.equal(e.store.get('SELECT count(*) n FROM events').n,2);
  assert.equal((await e.request('logout','POST',{},s)).status,200);assert.equal((await e.request('state','GET',undefined,s)).status,401);
 }finally{await e.stop();}
});
