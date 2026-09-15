# CIMOMET · Gestión Comercial — Fase 1

Réplica funcional de noCRM.io para evaluar con las manos, sin base de datos ni backend. Corre entera en el navegador — los datos viven en `localStorage`, por navegador y por dispositivo (no hay nada compartido entre personas todavía). Ver [CLAUDE.public.md](CLAUDE.public.md) para el contexto completo del proyecto, el modelo de datos y las decisiones abiertas.

**Datos de ejemplo:** todos los nombres de empresas, personas y contactos son ficticios — no son clientes ni prospectos reales de CIMOMET.

## Probarlo

👉 **[Abrir la app](https://nexorrhh.github.io/tablero-comercial/)**

Entrás eligiendo un usuario (sin contraseña real, es una simulación de roles). Si en algún momento querés volver a los datos de ejemplo originales, el botón "Reiniciar datos de ejemplo" está tanto en el login como en el header.

## Correrlo localmente

Es HTML/JS vanilla con módulos ES (`<script type="module">`), así que no se puede abrir `index.html` directo desde el explorador de archivos — hace falta servirlo por HTTP:

```bash
python -m http.server 8000
# o: npx serve
```

Y abrir `http://localhost:8000`.

## Estructura

```
index.html
css/styles.css
js/
  app.js              # entrada, shell, pestañas por rol
  lib/                # gateway de datos, permisos, formato, uuid
  seed/               # datos de ejemplo
  modules/
    auth/       leads/       pipeline/    prospects/
    clients/    activities/  parser/      config/
    users/      reports/
```

Cada módulo accede a los datos únicamente a través de `js/lib/gateway.js` — es la pieza que permite cambiar `localStorage` por una base de datos real en la Fase 2 sin tocar el resto del código.
