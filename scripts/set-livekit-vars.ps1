$url    = "wss://gopocket-live-1cvwgdhd.livekit.cloud"
$key    = "APIoWMFEWDevCnZ"
$secret = "1LvWtedwigBqAvN7edKDeAdG8QgQOY8Fk01958mqsq0B"

foreach ($env in @("production","preview","development")) {
    echo $url    | vercel env add LIVEKIT_URL    $env --force
    echo $key    | vercel env add LIVEKIT_API_KEY    $env --force
    echo $secret | vercel env add LIVEKIT_API_SECRET $env --force
    Write-Host "✅ Set for $env"
}
Write-Host "Done!"
