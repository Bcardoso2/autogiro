const admin = require('firebase-admin');

let firebaseInitialized = false;

function initializeFirebase() {
    if (firebaseInitialized) return;

    try {
        // Esta string é a que você me enviou. 
        // IMPORTANTE: Se você mudou letras nela, substitua pela ORIGINAL do JSON.
        const hardcodedKey = `-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDZHy98WQVsMAbQ\nTYJHQIWfdQYxHgfgKkwwhCj4Fh1n4AAz1JCgiNCCS2EtVLOG4fE9TalKT3DnOAPC\npaA7fluq4JQwOScESOXSh7nfQ+ZsAwl5W4lDylaprmQa0yOA9Er7RhFoHu+O8BM8\nwuEUfmUdLse/OA8evSVkp1fINLaN9o2BCARYlQ7vOWy2DwWsRY/oZylHvNoieh+x\n0JqB/MiF7avaaWtA6VFryxMGr4MVSamd8VBuvkABNFNakx/J1pMBzh2GMT3W5U5q\nprMFISNcYY4jsmuyyjv60RGOqSMnXjfHOnBp+1Tm0sUTm7UeXZ7PPOgGHy2jXD3R\nwQqFV9EZAgMBAAECggEAa7bl9vmvEAIvjy20wSaIZBhJbxqn65TwYW1fadyG0B63\n2v7MlWfqkYlV94g63GLBLJmXr+8DYyJN80X53SoNzhNGUTo5Wg3UPoLpOpNUACft\njlBUI9aA8gM7VHeE+Je5jzkur4oRbMc7s/w2b9VY0oZ/wCTOk4BgybOfgApuurQ5\nKpBiUCp3KoMc4R9B+EnomOstoABiX2CkTO7oOfTW7Ka44O/EMgRRaBvvzhrnFRph\n8Cm731c/5FEKNEmvzJWC/Bfkd+FQZAsdXnkJXNBjIkGVb4XTHjQYnn7Qivv8doYM\nCNgbOzzJK9fatRtqWC7eJpkLXwwA3kxoQMUe7P44NQKBgQD5Ula8/TJl43hJ+12u\nw2AqVUTdbIfNuhFYaHBykS1zHyhi58lMwZSTx+ZMLU3FB7RTuilfgcsAfR+a2++3\ncMeUwmW97EQ0XBNFLyjueXrq8LTCv2RrSs0riR5lSCHdavCJ2CSd2zmzmbkX9ad0\nxU28IyVVzea65ZkbGgF2+Vo1JwKBgQDe8AtfFY38snKpnO/JIVocUYoRgJiD0MSm\n9dNK/utPX8gRbrYH4re19b0kDv0fOSc0Z/v4gefAJTPXc6e+0Mbfbs8NB+KIAiys\n+oeKV//TCGeYJgFedU0oXCjluWEEobVtwXKfR+p31z7WC5Fgd9rOQn7P9QfYFQx5\nuLjEl3gvvwKBgGGtzKXGXRRmBh6WCKILkYWEWrKVbq8/EsScRlHcZv4PWvdE8CzO\nOrObQbLenPVwi0mySbtNUociflthh41K9iZl8w5xnlcVK8eTLmof1fRt0aPq8CDI\n8ZD465uqovnoh8y5jb76wKSIuWeVqsGo+0eWTW5MePUINu/TRHekQZ9JAoGAcf2/\ncsDstvbvljZ+jRMWpkAzHrvoQA4xX0V24nPyEcXh4LgBL4sHcGzUZ2mal6p7l1pM\nBkc2HpNnLJUggnryFTDtgbY0aGLkQRZg06YnUtqLTcqxDIFiEG7/Imdlah7dS9+M\nIlF9XAWdRYjorrDaGnj5qo+ZkS1CEcMYBr2EYLUCgYBvUxeJ0ZN17pmYyJhEZE8j\nO2PMyu0D8rH2XiCUm6JYX9qySrPvWl8UoUOUBQvfh21q2msMZtYxKWO3vWuTcX+G\nc0vx7PYsDEyiKwNxQqGvIbQ95c9EV7Zzybe9ZulBB8TqRvL3hdJ1orhd8udfGFrF\nyzfFrGS5gqt0sKDbOxxwew==\n-----END PRIVATE KEY-----\n`;

        // Tentamos pegar da ENV, se não existir, usa a hardcoded
        let privateKey = process.env.FIREBASE_PRIVATE_KEY || hardcodedKey;

        // Limpeza crucial: substitui as barras literais por quebras de linha reais
        privateKey = privateKey.replace(/\\n/g, '\n');

        const serviceAccount = {
            "type": "service_account",
            "project_id": "autogiro-e48fa",
            "private_key_id": "a9ff6706ea1d84c91e843462978c52d8cd1e65b5",
            "private_key": privateKey,
            "client_email": "firebase-adminsdk-fbsvc@autogiro-e48fa.iam.gserviceaccount.com",
            "client_id": "117530557454487622495",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40autogiro-e48fa.iam.gserviceaccount.com",
            "universe_domain": "googleapis.com"
        };

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
    if (!firebaseInitialized) throw new Error('Firebase não inicializado');

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
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } }
    };

    try {
        const response = await admin.messaging().send(message);
        console.log('✅ Push enviado! ID:', response);
        return response;
    } catch (error) {
        console.error('❌ Erro ao enviar Push:', error.message);
        throw error;
    }
}

module.exports = { sendPushNotification };
