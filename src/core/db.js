import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export class Store {
 constructor(file) {
  if(file!==':memory:') fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true});
  this.db=new DatabaseSync(file,{timeout:10000});
  this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=10000;');
 }
 all(sql,...args) { return this.db.prepare(sql).all(...args); }
 get(sql,...args) { return this.db.prepare(sql).get(...args); }
 run(sql,...args) { return this.db.prepare(sql).run(...args); }
 transaction(fn) {
  this.db.exec('BEGIN IMMEDIATE');
  try { const value=fn(); this.db.exec('COMMIT'); return value; }
  catch(error) { this.db.exec('ROLLBACK'); throw error; }
 }
 close() { this.db.close(); }
}
