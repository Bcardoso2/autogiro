const admin = require('firebase-admin')

let firebaseInitialized = false

function initializeFirebase() {
    if (firebaseInitialized) return
    
    try {
        // ✅ CREDENCIAIS HARDCODED
        const serviceAccount = {
            "type": "service_account",
            "project_id": "autogiro-e48fa",
            "private_key_id": "c9237d396f2d57f730e75c9aad74cd28634d10e9",
            "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDF4c+HMghl7JOp\nFyBGTkwRYKcX+rCSc51cBRCOXhyD4Bf8AInvbc8Afp3i/+MWBBP2lBIT1zL8sYgF\nMUIr0Hqs8PZt0FEW8kiCiS0rVYWGXr1wOKj5EVr/WXJ6SLP3ZLSaAoUYHx2uBfK4\netHA8VfzWMcVwcyDwHY2ns75WEAZtlLK0hRIzQqLJd7/l2vOsROJ7YOsTNAQtlU7\nblOc6auBtykTUe10BrlveRqlLLxiwCgMOWmBKXQLwB04ivbKIOYKZ3Emtr8ge4et\nCvuq3O8k/PTYQLfZXM4zYREYe1Vpn6UhWBr7JU5rAWqiMjTemBpdP38Bk7/WSsag\nTwgbZzUNAgMBAAECggEAGsm+9mZnjKTCOJnQ3LOsyI11EWH2lVzhaJum6h8DbTbh\nCFRqV+ddpot9hEVv0IMs0Kyq5dS0KlE+QLWyZ4wJj2/vbF5PG/QgrMs1OjCRqucY\nbiC9fzpCP180iClfc5ZGfLLqoaFUu0JC4YZ+7se9SEw0Z1WdAhkD59EH4+l2hARV\nUDdUidYrs2Btdu+eYhVNEI5VBmkHY+c+qIG7vpgIdgcu3J4ZiNomdKsvTQuyakYq\npm30HQz235Wx8HZDJfIfvl454FfgXI91bx3zuBdfNUBlmfJwiWOnmfRtyYO9Tb+4\nY755tUd6+LtTdY769dWlXzXtK8xkM1HfZwFgJjLBAQKBgQD7hFyjTpuqiZmqTFDK\nkyq61rVTehTMMG0nhMW1xEVX3tJpvULN+pdyRTHs6xZe7nfsvK14fb9s7lzPSOd/\nwPjYey6u6jOCTsHjSHVfXFuHq13/vZO72nXeHheG/mnut/nT+lolCyh1EB1Ymtas\nlCcfM8lJvsAbB2ZXRlfhUu2I6QKBgQDJaLg/UDetwQZLklmizJ2vjqYjIeKrF37j\n2jJN93ccD2XgPIYO4lwja1PCnHQZ4IdW4PUhZxr3v4keNKdI+jsMZB0NEcHGRWFn\nfhwbjiCz+ublkgShoJlY8+4ig798z74b2BP2wKGpGok63JT/CKKE1RxJEDpd8vVw\nP9u0wtn0hQKBgDL+H+YAHvFRWnU7abnYYnZk53hYLPVE8Cxt78OtWj25cEF93Jh0\nMNY7DycwdmWixW+axTTDkdbc8LYZ2s186zbAqrNNykml/As/eoRt7iSwaqtZ3STd\n4r24rh5xYDrE1ALVJAeUnow1Sy3WnqV4mAHsdufbo4kXU/lnypNlQ8FZAoGAfXLQ\nb/8S7xKvTRrW4eP4w4RiTreoa1CzJFCfzJg6hCvDFKweA99R7G3JOgog9o03PxHX\nHPsPfQi76yh4mafiZ5Fj1uQcgdZtGP0fnLol/HRmpM8SO2nAmfs1dCIDf0YV71ni\n9Wp+RsnUd+k0lLVYJMxoVcnZ0PKnlUbxHeHPx9ECgYEAjGOwGvTPYK7o07REM9xr\nyo702M3xzjUdo4AzOb3xdWex7oOyh0j4PDoNxby8miB8U6gfFeC4nGSrnvYBn8Si\nTcha/ZPXq0EFE8f1a+Eq/h1Oe1rBHGE84+R0QTorOPFALEg2dQngrokXg4zcfPNB\nVG5tPCnnNxE9wtP1mMCN/UA=\n-----END PRIVATE KEY-----\n",
            "client_email": "firebase-adminsdk-fbsvc@autogiro-e48fa.iam.gserviceaccount.com",
            "client_id": "117530557454487622495",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40autogiro-e48fa.iam.gserviceaccount.com",
            "universe_domain": "googleapis.com"
        }
        
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
    console.log('✅ Push enviado:', response)
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
