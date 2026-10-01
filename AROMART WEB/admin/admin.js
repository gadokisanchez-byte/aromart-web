/* ==================================
   LOGIN AROMART ADMIN
================================== */

const formLogin =
    document.getElementById("formLogin");


if (formLogin) {

    formLogin.addEventListener(
        "submit",
        iniciarSesion
    );

}


async function iniciarSesion(evento) {

    evento.preventDefault();


    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("password").value;

    const mensaje =
        document.getElementById("mensajeLogin");

    const boton =
        document.getElementById("botonLogin");


    mensaje.textContent = "";

    boton.disabled = true;
    boton.innerHTML =
        "COMPROBANDO ACCESO...";


    const {
        data,
        error
    } =
        await supabaseClient.auth.signInWithPassword({

            email: email,
            password: password

        });


    if (error) {

        mensaje.textContent =
            "Correo o contraseña incorrectos.";

        boton.disabled = false;

        boton.innerHTML =
            "ENTRAR AL PANEL <span>→</span>";

        return;
    }


    if (data.user) {

        window.location.href =
            "panel.html";

    }

}


/* ==================================
   MOSTRAR CONTRASEÑA
================================== */

function mostrarPassword() {

    const password =
        document.getElementById("password");

    const boton =
        document.getElementById("verPassword");


    if (password.type === "password") {

        password.type = "text";
        boton.textContent = "OCULTAR";

    } else {

        password.type = "password";
        boton.textContent = "VER";

    }

}
