// AromArt Shop · sincronización Admin con Supabase
const db=window.aromartDb||window.supabaseClient;
let cloudReady=false;
async function requireAdmin(){
 const {data}=await db.auth.getSession();
 if(!data.session){location.href='login.html';throw new Error('Sesión requerida')}
}
function cloudProduct(p,i=0){
 const id=idOf(p.name),x=inv[id]||{};
 return {id,name:p.name,sku:p.sku||x.sku||null,category:p.cat||'Perfumes',description:p.desc||'',image_url:p.img||'',price:+(x.price??p.price??0),cost:+(x.cost||0),stock:Math.max(0,+(x.qty??(p.upcoming?0:1))),status:x.status||(p.upcoming?'proximamente':'disponible'),is_custom:!!p.custom,sort_order:i};
}
async function seedProductsIfEmpty(){
 const {count,error}=await db.from('products').select('*',{count:'exact',head:true});if(error)throw error;
 if(count===0){const rows=allBase().map(cloudProduct);for(let i=0;i<rows.length;i+=40){const {error:e}=await db.from('products').upsert(rows.slice(i,i+40));if(e)throw e}}
}
async function cloudLoad(){
 await requireAdmin();await seedProductsIfEmpty();
 const [pr,sr,cr,nr]=await Promise.all([
  db.from('products').select('*').order('sort_order'),
  db.from('sales').select('*').order('sold_on',{ascending:false}).limit(500),
  db.from('coupons').select('*').order('updated_at',{ascending:false}).limit(1),
  db.from('notices').select('*').order('updated_at',{ascending:false}).limit(1)
 ]);
 if(pr.error)throw pr.error;
 customProducts=pr.data.map(x=>({name:x.name,img:x.image_url,price:+x.price,upcoming:x.status==='proximamente',desc:x.description,cat:x.category,sku:x.sku,custom:true,_cloud:true}));
 inv={};pr.data.forEach(x=>inv[x.id]={qty:x.stock,cost:+x.cost,price:+x.price,status:x.status,sku:x.sku});
 sales=(sr.data||[]).map(x=>({id:x.id,productId:x.product_id,name:x.product_name,qty:x.qty,price:+x.unit_price,cost:+x.unit_cost,date:x.sold_on}));
 window._cloudCoupon=cr.data?.[0]||null;window._cloudNotice=nr.data?.[0]||null;cloudReady=true;
}
allBase=()=>customProducts;
persist=function(){};persistCustom=function(){};persistSales=function(){};
setField=async function(id,f,v){
 const map={qty:'stock',cost:'cost',price:'price',status:'status'},field=map[f];if(!field)return;
 const val=f==='status'?v:Number(v||0);let patch={[field]:val,updated_at:new Date().toISOString()};
 if(f==='qty'&&val<=0&&inv[id]?.status==='disponible'){patch.status='agotado'}
 const {error}=await db.from('products').update(patch).eq('id',id);if(error)return alert('No se pudo guardar: '+error.message);
 await cloudLoad();renderInventory();renderSales();
};
addSale=async function(id,qty,price,date){
 const p=allBase().find(z=>idOf(z.name)===id),x=inv[id];if(!p||!x)return;const q=Math.max(1,+qty||1);
 if(q>x.qty)return alert('No hay suficiente stock.');
 const row={product_id:id,product_name:p.name,qty:q,unit_price:+price||0,unit_cost:+x.cost||0,sold_on:date};
 const {error}=await db.from('sales').insert(row);if(error)return alert('No se pudo registrar la venta: '+error.message);
 const left=Math.max(0,x.qty-q);const patch={stock:left,updated_at:new Date().toISOString()};if(left===0&&x.status==='disponible')patch.status='agotado';
 await db.from('products').update(patch).eq('id',id);await cloudLoad();renderInventory();renderSales();
};
quickSale=async id=>addSale(id,1,inv[id].price,new Date().toISOString().slice(0,10));
deleteCustom=async function(id){const p=allBase().find(x=>idOf(x.name)===id);if(!p||!confirm('¿Eliminar '+p.name+'?'))return;const {error}=await db.from('products').delete().eq('id',id);if(error)return alert(error.message);await cloudLoad();renderInventory()};
async function uploadProductImage(file,id){
 if(!file)return 'assets/brand/logo.jpeg';
 const ext=(file.name.split('.').pop()||'jpg').toLowerCase(),path=`${id}-${Date.now()}.${ext}`;
 const {error}=await db.storage.from('product-images').upload(path,file,{upsert:false,contentType:file.type});if(error)throw error;
 return db.storage.from('product-images').getPublicUrl(path).data.publicUrl;
}
function setupCloudProductManager(){
 const f=document.getElementById('productForm');if(!f)return;const clone=f.cloneNode(true);f.replaceWith(clone);
 const form=document.getElementById('productForm'),cost=document.getElementById('newCost'),price=document.getElementById('newPrice'),gain=document.getElementById('newGain');
 const upd=()=>gain.textContent=sol((+price.value||0)-(+cost.value||0));cost.oninput=upd;price.oninput=upd;upd();
 form.addEventListener('submit',async e=>{e.preventDefault();const name=newName.value.trim(),id=idOf(name);if(!name)return;if(allBase().some(p=>idOf(p.name)===id))return alert('Ya existe un producto con ese nombre.');
  try{const image=await uploadProductImage(newImage.files[0],id),row={id,name,sku:newSku.value.trim()||null,category:newCat.value,description:newDesc.value.trim(),image_url:image,price:+newPrice.value||0,cost:+newCost.value||0,stock:+newQty.value||0,status:newStatus.value,is_custom:true,sort_order:allBase().length,updated_at:new Date().toISOString()};const {error}=await db.from('products').insert(row);if(error)throw error;form.reset();await cloudLoad();renderInventory();alert('Producto publicado para todos los visitantes.')}catch(err){alert('No se pudo agregar: '+err.message)}
 });
}
function fillCloudPromos(){
 const c=window._cloudCoupon,n=window._cloudNotice;
 if(c){couponActive.checked=!!c.active;couponCode.value=c.code||'';couponPercent.value=c.percent||10;couponMinQty.value=c.min_qty||1;couponStart.value=c.starts_on||'';couponEnd.value=c.ends_on||''}
 if(n){noticeActive.checked=!!n.active;noticeTitle.value=n.title||'';noticeText.value=n.message||'';noticeStart.value=n.starts_on||'';noticeEnd.value=n.ends_on||''}
 paintCloudStatus();
}
function paintCloudStatus(){
 const c=window._cloudCoupon?{active:_cloudCoupon.active,code:_cloudCoupon.code,minQty:_cloudCoupon.min_qty,start:_cloudCoupon.starts_on,end:_cloudCoupon.ends_on}:{active:false};
 const n=window._cloudNotice?{active:_cloudNotice.active,title:_cloudNotice.title,text:_cloudNotice.message,start:_cloudNotice.starts_on,end:_cloudNotice.ends_on}:{active:false};
 const cs=promoState(c),ns=promoState(n);if(window.couponStatus){couponStatus.className='promo-status '+cs[1];couponStatus.textContent=`Estado del cupón: ${cs[0]}${c.code?' · '+c.code:''}${c.minQty?` · mínimo ${c.minQty}`:''} · NUBE`};if(window.noticeStatus){noticeStatus.className='promo-status '+ns[1];noticeStatus.textContent=`Estado del aviso: ${ns[0]} · NUBE`};if(window.noticePreview)noticePreview.innerHTML=(n.title||n.text)?`<b>${n.title||'AromArt Shop'}</b><span>${n.text||''}</span>`:'<span>La vista previa aparecerá aquí.</span>';
}
function setupCloudPromos(){
 fillCloudPromos();
 const cf=couponForm.cloneNode(true),nf=noticeForm.cloneNode(true);couponForm.replaceWith(cf);noticeForm.replaceWith(nf);
 cf.addEventListener('submit',async e=>{e.preventDefault();const row={code:couponCode.value.trim().toUpperCase(),percent:Math.min(100,Math.max(1,+couponPercent.value||1)),min_qty:Math.max(1,Math.floor(+couponMinQty.value||1)),starts_on:couponStart.value||null,ends_on:couponEnd.value||null,active:couponActive.checked,updated_at:new Date().toISOString()};let q=window._cloudCoupon?db.from('coupons').update(row).eq('id',_cloudCoupon.id):db.from('coupons').insert(row);const {error}=await q;if(error)return alert(error.message);await cloudLoad();fillCloudPromos();alert('Cupón publicado para todos los visitantes.')});
 nf.addEventListener('submit',async e=>{e.preventDefault();const row={title:noticeTitle.value.trim(),message:noticeText.value.trim(),starts_on:noticeStart.value||null,ends_on:noticeEnd.value||null,active:noticeActive.checked,updated_at:new Date().toISOString()};let q=window._cloudNotice?db.from('notices').update(row).eq('id',_cloudNotice.id):db.from('notices').insert(row);const {error}=await q;if(error)return alert(error.message);await cloudLoad();fillCloudPromos();alert('Aviso publicado para todos los visitantes.')});
}
document.addEventListener('DOMContentLoaded',async()=>{if(!document.querySelector('.panel-body'))return;try{await cloudLoad();renderInventory();renderSales();setupCloudProductManager();setupCloudPromos()}catch(e){console.error(e);alert('Falta preparar Supabase. Ejecuta SUPABASE-SETUP.sql una sola vez. Detalle: '+e.message)}})
