import express from "express";
import session from "express-session";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "https://rad-marigold-8b05b4.netlify.app", 
    credentials: true,
  })
);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "a7f4e9c2b1d8e3a6f5c2d9b7e4a1f8c3",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", 
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  const { data: existingUser, error: checkError } = await supabase
    .from("ctm")
    .select("username")
    .eq("username", username)
    .single();

  if (checkError) {
    return res.status(500).json({ message: "Error checking username", error: checkError.message });
  }

  if (existingUser) {
    return res.status(400).json({ message: "Username already exists" });
  }

  const { data, error } = await supabase
    .from("ctm")
    .insert([{ username, password }]);

  if (error) {
    return res.status(500).json({ message: "Error registering user", error: error.message });
  }

  return res.status(201).json({ message: "User registered successfully", data });
});

app.post("/leaderboard", async (req, res) => {
  const { score, gameId } = req.body;
  const userData = req.session.userData;

  if (!userData || !userData.loggedIn) {
    return res.status(401).json({ message: "User not logged in" });
  }

  const { username } = userData;

  const { data, error } = await supabase
    .from("leaderboard")
    .insert([{ score, game_id: gameId, username }]);

  if (error) {
    console.error("Error submitting score:", error);
    return res.status(500).json({ message: "Error submitting score", error: error.message });
  }

  return res.status(200).json({ message: "Score submitted successfully", data });
});

app.get("/leaderboard", async (req, res) => {
  const { gameId } = req.query;

  const { data, error } = await supabase
    .from("leaderboard")
    .select("*")
    .eq("game_id", gameId)
    .order("score", { ascending: false });

  if (error) {
    console.error("Error loading leaderboard:", error);
    return res.status(500).json({ message: "Failed to load leaderboard", error: error.message });
  }

  return res.status(200).json(data);
});

app.get("/check-login", (req, res) => {
  const userData = req.session.userData;

  if (userData && userData.loggedIn) {
    return res.status(200).json({ loggedIn: true, username: userData.username });
  }

  return res.status(200).json({ loggedIn: false });
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const { data: user, error } = await supabase
    .from("ctm")
    .select("username, password")
    .eq("username", username)
    .eq("password", password)
    .single();

  if (error || !user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  req.session.userData = { loggedIn: true, username: user.username };
  return res.status(200).json({ message: "Login successful" });
});

app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Failed to log out", error: err.message });
    }

    return res.status(200).json({ message: "Logout successful" });
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
