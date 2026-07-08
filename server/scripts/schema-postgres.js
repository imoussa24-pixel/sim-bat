// Génère prisma/schema.postgres.prisma à partir de prisma/schema.prisma
// en remplaçant simplement le datasource sqlite par postgresql.
// Utilisé au build Render — le développement local reste sur SQLite.
const fs = require('fs')
const path = require('path')

const source = path.join(__dirname, '..', 'prisma', 'schema.prisma')
const cible = path.join(__dirname, '..', 'prisma', 'schema.postgres.prisma')

let schema = fs.readFileSync(source, 'utf8')
schema = schema.replace(
  /datasource db \{[\s\S]*?\}/,
  'datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}'
)
schema = '// FICHIER GÉNÉRÉ — ne pas modifier (voir scripts/schema-postgres.js)\n' + schema
fs.writeFileSync(cible, schema)
console.log('✔ prisma/schema.postgres.prisma généré (provider postgresql)')
