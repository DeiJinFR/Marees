node_modules/
.vercel/
.env.local
.DS_Store

{
  "buildCommand": "echo 'No build needed'",
  "devCommand": "echo 'Dev mode'",
  "outputDirectory": "public",
  "public": true
}

{
  "name": "horloge-marees",
  "version": "1.0.0",
  "description": "Horloge interactive des marées françaises avec données en temps réel",
  "main": "api/tides.js",
  "scripts": {
    "dev": "vercel dev",
    "build": "vercel build"
  },
  "keywords": ["marées", "tides", "france", "ocean"],
  "author": "DeiJinFR",
  "license": "MIT"
}
