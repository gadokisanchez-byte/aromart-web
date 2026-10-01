let carrito = JSON.parse(localStorage.getItem("aromartCarrito")) || [];


/* ==============================
   HEADER
============================== */

const header = document.getElementById("header");

window.addEventListener("scroll", () => {

    if (window.scrollY > 80) {
        header.classList.add("scrolled");
    } else {
        header.classList.remove("scrolled");
    }

});


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
   FILTROS
============================== */

const filtros = document.querySelectorAll(".filtro");
const productos = document.querySelectorAll(".producto");

filtros.forEach(filtro => {

    filtro.addEventListener("click", () => {

        filtros.forEach(f => {
            f.classList.remove("activo");
        });

        filtro.classList.add("activo");

        const categoria =
            filtro.dataset.filtro;

        productos.forEach(producto => {

            if (
                categoria === "todos" ||
                producto.dataset.categoria === categoria
            ) {

                producto.classList.remove("oculto");

            } else {

                producto.classList.add("oculto");

            }

        });

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


    contador.textContent = cantidadTotal;

    subtotal.textContent =
        `S/ ${precioTotal.toFixed(2)}`;


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

const buscador =
    document.getElementById("buscador");

const cantidadProductos =
    document.getElementById("cantidadProductos");

const sinResultados =
    document.getElementById("sinResultados");


if (buscador) {

    buscador.addEventListener(
        "input",
        buscarProductos
    );

}


function buscarProductos() {

    const texto =
        buscador.value
            .toLowerCase()
            .trim();

    const productosCatalogo =
        document.querySelectorAll(
            "#listaProductos .producto"
        );

    let visibles = 0;


    productosCatalogo.forEach(
        producto => {

            const nombre =
                producto.dataset.nombre
                    .toLowerCase();

            if (
                nombre.includes(texto)
            ) {

                producto.style.display =
                    "";

                visibles++;

            } else {

                producto.style.display =
                    "none";

            }

        }
    );


    cantidadProductos.textContent =
        `${visibles} ${
            visibles === 1
            ? "PRODUCTO"
            : "PRODUCTOS"
        }`;


    if (visibles === 0) {

        sinResultados.style.display =
            "block";

    } else {

        sinResultados.style.display =
            "none";

    }

}


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

