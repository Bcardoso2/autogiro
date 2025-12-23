const express = require('express')
const bcrypt = require('bcrypt')
const { query } = require('../config/database')
const { generateToken } = require('../utils/jwt')
const { requireJWT } = require('../middleware/jwtAuth')
const { sendPushNotification } = require('../services/notificationService')
const router = express.Router()

// =====================================
// AUTENTICAÇÃO
// =====================================

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body
    
    if (!phone || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Telefone e senha são obrigatórios' 
      })
    }
    
    const result = await query(
      `SELECT id, phone, name, email, client_id, credits, role, is_active, password_hash, cpf,
              terms_accepted, terms_accepted_at, fcm_token
       FROM users
       WHERE phone = $1 AND is_active = true`,
      [phone]
    )
    
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'Telefone ou senha incorretos' 
      })
    }
    
    const user = result.rows[0]
    
    const isValidPassword = await bcrypt.compare(password, user.password_hash)
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        error: 'Telefone ou senha incorretos' 
      })
    }
    
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id])
    
    const token = generateToken(user)
    
    res.json({ 
      success: true,
      token: token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        cpf: user.cpf,
        credits: parseFloat(user.credits),
        role: user.role,
        terms_accepted: user.terms_accepted || false,
        terms_accepted_at: user.terms_accepted_at || null
      }
    })
    
  } catch (error) {
    console.error('Erro no login:', error)
    res.status(500).json({ success: false, error: 'Erro no servidor' })
  }
})

// =====================================
// CADASTRO PENDENTE (APROVAÇÃO)
// =====================================

// POST /api/auth/register-pending
router.post('/register-pending', async (req, res) => {
  try {
    const { name, phone, email, password, cpf } = req.body
    
    if (!name || !phone || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nome, telefone e senha são obrigatórios' 
      })
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'Senha deve ter no mínimo 6 caracteres' 
      })
    }
    
    // Verificar se telefone já existe
    const existingUser = await query(
      'SELECT id FROM users WHERE phone = $1',
      [phone]
    )
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Este telefone já está cadastrado' 
      })
    }

    // Verificar se já tem solicitação pendente
    const existingPending = await query(
      'SELECT id FROM pending_users WHERE phone = $1 AND status = $2',
      [phone, 'pending']
    )

    if (existingPending.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Já existe uma solicitação pendente para este telefone' 
      })
    }
    
    const password_hash = await bcrypt.hash(password, 10)
    
    // Capturar IP e User Agent
    const ipAddress = req.ip || req.connection.remoteAddress
    const userAgent = req.headers['user-agent']

    // Inserir em pending_users
    const result = await query(
      `INSERT INTO pending_users (name, phone, email, password_hash, cpf, ip_address, user_agent, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
       RETURNING id, name, phone, email, created_at`,
      [name, phone, email || null, password_hash, cpf || null, ipAddress, userAgent]
    )
    
    const pendingUser = result.rows[0]

    console.log('📬 Nova solicitação de cadastro:', pendingUser.name, '-', pendingUser.phone)
    
    res.json({ 
      success: true,
      message: 'Cadastro enviado para aprovação! Você receberá uma notificação em breve.',
      data: {
        id: pendingUser.id,
        name: pendingUser.name
      }
    })
    
  } catch (error) {
    console.error('Erro ao criar registro pendente:', error)
    res.status(500).json({ success: false, error: 'Erro no servidor' })
  }
})

// GET /api/auth/pending-users (apenas admin)
router.get('/pending-users', requireJWT, async (req, res) => {
  try {
    // Verificar se é admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      })
    }

    const result = await query(
      `SELECT id, name, phone, email, cpf, status, ip_address, created_at
       FROM pending_users
       WHERE status = 'pending'
       ORDER BY created_at DESC`
    )

    res.json({
      success: true,
      data: result.rows
    })

  } catch (error) {
    console.error('Erro ao listar pendentes:', error)
    res.status(500).json({ success: false, error: 'Erro no servidor' })
  }
})

// POST /api/auth/approve-user/:id (apenas admin)
router.post('/approve-user/:id', requireJWT, async (req, res) => {
  try {
    // Verificar se é admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      })
    }

    const { id } = req.params
    const adminId = req.userId

    // Buscar usuário pendente
    const pendingResult = await query(
      'SELECT * FROM pending_users WHERE id = $1 AND status = $2',
      [id, 'pending']
    )

    if (pendingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Solicitação não encontrada ou já processada'
      })
    }

    const pending = pendingResult.rows[0]

    // Criar usuário definitivo
    const userResult = await query(
      `INSERT INTO users (phone, password_hash, name, email, cpf, client_id, role, credits, is_active, terms_accepted)
       VALUES ($1, $2, $3, $4, $5, 'client2', 'viewer', 0, true, false)
       RETURNING id, name, phone, email, credits, created_at`,
      [pending.phone, pending.password_hash, pending.name, pending.email, pending.cpf]
    )

    const newUser = userResult.rows[0]

    // Atualizar status do pending
    await query(
      `UPDATE pending_users
       SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
       WHERE id = $2`,
      [adminId, id]
    )

    console.log('✅ Usuário aprovado:', newUser.name)

    // 🔔 TENTAR ENVIAR PUSH NOTIFICATION (se tiver token)
    // Como o usuário foi recém-criado, ele ainda não tem FCM token
    // O push só será enviado quando ele fizer login e registrar o token

    res.json({
      success: true,
      message: 'Usuário aprovado com sucesso!',
      data: newUser
    })

  } catch (error) {
    console.error('Erro ao aprovar usuário:', error)
    res.status(500).json({ success: false, error: 'Erro no servidor' })
  }
})

// POST /api/auth/reject-user/:id (apenas admin)
router.post('/reject-user/:id', requireJWT, async (req, res) => {
  try {
    // Verificar se é admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      })
    }

    const { id } = req.params
    const { reason } = req.body
    const adminId = req.userId

    const pendingResult = await query(
      'SELECT * FROM pending_users WHERE id = $1 AND status = $2',
      [id, 'pending']
    )

    if (pendingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Solicitação não encontrada ou já processada'
      })
    }

    await query(
      `UPDATE pending_users
       SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW(), rejection_reason = $2
       WHERE id = $3`,
      [adminId, reason || 'Não aprovado', id]
    )

    console.log('❌ Usuário reprovado:', pendingResult.rows[0].name)

    res.json({
      success: true,
      message: 'Usuário reprovado'
    })

  } catch (error) {
    console.error('Erro ao reprovar usuário:', error)
    res.status(500).json({ success: false, error: 'Erro no servidor' })
  }
})

// =====================================
// FCM TOKEN
// =====================================

// POST /api/auth/update-fcm-token
router.post('/update-fcm-token', requireJWT, async (req, res) => {
  try {
    const { fcmToken } = req.body
    const userId = req.userId

    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        error: 'FCM Token é obrigatório'
      })
    }

    await query(
      'UPDATE users SET fcm_token = $1, updated_at = NOW() WHERE id = $2',
      [fcmToken, userId]
    )

    console.log(`✅ FCM Token atualizado para usuário ${userId}`)

    res.json({
      success: true,
      message: 'Token atualizado com sucesso'
    })

  } catch (error) {
    console.error('Erro ao atualizar FCM Token:', error)
    res.status(500).json({ success: false, error: 'Erro no servidor' })
  }
})

// POST /api/auth/test-push (enviar notificação de teste)
router.post('/test-push', requireJWT, async (req, res) => {
  try {
    const userId = req.userId

    // Buscar token do usuário
    const result = await query(
      'SELECT fcm_token FROM users WHERE id = $1',
      [userId]
    )

    if (result.rows.length === 0 || !result.rows[0].fcm_token) {
      return res.status(400).json({
        success: false,
        error: 'Você ainda não tem um token FCM registrado. Faça login novamente.'
      })
    }

    const fcmToken = result.rows[0].fcm_token

    // Enviar notificação de teste
    await sendPushNotification(
      fcmToken,
      '🧪 Teste de Notificação',
      'Se você está vendo isso, as notificações estão funcionando!',
      {
        type: 'test',
        timestamp: new Date().toISOString()
      }
    )

    res.json({
      success: true,
      message: 'Notificação de teste enviada!'
    })

  } catch (error) {
    console.error('Erro ao testar push:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao enviar notificação',
      details: error.message 
    })
  }
})

// =====================================
// DEMAIS ROTAS (INALTERADAS)
// =====================================

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({ success: true })
})

// GET /api/auth/me
router.get('/me', requireJWT, async (req, res) => {
  try {
    res.json({ 
      success: true,
      user: {
        id: req.user.id,
        phone: req.user.phone,
        name: req.user.name,
        email: req.user.email,
        cpf: req.user.cpf,
        credits: parseFloat(req.user.credits),
        role: req.user.role,
        terms_accepted: req.user.terms_accepted || false,
        terms_accepted_at: req.user.terms_accepted_at || null
      }
    })
  } catch (error) {
    console.error('Erro ao buscar usuário:', error)
    res.status(500).json({ success: false, error: 'Erro no servidor' })
  }
})

// POST /api/auth/accept-terms
router.post('/accept-terms', requireJWT, async (req, res) => {
  try {
    const result = await query(
      `UPDATE users 
       SET terms_accepted = true, 
           terms_accepted_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, phone, name, email, cpf, credits, role, terms_accepted, terms_accepted_at`,
      [req.userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Usuário não encontrado' 
      })
    }

    const user = result.rows[0]

    res.json({ 
      success: true,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        cpf: user.cpf,
        credits: parseFloat(user.credits),
        role: user.role,
        terms_accepted: user.terms_accepted,
        terms_accepted_at: user.terms_accepted_at
      }
    })
  } catch (error) {
    console.error('Erro ao aceitar termos:', error)
    res.status(500).json({ success: false, error: 'Erro ao aceitar termos' })
  }
})

// PATCH /api/auth/update-profile
router.patch('/update-profile', requireJWT, async (req, res) => {
  try {
    const { name, email, cpf } = req.body
    
    const updates = []
    const params = []
    let paramCount = 1
    
    if (name) {
      updates.push(`name = $${paramCount}`)
      params.push(name)
      paramCount++
    }
    
    if (email !== undefined) {
      updates.push(`email = $${paramCount}`)
      params.push(email || null)
      paramCount++
    }
    
    if (cpf !== undefined) {
      updates.push(`cpf = $${paramCount}`)
      params.push(cpf || null)
      paramCount++
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nenhum campo para atualizar' 
      })
    }
    
    params.push(req.userId)
    
    await query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramCount}`,
      params
    )
    
    res.json({ success: true })
    
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error)
    res.status(500).json({ success: false, error: 'Erro ao atualizar perfil' })
  }
})

// PATCH /api/auth/change-password
router.patch('/change-password', requireJWT, async (req, res) => {
  try {
    const { current_password, new_password } = req.body
    
    if (!current_password || !new_password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Senha atual e nova senha são obrigatórias' 
      })
    }
    
    if (new_password.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'A nova senha deve ter no mínimo 6 caracteres' 
      })
    }
    
    const result = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.userId]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Usuário não encontrado' 
      })
    }
    
    const user = result.rows[0]
    
    const isValidPassword = await bcrypt.compare(current_password, user.password_hash)
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        error: 'Senha atual incorreta' 
      })
    }
    
    const newPasswordHash = await bcrypt.hash(new_password, 10)
    
    await query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, req.userId]
    )
    
    res.json({ success: true })
    
  } catch (error) {
    console.error('Erro ao alterar senha:', error)
    res.status(500).json({ success: false, error: 'Erro ao alterar senha' })
  }
})

// DELETE /api/auth/delete-account
router.delete('/delete-account', requireJWT, async (req, res) => {
  try {
    await query(
      'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = $1',
      [req.userId]
    )
    
    res.json({ success: true })
    
  } catch (error) {
    console.error('Erro ao excluir conta:', error)
    res.status(500).json({ success: false, error: 'Erro ao excluir conta' })
  }
})

module.exports = router
