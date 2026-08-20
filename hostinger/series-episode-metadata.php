<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=3600, stale-while-revalidate=86400');

$title = trim((string)($_GET['title'] ?? ''));
$year = trim((string)($_GET['year'] ?? ''));
$seasons = trim((string)($_GET['seasons'] ?? ''));

if ($title === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Missing title']);
    exit;
}
if ($year !== '' && !preg_match('/^(19|20)\d{2}$/', $year)) $year = '';
if ($seasons !== '' && !preg_match('/^\d+(,\d+)*$/', $seasons)) $seasons = '';

$cacheDir = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'streamvault-series-episode-metadata-v1';
$cacheKey = hash('sha256', strtolower($title) . '|' . $year . '|' . $seasons);
$cacheFile = $cacheDir . DIRECTORY_SEPARATOR . $cacheKey . '.json';
$cacheTtl = 86400;
$cachedBody = '';
$cachedMtime = 0;

if (is_file($cacheFile)) {
    $cachedMtime = (int)@filemtime($cacheFile);
    $cachedBody = (string)@file_get_contents($cacheFile);
    if ($cachedBody !== '' && $cachedMtime > 0 && (time() - $cachedMtime) <= $cacheTtl) {
        header('X-StreamVault-Episode-Metadata-Cache: HIT');
        echo $cachedBody;
        exit;
    }
}

$params = ['title' => $title];
if ($year !== '') $params['year'] = $year;
if ($seasons !== '') $params['seasons'] = $seasons;
$url = 'https://backend.streamvault.fit/api/series/episode-metadata?' . http_build_query($params, '', '&', PHP_QUERY_RFC3986);
$body = false;
$status = 0;
$error = '';

if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_USERAGENT => 'StreamVault-Hostinger-EpisodeMetadata/1.0',
        CURLOPT_ENCODING => '',
    ]);
    $body = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    if ($body === false) $error = (string)curl_error($ch);
    curl_close($ch);
} else {
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 8,
            'ignore_errors' => true,
            'header' => "Accept: application/json\r\nUser-Agent: StreamVault-Hostinger-EpisodeMetadata/1.0\r\n",
        ],
    ]);
    $body = @file_get_contents($url, false, $context);
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
        $status = (int)$m[1];
    }
}

if ($body !== false && $body !== '' && $status >= 200 && $status < 300) {
    $decoded = json_decode($body, true);
    if (is_array($decoded) && !empty($decoded['seasons'])) {
        if (!is_dir($cacheDir)) @mkdir($cacheDir, 0775, true);
        if (is_dir($cacheDir)) @file_put_contents($cacheFile, $body, LOCK_EX);
        header('X-StreamVault-Episode-Metadata-Cache: MISS');
        echo $body;
        exit;
    }
}

if ($cachedBody !== '') {
    header('X-StreamVault-Episode-Metadata-Cache: STALE');
    echo $cachedBody;
    exit;
}

http_response_code($status >= 400 && $status <= 599 ? $status : 502);
echo json_encode(['ok' => false, 'error' => 'Episode metadata unavailable', 'detail' => $error]);
