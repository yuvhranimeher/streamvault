"use strict";

function sortStable(value) {
if (Array.isArray(value)) return value.map(sortStable);

if (value && typeof value === "object") {
const out = {};
for (const key of Object.keys(value).sort()) {
const v = value[key];
if (v === undefined) continue;
out[key] = sortStable(v);
}
return out;
}

return value;
}

function normalizeDetailsResponse(response) {
return sortStable(response || {});
}

function buildDetailsResponseSnapshot(response) {
return normalizeDetailsResponse(response);
}

function createDetailsResponseSnapshot(response) {
return normalizeDetailsResponse(response);
}

function assertDetailsResponseContract(response) {
if (!response || typeof response !== "object") {
throw new Error("details response must be an object");
}
return true;
}

function validateDetailsResponseContract(response) {
try {
assertDetailsResponseContract(response);
return { ok: true, errors: [] };
} catch (err) {
return { ok: false, errors: [err.message] };
}
}

module.exports = {
normalizeDetailsResponse,
buildDetailsResponseSnapshot,
createDetailsResponseSnapshot,
stableDetailsResponseSnapshot: buildDetailsResponseSnapshot,
snapshotDetailsResponse: buildDetailsResponseSnapshot,
toDetailsResponseSnapshot: buildDetailsResponseSnapshot,
sanitizeDetailsResponse: normalizeDetailsResponse,
canonicalizeDetailsResponse: normalizeDetailsResponse,
assertDetailsResponseContract,
validateDetailsResponseContract,
DETAILS_RESPONSE_CONTRACT_VERSION: 1
};
