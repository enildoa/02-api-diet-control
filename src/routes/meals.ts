import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import crypto from 'node:crypto'
import { knex } from '../database'
import { checkIsAuthenticated } from '../middlewares/checkIsAuthenticated'

export async function mealsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', checkIsAuthenticated)

  app.get('/', async (request) => {
    const { userId } = request.cookies

    const meals = await knex('meals')
      .where('user_id', userId)
      .select()

    return { meals }
  })

  app.get('/:id', async (request) => {
    const getMealParamsSchema = z.object({
      id: z.string().uuid(),
    })

    const { id } = getMealParamsSchema.parse(request.params)
    const { userId } = request.cookies

    const meal = await knex('meals')
      .where({
        user_id: userId,
        id,
      })
      .first()

    return { meal }
  })
  app.get('/summary', async (request) => {
    const { userId } = request.cookies

    const meals = await knex
    .raw(`
          SELECT x1.*, x2.total_meals, x3.in_diet, x4.out_diet
            FROM(
                SELECT user_id, MAX(count) AS best_sequence
                FROM (SELECT user_id, sequence, COUNT(*) AS count
                        FROM (SELECT user_id, diet,
                              ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY rowid) -
                              ROW_NUMBER() OVER (PARTITION BY user_id, diet ORDER BY rowid) AS sequence
                              FROM meals
                              ) AS sequences
                        WHERE diet = 1 AND user_id = '${userId}'
                        GROUP BY user_id, sequence
                        ORDER BY COUNT(*) DESC
                        LIMIT 1
                      ) AS max_sequences
                      GROUP BY user_id
            ) x1
            INNER JOIN (
              SELECT user_id, COUNT(*) total_meals FROM meals WHERE user_id = '${userId}'
            ) x2 ON x1.user_id = x2.user_id
            INNER JOIN (
              SELECT user_id, COUNT(*) in_diet FROM meals WHERE user_id = '${userId}' AND diet = 1
            ) x3 ON x1.user_id = x3.user_id
            INNER JOIN (
              SELECT user_id, COUNT(*) out_diet FROM meals WHERE user_id = '${userId}' AND diet = 0
            ) x4 ON x1.user_id = x4.user_id`)

    return { meals }
  })

  app.post('/', async (request, reply) => {
    const createMealBodySchema = z.object({
      name: z.string(),
      description: z.string(),
      eaten_at: z.string(),
      diet: z.boolean()
    })

    const { name, description, eaten_at, diet } = createMealBodySchema.parse(
      request.body,
    )

    const { userId } = request.cookies

    await knex('meals').insert({
      id: crypto.randomUUID(),
      user_id: userId,
      name,
      description,
      eaten_at,
      diet
    })

    return reply.status(201).send()
  })

  app.put('/:id', async (request, reply) => {
    const { userId } = request.cookies
    const getMealParamsSchema = z.object({
      id: z.string().uuid(),
    })
    const { id } = getMealParamsSchema.parse(request.params)

    const createMealBodySchema = z.object({
      name: z.string().nullable(),
      description: z.string().nullable(),
      eaten_at: z.string().nullable(),
      diet: z.boolean().nullable()
    })
    const body = createMealBodySchema.parse(request.body)

    const meal = await knex('meals')
      .where({
        user_id: userId,
        id,
      })
      .first()
    
    if(!meal) {
      return reply.status(401).send({
        error: 'Unauthorized.',
      })
    }
    let data = {} as any

    if(body.name) data.name = body.name
    if(body.description) data.description = body.description
    if(body.eaten_at) data.eaten_at = body.eaten_at
    if(body.diet) data.diet = body.diet
    
    await knex('meals')
    .where({id})
    .update(data)

    return reply.status(200).send(JSON.stringify({message: 'Updated'}))
  })

  app.delete('/:id', async (request, reply) => {
    const getMealParamsSchema = z.object({
      id: z.string().uuid(),
    })

    const { id } = getMealParamsSchema.parse(request.params)
    const { userId } = request.cookies

    const meal = await knex('meals')
      .where({
        user_id: userId,
        id,
      })
      .first()

    if(!meal) {
      return reply.status(401).send({
        error: 'Unauthorized.',
      })
    }

    await knex('meals')
    .where({id})
    .delete()

    return reply.status(200).send(JSON.stringify({message: 'Deleted'}))
  })
}
