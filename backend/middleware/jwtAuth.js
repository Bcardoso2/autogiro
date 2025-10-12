const { verifyToken } = require('../utils/jwt')
const { query } = require('../config/database')

async function requireJWT(req, res, next) {
  try {
    // Pegar token do header Authorization
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token não fornecido' 
      })
    }
    
    const token = authHeader.split(' ')[1]
    const decoded = verifyToken(token)
    
    if (!decoded) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token inválido ou expirado' 
      })
    }
    
    // Buscar usuário no banco
    // ✅ ADICIONAR CPF AQUI:
    const result = await query(
      'SELECT id, phone, name, email, cpf, role, credits, terms_accepted, terms_accepted_at FROM users WHERE id = $1',
      [decoded.id]
    )
    
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'Usuário não encontrado' 
      })
    }
    
    // Adicionar usuário ao request
    req.user = result.rows[0]
    req.userId = result.rows[0].id
    
    next()
  } catch (error) {
    console.error('Erro no middleware JWT:', error)
    return res.status(401).json({ 
      success: false, 
      error: 'Erro na autenticação' 
    })
  }
}

// 🔥 NOVO: Middleware para verificar créditos
const checkCredits = (requiredCredits) => {
  return async (req, res, next) => {
    try {
      const result = await query(
        'SELECT credits FROM users WHERE id = $1',
        [req.userId]
      )
      
      if (result.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Usuário não encontrado' 
        })
      }
      
      const userCredits = parseFloat(result.rows[0].credits)
      
      if (userCredits < requiredCredits) {
        return res.status(403).json({ 
          success: false, 
          error: 'Créditos insuficientes',
          required: requiredCredits,
          available: userCredits
        })
      }
      
      next()
    } catch (error) {
      console.error('Erro ao verificar créditos:', error)
      return res.status(500).json({ 
        success: false, 
        error: 'Erro ao verificar créditos' 
      })
    }
  }
}

module.exports = { requireJWT, checkCredits }
