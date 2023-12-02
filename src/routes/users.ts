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
}
