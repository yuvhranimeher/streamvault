<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=86400, stale-while-revalidate=604800');

$title = trim((string)($_GET['title'] ?? ''));
if ($title === '' || strlen($title) > 180) {
    http_response_code(400);
    echo json_encode(['items' => [], 'error' => 'invalid title']);
    exit;
}

function sv_fetch_json(string $url): ?array {
    if (!function_exists('curl_init')) return null;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 2,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'Accept-Language: en-US,en;q=0.9',
            'User-Agent: Mozilla/5.0 StreamVaultArtwork/2.0'
        ],
        CURLOPT_ENCODING => ''
    ]);
    $body = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if (!is_string($body) || $body === '' || $status < 200 || $status >= 300) return null;
    $json = json_decode($body, true);
    return is_array($json) ? $json : null;
}

$cacheDir = __DIR__ . '/.software-artwork-cache';
$key = sha1(strtolower($title));
$cacheFile = $cacheDir . '/' . $key . '.json';
if (is_file($cacheFile) && (time() - (int)filemtime($cacheFile)) < 604800) {
    $cached = file_get_contents($cacheFile);
    if (is_string($cached) && $cached !== '') {
        echo $cached;
        exit;
    }
}

$items = [];
$storeUrl = 'https://store.steampowered.com/api/storesearch/?term=' . rawurlencode($title) . '&l=english&cc=US';
$store = sv_fetch_json($storeUrl);
if (is_array($store['items'] ?? null)) {
    foreach (array_slice($store['items'], 0, 12) as $item) {
        $id = (string)($item['id'] ?? '');
        $name = trim((string)($item['name'] ?? ''));
        if ($id === '' || $name === '') continue;
        $items[] = [
            'id' => $id,
            'name' => $name,
            'tiny_image' => (string)($item['tiny_image'] ?? '')
        ];
    }
}

if (!$items) {
    $communityUrl = 'https://steamcommunity.com/actions/SearchApps/' . rawurlencode($title);
    $community = sv_fetch_json($communityUrl);
    if (is_array($community)) {
        foreach (array_slice($community, 0, 12) as $item) {
            $id = (string)($item['appid'] ?? '');
            $name = trim((string)($item['name'] ?? ''));
            if ($id === '' || $name === '') continue;
            $items[] = [
                'id' => $id,
                'name' => $name,
                'tiny_image' => (string)($item['logo'] ?? $item['icon'] ?? '')
            ];
        }
    }
}

$payload = json_encode(['items' => $items], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
if (!is_string($payload)) $payload = '{"items":[]}';

if (!is_dir($cacheDir)) @mkdir($cacheDir, 0755, true);
if (is_dir($cacheDir) && is_writable($cacheDir)) @file_put_contents($cacheFile, $payload, LOCK_EX);

echo $payload;
