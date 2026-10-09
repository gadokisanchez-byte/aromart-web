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
  db.from('sales').select('*').order('created_at',{ascending:false}).limit(500),
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
 const {data,error}=await db.from('products').update(patch).eq('id',id).select('id');if(error)return alert('No se pudo guardar: '+error.message);
 if(!data?.length)return alert('No se encontró el producto para actualizar el stock.');
 await cloudLoad();renderInventory();renderSales();
};
addSale=async function(id,qty,price,date){const p=allBase().find(z=>idOf(z.name)===id),x=inv[id],q=Number(qty);if(!p||!x||!Number.isInteger(q)||q<1||q>x.qty)throw Error('Stock insuficiente o cantidad incorrecta');const method=document.getElementById('saleMethod')?.value||'Efectivo';const {error}=await db.rpc('aromart_register_sale',{p_product_id:id,p_qty:q,p_unit_price:Number(price),p_method:method,p_sold_on:date});if(error)throw Error(error.message);await cloudLoad();renderInventory();renderSales();};
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
function promoEls(){
 return {
  couponForm:document.getElementById('couponForm'),couponActive:document.getElementById('couponActive'),couponCode:document.getElementById('couponCode'),
  couponPercent:document.getElementById('couponPercent'),couponMinQty:document.getElementById('couponMinQty'),couponStart:document.getElementById('couponStart'),
  couponEnd:document.getElementById('couponEnd'),couponStatus:document.getElementById('couponStatus'),noticeForm:document.getElementById('noticeForm'),
  noticeActive:document.getElementById('noticeActive'),noticeTitle:document.getElementById('noticeTitle'),noticeText:document.getElementById('noticeText'),
  noticeStart:document.getElementById('noticeStart'),noticeEnd:document.getElementById('noticeEnd'),noticeStatus:document.getElementById('noticeStatus'),
  noticePreview:document.getElementById('noticePreview')
 };
}
function fillCloudPromos(){
 const e=promoEls(),c=window._cloudCoupon,n=window._cloudNotice;
 if(c){e.couponActive.checked=!!c.active;e.couponCode.value=c.code||'';e.couponPercent.value=c.percent||10;e.couponMinQty.value=c.min_qty||1;e.couponStart.value=c.starts_on||'';e.couponEnd.value=c.ends_on||''}
 if(n){e.noticeActive.checked=!!n.active;e.noticeTitle.value=n.title||'';e.noticeText.value=n.message||'';e.noticeStart.value=n.starts_on||'';e.noticeEnd.value=n.ends_on||''}
 paintCloudStatus();
}
function promoState(p){
 const today=new Date().toISOString().slice(0,10);
 if(!p||!p.active)return ['INACTIVO','off'];
 if(p.start&&today<p.start)return ['PROGRAMADO','scheduled'];
 if(p.end&&today>p.end)return ['FINALIZADO','expired'];
 return ['ACTIVO','active'];
}
function paintCloudStatus(){
 const e=promoEls(),cc=window._cloudCoupon,nn=window._cloudNotice;
 const c=cc?{active:cc.active,code:cc.code,minQty:cc.min_qty,start:cc.starts_on,end:cc.ends_on}:{active:false};
 const n=nn?{active:nn.active,title:nn.title,text:nn.message,start:nn.starts_on,end:nn.ends_on}:{active:false};
 const cs=promoState(c),ns=promoState(n);
 if(e.couponStatus){e.couponStatus.className='promo-status '+cs[1];e.couponStatus.textContent=`Estado del cupón: ${cs[0]}${c.code?' · '+c.code:''}${c.minQty?` · mínimo ${c.minQty}`:''} · NUBE`}
 if(e.noticeStatus){e.noticeStatus.className='promo-status '+ns[1];e.noticeStatus.textContent=`Estado del aviso: ${ns[0]} · NUBE`}
 if(e.noticePreview)e.noticePreview.innerHTML=(n.title||n.text)?`<b>${n.title||'AromArt Shop'}</b><span>${n.text||''}</span>`:'<span>La vista previa aparecerá aquí.</span>';
}
function showCloudMessage(message,ok=true){
 let box=document.getElementById('cloudSaveMessage');
 if(!box){box=document.createElement('div');box.id='cloudSaveMessage';box.style.cssText='position:fixed;right:18px;bottom:18px;z-index:99999;padding:14px 18px;border-radius:12px;background:#111;color:#fff;border:1px solid #c9a227;max-width:380px;font:600 14px system-ui';document.body.appendChild(box)}
 box.textContent=message;box.style.borderColor=ok?'#c9a227':'#e35d6a';clearTimeout(window._cloudMsgTimer);window._cloudMsgTimer=setTimeout(()=>box.remove(),5000);
}
function setupCloudPromos(){
 const old=promoEls();if(!old.couponForm||!old.noticeForm)return;
 const cf=old.couponForm.cloneNode(true),nf=old.noticeForm.cloneNode(true);old.couponForm.replaceWith(cf);old.noticeForm.replaceWith(nf);fillCloudPromos();
 document.getElementById('couponForm').addEventListener('submit',async ev=>{
  ev.preventDefault();const e=promoEls(),code=e.couponCode.value.trim().toUpperCase();if(!code)return showCloudMessage('Escribe un código de descuento.',false);
  const row={code,percent:Math.min(100,Math.max(1,+e.couponPercent.value||1)),min_qty:Math.max(1,Math.floor(+e.couponMinQty.value||1)),starts_on:e.couponStart.value||null,ends_on:e.couponEnd.value||null,active:e.couponActive.checked,updated_at:new Date().toISOString()};
  try{const current=window._cloudCoupon;const res=current?await db.from('coupons').update(row).eq('id',current.id).select().single():await db.from('coupons').insert(row).select().single();if(res.error)throw res.error;window._cloudCoupon=res.data;fillCloudPromos();showCloudMessage('✓ Cupón guardado en Supabase y publicado.')}
  catch(err){console.error('Coupon save:',err);showCloudMessage('No se guardó el cupón: '+(err.message||String(err)),false)}
 });
 document.getElementById('noticeForm').addEventListener('submit',async ev=>{
  ev.preventDefault();const e=promoEls();const row={title:e.noticeTitle.value.trim(),message:e.noticeText.value.trim(),starts_on:e.noticeStart.value||null,ends_on:e.noticeEnd.value||null,active:e.noticeActive.checked,updated_at:new Date().toISOString()};
  try{const current=window._cloudNotice;const res=current?await db.from('notices').update(row).eq('id',current.id).select().single():await db.from('notices').insert(row).select().single();if(res.error)throw res.error;window._cloudNotice=res.data;fillCloudPromos();showCloudMessage('✓ Aviso guardado en Supabase y publicado.')}
  catch(err){console.error('Notice save:',err);showCloudMessage('No se guardó el aviso: '+(err.message||String(err)),false)}
 });
}

document.addEventListener('DOMContentLoaded',async()=>{
 if(!document.querySelector('.panel-body'))return;
 try{
  await cloudLoad();

  const now=new Date();
  const month=document.getElementById('monthFilter');
  const date=document.getElementById('saleDate');
  const search=document.getElementById('adminSearch');
  const product=document.getElementById('saleProduct');
  const form=document.getElementById('saleForm');

  if(month&&!month.value)month.value=now.toISOString().slice(0,7);
  if(date&&!date.value)date.value=now.toISOString().slice(0,10);

  renderInventory();
  renderSales();

  if(search)search.addEventListener('input',renderInventory);
  if(month)month.addEventListener('change',renderStats);
  if(product)product.addEventListener('change',syncSalePrice);

  if(form){
   form.addEventListener('submit',async ev=>{
    ev.preventDefault();
    const btn=form.querySelector('button[type="submit"]');
    if(btn)btn.disabled=true;
    try{
     await addSale(
      document.getElementById('saleProduct').value,
      document.getElementById('saleQty').value,
      document.getElementById('salePrice').value,
      document.getElementById('saleDate').value
     );
     document.getElementById('saleQty').value=1;
    }finally{
     if(btn)btn.disabled=false;
    }
   });
  }

  setupCloudProductManager();
  setupCloudPromos();
 }catch(e){
  console.error(e);
  alert('No se pudo cargar el panel: '+(e.message||String(e)));
 }
});
