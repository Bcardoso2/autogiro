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
        console.warn('Firebase não inicializado. Notificação não enviada.')
        return { success: false, error: 'Firebase não configurado' }
    }
    
    try {
        const message = {
            token: token,
            notification: {
                title: title,
                body: body
            },
            data: data,
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
        
        const response = await admin.messaging().send(message)
        console.log('📱 Notificação enviada:', response)
        return { success: true, messageId: response }
        
    } catch (error) {
        console.error('❌ Erro ao enviar notificação:', error.message)
        return { success: false, error: error.message }
    }
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
        return { success: false, error: 'Tokens inválidos ou Firebase não configurado' }
    }
    
    try {
        const message = {
            tokens: tokens,
            notification: {
                title: title,
                body: body
            },
            data: data,
            android: {
                priority: 'high'
            }
        }
        
        const response = await admin.messaging().sendEachForMulticast(message)
        console.log(`📱 ${response.successCount} notificações enviadas de ${tokens.length}`)
        
        return {
            success: true,
            successCount: response.successCount,
            failureCount: response.failureCount
        }
        
    } catch (error) {
        console.error('❌ Erro ao enviar notificações:', error.message)
        return { success: false, error: error.message }
    }
}

module.exports = {
    sendPushNotification,
    sendMulticastNotification
}
