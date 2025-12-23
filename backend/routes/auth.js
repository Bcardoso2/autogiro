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
              terms_accepted, terms_accepted_at, fcm_token, approval_status
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
        terms_accepted_at: user.terms_accepted_at || null,
        approval_status: user.approval_status || 'approved'
      }
    })
    
  } catch (error) {
    console.error('Erro no login:', error)
    res.status(500).json({ success: false, error: 'Erro no servidor' })
  }
})

// =====================================
// CADASTRO COM APROVAÇÃO
// =====================================

// POST /api/auth/register
router.post('/register', async (req, res) => {
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
    
    const password_hash = await bcrypt.hash(password, 10)
    
    // Criar usuário com approval_status = 'pending'
    const result = await query(
      `INSERT INTO users (phone, name, email, password_hash, cpf, client_id, role, credits, is_active, terms_accepted, approval_status)
       VALUES ($1, $2, $3, $4, $5, 'client2', 'viewer', 0, true, false, 'pending')
       RETURNING id, phone, name, email, credits, role, cpf, terms_accepted, terms_accepted_at, approval_status`,
      [phone, name, email || null, password_hash, cpf || null]
    )
    
    const user = result.rows[0]
    
    // Gerar JWT token (permite login, mas com acesso limitado)
    const token = generateToken(user)
    
    console.log('📝 Novo usuário registrado (aguardando aprovação):', user.name, '-', user.phone)
    
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
        terms_accepted_at: user.terms_accepted_at || null,
        approval_status: user.approval_status
      }
    })
    
  } catch (error) {
    console.error('Erro no registro:', error)
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

    // Buscar usuários pendentes
    const result = await query(
      `SELECT id, name, phone, email, cpf, created_at
       FROM users
       WHERE approval_status = 'pending'
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

    // Atualizar approval_status
    const result = await query(
      `UPDATE users
       SET approval_status = 'approved', updated_at = NOW()
       WHERE id = $1 AND approval_status = 'pending'
       RETURNING id, name, phone, fcm_token`,
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado ou já processado'
      })
    }

    const user = result.rows[0]

    console.log('✅ Usuário aprovado:', user.name)

    // Enviar push notification
    if (user.fcm_token) {
      try {
        await sendPushNotification(
          user.fcm_token,
          '🎉 Cadastro Aprovado!',
          'Seu cadastro foi aprovado! Você já pode acessar todas as funcionalidades do Autogiro.',
          {
            type: 'user_approved',
            userId: user.id
          }
        )
        console.log('📱 Push notification enviada para:', user.name)
      } catch (pushError) {
        console.error('❌ Erro ao enviar push:', pushError)
        // Não falha a aprovação se o push falhar
      }
    } else {
      console.log('⚠️ Usuário não tem FCM token registrado ainda')
    }

    res.json({
      success: true,
      message: 'Usuário aprovado com sucesso!',
      data: {
        id: user.id,
        name: user.name
      }
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

    const result = await query(
      `UPDATE users
       SET approval_status = 'rejected', updated_at = NOW()
       WHERE id = $1 AND approval_status = 'pending'
       RETURNING id, name`,
      [id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado ou já processado'
      })
    }

    console.log('❌ Usuário reprovado:', result.rows[0].name)

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
// FCM TOKEN (ATUALIZADO - ACEITA JWT OU USERID)
// =====================================

// POST /api/auth/update-fcm-token
// Aceita 2 formas de autenticação:
// 1. JWT Token (Authorization header) - usuário logado
// 2. userId no body - usuário recém-registrado/pendente
router.post('/update-fcm-token', async (req, res) => {
  try {
    const { fcmToken, userId } = req.body
    
    console.log('📥 update-fcm-token recebido')
    console.log('   - fcmToken:', fcmToken ? 'presente' : 'ausente')
    console.log('   - userId:', userId || 'não fornecido')
    console.log('   - Authorization:', req.headers.authorization ? 'presente' : 'ausente')
    
    // Validação: fcmToken é obrigatório
    if (!fcmToken) {
      return res.status(400).json({
        success: false,
        error: 'FCM Token é obrigatório'
      })
    }
    
    let userIdToUpdate = null
    
    // MÉTODO 1: Tentar via JWT Token (usuário logado)
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.replace('Bearer ', '')
        const jwt = require('jsonwebtoken')
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        userIdToUpdate = decoded.userId || decoded.id
        console.log('✅ JWT válido, userId:', userIdToUpdate)
      } catch (error) {
        console.log('⚠️ JWT inválido ou expirado, tentando userId do body...')
      }
    }
    
    // MÉTODO 2: Tentar via userId no body (usuário pendente)
    if (!userIdToUpdate && userId) {
      userIdToUpdate = userId
      console.log('✅ Usando userId do body:', userIdToUpdate)
    }
    
    // Se não tem nenhum dos dois
    if (!userIdToUpdate) {
      console.log('❌ Nem JWT nem userId fornecidos')
      return res.status(401).json({
        success: false,
        error: 'Autenticação necessária (JWT ou userId)'
      })
    }
    
    // Verificar se usuário existe
    const checkUser = await query(
      'SELECT id, name, approval_status FROM users WHERE id = $1',
      [userIdToUpdate]
    )
    
    if (checkUser.rows.length === 0) {
      console.log('❌ Usuário não encontrado:', userIdToUpdate)
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      })
    }
    
    const user = checkUser.rows[0]
    
    // Atualizar FCM token
    await query(
      'UPDATE users SET fcm_token = $1, updated_at = NOW() WHERE id = $2',
      [fcmToken, userIdToUpdate]
    )
    
    console.log(`✅ FCM Token atualizado:`)
    console.log(`   - Usuário: ${user.name}`)
    console.log(`   - Status: ${user.approval_status || 'N/A'}`)
    console.log(`   - Token: ${fcmToken.substring(0, 20)}...`)
    
    res.json({
      success: true,
      message: 'FCM Token atualizado com sucesso'
    })
    
  } catch (error) {
    console.error('❌ Erro ao atualizar FCM Token:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Erro no servidor',
      details: error.message 
    })
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
// DEMAIS ROTAS
// =====================================

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.json({ success: true })
})

// GET /api/auth/me
router.get('/me', requireJWT, async (req, res) => {
  try {
    // Buscar usuário completo com approval_status
    const result = await query(
      `SELECT id, phone, name, email, cpf, credits, role, terms_accepted, terms_accepted_at, approval_status
       FROM users
       WHERE id = $1`,
      [req.userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado' })
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
        terms_accepted: user.terms_accepted || false,
        terms_accepted_at: user.terms_accepted_at || null,
        approval_status: user.approval_status || 'approved'
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
