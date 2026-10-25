/**
 * Seed / upsert an application login account.
 *
 * Usage:
 *   node seedUser.js                                  # seeds the default executive account
 *   node seedUser.js <username> <password> [role]     # seeds a custom account
 *
 * Idempotent: if the username already exists, its password/role are reset.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const DEFAULT_USERNAME = 'Executive-National-01';
const DEFAULT_PASSWORD = 'Admin@123';

async function run() {
  const username = process.argv[2] || DEFAULT_USERNAME;
  const password = process.argv[3] || DEFAULT_PASSWORD;
  const role = process.argv[4] || 'admin';

  if (!process.env.MONGO_URI) {
    console.error('✗ MONGO_URI is not set in the environment (.env).');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✓ Connected to MongoDB');

  let user = await User.findOne({ username }).select('+password');

  if (user) {
    user.password = password; // pre-save hook re-hashes
    user.role = role;
    // Drop any previously stored invalid/placeholder email so save() passes
    // and username-only login works cleanly.
    if (user.email && !/^\S+@\S+\.\S+$/.test(user.email)) {
      user.email = undefined;
    }
    await user.save();
    console.log(`✓ Updated existing account: ${username} (role: ${role})`);
  } else {
    user = await User.create({ username, password, role });
    console.log(`✓ Created account: ${username} (role: ${role})`);
  }

  console.log('  Login with:');
  console.log(`    username: ${username}`);
  console.log(`    password: ${password}`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('✗ Seed failed:', err.message);
  process.exit(1);
});
