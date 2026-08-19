/*
 * Seed một tài khoản SuperAdmin mới (role=admin, isSuperAdmin=true, emailVerified=true).
 * Dùng khi cần thêm SuperAdmin ngoài admin gốc seed từ .env.
 *
 * Cách dùng:
 *   node scripts/create-superadmin.js <email> <password> [tên hiển thị]
 * Không truyền tham số thì dùng giá trị mặc định bên dưới.
 *
 * Nếu email đã tồn tại: nâng cấp tài khoản đó thành SuperAdmin và đặt lại mật khẩu.
 */
require('dns').setServers(['8.8.8.8', '1.1.1.1']); // ép DNS công cộng cho mongodb+srv (giống main.ts)

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');

const SALT_ROUNDS = 12;

function readMongoUri() {
  const envPath = path.join(__dirname, '..', '.env');
  const env = fs.readFileSync(envPath, 'utf8');
  const line = env.split('\n').find((l) => l.startsWith('MONGODB_URI='));
  if (!line) {
    throw new Error('Không tìm thấy MONGODB_URI trong .env');
  }
  return line.slice('MONGODB_URI='.length).trim();
}

async function main() {
  const email = (process.argv[2] || 'superadmin@recipe.app').toLowerCase();
  const password = process.argv[3] || 'Super@dmin123';
  const name = process.argv[4] || 'Super Admin';

  const client = new MongoClient(readMongoUri(), { serverSelectionTimeoutMS: 20000 });
  await client.connect();
  const users = client.db().collection('users');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const now = new Date();

  const existing = await users.findOne({ email });
  if (existing) {
    await users.updateOne(
      { email },
      { $set: { role: 'admin', isSuperAdmin: true, emailVerified: true, password: passwordHash, updatedAt: now } },
    );
    console.log(`Đã nâng cấp "${email}" thành SuperAdmin và đặt lại mật khẩu.`);
  } else {
    await users.insertOne({
      name,
      email,
      password: passwordHash,
      role: 'admin',
      isSuperAdmin: true,
      emailVerified: true,
      avatarUrl: '',
      refreshTokenHashes: [],
      createdAt: now,
      updatedAt: now,
    });
    console.log(`Đã tạo SuperAdmin mới: ${email}`);
  }

  console.log('----------------------------------------');
  console.log('Email   :', email);
  console.log('Password:', password);
  console.log('Role    : admin (SuperAdmin)');
  console.log('----------------------------------------');

  await client.close();
}

main().catch((err) => {
  console.error('LỖI:', err.message);
  process.exit(1);
});
