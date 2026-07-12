export const SESSION_COOKIE_NAME = "capataz_session";

function positiveInt(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export const authConfig = {
  sessionDays: positiveInt("AUTH_SESSION_DAYS", 30),
  verificationMinutes: positiveInt("AUTH_VERIFICATION_TOKEN_MINUTES", 24 * 60),
  resetMinutes: positiveInt("AUTH_RESET_TOKEN_MINUTES", 30),
  maxLoginAttempts: positiveInt("AUTH_MAX_LOGIN_ATTEMPTS", 5),
  lockMinutes: positiveInt("AUTH_LOCK_MINUTES", 15)
};
