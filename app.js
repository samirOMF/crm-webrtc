// --- CONFIGURATION FreePBX ---
const SIP_DOMAIN = 'freepbx.omfomf.dyndns.org';
const WS_SERVER  = 'wss://freepbx.omfomf.dyndns.org:8089/ws';
const EXTENSION  = '414';
const PASSWORD   = '1234az';

let currentSession = null;
let activeTargetNumber = '';
let ringbackAudioUnlocked = false;
let ringbackToneRequested = false;

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
    stopRingbackTone();
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
    unlockRingbackTone();

    const options = {
        mediaConstraints: { audio: true, video: false },
        // pcConfig: { iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] }
        // Remove external STUN servers for LAN testing
        pcConfig: { iceServers: [] }
    };

    currentSession = userAgent.call(`sip:${activeTargetNumber}@${SIP_DOMAIN}`, options);

    currentSession.on('connecting', () => {
        console.log('📡 Établissement du canal média WebRTC...');
        document.getElementById('callStatus').innerText = 'Connexion...';
    });

    currentSession.on('progress', (event) => {
        const statusCode = event.response.status_code;

        if (statusCode === 180) {
            console.log('🔔 Réponse SIP 180 Ringing : lecture du retour de sonnerie local.');
            document.getElementById('callStatus').innerText = 'Sonnerie...';
            startRingbackTone();
            return;
        }

        // Stop the local tone for other provisional responses, such as 183 early media.
        stopRingbackTone();
        console.log(`ℹ️ Progression de l'appel : réponse SIP ${statusCode}.`);
        document.getElementById('callStatus').innerText = 'Mise en relation...';
    });

    currentSession.on('accepted', () => {
        stopRingbackTone();
    });

    currentSession.on('confirmed', () => {
        stopRingbackTone();
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
        stopRingbackTone();
        console.log('📴 Appel terminé.');
        document.getElementById('callStatus').innerText = 'Appel terminé';
        currentSession = null;
    });

    currentSession.on('failed', (e) => {
        stopRingbackTone();
        console.error('💥 Échec de l\'appel :', e.cause);
        document.getElementById('callStatus').innerText = `Échec : ${e.cause}`;
        currentSession = null;
    });
}

function unlockRingbackTone() {
    const audio = document.getElementById('ringbackAudio');
    if (!audio || ringbackAudioUnlocked) return;

    // Prime playback during the user's click so the later SIP response can play audio
    // even in browsers that restrict playback not directly initiated by a user gesture.
    audio.muted = true;
    const playAttempt = audio.play();

    if (playAttempt && typeof playAttempt.then === 'function') {
        playAttempt.then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.muted = false;
            ringbackAudioUnlocked = true;
            if (ringbackToneRequested) startRingbackTone();
        }).catch((error) => {
            audio.muted = false;
            console.warn('🔇 Le navigateur n’a pas autorisé la préparation du retour de sonnerie :', error);
        });
    } else {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        ringbackAudioUnlocked = true;
    }
}

function startRingbackTone() {
    const audio = document.getElementById('ringbackAudio');
    if (!audio) return;

    ringbackToneRequested = true;
    // If the muted user-gesture playback is still being prepared, resume audibly
    // as soon as that attempt resolves.
    if (!ringbackAudioUnlocked || !audio.paused) return;

    audio.currentTime = 0;
    const playAttempt = audio.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
        playAttempt.catch((error) => {
            console.warn('🔇 Impossible de lire le retour de sonnerie local :', error);
        });
    }
}

function stopRingbackTone() {
    ringbackToneRequested = false;
    const audio = document.getElementById('ringbackAudio');
    if (!audio) return;

    audio.pause();
    try {
        audio.currentTime = 0;
    } catch (error) {
        // Metadata may not be loaded yet; pause() still stops the tone.
    }
}

function terminateCall() {
    if (currentSession) {
        console.log("🛑 Action utilisateur : Raccrocher l'appel");
        stopRingbackTone();
        currentSession.terminate();
    }
}
