import {snapshot} from './repository.js';
import * as service from './service.js';
import {integer,csv,fail} from './core/validate.js';
export function routes(app,s,guard){
 app.get('/api/state',guard(),(req,res)=>res.json(snapshot(s,req.query)));
 app.post('/api/:kind',guard(),(req,res)=>{
  const kind=req.params.kind;if(['blocks','categories','kiosks'].includes(kind)&&req.user.role!=='Admin')fail('Data blok, kategori dan kios hanya dikelola Admin.',403);
  if(['blocks','categories'].includes(kind))service.master(s,kind,req.body);else if(kind==='traders')service.trader(s,req.body);else if(kind==='kiosks')service.kiosk(s,req.body);else if(kind==='leases')return res.status(201).json({id:service.place(s,req.user,req.body),message:'Penempatan dicatat.'});else fail('Alamat tidak tersedia.',404);res.status(201).json({message:'Data ditambahkan.'});
 });
 app.put('/api/:kind/:id',guard(),(req,res)=>{const kind=req.params.kind,id=integer(req.params.id,'ID',1);if(kind!=='traders'&&req.user.role!=='Admin')fail('Data induk hanya dikelola Admin.',403);if(['blocks','categories'].includes(kind))service.master(s,kind,req.body,id);else if(kind==='traders')service.trader(s,req.body,id);else if(kind==='kiosks')service.kiosk(s,req.body,id);else fail('Alamat tidak tersedia.',404);res.json({message:'Data diperbarui.'});});
 app.delete('/api/:kind/:id',guard(),(req,res)=>{const kind=req.params.kind;if(kind!=='traders'&&req.user.role!=='Admin')fail('Tindakan ini hanya untuk Admin.',403);service.remove(s,kind,integer(req.params.id,'ID',1));res.json({message:'Data dihapus atau diarsipkan; riwayat tetap dipertahankan.'});});
 app.post('/api/:kind/:id/restore',guard(['Admin']),(req,res)=>{const kind=req.params.kind;if(!['traders','kiosks'].includes(kind))fail('Tindakan tidak tersedia.');const id=integer(req.params.id,'ID',1);service.find(s,kind,id);s.run('UPDATE '+kind+' SET archived=0 WHERE id=?',id);res.json({message:'Data dipulihkan.'});});
 app.post('/api/leases/:id/transfer',guard(),(req,res)=>res.json({id:service.transfer(s,req.user,integer(req.params.id,'ID penempatan',1),req.body),message:'Perpindahan dan riwayat dicatat dalam satu transaksi.'}));
 app.post('/api/leases/:id/cancel',guard(['Admin']),(req,res)=>{service.cancel(s,req.user,integer(req.params.id,'ID penempatan',1));res.json({message:'Penempatan dibatalkan.'});});
 app.get('/api/leases/:id/events',guard(),(req,res)=>{const id=integer(req.params.id,'ID penempatan',1);service.find(s,'leases',id);res.json(s.all('SELECT e.*,u.name actor FROM events e JOIN users u ON u.id=e.actor_id WHERE lease_id=? ORDER BY e.id DESC',id));});
 app.get('/api/export',guard(),(req,res)=>{const state=snapshot(s,req.query),rows=[['Tanggal laporan','Blok','Kode kios','Status','Pedagang demonstrasi','Mulai penggunaan','Akhir penggunaan'],...state.kiosks.map(k=>[state.asOf,k.block,k.code,k.status,k.occupancy?.trader||'',k.occupancy?.starts_on||'',k.occupancy?.ends_on||''])];res.setHeader('Content-Disposition','attachment; filename=okupansi-kios.csv');res.type('text/csv').send(csv(rows));});
}
