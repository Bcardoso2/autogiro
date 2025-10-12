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
    const result = await query(
      'SELECT id, phone, name, email, role, credits FROM users WHERE id = $1',
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

module.exports = { requireJWT }
