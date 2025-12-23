const admin = require('firebase-admin');

let firebaseInitialized = false;

function initializeFirebase() {
    if (firebaseInitialized) return;

    try {
        // Buscamos a chave da variável de ambiente primeiro
        const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
        
        const serviceAccount = {
            "type": "service_account",
            "project_id": "autogiro-e48fa",
            "private_key_id": "6503490a23db8dfb4f7f783eb39cee35ad619558",
            // O .replace(/\\n/g, '\n') resolve o erro de "Invalid JWT Signature"
            "private_key": rawPrivateKey ? rawPrivateKey.replace(/\\n/g, '\n') : undefined,
            "client_email": "firebase-adminsdk-fbsvc@autogiro-e48fa.iam.gserviceaccount.com",
            "client_id": "117530557454487622495",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40autogiro-e48fa.iam.gserviceaccount.com",
            "universe_domain": "googleapis.com"
        };

        // Validação básica para evitar erro de inicialização sem chave
        if (!serviceAccount.private_key && !process.env.FIREBASE_PRIVATE_KEY) {
            console.error('❌ ERRO: FIREBASE_PRIVATE_KEY não encontrada nas variáveis de ambiente!');
            return;
        }

        console.log('\n🔍 ===== FIREBASE INIT =====');
        console.log('🔑 Key ID:', serviceAccount.private_key_id);
        console.log('🔐 Private Key configurada corretamente via ENV');
        console.log('============================\n');

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        firebaseInitialized = true;
        console.log('✅ Firebase inicializado com sucesso!');

    } catch (error) {
        console.error('❌ Erro ao inicializar Firebase:', error.message);
    }
}

// Inicializa imediatamente
initializeFirebase();

/**
 * Envia notificação para um único token
 */
async function sendPushNotification(token, title, body, data = {}) {
    if (!firebaseInitialized) {
        throw new Error('Firebase não inicializado corretamente.');
    }

    try {
        const stringData = {};
        if (data) {
            for (const [key, value] of Object.entries(data)) {
                stringData[key] = String(value);
            }
        }

        const message = {
            token,
            notification: { title, body },
            data: stringData,
            // Configurações específicas para garantir entrega em background
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    clickAction: 'FLUTTER_NOTIFICATION_CLICK' // Útil se estiver usando Flutter
                }
            },
            apns: {
                payload: {
                    aps: {
                        alert: { title, body },
                        sound: 'default',
                        badge: 1,
                        contentAvailable: true
                    }
                }
            }
        };

        const response = await admin.messaging().send(message);
        console.log('✅ Push enviado com sucesso! ID:', response);
        return response;
    } catch (error) {
        console.error('❌ Erro ao enviar Push:', error);
        throw error;
    }
}

/**
 * Envia notificação para múltiplos tokens (Multicast)
 */
async function sendMulticastNotification(tokens, title, body, data = {}) {
    if (!firebaseInitialized) {
        throw new Error('Firebase não inicializado.');
    }

    try {
        const stringData = {};
        if (data) {
            for (const [key, value] of Object.entries(data)) {
                stringData[key] = String(value);
            }
        }

        const message = {
            tokens, // Array de strings
            notification: { title, body },
            data: stringData,
            android: { priority: 'high' }
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        console.log(`✅ Resultado Multicast: ${response.successCount} enviadas, ${response.failureCount} falhas.`);
        return response;
    } catch (error) {
        console.error('❌ Erro no envio Multicast:', error);
        throw error;
    }
}

module.exports = { sendPushNotification, sendMulticastNotification };
