// Firebase is not required for this app
// Authentication uses backend OTP system with MongoDB
// Email delivery can be integrated via Resend, SendGrid, or AWS SES

const app = null;
const auth = null;
const isFirebaseConfigured = false;

console.log('ℹ️  Using backend OTP authentication');
console.log('📧 Email delivery: Integrate Resend/SendGrid for production');

export { app, auth, isFirebaseConfigured };
export default null;
