// ecosystem.config.js
module.exports = {
  apps: [{
    name:        'genomiclab',
    script:      'node',
    args:        'server.js',          // uses your Socket.io custom server
    cwd:         __dirname,
    instances:   1,
    autorestart: true,
    watch:       false,
    max_memory_restart: '512M',
    env_production: {
      NODE_ENV:        'production',
      PORT:            3000,
      DATABASE_URL:    process.env.DATABASE_URL,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
      NEXTAUTH_URL:    process.env.NEXTAUTH_URL,
    }
  }]
}
