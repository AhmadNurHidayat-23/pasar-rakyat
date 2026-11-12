import {createInterface} from 'node:readline/promises';
import {Store} from './db.js';
import {initAuth,addUser} from './auth.js';
async function secret() {
 if(!process.stdin.isTTY) throw new Error('Jalankan pengaturan akun melalui terminal interaktif.');
 process.stdout.write('Kata sandi (12–200 karakter, tidak ditampilkan): ');
 process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
 return new Promise((resolve,reject)=>{
  let value='';
  const onData=chunk=>{for(const char of chunk){
   if(char==='\u0003'){finish();reject(new Error('Dibatalkan.'));return;}
   if(char==='\r'||char==='\n'){finish();resolve(value);return;}
   if(char==='\u007f'||char==='\b') value=value.slice(0,-1); else if(char>=' ') value+=char;
  }};
  function finish(){process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');}
  process.stdin.on('data',onData);
 });
}
const store=new Store(process.env.APP_DB||'./data/app.sqlite');initAuth(store);
const rl=createInterface({input:process.stdin,output:process.stdout});
try {
 const username=await rl.question('Nama pengguna: '),name=await rl.question('Nama tampilan: '),role=await rl.question('Peran (Admin/Petugas): ');
 rl.close();
 const password=await secret();
 addUser(store,{username,name,role,password});
 console.log('Akun berhasil dibuat.');
} catch(error) {console.error(error.message);process.exitCode=1;}
finally {rl.close();store.close();}
