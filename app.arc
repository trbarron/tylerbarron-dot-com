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
  AWS_BUCKET_NAME
  AWS_REGION
  SUPABASE_URL
  SUPABASE_ANON_KEY
  GA_TRACKING_ID