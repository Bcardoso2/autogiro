const admin = require('firebase-admin')

// Inicializar Firebase Admin (apenas uma vez)
let firebaseInitialized = false

function initializeFirebase() {
    if (firebaseInitialized) return
    
    try {
        // Opção 1: Usar credenciais da variável de ambiente
        if (process.env.FIREBASE_CREDENTIALS) {
            const credentials = JSON.parse(process.env.FIREBASE_CREDENTIALS)
            admin.initializeApp({
                credential: admin.credential.cert(credentials)
            })
        }
        // Opção 2: Usar arquivo
        else if (process.env.FIREBASE_CREDENTIALS_PATH) {
            const serviceAccount = require(`../${process.env.FIREBASE_CREDENTIALS_PATH}`)
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            })
        }
        else {
            throw new Error('Credenciais do Firebase não configuradas')
        }
        
        firebaseInitialized = true
        console.log('✅ Firebase Admin inicializado')
    } catch (error) {
        console.error('❌ Erro ao inicializar Firebase:', error.message)
    }
}

// Inicializar ao carregar o módulo
initializeFirebase()

/**
 * Enviar notificação push para um usuário
 * @param {string} token - Token FCM do dispositivo
 * @param {string} title - Título da notificação
 * @param {string} body - Corpo da notificação
 * @param {object} data - Dados extras (opcional)
 * @returns {Promise}
 */
async function sendPushNotification(token, title, body, data = {}) {
    if (!firebaseInitialized) {
        const error = new Error('Firebase não configurado')
        error.code = 'firebase/not-initialized'
        throw error
    }
    
    // Converter data object para strings (Firebase exige)
    const stringData = {}
    if (data && typeof data === 'object') {
        for (const [key, value] of Object.entries(data)) {
            stringData[key] = String(value)
        }
    }
    
    const message = {
        token: token,
        notification: {
            title: title,
            body: body
        },
        data: stringData,
        android: {
            priority: 'high',
            notification: {
                sound: 'default',
                channelId: 'high_importance_channel'
            }
        },
        apns: {
            payload: {
                aps: {
                    sound: 'default',
                    badge: 1
                }
            }
        }
    }
    
    // ✅ Se der erro, lança exceção (não retorna objeto)
    const response = await admin.messaging().send(message)
    
    // ✅ Log SOMENTE se enviou com sucesso
    console.log('📱 Notificação enviada com sucesso:', response)
    
    return response
}

/**
 * Enviar notificação para múltiplos usuários
 * @param {Array} tokens - Array de tokens FCM
 * @param {string} title - Título da notificação
 * @param {string} body - Corpo da notificação
 * @param {object} data - Dados extras (opcional)
 */
async function sendMulticastNotification(tokens, title, body, data = {}) {
    if (!firebaseInitialized || !tokens || tokens.length === 0) {
        throw new Error('Tokens inválidos ou Firebase não configurado')
    }
    
    // Converter data object para strings
    const stringData = {}
    if (data && typeof data === 'object') {
        for (const [key, value] of Object.entries(data)) {
            stringData[key] = String(value)
        }
    }
    
    const message = {
        tokens: tokens,
        notification: {
            title: title,
            body: body
        },
        data: stringData,
        android: {
            priority: 'high',
            notification: {
                sound: 'default',
                channelId: 'high_importance_channel'
            }
        },
        apns: {
            payload: {
                aps: {
                    sound: 'default',
                    badge: 1
                }
            }
        }
    }
    
    const response = await admin.messaging().sendEachForMulticast(message)
    
    console.log(`📱 ${response.successCount} notificações enviadas de ${tokens.length}`)
    
    if (response.failureCount > 0) {
        console.warn(`⚠️ ${response.failureCount} notificações falharam`)
        // Log dos tokens que falharam
        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
                console.error(`❌ Token ${tokens[idx].substring(0, 20)}... falhou:`, resp.error?.message)
            }
        })
    }
    
    return response
}

module.exports = {
    sendPushNotification,
    sendMulticastNotification
}
