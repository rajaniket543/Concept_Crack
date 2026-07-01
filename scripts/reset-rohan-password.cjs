const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth }             = require('firebase-admin/auth');
const { getFirestore }        = require('firebase-admin/firestore');
const sa = require('./service-account.json');

initializeApp({ credential: cert(sa) });

const UID      = '8cUmnT2SCuRcjvWyLu6pGIpdrwm1';
const NEW_PASS = 'Temp@1234';

async function main() {
  await getAuth().updateUser(UID, { password: NEW_PASS });
  console.log('✓ Firebase Auth password reset to Temp@1234');

  await getFirestore().doc(`users/${UID}`).update({ mustChangePassword: true });
  console.log('✓ Firestore mustChangePassword = true');

  console.log('\nRohan can now log in with:');
  console.log('  Email:    student.rohan@conceptcrack.in');
  console.log('  Password: Temp@1234');
  process.exit(0);
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
