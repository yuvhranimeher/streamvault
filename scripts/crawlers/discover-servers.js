// discover-servers.js
const axios = require("axios");

async function checkIP(ip) {
  try {
    const { data } = await axios.get(`http://${ip}/`, { timeout: 3000 });
    console.log(`✓ ${ip} → reachable`);
    return true;
  } catch {
    return false;
  }
}

async function checkServer(ip, share) {
  try {
    const { data } = await axios.get(`http://${ip}/${share}/`, { timeout: 3000 });
    console.log(`✓ http://${ip}/${share}/`);
  } catch {}
}

async function main() {
  // scan likely IPs
  for (let i = 1; i <= 20; i++) {
    const ip = `172.16.50.${i}`;
    const reachable = await checkIP(ip);
    if (reachable) {
      // check common share names
      for (let j = 1; j <= 20; j++) {
        await checkServer(ip, `DHAKA-FLIX-${j}`);
      }
    }
  }
}

main().catch(console.error);