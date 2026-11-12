import {randomBytes} from 'node:crypto';
import {createApp} from '../src/core/app.js';
import {addUser} from '../src/core/auth.js';
import * as service from '../src/service.js';
export const day=(offset=0)=>{const now=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'});return new Date(Date.parse(now+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10);};
export const period=(extra={})=>({kiosk_id:1,trader_id:1,starts_on:day(-2),ends_on:day(20),note:'Penempatan khusus pengujian',...extra});
export async function setup(file=':memory:'){
 const {app,store}=createApp(file),password=randomBytes(20).toString('hex');
 if(!store.get('SELECT id FROM users LIMIT 1')){
  for(const [username,role] of [['admin','Admin'],['petugas','Petugas']])addUser(store,{username,name:username+' uji',role,password});
  service.master(store,'blocks',{name:'Blok Uji'});service.master(store,'categories',{name:'Kategori Uji'});
  for(const code of ['A-01','A-02'])service.kiosk(store,{code,block_id:1,description:'Kios demonstrasi'});
  for(const [code,name] of [['PDG-01','Pedagang Contoh 1'],['PDG-02','Pedagang Contoh 2']])service.trader(store,{code,name,business:'Usaha demonstrasi',category_id:1});
 }
 const server=await new Promise(resolve=>{const value=app.listen(0,'127.0.0.1',()=>resolve(value));});
 const base='http://127.0.0.1:'+server.address().port;
 async function request(url,method='GET',body,headers={}){return fetch(base+'/api/'+url,{method,headers:{'Content-Type':'application/json',...headers},body:method==='GET'?undefined:JSON.stringify(body||{})});}
 async function login(username){const response=await request('login','POST',{username,password});if(response.status!==200)throw new Error('Login fixture gagal');const value=await response.json();return {cookie:response.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':value.csrf};}
 return {store,request,login,stop:async()=>{await new Promise(resolve=>server.close(resolve));store.close();}};
}
