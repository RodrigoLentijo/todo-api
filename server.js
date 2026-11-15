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

app.patch('/api/tareas/:id', (req, res) => {
  const id = Number(req.params.id)
  const tarea = tareas.find((t) => t.id === id)

  if (!tarea) {
    return res.status(404).json({ error: 'Tarea no encontrada' })
  }

  tarea.completada = !tarea.completada
  res.json(tarea)
})

app.delete('/api/tareas/:id', (req, res) => {
  const id = Number(req.params.id)
  const existe = tareas.some((t) => t.id === id)

  if (!existe) {
    return res.status(404).json({ error: 'Tarea no encontrada' })
  }

  tareas = tareas.filter((t) => t.id !== id)
  res.status(204).send()
})

app.listen(PUERTO, () => {
  console.log(`API escuchando en http://localhost:${PUERTO}`)
})