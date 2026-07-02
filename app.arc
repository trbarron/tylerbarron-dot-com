@app
tb-website-remix

@aws
prune true
runtime nodejs22.x
memory 2048
region us-west-2
timeout 30
architecture x86_64

@http
/*
  method any
  src server

@static
fingerprint true
folder public
spa true

@env
production
  NODE_ENV
  REDIS_TLS_URL
  GA_TRACKING_ID G-S3MFTCJ7ZW
  CAMEL_TOURNAMENT_FUNCTION camel-up-tournament
