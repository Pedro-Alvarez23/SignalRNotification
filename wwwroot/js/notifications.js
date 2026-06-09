// ============================================================
// notifications.js — Cliente SignalR para el Centro de Notificaciones
// ============================================================

const connection = new signalR.HubConnectionBuilder()
    .withUrl("/hubs/notifications")
    .withAutomaticReconnect([0, 2000, 5000, 10000])
    .configureLogging(signalR.LogLevel.Information)
    .build();

let currentUsername = '';
let connectedUsers  = [];

// ============================================================
// Mensajes del SERVIDOR → CLIENTE
// ============================================================

connection.on("Registered", (username) => {
    currentUsername = username;
    document.getElementById("currentUsername").textContent = username;
    mostrarPanelPrincipal();
    actualizarEstado('connected');
});

connection.on("ReceiveNotification", (notification) => {
    agregarNotificacionAlFeed(notification);
});

connection.on("UserConnected", (username) => {
    agregarMensajeSistema(`${username} se ha unido al sistema`);
});

connection.on("UserDisconnected", (username) => {
    agregarMensajeSistema(`${username} ha abandonado el sistema`);
});

connection.on("UpdateUserCount", (count) => {
    document.getElementById("userCount").textContent = count;
});

connection.on("UpdateUserList", (users) => {
    connectedUsers = users;
    actualizarSelectorUsuarios(users);
});

// ============================================================
// Ciclo de vida de la conexión
// ============================================================

connection.onreconnecting(() => {
    actualizarEstado('reconnecting');
    agregarMensajeSistema("Conexión perdida. Intentando reconectar...");
});

connection.onreconnected(() => {
    actualizarEstado('connected');
    agregarMensajeSistema("Reconectado al servidor.");
    // Tras reconectar el servidor asigna un nuevo ConnectionId,
    // hay que volver a registrar el usuario
    if (currentUsername) {
        connection.invoke("Register", currentUsername).catch(console.error);
    }
});

connection.onclose(() => {
    actualizarEstado('disconnected');
    agregarMensajeSistema("Conexión cerrada. Recarga la página para reconectar.");
});

// ============================================================
// Iniciar conexión
// ============================================================

async function iniciarConexion() {
    try {
        await connection.start();
        console.log("✅ SignalR conectado correctamente");
    } catch (err) {
        console.error("❌ Error al conectar con SignalR:", err);
        setTimeout(iniciarConexion, 5000);
    }
}

// ============================================================
// Eventos UI → SERVIDOR
// ============================================================

document.getElementById("connectBtn").addEventListener("click", async () => {
    const username = document.getElementById("usernameInput").value.trim();
    if (!username) { alert("Introduce tu nombre de usuario."); return; }
    try {
        await connection.invoke("Register", username);
    } catch (err) {
        console.error("Error al registrarse:", err);
    }
});

document.getElementById("usernameInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") document.getElementById("connectBtn").click();
});

document.getElementById("sendBroadcastBtn").addEventListener("click", async () => {
    const message = document.getElementById("broadcastMessage").value.trim();
    if (!message) return;
    try {
        await connection.invoke("SendBroadcast", message);
        document.getElementById("broadcastMessage").value = '';
    } catch (err) {
        console.error("Error al enviar broadcast:", err);
    }
});

document.getElementById("sendDirectBtn").addEventListener("click", async () => {
    const target  = document.getElementById("targetUser").value;
    const message = document.getElementById("directMessage").value.trim();
    if (!target)  { alert("Selecciona un destinatario."); return; }
    if (!message) return;
    try {
        await connection.invoke("SendDirect", target, message);
        document.getElementById("directMessage").value = '';
    } catch (err) {
        console.error("Error al enviar mensaje directo:", err);
    }
});

document.getElementById("clearBtn").addEventListener("click", () => {
    document.getElementById("notificationFeed").innerHTML =
        '<p class="empty-state">Las notificaciones aparecerán aquí en tiempo real...</p>';
});

// Cambio de pestañas
document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));
        tab.classList.add("active");
        document.getElementById(`${tab.dataset.tab}-form`).classList.remove("hidden");
    });
});

// ============================================================
// Funciones auxiliares de UI
// ============================================================

function mostrarPanelPrincipal() {
    document.getElementById("login-panel").classList.add("hidden");
    document.getElementById("main-panel").classList.remove("hidden");
}

function agregarNotificacionAlFeed(notification) {
    const feed       = document.getElementById("notificationFeed");
    const emptyState = feed.querySelector(".empty-state");
    if (emptyState) emptyState.remove();

    const isMine    = notification.from === currentUsername;
    const time      = notification.timestamp
        ? new Date(notification.timestamp).toLocaleTimeString('es-ES')
        : new Date().toLocaleTimeString('es-ES');
    const typeLabel = notification.type === 'broadcast' ? '📢 Broadcast' : '✉️ Directo';

    const card = document.createElement("div");
    card.className = `notification-card ${notification.type}`;
    card.innerHTML = `
        <div class="notification-header">
            <span class="notification-type">${typeLabel}</span>
            <span class="notification-from">${isMine ? 'Tú' : escapeHtml(notification.from)}</span>
            <span class="notification-time">${time}</span>
        </div>
        <p class="notification-message">${escapeHtml(notification.message)}</p>
    `;

    feed.insertBefore(card, feed.firstChild);
}

function agregarMensajeSistema(texto) {
    const feed       = document.getElementById("notificationFeed");
    const emptyState = feed.querySelector(".empty-state");
    if (emptyState) emptyState.remove();

    const msg = document.createElement("div");
    msg.className   = "system-message";
    msg.textContent = `ℹ️ ${texto}`;
    feed.insertBefore(msg, feed.firstChild);
}

function actualizarSelectorUsuarios(users) {
    const select      = document.getElementById("targetUser");
    const valorActual = select.value;

    select.innerHTML = '<option value="">Selecciona un usuario...</option>';
    users
        .filter(u => u !== currentUsername)
        .forEach(user => {
            const opt = document.createElement("option");
            opt.value       = user;
            opt.textContent = user;
            if (user === valorActual) opt.selected = true;
            select.appendChild(opt);
        });
}

function actualizarEstado(status) {
    const badge   = document.getElementById("connectionStatus");
    const estados = {
        connected:    ['Conectado',       'badge-connected'],
        reconnecting: ['Reconectando...', 'badge-reconnecting'],
        disconnected: ['Desconectado',    'badge-disconnected']
    };
    const [label, className] = estados[status] ?? estados.disconnected;
    badge.className   = `badge ${className}`;
    badge.textContent = label;
}

// Previene XSS al insertar texto de usuario en el DOM
function escapeHtml(text) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}

// ============================================================
// Arrancar
// ============================================================
iniciarConexion();
