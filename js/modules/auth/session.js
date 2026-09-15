// Sesión local (CLAUDE.md §5 `auth`): login local simple, sin backend.
// No es seguridad real (no hay contraseña) — es para poder probar los
// roles y permisos de §8. Vive en memoria, no en localStorage: no es una
// colección de dominio, es estado de la pestaña actual del navegador.

let currentUser = null;
const listeners = new Set();

export function getCurrentUser() {
  return currentUser;
}

export function getCurrentUserId() {
  return currentUser?.id ?? null;
}

export function isLoggedIn() {
  return currentUser !== null;
}

export function login(user) {
  currentUser = user;
  listeners.forEach((fn) => fn(currentUser));
}

export function logout() {
  currentUser = null;
  listeners.forEach((fn) => fn(currentUser));
}

export function onSessionChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
