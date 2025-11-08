// server/server.js
import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./db/connectToDB.js";

dotenv.config(); // load .env variables

const app = express();

// Example route
app.get("/", (req, res) => {
  res.send("Server is running ✅");
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  connectDB();
  console.log(`🚀 Running on PORT ${PORT}`);
});
