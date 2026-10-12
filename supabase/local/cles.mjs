// Génère les clés anon et service_role (JWT HS256) pour le secret local.
import { createHmac } from 'node:crypto'

const secret = process.argv[2]
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jeton = (role) => {
  const corps = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'supabase', role, iat: 1_700_000_000, exp: 2_100_000_000 })}`
  return `${corps}.${createHmac('sha256', secret).update(corps).digest('base64url')}`
}
console.log(`ANON=${jeton('anon')}`)
console.log(`SERVICE=${jeton('service_role')}`)
