const formLogin=document.getElementById('formLogin');
if(formLogin) formLogin.addEventListener('submit',iniciarSesion);

async function iniciarSesion(e){
  e.preventDefault();

  const email=document.getElementById('email').value.trim();
  const password=document.getElementById('password').value;
  const m=document.getElementById('mensajeLogin');
  const b=document.getElementById('botonLogin');

  m.textContent='';
  b.disabled=true;
  b.innerHTML='COMPROBANDO ACCESO...';

  const {data,error}=await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if(error){
    m.textContent='Correo o contraseña incorrectos.';
    b.disabled=false;
    b.innerHTML='ENTRAR AL PANEL <span>→</span>';
    return;
  }

  if(data.user){
    location.href='panel.html';
  }
}

function mostrarPassword(){
  const p=document.getElementById('password');
  const b=document.getElementById('verPassword');

  p.type=p.type==='password'?'text':'password';
  b.textContent=p.type==='password'?'VER':'OCULTAR';
}


const KEY='aromart_inventory_v2';
const SALES='aromart_sales_v2';

let allBase=()=>[
  ...(window.STOCK||[]),
  ...(window.UPCOMING||[])
];

let inv=JSON.parse(localStorage.getItem(KEY)||'{}');
let sales=JSON.parse(localStorage.getItem(SALES)||'[]');

const idOf=n=>n
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9]+/g,'-')
  .replace(/^-|-$/g,'');

function ensure(){
  allBase().forEach(p=>{
    const id=idOf(p.name);

    if(!inv[id]){
      inv[id]={
        qty:p.upcoming?0:1,
        cost:0,
        price:p.price||0,
        status:p.upcoming?'proximamente':'disponible'
      };
    }else if(inv[id].price==null){
      inv[id].price=p.price||0;
    }
  });

  persist();
}

function persist(){
  localStorage.setItem(KEY,JSON.stringify(inv));
}

function persistSales(){
  localStorage.setItem(SALES,JSON.stringify(sales));
}

const sol=n=>'S/'+Number(n||0)
  .toFixed(2)
  .replace('.00','');


function renderInventory(){
  const body=document.getElementById('inventoryBody');
  if(!body)return;

  const q=(document.getElementById('adminSearch').value||'').toLowerCase();

  body.innerHTML=allBase()
    .filter(p=>p.name.toLowerCase().includes(q))
    .map(p=>{
      const id=idOf(p.name);

      const x=inv[id]||(inv[id]={
        qty:p.upcoming?0:1,
        cost:0,
        price:p.price||0,
        status:p.upcoming?'proximamente':'disponible'
      });

      const gain=(+x.price||0)-(+x.cost||0);
      const margin=x.price?gain/x.price*100:0;

      const src=
        p.img?.startsWith('data:')||
        p.img?.startsWith('http')
          ?p.img
          :'../'+encodeURI(p.img);

      return `
      <tr>

        <td>
          <div class="product-cell">

            <img
              src="${src}"
              onerror="this.src='../assets/brand/logo.jpeg'"
            >

            <div>
              <b>${p.name}</b>
              <small>${p.cat}</small>

              ${
                (p.sku||x.sku)
                ?`<code>${p.sku||x.sku}</code>`
                :''
              }

            </div>

          </div>
        </td>

        <td>
          <select
            class="status-select"
            onchange="setField('${id}','status',this.value)"
          >

            <option
              value="disponible"
              ${x.status==='disponible'?'selected':''}
            >
              Disponible
            </option>

            <option
              value="agotado"
              ${x.status==='agotado'?'selected':''}
            >
              Agotado
            </option>

            <option
              value="proximamente"
              ${x.status==='proximamente'?'selected':''}
            >
              Próximamente
            </option>

          </select>
        </td>

        <td>
          <input
            class="cell-input"
            type="number"
            min="0"
            value="${x.qty||0}"
            onchange="setField('${id}','qty',this.value)"
          >
        </td>

        <td>
          <input
            class="cell-input"
            type="number"
            min="0"
            step=".01"
            value="${x.cost||0}"
            onchange="setField('${id}','cost',this.value)"
          >
        </td>

        <td>
          <input
            class="cell-input"
            type="number"
            min="0"
            step=".01"
            value="${x.price||0}"
            onchange="setField('${id}','price',this.value)"
          >
        </td>

        <td class="${gain>=0?'gain':'loss'}">
          ${sol(gain)}
        </td>

        <td>
          ${margin.toFixed(1)}%
        </td>

        <td>

          <button
            class="mini-action"
            onclick="quickSale('${id}')"
          >
            + VENTA
          </button>

          ${
            p.custom
            ?`
            <button
              class="mini-action delete-product"
              onclick="deleteCustom('${id}')"
            >
              ELIMINAR
            </button>
            `
            :''
          }

        </td>

      </tr>
      `;
    })
    .join('');

  refreshSaleProducts();
  renderStats();
}


function setField(id,f,v){

  if(!inv[id])return;

  inv[id][f]=
    f==='status'
      ?v
      :Number(v||0);

  if(
    f==='qty' &&
    inv[id].qty<=0 &&
    inv[id].status==='disponible'
  ){
    inv[id].status='agotado';
  }

  persist();
  renderInventory();
}


function refreshSaleProducts(){

  const s=document.getElementById('saleProduct');
  if(!s)return;

  const old=s.value;

  s.innerHTML=allBase().map(p=>{

    const id=idOf(p.name);
    const x=inv[id]||{qty:0};

    return `
      <option value="${id}">
        ${p.name} · stock ${x.qty||0}
      </option>
    `;

  }).join('');

  if([...s.options].some(o=>o.value===old)){
    s.value=old;
  }

  syncSalePrice();
}


function syncSalePrice(){

  const id=document.getElementById('saleProduct')?.value;

  if(id){
    document.getElementById('salePrice').value=
      inv[id]?.price||0;
  }

}


function addSale(id,qty,price,date){

  const p=allBase().find(
    z=>idOf(z.name)===id
  );

  if(!p)return;

  const x=inv[id];
  const q=Math.max(1,Number(qty||1));

  sales.unshift({
    id:Date.now(),
    productId:id,
    name:p.name,
    qty:q,
    price:Number(price||0),
    cost:Number(x.cost||0),
    date
  });

  x.qty=Math.max(
    0,
    Number(x.qty||0)-q
  );

  if(
    x.qty===0 &&
    x.status==='disponible'
  ){
    x.status='agotado';
  }

  persist();
  persistSales();
  renderInventory();
  renderSales();
}


function quickSale(id){

  addSale(
    id,
    1,
    inv[id].price,
    new Date().toISOString().slice(0,10)
  );

}


function renderSales(){

  const box=document.getElementById('salesList');

  if(!box)return;

  box.innerHTML=sales.length

    ?sales.slice(0,50).map(s=>`

      <div class="sale-item">

        <div>
          <b>${s.qty} × ${s.name}</b>
          <small>${s.date}</small>
        </div>

        <span class="sale-cost">
          Costo ${sol(s.cost*s.qty)}
        </span>

        <b>
          ${sol(s.price*s.qty)}
        </b>

      </div>

    `).join('')

    :'<div class="empty-admin">Todavía no registraste ventas.</div>';

  renderStats();
}


function renderStats(){

  if(!document.getElementById('revenue'))return;

  const month=document.getElementById('monthFilter').value;

  const ss=sales.filter(
    s=>s.date?.startsWith(month)
  );

  const units=ss.reduce(
    (a,s)=>a+s.qty,
    0
  );

  const rev=ss.reduce(
    (a,s)=>a+s.price*s.qty,
    0
  );

  const cost=ss.reduce(
    (a,s)=>a+s.cost*s.qty,
    0
  );

  const stock=Object.values(inv).reduce(
    (a,x)=>a+(+x.qty||0)*(+x.cost||0),
    0
  );

  const salesCountEl=document.getElementById('salesCount');
  const revenueEl=document.getElementById('revenue');
  const cogsEl=document.getElementById('cogs');
  const profitEl=document.getElementById('profit');
  const stockValueEl=document.getElementById('stockValue');

  if(salesCountEl)salesCountEl.textContent=units;
  if(revenueEl)revenueEl.textContent=sol(rev);
  if(cogsEl)cogsEl.textContent=sol(cost);
  if(profitEl)profitEl.textContent=sol(rev-cost);
  if(stockValueEl)stockValueEl.textContent=sol(stock);
}


function clearSales(){

  if(
    confirm(
      '¿Borrar todo el historial de ventas? Esta acción no se puede deshacer.'
    )
  ){
    sales=[];
    persistSales();
    renderSales();
  }

}


function exportData(){

  const blob=new Blob(
    [
      JSON.stringify(
        {
          inventory:inv,
          sales,
          exportedAt:new Date().toISOString()
        },
        null,
        2
      )
    ],
    {
      type:'application/json'
    }
  );

  const a=document.createElement('a');

  a.href=URL.createObjectURL(blob);

  a.download=
    'aromart-respaldo-'+
    new Date().toISOString().slice(0,10)+
    '.json';

  a.click();

  URL.revokeObjectURL(a.href);
}


async function logout(){

  try{
    await supabaseClient.auth.signOut();
  }catch(e){}

  location.href='login.html';
}



// CATÁLOGO DINÁMICO

const CUSTOM='aromart_custom_products_v1';
const COUPON='aromart_coupon_v1';
const NOTICE='aromart_notice_v1';

let customProducts=
  JSON.parse(
    localStorage.getItem(CUSTOM)||'[]'
  );

const originalAllBase=allBase;

allBase=()=>[
  ...(window.STOCK||[]),
  ...(window.UPCOMING||[]),
  ...customProducts
];


function persistCustom(){

  localStorage.setItem(
    CUSTOM,
    JSON.stringify(customProducts)
  );

}


function readFileData(file){

  return new Promise(
    (resolve,reject)=>{

      if(!file){
        return resolve('');
      }

      const r=new FileReader();

      r.onload=()=>resolve(r.result);
      r.onerror=reject;

      r.readAsDataURL(file);

    }
  );

}


function setupProductManager(){

  const f=document.getElementById('productForm');

  if(!f)return;

  const newGainEl=document.getElementById('newGain');
  const newPriceEl=document.getElementById('newPrice');
  const newCostEl=document.getElementById('newCost');

  const update=()=>{

    if(newGainEl){

      newGainEl.textContent=sol(
        (+newPriceEl?.value||0)-
        (+newCostEl?.value||0)
      );

    }

  };

  newCostEl?.addEventListener(
    'input',
    update
  );

  newPriceEl?.addEventListener(
    'input',
    update
  );

  update();
}


function deleteCustom(id){

  const p=customProducts.find(
    x=>idOf(x.name)===id
  );

  if(!p)return;

  if(!confirm('¿Eliminar '+p.name+'?')){
    return;
  }

  customProducts=
    customProducts.filter(
      x=>idOf(x.name)!==id
    );

  delete inv[id];

  persistCustom();
  persist();
  renderInventory();
}
