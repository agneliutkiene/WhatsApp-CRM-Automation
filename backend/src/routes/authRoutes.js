import express from "express";
import {
  clearAuthCookie,
  hasAnyAccounts,
  loginAccount,
  logoutSessionByToken,
  registerAccount,
  setAuthCookie
} from "../services/authService.js";

export const authRouter = express.Router();

authRouter.get("/bootstrap", (_req, res) => {
  return res.json({
    data: {
      hasAccounts: hasAnyAccounts()
    }
  });
});

authRouter.get("/me", (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required." });
  }
  return res.json({ data: req.user });
});

authRouter.post("/register", (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    const result = registerAccount({ name, email, password });
    setAuthCookie(res, result.token);
    return res.status(201).json({ data: result.user });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      error: error.message || "Unable to register account."
    });
  }
});

authRouter.post("/login", (req, res) => {
  try {
    const { email, password } = req.body || {};
    const result = loginAccount({ email, password });
    setAuthCookie(res, result.token);
    return res.json({ data: result.user });
  } catch (error) {
    return res.status(error.statusCode || 401).json({
      error: error.message || "Invalid login request."
    });
  }
});

authRouter.post("/logout", (req, res) => {
  logoutSessionByToken(req.sessionToken);
  clearAuthCookie(res);
  return res.status(204).send();
});
