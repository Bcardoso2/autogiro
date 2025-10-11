const express = require('express')
const { query } = require('../config/database')
const router = express.Router()

// GET /api/vehicles - Lista todos os veículos ativos
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        id, external_id, title, brand, model, year, price,
        fipe_price, fipe_confidence, mileage, fuel_type, transmission,
        color, description, category, event_date, location, dealer_name, dealer_phone,
        images, laudo_status, laudo_url, laudo_file_url,
        vehicle_data, ai_classification, created_at
      FROM vehicles
      WHERE is_active = true
      ORDER BY event_date DESC NULLS LAST, created_at DESC
    `)
    
    res.json({ 
      success: true, 
      vehicles: result.rows 
    })
  } catch (error) {
    console.error('Erro ao buscar veículos:', error)
    res.status(500).json({ success: false, error: 'Erro ao buscar veículos' })
  }
})
// GET /api/vehicles/by-external-id/:external_id - Busca por external_id (INCLUI INATIVOS)
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

// GET /api/vehicles/:id - Detalhes de um veículo
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

module.exports = router
