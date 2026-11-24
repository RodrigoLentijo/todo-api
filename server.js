import 'dotenv/config'
import { randomInt } from 'node:crypto'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from './prisma.js'
import { enviarCodigo } from './correo.js'

const app = express()
const PUERTO = process.env.PORT ?? 3001
const JWT_SECRET = process.env.JWT_SECRET

const MINUTOS_VIGENCIA = 10
const MAX_INTENTOS = 5
const SEGUNDOS_ENTRE_ENVIOS = 60

if (!JWT_SECRET) {
  throw new Error('Falta JWT_SECRET en el archivo .env')
}

const ORIGENES = (process.env.FRONTEND_URL ?? 'http://localhost:5173').split(',')
app.use(cors({ origin: ORIGENES }))
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

async function enviarNuevoCodigo(usuario) {
  const codigo = String(randomInt(0, 1000000)).padStart(6, '0')
  const codigoHash = await bcrypt.hash(codigo, 10)
  const codigoVence = new Date(Date.now() + MINUTOS_VIGENCIA * 60 * 1000)

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { codigoHash, codigoVence, intentos: 0 },
  })
  await enviarCodigo(usuario.email, codigo)
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
  await enviarNuevoCodigo(usuario)

  res.status(201).json({
    mensaje: 'Te enviamos un código de verificación',
    email: usuario.email,
  })
})

app.post('/api/verificar', async (req, res) => {
  const email = (req.body.email ?? '').trim().toLowerCase()
  const codigo = String(req.body.codigo ?? '').trim()

  const rechazar = () =>
    res.status(400).json({
      error: 'Código incorrecto, vencido o con demasiados intentos. Pedí uno nuevo.',
    })

  const usuario = await prisma.usuario.findUnique({ where: { email } })
  if (!usuario || usuario.verificado || !usuario.codigoHash || !usuario.codigoVence) {
    return rechazar()
  }
  if (usuario.codigoVence < new Date() || usuario.intentos >= MAX_INTENTOS) {
    return rechazar()
  }

  const coincide = await bcrypt.compare(codigo, usuario.codigoHash)
  if (!coincide) {
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { intentos: { increment: 1 } },
    })
    return rechazar()
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { verificado: true, codigoHash: null, codigoVence: null, intentos: 0 },
  })

  res.json({ token: crearToken(usuario), email: usuario.email })
})

app.post('/api/reenviar', async (req, res) => {
  const email = (req.body.email ?? '').trim().toLowerCase()
  const usuario = await prisma.usuario.findUnique({ where: { email } })

  if (usuario && !usuario.verificado) {
    const ultimoEnvio = usuario.codigoVence
      ? usuario.codigoVence.getTime() - MINUTOS_VIGENCIA * 60 * 1000
      : 0
    const pasaron = (Date.now() - ultimoEnvio) / 1000

    if (pasaron >= SEGUNDOS_ENTRE_ENVIOS) {
      await enviarNuevoCodigo(usuario)
    }
  }

  res.json({
    mensaje: 'Si la cuenta existe y falta verificarla, te enviamos un código nuevo',
  })
})

app.post('/api/login', async (req, res) => {
  const email = (req.body.email ?? '').trim().toLowerCase()
  const password = req.body.password ?? ''

  const usuario = await prisma.usuario.findUnique({ where: { email } })
  const valido = usuario && (await bcrypt.compare(password, usuario.password))

  if (!valido) {
    return res.status(401).json({ error: 'Email o contraseña incorrectos' })
  }

  if (!usuario.verificado) {
    return res.status(403).json({
      error: 'Verificá tu correo antes de ingresar',
      requiereVerificacion: true,
    })
  }

  res.json({ token: crearToken(usuario), email: usuario.email })
})

app.get('/api/salud', (req, res) => {
  res.json({ ok: true })
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
  const completada = req.body.completada

  if (typeof completada !== 'boolean') {
    return res.status(400).json({ error: 'completada debe ser true o false' })
  }

  try {
    const actualizada = await prisma.tarea.update({
      where: { id, usuarioId: req.usuarioId },
      data: { completada },
    })
    res.json(actualizada)
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Tarea no encontrada' })
    }
    throw error
  }
})

app.delete('/api/tareas/:id', autenticar, async (req, res) => {
  const id = Number(req.params.id)

  try {
    await prisma.tarea.delete({ where: { id, usuarioId: req.usuarioId } })
    res.status(204).send()
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Tarea no encontrada' })
    }
    throw error
  }
})

app.listen(PUERTO, () => {
  console.log(`API escuchando en http://localhost:${PUERTO}`)
})