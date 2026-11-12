export function fail(message,status=400) {const e=new Error(message);e.status=status;throw e;}
export function text(value,label,max=120,required=true) {if(typeof value!=='string'||value.trim().length>max||required&&!value.trim())fail(label+' wajib diisi dengan benar, maksimal '+max+' karakter.');return value.trim();}
export function integer(value,label,min=0,max=1000000000000) {if(typeof value==='boolean'||!/^-?\d+$/.test(String(value))||!Number.isSafeInteger(Number(value))||Number(value)<min||Number(value)>max)fail(label+' harus bilangan bulat antara '+min+' dan '+max+'.');return Number(value);}
export function choice(value,allowed,label) {if(!allowed.includes(value))fail(label+' tidak valid.');return value;}
export function date(value,label='Tanggal') {if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)fail(label+' tidak valid.');return value;}
export const csv=rows=>'\uFEFF'+rows.map(row=>row.map(v=>'"'+(/^[=+@-]/.test(String(v))?"'"+v:String(v??'')).replaceAll('"','""')+'"').join(',')).join('\r\n');
