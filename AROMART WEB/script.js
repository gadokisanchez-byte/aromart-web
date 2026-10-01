let carrito = JSON.parse(localStorage.getItem("aromartCarrito")) || [];


/* ==============================
   HEADER
============================== */

const header = document.getElementById("header");

if (header) {
    window.addEventListener("scroll", () => {
        if (window.scrollY > 80) header.classList.add("scrolled");
        else header.classList.remove("scrolled");
    });
}


/* ==============================
   ANIMACIONES AL HACER SCROLL
============================== */

const elementos = document.querySelectorAll(".revelar");

const observer = new IntersectionObserver(

    entradas => {

        entradas.forEach((entrada, index) => {

            if (entrada.isIntersecting) {

                setTimeout(() => {
                    entrada.target.classList.add("visible");
                }, index * 70);

                observer.unobserve(entrada.target);
            }

        });

    },

    {
        threshold: 0.12
    }

);

elementos.forEach(elemento => {
    observer.observe(elemento);
});


/* ==============================
   FILTROS + BUSCADOR
============================== */

let filtroActivo = "todos";

function aplicarFiltrosCatalogo() {
    const lista = document.querySelectorAll("#listaProductos .producto");
    if (!lista.length) return;
    const buscadorEl = document.getElementById("buscador");
    const texto = buscadorEl ? buscadorEl.value.toLowerCase().trim() : "";
    let visibles = 0;
    lista.forEach(producto => {
        const nombre = (producto.dataset.nombre || producto.textContent).toLowerCase();
        const coincideTexto = nombre.includes(texto);
        const coincideCategoria = filtroActivo === "todos" || producto.dataset.categoria === filtroActivo;
        const mostrar = coincideTexto && coincideCategoria;
        producto.classList.toggle("oculto", !mostrar);
        producto.style.display = mostrar ? "" : "none";
        if (mostrar) visibles++;
    });
    const cantidad = document.getElementById("cantidadProductos");
    if (cantidad) cantidad.textContent = `${visibles} ${visibles === 1 ? "PRODUCTO" : "PRODUCTOS"}`;
    const vacio = document.getElementById("sinResultados");
    if (vacio) vacio.style.display = visibles === 0 ? "block" : "none";
}

document.querySelectorAll(".filtro").forEach(filtro => {
    filtro.addEventListener("click", () => {
        document.querySelectorAll(".filtro").forEach(f => f.classList.remove("activo"));
        filtro.classList.add("activo");
        filtroActivo = filtro.dataset.filtro || "todos";
        aplicarFiltrosCatalogo();
    });
});

/* ==============================
   CARRITO
============================== */

function agregarCarrito(nombre, precio) {

    const existente =
        carrito.find(item => item.nombre === nombre);

    if (existente) {

        existente.cantidad++;

    } else {

        carrito.push({
            nombre,
            precio,
            cantidad: 1
        });

    }
localStorage.setItem(
    "aromartCarrito",
    JSON.stringify(carrito)
);
    actualizarCarrito();
    abrirCarrito();
}


function eliminarProducto(index) {

    carrito.splice(index, 1);

    actualizarCarrito();

}


function actualizarCarrito() {

    const contenedor =
        document.getElementById("carritoItems");

    const contador =
        document.getElementById("contador");

    const subtotal =
        document.getElementById("subtotal");


    const cantidadTotal =
        carrito.reduce(
            (total, item) =>
                total + item.cantidad,
            0
        );


    const precioTotal =
        carrito.reduce(
            (total, item) =>
                total + item.precio * item.cantidad,
            0
        );


    if (contador) contador.textContent = cantidadTotal;
    if (subtotal) subtotal.textContent = `S/ ${precioTotal.toFixed(2)}`;
    if (!contenedor) return;


    if (carrito.length === 0) {

        contenedor.innerHTML =
            `<p class="vacio">
                Tu bolsa está vacía.
             </p>`;

        return;
    }


    contenedor.innerHTML =
        carrito.map((item, index) => `

            <div class="item-carrito">

                <div>

                    <h4>${item.nombre}</h4>

                    <p>
                        ${item.cantidad} ×
                        S/ ${item.precio.toFixed(2)}
                    </p>

                </div>

                <button
                    onclick="eliminarProducto(${index})"
                >
                    ELIMINAR
                </button>

            </div>

        `).join("");

}


function abrirCarrito() {

    document
        .getElementById("carrito")
        .classList.add("abierto");

    document
        .getElementById("overlay")
        .classList.add("abierto");

    document.body.style.overflow = "hidden";
}


function cerrarCarrito() {

    document
        .getElementById("carrito")
        .classList.remove("abierto");

    document
        .getElementById("overlay")
        .classList.remove("abierto");

    document.body.style.overflow = "";
}


/* ==============================
   WHATSAPP
============================== */

function finalizarPedido() {

    if (carrito.length === 0) {

        alert("Tu bolsa está vacía.");

        return;
    }


    let mensaje =
        "Hola AromArt ✨%0A" +
        "Quiero realizar el siguiente pedido:%0A%0A";


    carrito.forEach(item => {

        mensaje +=
            `• ${item.nombre} x${item.cantidad}` +
            ` — S/ ${(item.precio * item.cantidad).toFixed(2)}%0A`;

    });


    const total =
        carrito.reduce(
            (suma, item) =>
                suma +
                item.precio * item.cantidad,
            0
        );


    mensaje +=
        `%0A*Total: S/ ${total.toFixed(2)}*`;


    /*
       MÁS ADELANTE COLOCAREMOS
       AQUÍ EL WHATSAPP REAL
       DE AROMART.
    */

    const url =
        `https://wa.me/?text=${mensaje}`;

    window.open(url, "_blank");

}
/* ==================================
   BUSCADOR DEL CATÁLOGO
================================== */
const buscador = document.getElementById("buscador");
if (buscador) buscador.addEventListener("input", aplicarFiltrosCatalogo);

/* ==================================
   FAVORITOS
================================== */

const favoritos =
    document.querySelectorAll(
        ".favorito"
    );


favoritos.forEach(
    boton => {

        boton.addEventListener(
            "click",
            () => {

                boton.classList.toggle(
                    "guardado"
                );

                if (
                    boton.classList.contains(
                        "guardado"
                    )
                ) {

                    boton.textContent =
                        "♥";

                } else {

                    boton.textContent =
                        "♡";

                }

            }
        );

    }
);
/* ==============================
   PÁGINA DEL PRODUCTO
============================== */

let cantidadDetalle = 1;


function sumarCantidad() {

    cantidadDetalle++;

    actualizarCantidadDetalle();

}


function restarCantidad() {

    if (cantidadDetalle > 1) {

        cantidadDetalle--;

        actualizarCantidadDetalle();

    }

}


function actualizarCantidadDetalle() {

    const elemento =
        document.getElementById("cantidad");

    if (elemento) {

        elemento.textContent =
            cantidadDetalle;

    }

}


function agregarProductoDetalle() {

    for (
        let i = 0;
        i < cantidadDetalle;
        i++
    ) {

        agregarCarrito(
            "Khamrah",
            150
        );

    }

    cantidadDetalle = 1;

    actualizarCantidadDetalle();

}
/* ===============================
   PRÓXIMAMENTE
=============================== */

function avisarme(producto) {

    const mensaje =
        `Hola AromArt ✨%0A%0A` +
        `Quisiera información sobre: *${producto}*.%0A` +
        `¿Me pueden avisar cuando esté disponible?`;

    window.open(
        `https://wa.me/?text=${mensaje}`,
        "_blank"
    );

}
/* ==================================
   CONTACTO AROMART
================================== */

function contactarAromArt() {
    const mensaje = encodeURIComponent(
        "¡Hola, AromArt Shop! ✨ Quisiera consultar por sus perfumes y productos disponibles."
    );

    window.open(
        `https://wa.me/?text=${mensaje}`,
        "_blank",
        "noopener,noreferrer"
    );
}
/* ==================================
   INICIAR AROMART
================================== */

document.addEventListener("DOMContentLoaded", () => {
    actualizarCarrito();
    const lista = document.querySelectorAll("#listaProductos .producto");
    const cantidad = document.getElementById("cantidadProductos");
    if (cantidad) cantidad.textContent = `${lista.length} ${lista.length === 1 ? "PRODUCTO" : "PRODUCTOS"}`;
    aplicarFiltrosCatalogo();
});
/* ==================================
   MENÚ MÓVIL
================================== */

function abrirMenu() {

    const menu =
        document.getElementById("menuMovil");

    if (!menu) return;

    menu.classList.add("abierto");

    document.body.classList.add(
        "menu-abierto"
    );
}


function cerrarMenu() {

    const menu =
        document.getElementById("menuMovil");

    if (!menu) return;

    menu.classList.remove("abierto");

    document.body.classList.remove(
        "menu-abierto"
    );
}


/* CERRAR CON ESC */

document.addEventListener(
    "keydown",
    (evento) => {

        if (evento.key === "Escape") {
            cerrarMenu();
        }

    }
);

