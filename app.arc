@app
tb-website-remix

@aws
prune true
runtime nodejs20.x
memory 4096
region us-west-2
timeout 30
architecture x86_64

@http
/*
  method any
  src server

@static
fingerprint false

@env
production
  NODE_ENV
  AWS_BUCKET_NAME
  AWS_REGION
  SUPABASE_URL
  SUPABASE_ANON_KEY
  GA_TRACKING_ID