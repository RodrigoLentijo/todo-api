import express from 'express'
import cors from 'cors'

const app = express()
const PUERTO = 3001

app.use(cors())
app.use(express.json())

let tareas = []

app.get('/api/tareas', (req, res) => {
  res.json(tareas)
})

app.post('/api/tareas', (req, res) => {
  const texto = (req.body.texto ?? '').trim()
  if (texto === '') {
    return res.status(400).json({ error: 'El texto es obligatorio' })
  }

  const nueva = { id: Date.now(), texto, completada: false }
  tareas.push(nueva)
  res.status(201).json(nueva)
})

app.listen(PUERTO, () => {
  console.log(`API escuchando en http://localhost:${PUERTO}`)
})