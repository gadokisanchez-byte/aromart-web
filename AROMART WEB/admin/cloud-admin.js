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
 const p=allBase().find(z=>idOf(z.name)===id),x=inv[id];
 if(!p||!x)throw new Error('Selecciona un producto válido.');
 const q=Math.max(1,Math.floor(Number(qty)||0)),unitPrice=Number(price);
 if(!Number.isFinite(unitPrice)||unitPrice<0)throw new Error('Escribe un precio válido.');
 if(q>(Number(x.qty)||0))throw new Error('Stock insuficiente. Disponible: '+(Number(x.qty)||0)+'.');
 const soldOn=/^\d{4}-\d{2}-\d{2}$/.test(date||'')?date:aromartLocalDate();
 const row={product_id:id,product_name:p.name,qty:q,unit_price:unitPrice,unit_cost:Number(x.cost)||0,sold_on:soldOn};
 const inserted=await db.from('sales').insert(row).select().single();
 if(inserted.error)throw inserted.error;
 const left=Math.max(0,(Number(x.qty)||0)-q),patch={stock:left,updated_at:new Date().toISOString()};
 if(left===0&&x.status==='disponible')patch.status='agotado';
 const updated=await db.from('products').update(patch).eq('id',id).select('id').maybeSingle();
 if(updated.error||!updated.data){
  await db.from('sales').delete().eq('id',inserted.data.id);
  throw updated.error||new Error('No se pudo actualizar el stock del producto.');
 }
 await cloudLoad();renderInventory();renderSales();
};
const aromartLocalDate=()=>{const d=new Date(),offset=d.getTimezoneOffset();return new Date(d.getTime()-offset*60000).toISOString().slice(0,10)};
quickSale=async id=>addSale(id,1,inv[id].price,aromartLocalDate());
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


// Botón para reemplazar únicamente la fotografía de un producto existente.
async function changeProductImage(id){
 const product=allBase().find(p=>idOf(p.name)===id);
 if(!product)return alert('No se encontró el producto.');
 const picker=document.createElement('input');
 picker.type='file';picker.accept='image/jpeg,image/png,image/webp';picker.style.display='none';
 document.body.appendChild(picker);
 picker.addEventListener('change',async()=>{
  const file=picker.files&&picker.files[0];picker.remove();if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))return alert('Usa una imagen JPG, PNG o WEBP.');
  if(file.size>5*1024*1024)return alert('La imagen debe pesar máximo 5 MB.');
  try{
   const imageUrl=await uploadProductImage(file,id);
   const {error}=await db.from('products').update({image_url:imageUrl,updated_at:new Date().toISOString()}).eq('id',id);
   if(error)throw error;
   await cloudLoad();renderInventory();
   alert('Fotografía actualizada correctamente.');
  }catch(err){console.error(err);alert('No se pudo cambiar la fotografía: '+(err.message||String(err)));}
 });
 picker.click();
}

// Añade el botón en la columna Acciones sin modificar el resto del inventario.
const renderInventoryBeforePhotoButton=renderInventory;
renderInventory=function(){
 renderInventoryBeforePhotoButton();
 const body=document.getElementById('inventoryBody');if(!body)return;
 body.querySelectorAll('tr').forEach(row=>{
  const saleButton=row.querySelector('button[onclick^="quickSale("]');if(!saleButton||row.querySelector('.change-photo-button'))return;
  const match=(saleButton.getAttribute('onclick')||'').match(/quickSale\('([^']+)'\)/);if(!match)return;
  const button=document.createElement('button');button.type='button';button.className='mini-action change-photo-button';button.textContent='CAMBIAR FOTO';button.style.marginLeft='5px';
  button.addEventListener('click',()=>changeProductImage(match[1]));saleButton.insertAdjacentElement('afterend',button);
 });
};

// Registro de ventas: conectar el formulario (el listener antiguo estaba desactivado).
function setupCloudSalesForm(){
 const original=document.getElementById('saleForm');if(!original||original.dataset.cloudSalesReady==='1')return;
 const form=original.cloneNode(true);original.replaceWith(form);form.dataset.cloudSalesReady='1';
 const product=form.querySelector('#saleProduct'),qty=form.querySelector('#saleQty'),price=form.querySelector('#salePrice'),date=form.querySelector('#saleDate'),submit=form.querySelector('button[type="submit"]');
 if(date&&!date.value)date.value=aromartLocalDate();
 // Buscador de productos SOLO para el campo Producto de Registrar venta.
 if(product){
  const label=product.closest('label');
  const search=document.createElement('input');search.type='search';search.id='saleProductSearch';search.placeholder='Escribe el perfume (ej. vainilla)…';search.autocomplete='off';search.setAttribute('aria-label','Buscar producto del inventario para registrar una venta');
  search.style.cssText='width:100%;box-sizing:border-box;margin:0 0 8px;padding:11px 12px;border:1px solid #c9a227;border-radius:8px;background:#fff;color:#222;font:inherit';
  const results=document.createElement('div');results.id='saleProductResults';results.style.cssText='display:none;max-height:240px;overflow-y:auto;border:1px solid #d8c58a;border-radius:8px;margin:-3px 0 10px;background:#fff;box-shadow:0 5px 18px rgba(0,0,0,.12)';
  if(label){label.insertBefore(search,product);label.insertBefore(results,product);}
  // Reconstruir las opciones desde el inventario sincronizado, sin cambiar el stock.
  product.innerHTML='<option value="">Selecciona un producto</option>';
  allBase().forEach(p=>{const id=idOf(p.name),option=document.createElement('option');option.value=id;option.textContent=p.name;product.appendChild(option)});
  product.style.cssText+=';position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important';
  const norm=v=>String(v||'').toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const hide=()=>{results.style.display='none'};
  const choose=p=>{const id=idOf(p.name);product.value=id;search.value=p.name;hide();product.dispatchEvent(new Event('change',{bubbles:true}))};
  const showMatches=()=>{
   const q=norm(search.value);results.innerHTML='';
   if(!q){hide();return}
   const found=allBase().filter(p=>norm(p.name).includes(q)).slice(0,100);
   if(!found.length){const empty=document.createElement('div');empty.textContent='No hay productos que coincidan en tu inventario.';empty.style.cssText='padding:11px 12px;color:#666;font-size:13px';results.appendChild(empty)}
   found.forEach(p=>{const id=idOf(p.name),x=inv[id]||{},item=document.createElement('button');item.type='button';item.textContent=p.name+' · Stock: '+(Number(x.qty)||0)+' · '+sol(Number(x.price)||0);item.style.cssText='display:block;width:100%;padding:11px 12px;text-align:left;border:0;border-bottom:1px solid #eee;background:#fff;color:#222;font:inherit;cursor:pointer';item.addEventListener('mouseenter',()=>item.style.background='#f7f2e5');item.addEventListener('mouseleave',()=>item.style.background='#fff');item.addEventListener('click',()=>choose(p));results.appendChild(item)});
   results.style.display='block';
  };
  search.addEventListener('input',showMatches);
  search.addEventListener('focus',showMatches);
  search.addEventListener('keydown',e=>{if(e.key==='Escape')hide();if(e.key==='Enter'&&results.style.display==='block'){const first=results.querySelector('button');if(first){e.preventDefault();first.click()}}});
  document.addEventListener('click',e=>{if(!label?.contains(e.target))hide()});
  form.addEventListener('reset',()=>{search.value='';hide();product.value=''});
 }
 product?.addEventListener('change',()=>{const item=inv[product.value];if(item&&price)price.value=Number(item.price)||0});
 form.addEventListener('submit',async ev=>{
  ev.preventDefault();if(submit)submit.disabled=true;
  try{
   if(!product?.value)throw new Error('Selecciona el perfume que vendiste.');
   if(!qty?.value||Number(qty.value)<1)throw new Error('La cantidad debe ser al menos 1.');
   await addSale(product.value,qty.value,price?.value,date?.value||aromartLocalDate());
   form.reset();if(qty)qty.value='1';if(date)date.value=aromartLocalDate();
   if(product?.options.length){product.selectedIndex=0;product.dispatchEvent(new Event('change'))}
   showCloudMessage('✓ Venta registrada correctamente.');
  }catch(err){console.error('AromArt sale:',err);alert('No se pudo registrar la venta: '+(err.message||String(err)));}
  finally{if(submit)submit.disabled=false;}
 });
}

// Buscador del historial: encuentra todas las ventas cuyos nombres coincidan,
// por ejemplo Bare Vanilla, Bare Vanilla Shimmer y otras variedades.
function normalizeSaleSearch(value){return String(value||'').toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ')}
function setupSalesSearch(){
 const list=document.getElementById('salesList');if(!list)return;
 const header=list.closest('.admin-section')?.querySelector('.section-head');if(!header)return;
 let search=document.getElementById('salesSearch');
 if(!search){search=document.createElement('input');search.id='salesSearch';search.type='search';search.placeholder='Buscar perfume vendido… (ej. vainilla)';search.className='search-admin';search.setAttribute('aria-label','Buscar en el historial de ventas');search.style.maxWidth='280px';search.style.marginLeft='auto';header.appendChild(search);}
 if(search.dataset.ready!=='1'){search.dataset.ready='1';search.addEventListener('input',renderSales)}
}
const renderSalesBeforeSearch=renderSales;
renderSales=function(){
 const box=document.getElementById('salesList');if(!box)return;
 const query=normalizeSaleSearch(document.getElementById('salesSearch')?.value||'');
 const matches=sales.filter(s=>!query||normalizeSaleSearch([s.name,s.date].filter(Boolean).join(' ')).includes(query));
 box.innerHTML=matches.length?matches.slice(0,500).map(s=>`<div class="sale-item"><div><b>${s.qty} × ${s.name}</b><small>${s.date}</small></div><span class="sale-cost">Costo ${sol((+s.cost||0)*(+s.qty||0))}</span><b>${sol((+s.price||0)*(+s.qty||0))}</b></div>`).join(''):(query?'<div class="empty-admin">No se encontraron ventas para esa búsqueda.</div>':'<div class="empty-admin">Todavía no registraste ventas.</div>');
 renderStats();
};

document.addEventListener('DOMContentLoaded',async()=>{if(!document.querySelector('.panel-body'))return;try{const today=aromartLocalDate();const month=document.getElementById('monthFilter'),saleDate=document.getElementById('saleDate');if(month&&!month.value)month.value=today.slice(0,7);if(saleDate&&!saleDate.value)saleDate.value=today;month?.addEventListener('change',renderStats);await cloudLoad();renderInventory();setupSalesSearch();renderSales();setupCloudSalesForm();setupCloudProductManager();setupCloudPromos()}catch(e){console.error(e);alert('Falta preparar Supabase. Ejecuta SUPABASE-SETUP.sql una sola vez. Detalle: '+e.message)}})
