const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Middleware para verificar JWT
const requireJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Não autenticado' 
      });
    }
    
    const token = authHeader.substring(7); // Remove "Bearer "
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.userId;
      next();
    } catch (err) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token inválido ou expirado' 
      });
    }
  } catch (error) {
    console.error('Erro no middleware JWT:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erro ao verificar autenticação' 
    });
  }
};

// 🔥 NOVO: Middleware para verificar créditos
const checkCredits = (requiredCredits) => {
  return async (req, res, next) => {
    try {
      const result = await query(
        'SELECT credits FROM users WHERE id = $1',
        [req.userId]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Usuário não encontrado' 
        });
      }
      
      const userCredits = parseFloat(result.rows[0].credits);
      
      if (userCredits < requiredCredits) {
        return res.status(403).json({ 
          success: false, 
          error: 'Créditos insuficientes',
          required: requiredCredits,
          available: userCredits
        });
      }
      
      next();
    } catch (error) {
      console.error('Erro ao verificar créditos:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Erro ao verificar créditos' 
      });
    }
  };
};

module.exports = { requireJWT, checkCredits };
