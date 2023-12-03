import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import crypto from 'node:crypto'
import { knex } from '../database'

export async function usersRoutes(app: FastifyInstance) {

  app.get('/', async (request) => {

    const users = await knex('users')
      .select()

    return { users }
  })

  app.post('/', async (request, reply) => {
    const createUserBodySchema = z.object({
      name: z.string(),
      email: z.string(),
      password: z.string()
    })

    const { name, email, password } = createUserBodySchema.parse(
      request.body,
    )

    await knex('users').insert({
      id: crypto.randomUUID(),
      name,
      email,
      password: crypto.createHash('sha256').update(password).digest('hex')
    })

    return reply.status(201).send()
  })

  app.post('/login', async (request, reply) => {
    const createUserBodySchema = z.object({
      email: z.string(),
      password: z.string()
    })

    const { email, password } = createUserBodySchema.parse(
      request.body,
    )

    const user = await knex('users')
      .where({
        email
      })
      .first()

    if(!(user?.password === crypto.createHash('sha256').update(password).digest('hex'))) {
      return reply.status(401).send({
        error: 'Unauthorized.',
      })
    }

    let userId = request.cookies.userId

    if (!userId) {
      reply.cookie('userId', user.id, {
        path: '/',
        maxAge: 1000 * 60 * 60 * 24 * 1, // 1 day
      })
    }
    
    return {userId: user.id}
  })
}
