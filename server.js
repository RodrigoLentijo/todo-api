import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from './prisma.js'

const app = express()
const PUERTO = 3001
const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error('Falta JWT_SECRET en el archivo .env')
}

app.use(cors())
app.use(express.json())

function crearToken(usuario) {
  return jwt.sign({ sub: usuario.id }, JWT_SECRET, { expiresIn: '7d' })
}

function autenticar(req, res, next) {
  const [tipo, token] = (req.headers.authorization ?? '').split(' ')
  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Falta el token' })
  }

  try {
    const datos = jwt.verify(token, JWT_SECRET)
    req.usuarioId = Number(datos.sub)
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o vencido' })
  }
}

app.post('/api/registro', async (req, res) => {
  const email = (req.body.email ?? '').trim().toLowerCase()
  const password = req.body.password ?? ''

  if (email === '' || password.length < 8) {
    return res
      .status(400)
      .json({ error: 'Email obligatorio y contraseña de al menos 8 caracteres' })
  }

  const existente = await prisma.usuario.findUnique({ where: { email } })
  if (existente) {
    return res.status(409).json({ error: 'Ese email ya está registrado' })
  }

  const hash = await bcrypt.hash(password, 10)
  const usuario = await prisma.usuario.create({
    data: { email, password: hash },
  })

  res.status(201).json({ token: crearToken(usuario), email: usuario.email })
})

app.post('/api/login', async (req, res) => {
  const email = (req.body.email ?? '').trim().toLowerCase()
  const password = req.body.password ?? ''

  const usuario = await prisma.usuario.findUnique({ where: { email } })
  const valido = usuario && (await bcrypt.compare(password, usuario.password))

  if (!valido) {
    return res.status(401).json({ error: 'Email o contraseña incorrectos' })
  }

  res.json({ token: crearToken(usuario), email: usuario.email })
})

app.get('/api/tareas', autenticar, async (req, res) => {
  const tareas = await prisma.tarea.findMany({
    where: { usuarioId: req.usuarioId },
    orderBy: { id: 'asc' },
  })
  res.json(tareas)
})

app.post('/api/tareas', autenticar, async (req, res) => {
  const texto = (req.body.texto ?? '').trim()
  if (texto === '') {
    return res.status(400).json({ error: 'El texto es obligatorio' })
  }

  const nueva = await prisma.tarea.create({
    data: { texto, usuarioId: req.usuarioId },
  })
  res.status(201).json(nueva)
})

app.patch('/api/tareas/:id', autenticar, async (req, res) => {
  const id = Number(req.params.id)
  const tarea = await prisma.tarea.findFirst({
    where: { id, usuarioId: req.usuarioId },
  })

  if (!tarea) {
    return res.status(404).json({ error: 'Tarea no encontrada' })
  }

  const actualizada = await prisma.tarea.update({
    where: { id },
    data: { completada: !tarea.completada },
  })
  res.json(actualizada)
})

app.delete('/api/tareas/:id', autenticar, async (req, res) => {
  const id = Number(req.params.id)
  const tarea = await prisma.tarea.findFirst({
    where: { id, usuarioId: req.usuarioId },
  })

  if (!tarea) {
    return res.status(404).json({ error: 'Tarea no encontrada' })
  }

  await prisma.tarea.delete({ where: { id } })
  res.status(204).send()
})

app.listen(PUERTO, () => {
  console.log(`API escuchando en http://localhost:${PUERTO}`)
})