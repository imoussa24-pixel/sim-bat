// Point d'entrée du seed (usage local) : la logique vit dans src/seed-donnees.ts
import { PrismaClient } from '@prisma/client'
import { executerSeed } from '../src/seed-donnees'

const prisma = new PrismaClient()

executerSeed(prisma)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
