import { DataSource } from "typeorm";

import * as bcrypt from "bcrypt";
import { User } from "./modules/users/user.entity";
import * as dotenv from "dotenv";
dotenv.config();

async function seed() {
  const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL, // 👈 USE THIS
  entities: [User],
  synchronize: false,
});

  await AppDataSource.initialize();

  const userRepo = AppDataSource.getRepository(User);

  const hashedPassword = await bcrypt.hash("123456", 10);

  const users: User[] = [];

  for (let i = 1; i <= 500; i++) {
    const user = userRepo.create({
  email: `user${i}@test.com`,
  passwordHash: hashedPassword, // ✅ correct field
  role: "user",
  isEmailVerified: true, // 👈 ADD THIS HERE
})

    users.push(user);
  }

  await userRepo.save(users);

  console.log("🔥 500 users created successfully");

  await AppDataSource.destroy();
}

seed();