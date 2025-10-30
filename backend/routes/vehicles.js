const express = require('express')
const { query } = require('../config/database')
const router = express.Router()

// =============================================================================
// GET /api/vehicles - Lista todos os veículos ativos (COM PAGINAÇÃO)
// ESTA É A ROTA QUE FOI MODIFICADA
// =============================================================================
router.get('/', async (req, res) => {
  try {
    // 1. Obter 'page' e 'limit' da URL.
    // Definimos valores padrão (página 1, limite de 20)
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 20

    // 2. Calcular o OFFSET (quantos registros pular)
    // Se page=1, offset=0. Se page=2, offset=20.
    const offset = (page - 1) * limit

    // 3. Query principal com LIMIT e OFFSET
    // Usamos $1 para 'limit' e $2 para 'offset'
    const vehiclesQuery = `
      SELECT 
        id, external_id, title, brand, model, year, price,
        fipe_price, fipe_confidence, mileage, fuel_type, transmission,
        color, description, category, event_date, location, dealer_name, dealer_phone,
        images, laudo_status, laudo_url, laudo_file_url,
        vehicle_data, ai_classification, created_at
      FROM vehicles
      WHERE is_active = true
      ORDER BY event_date DESC NULLS LAST, created_at DESC
      LIMIT $1 OFFSET $2
    `
    
    // 4. Query para CONTAR o total de veículos (para o frontend saber o total de páginas)
    const countQuery = 'SELECT COUNT(*) FROM vehicles WHERE is_active = true'

    // 5. Executar as duas queries em paralelo para mais performance
    const [vehiclesResult, countResult] = await Promise.all([
      query(vehiclesQuery, [limit, offset]), // Passa os parâmetros [limit, offset]
      query(countQuery)
    ])

    // 6. Extrair os resultados
    const vehicles = vehiclesResult.rows
    const totalVehicles = parseInt(countResult.rows[0].count, 10)
    const totalPages = Math.ceil(totalVehicles / limit)

    // 7. Enviar a resposta formatada com os dados de paginação
    res.json({
      success: true,
      data: {
        vehicles: vehicles,
        currentPage: page,
        totalPages: totalPages,
        totalVehicles: totalVehicles
      }
    })

  } catch (error) {
    console.error('Erro ao buscar veículos:', error)
    res.status(500).json({ success: false, error: 'Erro ao buscar veículos' })
  }
})

// =============================================================================
// GET /api/vehicles/by-external-id/:external_id - Busca por external_id (INCLUI INATIVOS)
// ESTA ROTA NÃO FOI ALTERADA
// =============================================================================
router.get('/by-external-id/:external_id', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        id, external_id, title, brand, model, year, price,
        fipe_price, fipe_confidence, mileage, fuel_type, transmission,
        color, description, category, event_date, location, dealer_name, dealer_phone,
        images, laudo_status, laudo_url, laudo_file_url,
        vehicle_data, ai_classification, is_active, created_at
      FROM vehicles
      WHERE external_id = $1
    `, [req.params.external_id])
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Veículo não encontrado' 
      })
    }
    
    res.json({ 
      success: true, 
      vehicle: result.rows[0] 
    })
  } catch (error) {
    console.error('Erro ao buscar veículo por external_id:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao buscar veículo' 
    })
  }
})

// =============================================================================
// GET /api/vehicles/:id - Detalhes de um veículo
// ESTA ROTA NÃO FOI ALTERADA
// =============================================================================
router.get('/:id', async (req, res) => {
  try {
    const result = await query(`
      SELECT *
      FROM vehicles
      WHERE id = $1 AND is_active = true
    `, [req.params.id])
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Veículo não encontrado' })
    }
    
    res.json({ 
      success: true, 
      vehicle: result.rows[0] 
    })
  } catch (error) {
    console.error('Erro ao buscar veículo:', error)
    res.status(500).json({ success: false, error: 'Erro ao buscar veículo' })
  }
})

// Exporta o router para ser usado no seu server.js/app.js
module.exports = router
