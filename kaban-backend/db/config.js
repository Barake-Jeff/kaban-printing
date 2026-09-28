const path = require('path');

// Locally this loads kaban-backend/.env. In Docker the vars already come from env_file, and
// dotenv never overrides a var that is already set (so `DB_HOST=127.0.0.1 npm run db:migrate`
// works from the host even though .env says DB_HOST=db).
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

const base = {
  dialect:  'mysql',
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  define:   { underscored: true },
};

// sequelize-cli picks the block matching NODE_ENV.
module.exports = {
  development: base,
  production:  { ...base, logging: false },
};
