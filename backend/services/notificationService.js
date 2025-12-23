const admin = require('firebase-admin');

let firebaseInitialized = false;

function initializeFirebase() {
    if (firebaseInitialized) return;

    try {
        // PRIORIDADE: Variável de ambiente (Render)
        // O .replace garante que os \n da variável de ambiente virem quebras de linha reais
        const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
        
        const serviceAccount = {
            "type": "service_account",
            "project_id": "autogiro-e48fa",
            "private_key_id": "a9ff6706ea1d84c91e843462978c52d8cd1e65b5",
            "private_key": rawPrivateKey ? rawPrivateKey.replace(/\\n/g, '\n') : undefined,
            "client_email": "firebase-adminsdk-fbsvc@autogiro-e48fa.iam.gserviceaccount.com",
            "client_id": "117530557454487622495",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40autogiro-e48fa.iam.gserviceaccount.com",
            "universe_domain": "googleapis.com"
        };

        // Se não houver chave na env, o código vai falhar aqui antes de tentar o Firebase
        if (!serviceAccount.private_key) {
            console.error('❌ ERRO: FIREBASE_PRIVATE_KEY vazia ou inválida!');
            return;
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        firebaseInitialized = true;
        console.log('✅ Firebase inicializado com sucesso!');

    } catch (error) {
        console.error('❌ Erro na inicialização:', error.message);
    }
}

initializeFirebase();

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
            token: token,
            notification: { title, body },
            data: stringData,
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    clickAction: 'FLUTTER_NOTIFICATION_CLICK'
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
        console.log('✅ Push enviado! ID:', response);
        return response;
    } catch (error) {
        // Aqui pegamos o erro de "Invalid JWT Signature"
        console.error('❌ Erro ao enviar Push:', error.message);
        throw error;
    }
}

module.exports = { sendPushNotification };
