const admin = require('firebase-admin')
const path = require('path')

// Inicializar Firebase Admin (apenas uma vez)
let firebaseInitialized = false

function initializeFirebase() {
    if (firebaseInitialized) {
        console.log('⚠️ Firebase já foi inicializado')
        return
    }
    
    try {
        let serviceAccount = null
        let method = ''
        
        // Opção 1: Variável de ambiente com JSON completo (PRODUÇÃO - Render)
        if (process.env.FIREBASE_CREDENTIALS && process.env.FIREBASE_CREDENTIALS.startsWith('{')) {
            console.log('🔑 Método 1: Carregando Firebase de FIREBASE_CREDENTIALS (JSON)')
            serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS)
            method = 'env-json'
        }
        // Opção 2: Variável de ambiente com caminho (PRODUÇÃO)
        else if (process.env.FIREBASE_CREDENTIALS_PATH) {
            console.log('🔑 Método 2: Carregando Firebase de FIREBASE_CREDENTIALS_PATH')
            const filePath = path.join(__dirname, '..', process.env.FIREBASE_CREDENTIALS_PATH)
            console.log('   Caminho:', filePath)
            serviceAccount = require(filePath)
            method = 'env-path'
        }
        // Opção 3: Tentar arquivo padrão (DESENVOLVIMENTO)
        else {
            console.log('🔑 Método 3: Tentando carregar de config/serviceAccountKey.json')
            
            // Tentar múltiplos caminhos
            const possiblePaths = [
                path.join(__dirname, '../config/serviceAccountKey.json'),
                path.join(__dirname, '../config/firebase-credentials.json'),
                path.join(process.cwd(), 'config/serviceAccountKey.json'),
                path.join(process.cwd(), 'config/firebase-credentials.json')
            ]
            
            let loaded = false
            for (const filePath of possiblePaths) {
                try {
                    console.log('   Tentando:', filePath)
                    serviceAccount = require(filePath)
                    console.log('   ✅ Arquivo encontrado!')
                    loaded = true
                    method = 'file-' + path.basename(filePath)
                    break
                } catch (err) {
                    console.log('   ❌ Não encontrado')
                }
            }
            
            if (!loaded) {
                throw new Error(`Arquivo de credenciais não encontrado. Tentados:\n${possiblePaths.join('\n')}`)
            }
        }
        
        // Validar service account
        if (!serviceAccount) {
            throw new Error('Service Account não foi carregado')
        }
        
        if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
            throw new Error('Service Account inválido - campos obrigatórios faltando')
        }
        
        // Inicializar Firebase
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        })
        
        firebaseInitialized = true
        console.log('✅ Firebase Admin inicializado com sucesso!')
        console.log('   Método:', method)
        console.log('   Project ID:', serviceAccount.project_id)
        console.log('   Client Email:', serviceAccount.client_email)
        
    } catch (error) {
        console.error('\n❌ ========== ERRO CRÍTICO AO INICIALIZAR FIREBASE ==========')
        console.error('Mensagem:', error.message)
        console.error('Stack:', error.stack)
        console.error('=============================================================\n')
        firebaseInitialized = false
    }
}

// Inicializar ao carregar o módulo
initializeFirebase()

/**
 * Enviar notificação push para um usuário
 */
async function sendPushNotification(token, title, body, data = {}) {
    console.log('\n📱 ========== ENVIANDO PUSH NOTIFICATION ==========')
    console.log('Firebase inicializado?', firebaseInitialized)
    console.log('Token:', token ? token.substring(0, 30) + '...' : 'VAZIO')
    console.log('Título:', title)
    console.log('Corpo:', body)
    console.log('Data:', data)
    
    if (!firebaseInitialized) {
        const error = new Error('Firebase não foi inicializado. Verifique as credenciais.')
        console.error('❌ ERRO:', error.message)
        throw error
    }
    
    if (!token) {
        const error = new Error('Token FCM não fornecido')
        console.error('❌ ERRO:', error.message)
        throw error
    }
    
    try {
        // Converter data para strings
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
            apns: {
                payload: {
                    aps: {
                        alert: {
                            title: title,
                            body: body
                        },
                        sound: 'default',
                        badge: 1
                    }
                }
            },
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'high_importance_channel'
                }
            }
        }
        
        console.log('📤 Enviando para Firebase Cloud Messaging...')
        const response = await admin.messaging().send(message)
        
        console.log('✅ NOTIFICAÇÃO ENVIADA COM SUCESSO!')
        console.log('   Message ID:', response)
        console.log('==================================================\n')
        
        return response
        
    } catch (error) {
        console.error('\n❌ ========== ERRO AO ENVIAR NOTIFICAÇÃO ==========')
        console.error('Código:', error.code)
        console.error('Mensagem:', error.message)
        
        // Erros comuns
        if (error.code === 'messaging/invalid-registration-token') {
            console.error('⚠️ Token FCM inválido ou mal formatado')
        } else if (error.code === 'messaging/registration-token-not-registered') {
            console.error('⚠️ Token não registrado (app desinstalado ou token expirado)')
        } else if (error.code === 'messaging/invalid-argument') {
            console.error('⚠️ Argumento inválido na mensagem')
        }
        
        console.error('Stack:', error.stack)
        console.error('===================================================\n')
        
        throw error
    }
}

/**
 * Enviar notificação para múltiplos usuários
 */
async function sendMulticastNotification(tokens, title, body, data = {}) {
    if (!firebaseInitialized || !tokens || tokens.length === 0) {
        throw new Error('Tokens inválidos ou Firebase não configurado')
    }
    
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
        apns: {
            payload: {
                aps: {
                    sound: 'default',
                    badge: 1
                }
            }
        },
        android: {
            priority: 'high',
            notification: {
                sound: 'default',
                channelId: 'high_importance_channel'
            }
        }
    }
    
    const response = await admin.messaging().sendEachForMulticast(message)
    
    console.log(`📱 ${response.successCount} notificações enviadas de ${tokens.length}`)
    
    if (response.failureCount > 0) {
        console.warn(`⚠️ ${response.failureCount} notificações falharam`)
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
