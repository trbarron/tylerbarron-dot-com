@app
tb-website-remix

@aws
prune true
runtime nodejs24.x
memory 2048
region us-west-2
timeout 30
architecture x86_64

@http
/*
  method any
  src server

# CloudFront serves /assets, /fonts and /images from the CDN bucket, which the
# deploy workflow syncs. This folder does not exist, so arc deploy skips
# uploading to Architect's own static bucket, which nothing reads. Keep the
# section: removing @static makes CloudFormation try to delete that (non-empty)
# bucket.
@static
folder arc-static-unused

@env
production
  NODE_ENV
  REDIS_TLS_URL
  GA_TRACKING_ID G-S3MFTCJ7ZW
  CAMEL_NOTIFY_TOPIC_ARN
  ORIGIN_VERIFY
