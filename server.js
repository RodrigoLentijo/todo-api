import express from 'express'
import cors from 'cors'
import { prisma } from './prisma.js'

const app = express()
const PUERTO = 3001

app.use(cors())
app.use(express.json())

app.get('/api/tareas', async (req, res) => {
  const tareas = await prisma.tarea.findMany({ orderBy: { id: 'asc' } })
  res.json(tareas)
})

app.post('/api/tareas', async (req, res) => {
  const texto = (req.body.texto ?? '').trim()
  if (texto === '') {
    return res.status(400).json({ error: 'El texto es obligatorio' })
  }

  const nueva = await prisma.tarea.create({ data: { texto } })
  res.status(201).json(nueva)
})

app.patch('/api/tareas/:id', async (req, res) => {
  const id = Number(req.params.id)
  const tarea = await prisma.tarea.findUnique({ where: { id } })

  if (!tarea) {
    return res.status(404).json({ error: 'Tarea no encontrada' })
  }

  const actualizada = await prisma.tarea.update({
    where: { id },
    data: { completada: !tarea.completada },
  })
  res.json(actualizada)
})

app.delete('/api/tareas/:id', async (req, res) => {
  const id = Number(req.params.id)
  const tarea = await prisma.tarea.findUnique({ where: { id } })

  if (!tarea) {
    return res.status(404).json({ error: 'Tarea no encontrada' })
  }

  await prisma.tarea.delete({ where: { id } })
  res.status(204).send()
})

app.listen(PUERTO, () => {
  console.log(`API escuchando en http://localhost:${PUERTO}`)
})