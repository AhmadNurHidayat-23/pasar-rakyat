import express from 'express';
import {fileURLToPath} from 'node:url';
import {Store} from './db.js';
import {initAuth,installAuth} from './auth.js';
import {schema} from '../schema.js';
import {routes} from '../routes.js';

export function createApp(file=process.env.APP_DB||'./data/app.sqlite') {
 const app=express(),store=new Store(file);
 initAuth(store); store.db.exec(schema);
 app.disable('x-powered-by');
 app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'");
  if(['POST','PUT','DELETE'].includes(req.method)) {
   if(!req.is('application/json')) return res.status(415).json({error:'Format permintaan tidak valid.'});
   if(req.headers.origin&&req.headers.origin!==req.protocol+'://'+req.get('host')) return res.status(403).json({error:'Asal permintaan tidak diizinkan.'});
  }
  next();
 });
 app.use(express.json({limit:'64kb'}));
 const guard=installAuth(app,store);
 routes(app,store,guard);
 const root=fileURLToPath(new URL('../../public/',import.meta.url));
 app.use(express.static(root));
 app.use('/api',(_req,res)=>res.status(404).json({error:'Alamat tidak tersedia.'}));
 app.use((error,_req,res,_next)=>{
  const message=String(error.message);
  res.status(error.status===413?413:message.includes('UNIQUE')?409:error.status||400).json({error:message.includes('UNIQUE')?'Data dengan identitas tersebut sudah digunakan.':message.includes('FOREIGN KEY')?'Data masih terkait atau rujukannya tidak ditemukan.':error instanceof SyntaxError?'Format data tidak valid.':message});
 });
 return {app,store};
}
