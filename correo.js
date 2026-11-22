import nodemailer from 'nodemailer'

let transporte

// En desarrollo usamos Ethereal: un servidor de correo de mentira.
// En producción este bloque se reemplaza por un servicio real.
async function obtenerTransporte() {
  if (transporte) return transporte

  const cuenta = await nodemailer.createTestAccount()
  transporte = nodemailer.createTransport({
    host: cuenta.smtp.host,
    port: cuenta.smtp.port,
    secure: cuenta.smtp.secure,
    auth: { user: cuenta.user, pass: cuenta.pass },
  })
  return transporte
}

export async function enviarCodigo(destino, codigo) {
  const t = await obtenerTransporte()
  const info = await t.sendMail({
    from: '"Mis tareas" <no-responder@mistareas.test>',
    to: destino,
    subject: 'Tu código de verificación',
    text: `Tu código de verificación es ${codigo}. Vence en 10 minutos.`,
  })

  console.log('Vista previa del correo:', nodemailer.getTestMessageUrl(info))
}