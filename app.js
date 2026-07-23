// --- CONFIGURATION FreePBX ---
const SIP_DOMAIN = 'freepbx.omfomf.dyndns.org';
const WS_SERVER  = 'wss://freepbx.omfomf.dyndns.org:8089/ws';
const EXTENSION  = '1005';
const PASSWORD   = 'sam123';

let currentSession = null;
let activeTargetNumber = '';

console.log("🚀 Initialisation du client WebRTC...");

// --- INITIALISATION JsSIP ---
const socket = new JsSIP.WebSocketInterface(WS_SERVER);
const configuration = {
  sockets: [socket],
  uri: `sip:${EXTENSION}@${SIP_DOMAIN}`,
  password: PASSWORD,
  display_name: `Extension ${EXTENSION}`,
  register: true
};

const userAgent = new JsSIP.UA(configuration);

// --- LOGS DE DÉBOGAGE CONSOLE ---
userAgent.on('connecting', () => {
  console.log('🔄 Connexion en cours au serveur WebSocket FreePBX...');
});

userAgent.on('connected', () => {
  console.log('✅ Connecté au serveur WebSocket ! Tentative d\'enregistrement SIP...');
});

userAgent.on('disconnected', () => {
  console.warn('❌ Déconnecté du serveur WebSocket FreePBX.');
});

userAgent.on('registered', () => {
  console.log('🎉 SUCCÈS : Extension SIP enregistrée avec succès sur FreePBX !');
});

userAgent.on('unregistered', () => {
  console.warn('⚠️ Extension SIP désenregistrée.');
});

userAgent.on('registrationFailed', (data) => {
  console.error('💥 ÉCHEC D\'ENREGISTREMENT SIP :', data.cause);
});

// Démarrer le client SIP
userAgent.start();

// --- GESTION DES MODALES ---
function openAddModal() {
    document.getElementById('addModal').style.display = 'flex';
}

function closeAddModal() {
    document.getElementById('addModal').style.display = 'none';
    document.getElementById('inputName').value = '';
    document.getElementById('inputPhone').value = '';
}

function openCallModal(name, phone) {
    activeTargetNumber = phone;
    document.getElementById('callTargetName').innerText = name;
    document.getElementById('callTargetNumber').innerText = phone;
    document.getElementById('callStatus').innerText = 'Prêt';
    document.getElementById('callModal').style.display = 'flex';
}

function closeCallModal() {
    if (currentSession) {
        console.log("🚫 Fermeture de la fenêtre : interruption de l'appel...");
        currentSession.terminate();
    }
    document.getElementById('callModal').style.display = 'none';
}

// --- AJOUT DE CONTACT ---
function saveContact() {
    const name = document.getElementById('inputName').value.trim();
    const phone = document.getElementById('inputPhone').value.trim();

    if (!name || !phone) {
        alert("Veuillez remplir le nom et le numéro !");
        return;
    }

    const emptyMsg = document.getElementById('emptyMsg');
    if (emptyMsg) emptyMsg.style.display = 'none';

    const list = document.getElementById('contactsList');
    const card = document.createElement('div');
    card.className = 'contact-card';
    card.innerHTML = `
        <span class="contact-name">${name}</span>
        <span class="contact-phone" onclick="openCallModal('${name}', '${phone}')">📞 ${phone}</span>
    `;

    list.appendChild(card);
    console.log(`👤 Contact ajouté : ${name} (${phone})`);
    closeAddModal();
}

// --- GESTION DES APPELS WEBRTC ET LOGS ---
function startCall() {
    if (!activeTargetNumber) return;

    console.log(`📞 Lancement de l'appel vers : ${activeTargetNumber}`);

    const options = {
        mediaConstraints: { audio: true, video: false },
        pcConfig: { iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] }
    };

    currentSession = userAgent.call(`sip:${activeTargetNumber}@${SIP_DOMAIN}`, options);

    currentSession.on('connecting', () => {
        console.log('📡 Établissement du canal média WebRTC...');
        document.getElementById('callStatus').innerText = 'Connexion...';
    });

    currentSession.on('progress', () => {
        console.log('🔔 Le destinataire sonne...');
        document.getElementById('callStatus').innerText = 'Sonnerie...';
    });

    currentSession.on('confirmed', () => {
        console.log('🗣️ Appel décroché ! Communication en cours.');
        document.getElementById('callStatus').innerText = '🟢 En communication';
        
        const stream = new MediaStream();
        const receiver = currentSession.connection.getReceivers().find(r => r.track.kind === 'audio');
        if (receiver) {
            stream.addTrack(receiver.track);
            document.getElementById('remoteAudio').srcObject = stream;
        }
    });

    currentSession.on('ended', () => {
        console.log('📴 Appel terminé.');
        document.getElementById('callStatus').innerText = 'Appel terminé';
        currentSession = null;
    });

    currentSession.on('failed', (e) => {
        console.error('💥 Échec de l\'appel :', e.cause);
        document.getElementById('callStatus').innerText = `Échec : ${e.cause}`;
        currentSession = null;
    });
}

function terminateCall() {
    if (currentSession) {
        console.log("🛑 Action utilisateur : Raccrocher l'appel");
        currentSession.terminate();
    }
}