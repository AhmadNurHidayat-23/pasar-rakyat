import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
export const digest=v=>createHash('sha256').update(v).digest('hex');
const derive=(value,salt)=>scryptSync(value,salt,64,{N:32768,r:8,p:3,maxmem:128*1024*1024});
export function passwordHash(value) {
 if(typeof value!=='string'||value.length<12||value.length>200) throw new Error('Kata sandi harus 12–200 karakter.');
 const salt=randomBytes(16).toString('hex');
 return salt+':'+derive(value,salt).toString('hex');
}
const dummy=passwordHash(randomBytes(24).toString('hex'));
function verify(value,hash) {
 if(typeof value!=='string'||value.length>200) return false;
 const [salt,encoded]=hash.split(':'),actual=derive(value,salt),expected=Buffer.from(encoded,'hex');
 return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export function initAuth(store) {
 store.db.exec("CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username TEXT NOT NULL UNIQUE COLLATE NOCASE,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('Admin','Petugas')),password TEXT NOT NULL);CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),csrf TEXT NOT NULL,expires INTEGER NOT NULL);");
}
export function addUser(store,{username,name,role,password}) {
 if(!/^[a-zA-Z0-9._-]{1,80}$/.test(username)||!name?.trim()||name.length>80||!['Admin','Petugas'].includes(role)) throw new Error('Nama pengguna, nama tampilan, atau peran tidak valid.');
 store.run('INSERT INTO users(username,name,role,password) VALUES(?,?,?,?)',username.toLowerCase(),name.trim(),role,passwordHash(password));
}
export function installAuth(app,store) {
 const attempts=new Map();
 function session(req) {
  const token=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('pasar_rakyat_session='))?.slice('pasar_rakyat_session='.length);
  if(!token||!/^[a-f0-9]{64}$/.test(token)) return null;
  return store.get('SELECT s.*,u.username,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?',digest(token),Date.now());
 }
 app.use((req,_res,next)=>{req.session=session(req);req.user=req.session?{id:req.session.user_id,name:req.session.name,role:req.session.role}:null;next();});
 const guard=(roles=['Admin','Petugas'])=>(req,res,next)=>{
  if(!req.user) return res.status(401).json({error:'Silakan masuk terlebih dahulu.'});
  if(!roles.includes(req.user.role)) return res.status(403).json({error:'Tindakan ini hanya diizinkan untuk Admin.'});
  if(req.method!=='GET'&&req.headers['x-csrf-token']!==req.session.csrf) return res.status(403).json({error:'Sesi formulir tidak valid. Muat ulang halaman.'});
  next();
 };
 app.get('/api/session',(req,res)=>res.json({user:req.user,csrf:req.session?.csrf,configured:!!store.get('SELECT id FROM users LIMIT 1')}));
 app.post('/api/login',(req,res)=>{
  const now=Date.now(),key=req.ip;
  let rate=attempts.get(key);
  if(!rate||rate.until<=now){rate={count:0,until:now+900000};attempts.set(key,rate);}
  if(rate.count>=6) return res.status(429).json({error:'Terlalu banyak percobaan. Coba lagi dalam 15 menit.'});
  const user=store.get('SELECT * FROM users WHERE username=?',String(req.body.username||'').toLowerCase());
  const valid=verify(req.body.password,user?.password||dummy);
  if(!user||!valid){rate.count++;return res.status(401).json({error:'Nama pengguna atau kata sandi tidak cocok.'});}
  attempts.delete(key);
  const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');
  store.transaction(()=>{
   store.run('DELETE FROM sessions WHERE expires<=?',now);
   if(req.session) store.run('DELETE FROM sessions WHERE token=?',req.session.token);
   store.run('INSERT INTO sessions(token,user_id,csrf,expires) VALUES(?,?,?,?)',digest(token),user.id,csrf,now+28800000);
  });
  res.setHeader('Set-Cookie','pasar_rakyat_session='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800'+(process.env.SECURE_COOKIE==='1'?'; Secure':''));
  res.json({user:{id:user.id,name:user.name,role:user.role},csrf});
 });
 app.post('/api/logout',guard(),(req,res)=>{
  store.run('DELETE FROM sessions WHERE token=?',req.session.token);
  res.setHeader('Set-Cookie','pasar_rakyat_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  res.json({message:'Anda telah keluar.'});
 });
 return guard;
}
