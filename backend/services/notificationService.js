const admin = require('firebase-admin')

let firebaseInitialized = false

function initializeFirebase() {
    if (firebaseInitialized) return
    
    try {
        // Private key com \n escapados (como vem do JSON)
        const privateKeyRaw = "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDNCEiIOPCh/4ft\nxHTENjVukz0kjxj7QYNJnpWvUJBgoZfCkk6tF/U+Wy/3Ugqvk0cPLP86G1Up0EiC\npNfOsqYLDaH5yA7h8Og4EYXqhmSfK6XoBdN6GLG6vK7SXwmRRiDfz+/nVPCf4gxa\nmvZkqwI7Gg1uOd9RAKL185AxwyEProSkjdWNy/O1506H6xKRhMRXYgXt/aAerwqn\nneXCJDyMlI4yUx7+qt9cBdETim8tJJNFxuvTsRr/93wX0UmYuvp+sIMnmtmah/rQ\npu6+ydmqWuxVStuzcluo60emAo3uEgFSTv1qekjDjbOpnr+YH3MRZNQ5jsXx2NA8\njFjjRixnAgMBAAECggEACQLYhTwov0Xxcxlo9F1ZjdQ6IgreqImhkTEUwmbCYazY\ndFG6ftBdvpwtXdZPkpXgz/bvT14iKRChZIna05fLGmiX+i1jvLm6IF9iHljtFTMg\nOzP+WRBlcfVBowylk//xXpokoMB9RC71fLSbfaMnxEc0gz1XO5fRPF60XgDbHsro\nSMAECUVvNzePyX2nqys2iEq2dzJiY/FG59R00o06OCvKPk9KoW4zSctcYAskVeWY\nAsqM72YF7MvXveSdwAf1spY4viWav09euEMNs4poC8UiaMaSoEBi6qpQny/qmSUD\nhj61PGKQUIY5cz39hazcHAwAcF9UKTZeVC9+IsRucQKBgQDrkKemBCpIAQ4ss+A6\ny9BjakKRW3U2Hoyj+/+zuSEFm2Br2nF2oWf0nTjgCyLEmyklwerh/4NR9srthAk6\nxNx55FVdFLZy7XuLM5k7O3b4LcywrQHfyG7jLubg5cVWZq3QVQhs0BbDMeZyE5HF\nQGefkLHxYURMlIsdx/oXpEB3vwKBgQDe0ZGuXxsQtBkBgF5JI0ZQcFhb9gfuqs+U\nZ1tM/ozRrI8UUjwNcajEaNOuZa54BkVxNrjle2SQpMMKM4YVHC7QP7UBXSJb3rim\ng5DFUyRYXF2SJOyS6KRxxsmoHvcrhlv8FWZ9IWIvhtJOKlmVI7/YKY7oBp4IJO/h\nztuzBG41WQKBgEQxUBcDRaoqhAv01oiuz9i3viWOMFRGa7hdDxzcDu8sl7EhP490\nEkAB86EIGDyKHlNL288oxL9Jjl1Lx9A3hQvUSdH0WQzUKtuVSFqZUEtwFr1emBhM\nUa16umOIoKPufYq90v6NDsna/Dcx6xULG/RZUunpmngA2HT6my+U4QTJAoGBAI9l\nrezbdi6kyScHNya4ler0sljUmLxHn3nxnneJppTWCerZFZ7NVAC7OegVtle2KYC3\n5/yAEfNopcDt8c+qKJKLPXEYQCGBz7ISH9xuKojXQLzqGHpfUF2MwoD5FLclLBOq\nrh+/mVHe4X++j5KExFVYQYkfoRq6ssrO9uNZ6ZdZAoGAXO7fgIh185HIDvMTzS4H\nKp6VVPrI8AcdzVpSa9tRlOozvnFUUw1G6TxVtTf4pj8JXRfcyB7rfuSbVvevbSJb\nijgrl4ptJVbnsBr4yyC8oJn+S3aVY2gb+oQqhHJVX83JnphL6ew9I6JlvHfdh+wK\n33gvRBQArwh7+zM1Fxg2GiI=\n-----END PRIVATE KEY-----\n"
        
        // ✅ CONVERTER \n ESCAPADOS PARA QUEBRAS DE LINHA REAIS
        const privateKey = privateKeyRaw.replace(/\\n/g, '\n')
        
        const serviceAccount = {
            "type": "service_account",
            "project_id": "autogiro-e48fa",
            "private_key_id": "6503490a23db8dfb4f7f783eb39cee35ad619558",
            "private_key": privateKey,
            "client_email": "firebase-adminsdk-fbsvc@autogiro-e48fa.iam.gserviceaccount.com",
            "client_id": "117530557454487622495",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40autogiro-e48fa.iam.gserviceaccount.com",
            "universe_domain": "googleapis.com"
        }
        
        console.log('\n🔍 ===== DEBUG FIREBASE =====')
        console.log('🔑 Key ID:', serviceAccount.private_key_id)
        console.log('🕐 Server Time:', new Date().toISOString())
        console.log('🔐 Private Key tem quebras de linha?:', privateKey.includes('\n'))
        console.log('============================\n')
        
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        })
        
        firebaseInitialized = true
        console.log('✅ Firebase inicializado! Project:', serviceAccount.project_id)
        
    } catch (error) {
        console.error('❌ Erro Firebase:', error.message)
    }
}

initializeFirebase()

async function sendPushNotification(token, title, body, data = {}) {
    if (!firebaseInitialized) {
        throw new Error('Firebase não inicializado')
    }
    
    const stringData = {}
    if (data) {
        for (const [key, value] of Object.entries(data)) {
            stringData[key] = String(value)
        }
    }
    
    const message = {
        token,
        notification: { title, body },
        data: stringData,
        apns: {
            payload: {
                aps: { alert: { title, body }, sound: 'default', badge: 1 }
            }
        }
    }
    
    const response = await admin.messaging().send(message)
    console.log('✅ Push enviado! ID:', response)
    return response
}

async function sendMulticastNotification(tokens, title, body, data = {}) {
    const stringData = {}
    if (data) {
        for (const [key, value] of Object.entries(data)) {
            stringData[key] = String(value)
        }
    }
    
    const message = {
        tokens,
        notification: { title, body },
        data: stringData
    }
    
    return await admin.messaging().sendEachForMulticast(message)
}

module.exports = { sendPushNotification, sendMulticastNotification }
