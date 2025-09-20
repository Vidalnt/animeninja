# Stremio AnimeOnline Addon

Addon de **Stremio** que permite ver anime desde [animeonline.ninja](https://ww3.animeonline.ninja/).

⚠️ **Aviso**: Este addon es solo con fines educativos. El scraping de sitios de anime puede infringir derechos de autor.

---

## 🚀 Instalación local

1. Clonar o descomprimir este repositorio.
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Ejecutar el servidor:
   ```bash
   npm start
   ```
4. El addon quedará disponible en:
   ```
   http://localhost:7000/manifest.json
   ```
5. Abre Stremio y agrega el addon con esa URL.

---

## ☁️ Despliegue en la nube

### 🔹 Heroku
1. Instala [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli).
2. Crea una app:
   ```bash
   heroku login
   heroku create stremio-anime-addon
   git init
   git add .
   git commit -m "Deploy inicial"
   git push heroku master
   ```
3. Tu addon estará disponible en:
   ```
   https://stremio-anime-addon.herokuapp.com/manifest.json
   ```

### 🔹 Render (alternativa moderna)
1. Regístrate en [Render](https://render.com/).
2. Crea un **Web Service** nuevo desde tu repo de GitHub.
3. Elige Node.js y el script `npm start`.
4. Obtendrás una URL como:
   ```
   https://stremio-anime-addon.onrender.com/manifest.json
   ```

---

## 📂 Archivos incluidos

- `index.js` → Código del addon.
- `package.json` → Dependencias y scripts.
- `Procfile` → Configuración para Heroku.

---

## 📌 Funcionalidades

- Catálogo de animes desde animeonline.ninja.
- Búsqueda de animes por nombre.
- Información detallada de cada anime (descripción, poster, episodios).
- Streams con nombres de servidores (Fembed, Streamtape, Okru, etc.).

---
