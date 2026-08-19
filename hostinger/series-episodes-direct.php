<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$title = trim((string)($_GET['title'] ?? ''));
$year = trim((string)($_GET['year'] ?? ''));

if ($title === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Missing title']);
    exit;
}

$params = ['title' => $title, '_' => (string)time()];
if ($year !== '' && preg_match('/^(19|20)\d{2}$/', $year)) {
    $params['year'] = $year;
}

$url = 'https://backend.streamvault.fit/api/series/episodes-direct?' . http_build_query($params, '', '&', PHP_QUERY_RFC3986);
$body = false;
$status = 0;
$error = '';

if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_USERAGENT => 'StreamVault-Hostinger-SeriesProxy/1.0',
    ]);
    $body = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    if ($body === false) $error = (string)curl_error($ch);
    curl_close($ch);
} else {
    $context = stream_context_create([
        'http' => [
            'method' => 'GET',
            'timeout' => 15,
            'ignore_errors' => true,
            'header' => "Accept: application/json\r\nUser-Agent: StreamVault-Hostinger-SeriesProxy/1.0\r\n",
        ],
    ]);
    $body = @file_get_contents($url, false, $context);
    if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
        $status = (int)$m[1];
    }
}

if ($body === false || $body === '') {
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => 'Episode backend unavailable', 'detail' => $error]);
    exit;
}

if ($status < 200 || $status >= 300) {
    http_response_code($status >= 400 && $status <= 599 ? $status : 502);
}

echo $body;
