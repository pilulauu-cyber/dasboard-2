# Ops Dashboard - Mercado Libre Argentina (MLA)

Este es un dashboard de inteligencia de negocios (BI) en tiempo real diseñado como una herramienta operativa premium interna. Cuenta con tema oscuro, división de métricas por dueño (Guadalupe, Tomás y Compartidos) e integración directa con la API oficial de Mercado Libre Argentina mediante OAuth 2.0.

---

## Características Core
1. **Control de Stock**: Visualización de stock disponible por publicación y capital invertido (Stock × Costo Unitario).
2. **Unidades Vendidas**: Reportes interactivos de volumen de ventas para períodos temporales (Hoy / Semana / Mes).
3. **Facturación**: Desglose financiero detallado mostrando ingreso bruto, comisión oficial de Mercado Libre Argentina, costos de envío (si aplica) e ingreso neto.
4. **Margen y Ganancias**: Ganancia de la publicación deduciendo costos de producto (COGS) y el gasto publicitario de campañas.
5. **Monitoreo de Publicidad**: Gasto diario y mes a la fecha (MTD) por ID de campaña de publicidad vinculada a cada dueño.
6. **Flujo de Caja (Cash Flow)**: Clasificación de fondos en Disponible, A Liberar y Retenido (por reclamos o disputas). Flujo Neto Retirable = Disponible + A Liberar − Gastos Personales.
7. **Registro de Gastos Personales**: Registro integrado para restar retiros o costos del Disponible de cada dueño.
8. **Modo Demo (Simulador)**: Entorno interactivo activado automáticamente si no hay credenciales vinculadas, permitiendo probar toda la funcionalidad.

---

## 1. Conexión del Proyecto Vercel a GitHub

1. Crea un repositorio privado o público en tu cuenta de GitHub (ej. `meli-bi-dashboard`).
2. Sube el código fuente local a este repositorio:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   git push -u origin main
   ```
3. Inicia sesión en tu consola de [Vercel](https://vercel.com).
4. Haz clic en **Add New** > **Project**.
5. Importa el repositorio de GitHub que acabas de subir.

---

## 2. Variables de Entorno a Configurar en Vercel

Antes de hacer clic en **Deploy** en Vercel, debes expandir la sección de **Environment Variables** y configurar las siguientes credenciales:

| Variable | Descripción | Ejemplo / Notas |
| :--- | :--- | :--- |
| `ML_APP_ID` | App ID oficial de tu aplicación en Mercado Libre Developers | `890458129849202` |
| `ML_CLIENT_SECRET` | Client Secret / Clave secreta de tu aplicación | `abc123secretXYZ` |
| `ML_REDIRECT_URI` | La URL a la que Mercado Libre redirigirá tras autorizar la cuenta | `https://[project-name].vercel.app/api/auth/callback` |

> [!TIP]
> **Persistencia Persistente en Producción**
> Para que tus configuraciones de productos (titulares, costos) y gastos personales persistan permanentemente en Vercel (evitando que se borren al reiniciarse los contenedores serverless):
> 1. Ve a la pestaña **Storage** en tu panel del proyecto de Vercel.
> 2. Crea y vincula una base de datos **KV (Upstash Redis)**.
> 3. Vercel inyectará automáticamente las variables `KV_REST_API_URL` y `KV_REST_API_TOKEN`. Nuestra capa de almacenamiento las detectará y cambiará del archivo JSON local a almacenamiento KV en la nube de forma transparente.

---

## 3. Activación y Autorización de OAuth (Primera Carga)

Una vez que el sitio se haya desplegado y esté en línea (ej. `https://mi-dashboard.vercel.app`):

1. Ve a la consola de desarrollo de Mercado Libre Developers y asegúrate de que la **Redirect URI** configurada en tu aplicación de Mercado Libre coincida exactamente con la URL de producción de Vercel: `https://mi-dashboard.vercel.app/api/auth/callback`.
2. Entra a tu dashboard de producción. Por defecto, al no haber credenciales guardadas, la aplicación se iniciará en **Modo Simulador (Demo)** para que puedas explorar la UI.
3. Haz clic en el botón dorado **Vincular MLA** en la esquina superior derecha del encabezado.
4. Serás redirigido a la página oficial de inicio de sesión y consentimiento de Mercado Libre Argentina.
5. Autoriza el acceso. Al finalizar, Mercado Libre te redirigirá automáticamente de vuelta al dashboard (`/api/auth/callback`), el servidor guardará los tokens y el dashboard cambiará automáticamente del Modo Demo al **Modo En Vivo**.

---

## 4. Configurar IDs de Campañas y Costos Unitarios

Tras completar la vinculación:

1. Haz clic en el botón **Configurar Dueños y Costos** ubicado en la esquina superior derecha del dashboard (arriba de las tarjetas).
2. **Publicidad**: Ingresa el ID de la campaña de publicidad activa de Guadalupe y Tomás en los campos del formulario superior. El sistema consultará a la API de Mercado Ads el gasto diario y acumulado de estas campañas.
3. **Asignación de Publicación**: Para cada producto activo importado de Mercado Libre:
   - Cambia su dueño entre **Guadalupe**, **Tomás** o **Compartidos**.
   - Si seleccionas **Compartidos**, define el porcentaje de participación (ej. `50` para dividir a partes iguales las ventas, stock e ingresos brutos).
   - Escribe el **Costo de Compra (COGS)** manual de cada unidad en el último campo para poder calcular las ganancias y el capital de inventario.
4. Haz clic en **Guardar Ajustes** al final del panel. Tus cambios se guardarán permanentemente en Vercel KV.

---

## Desarrollo Local

Para correr el proyecto en tu máquina de desarrollo local:

1. Crea un archivo `.env.local` en la raíz del proyecto con tus credenciales:
   ```env
   ML_APP_ID=tu_app_id
   ML_CLIENT_SECRET=tu_client_secret
   ML_REDIRECT_URI=http://localhost:3000/api/auth/callback
   ```
2. Ejecuta el servidor de desarrollo:
   ```bash
   npm run dev
   ```
3. Entra a `http://localhost:3000`. Todos tus ajustes y datos de prueba se guardarán localmente en un archivo autogenerado llamado `meli_db.json`.
