import axios from "axios";
import * as fs from "fs";

const BASE_URL = "http://localhost:3001"; // change if needed

async function generateTokens() {
  const tokens: string[] = [];

  for (let i = 1; i <= 500; i++) {
    try {
      const res = await axios.post(`${BASE_URL}/auth/login`, {
        email: `user${i}@test.com`,
        password: "123456",
      });

      tokens.push(res.data.accessToken);

      console.log(`✔ user${i} logged in`);
    } catch (err: any) {
  console.log(`❌ user${i} failed`, err.response?.data);
}
  }

  fs.writeFileSync("tokens.json", JSON.stringify(tokens, null, 2));

  console.log("🔥 tokens.json created successfully");
}

generateTokens();