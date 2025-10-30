const express = require('express')
const { query } = require('../config/database')
const router = express.Router()

// =============================================================================
// GET /api/vehicles - Lista veículos com filtros e paginação
// =============================================================================
router.get('/', async (req, res) => {
  try {
    // 1. Obter parâmetros de paginação
    const page = parseInt(req.query.page, 10) || 1
    const limit = parseInt(req.query.limit, 10) || 20
    const offset = (page - 1) * limit

    // 2. Obter parâmetros de filtros
    const category = req.query.category || 'all'
    const state = req.query.state || 'all'
    const eventDate = req.query.event_date || 'all'
    const search = req.query.search || ''

    // 3. Construir a query dinamicamente
    let whereConditions = ['is_active = true']
    let queryParams = []
    let paramCounter = 1

    // Filtro por categoria
    if (category !== 'all') {
      whereConditions.push(`category = $${paramCounter}`)
      queryParams.push(category)
      paramCounter++
    }

    // Filtro por estado (extrai últimos 2 caracteres do location)
    if (state !== 'all') {
      whereConditions.push(`RIGHT(location, 2) = $${paramCounter}`)
      queryParams.push(state)
      paramCounter++
    }

    // Filtro por data do evento
    if (eventDate !== 'all') {
      whereConditions.push(`DATE(event_date) = $${paramCounter}`)
      queryParams.push(eventDate)
      paramCounter++
    }

    // Filtro de busca (marca, modelo, descrição, cor)
    if (search.trim() !== '') {
      whereConditions.push(`(
        LOWER(brand) LIKE $${paramCounter} OR 
        LOWER(model) LIKE $${paramCounter} OR 
        LOWER(description) LIKE $${paramCounter} OR 
        LOWER(color) LIKE $${paramCounter}
      )`)
      queryParams.push(`%${search.toLowerCase()}%`)
      paramCounter++
    }

    // 4. Montar a cláusula WHERE
    const whereClause = whereConditions.join(' AND ')

    // 5. Query principal com filtros, limit e offset
    const vehiclesQuery = `
      SELECT 
        id, external_id, title, brand, model, year, price,
        fipe_price, fipe_confidence, mileage, fuel_type, transmission,
        color, description, category, event_date, location, dealer_name, dealer_phone,
        images, laudo_status, laudo_url, laudo_file_url,
        vehicle_data, ai_classification, created_at
      FROM vehicles
      WHERE ${whereClause}
      ORDER BY event_date DESC NULLS LAST, created_at DESC
      LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
    `
    
    // 6. Query de contagem com os mesmos filtros
    const countQuery = `
      SELECT COUNT(*) 
      FROM vehicles
      WHERE ${whereClause}
    `

    // 7. Adicionar limit e offset aos parâmetros
    const vehiclesParams = [...queryParams, limit, offset]
    const countParams = queryParams

    // 8. Executar as queries
    const [vehiclesResult, countResult] = await Promise.all([
      query(vehiclesQuery, vehiclesParams),
      query(countQuery, countParams)
    ])

    // 9. Extrair resultados
    const vehicles = vehiclesResult.rows
    const totalVehicles = parseInt(countResult.rows[0].count, 10)
    const totalPages = Math.ceil(totalVehicles / limit)

    // 10. Obter opções de filtros (estados e datas de eventos únicos)
    const statesQuery = `
      SELECT DISTINCT RIGHT(location, 2) as state
      FROM vehicles
      WHERE is_active = true AND location IS NOT NULL
      ORDER BY state
    `
    
    const eventsQuery = `
      SELECT DISTINCT DATE(event_date) as event_date
      FROM vehicles
      WHERE is_active = true AND event_date IS NOT NULL
      ORDER BY event_date DESC
    `

    const [statesResult, eventsResult] = await Promise.all([
      query(statesQuery),
      query(eventsQuery)
    ])

    // 11. Enviar resposta completa
    res.json({
      success: true,
      data: {
        vehicles: vehicles,
        pagination: {
          currentPage: page,
          totalPages: totalPages,
          totalVehicles: totalVehicles,
          limit: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        },
        filters: {
          states: statesResult.rows.map(r => r.state).filter(Boolean),
          eventDates: eventsResult.rows.map(r => r.event_date)
        },
        appliedFilters: {
          category,
          state,
          eventDate,
          search
        }
      }
    })

  } catch (error) {
    console.error('Erro ao buscar veículos:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao buscar veículos',
      message: error.message 
    })
  }
})

// =============================================================================
// GET /api/vehicles/by-external-id/:external_id
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
// GET /api/vehicles/:id
// =============================================================================
router.get('/:id', async (req, res) => {
  try {
    const result = await query(`
      SELECT *
      FROM vehicles
      WHERE id = $1 AND is_active = true
    `, [req.params.id])
    
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
    console.error('Erro ao buscar veículo:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao buscar veículo' 
    })
  }
})

module.exports = router
