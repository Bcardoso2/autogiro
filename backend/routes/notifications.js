const express = require('express')
const router = express.Router()
const { query } = require('../config/database')

// Middleware de autenticação (adapte conforme seu sistema)
function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ success: false, error: 'Não autenticado' })
    }
    next()
}

// Salvar/atualizar token do dispositivo
router.post('/save-token', requireAuth, async (req, res) => {
    try {
        const { fcm_token, platform } = req.body
        const user_id = req.session.user.id
        
        if (!fcm_token) {
            return res.status(400).json({ 
                success: false, 
                error: 'Token obrigatório' 
            })
        }
        
        // Inserir ou atualizar token
        await query(`
            INSERT INTO device_tokens (user_id, fcm_token, platform, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (fcm_token) 
            DO UPDATE SET 
                user_id = EXCLUDED.user_id,
                platform = EXCLUDED.platform,
                updated_at = NOW()
        `, [user_id, fcm_token, platform || 'android'])
        
        console.log(`✅ Token salvo para usuário ${user_id}`)
        
        res.json({ 
            success: true, 
            message: 'Token salvo com sucesso' 
        })
        
    } catch (error) {
        console.error('Erro ao salvar token:', error)
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao salvar token' 
        })
    }
})

// Remover token (logout ou desinstalação)
router.delete('/remove-token', requireAuth, async (req, res) => {
    try {
        const { fcm_token } = req.body
        
        if (!fcm_token) {
            return res.status(400).json({ 
                success: false, 
                error: 'Token obrigatório' 
            })
        }
        
        await query(
            'DELETE FROM device_tokens WHERE fcm_token = $1',
            [fcm_token]
        )
        
        console.log(`🗑️ Token removido: ${fcm_token.substring(0, 20)}...`)
        
        res.json({ 
            success: true,
            message: 'Token removido com sucesso'
        })
        
    } catch (error) {
        console.error('Erro ao remover token:', error)
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao remover token' 
        })
    }
})

// [OPCIONAL] Rota de teste para enviar notificação manual
router.post('/test', requireAuth, async (req, res) => {
    try {
        const { sendPushNotification } = require('../services/notificationService')
        const user_id = req.session.user.id
        
        // Buscar token do usuário logado
        const result = await query(
            'SELECT fcm_token FROM device_tokens WHERE user_id = $1 LIMIT 1',
            [user_id]
        )
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Token não encontrado para este usuário' 
            })
        }
        
        // Enviar notificação de teste
        const notification = await sendPushNotification(
            result.rows[0].fcm_token,
            '🧪 Notificação de Teste',
            'Se você recebeu isso, está funcionando perfeitamente!',
            { tipo: 'teste' }
        )
        
        res.json({ 
            success: true,
            notification
        })
        
    } catch (error) {
        console.error('Erro ao enviar notificação de teste:', error)
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao enviar notificação' 
        })
    }
})

module.exports = router
