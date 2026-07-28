# Sistema de gestión de combustible y flota — Firebase + Netlify

Frontend React + Vite + Tailwind, base de datos Firestore, deploy en Netlify.
Sin backend propio: el cliente habla directo con Firestore usando el SDK,
y la lógica de negocio (descuento de stock, etc.) vive en transacciones
de Firestore en `frontend/src/lib/combustible.ts`.

## Estructura

```
combustible-app/
├── firebase.json          # config de Firestore + Hosting (opcional, ver nota)
├── firestore.rules        # reglas de seguridad
├── firestore.indexes.json
├── netlify.toml           # config de build para Netlify
└── frontend/
    └── src/
        ├── lib/
        │   ├── firebase.ts       # inicialización del SDK
        │   ├── types.ts          # tipos de las colecciones
        │   ├── activos.ts        # CRUD de Activos
        │   ├── tanques.ts        # CRUD de Tanques
        │   └── combustible.ts    # ✅ transacciones: cargas, compras, transferencias
        ├── components/Gauge.tsx  # medidor circular (elemento de diseño)
        └── pages/…                # Dashboard, Activos, Tanques, Cargas reales;
                                    # el resto son placeholders
```

## 1. Crear el proyecto en Firebase

1. [console.firebase.google.com](https://console.firebase.google.com) → crear proyecto.
2. Activar **Firestore Database** (modo producción).
3. Activar **Authentication** → método Email/contraseña (o el que prefieras).
4. En Configuración del proyecto → tus apps → agregar app web → copiar las
   claves al `.env` del frontend (ver paso 3).

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules   # sube firestore.rules
```

## 2. Frontend en local

```bash
cd frontend
npm install
cp .env.example .env      # completar con las claves de Firebase
npm run dev                # http://localhost:5173
```

## 3. Deploy en Netlify

Dos formas, elegí una:

**A) Conectando el repo (recomendado)**
1. Subí este proyecto a GitHub/GitLab.
2. En Netlify → "Add new site" → "Import an existing project" → elegí el repo.
3. Netlify va a leer `netlify.toml` automáticamente (base `frontend`, build
   `npm run build`, publish `frontend/dist`).
4. En Site settings → Environment variables, cargá las mismas `VITE_FIREBASE_*`
   del `.env`.
5. Deploy.

**B) Desde la CLI**
```bash
cd frontend
npm run build
npx netlify-cli deploy --prod --dir=dist
```

## 4. Acceso restringido (usuarios y contraseñas)

La app ahora pide login — nadie entra sin cuenta. Para crear el **primer**
usuario administrador (el que va a poder crear a los demás desde la app),
como todavía no hay nadie con permiso, se hace una vez a mano:

1. Firebase Console → Authentication → Users → "Add user" → cargá email y contraseña.
2. Firebase Console → Firestore Database → creá manualmente un documento en
   la colección `usuarios` con el mismo UID que te generó el paso 1:
   ```
   usuarios/{uid}
     email: "admin@empresa.com"
     nombre: "Nombre del admin"
     rol: "administracion"
     activo: true
   ```
3. Con eso ya podés loguearte en la app y crear el resto de los usuarios
   desde Usuarios (abajo del menú lateral) sin volver a tocar la consola.

Las reglas de `firestore.rules` ya exigen `request.auth != null` para
cualquier lectura o escritura — sin login, la app no trae ni un dato.

## Qué es real y qué es placeholder

**Funciona de punta a punta:**
- **Login con Firebase Auth** — la app entera queda atrás de `/login`, nadie ve datos sin sesión
- **Dos roles**: **Administración** (acceso total) y **Empleado** (solo entra a Solicitudes — ni siquiera ve el resto del menú, y las reglas de Firestore lo bloquean aunque intente por afuera de la UI)
- **Usuarios**: alta de usuarios con rol, sin desloguear al admin que los crea
- **Solicitudes**: corregido para que quede registrado el usuario que pide (nombre, no un campo libre) y la fecha se elige con un date picker. Un Empleado ve solo sus propias solicitudes; Administración las ve y aprueba/rechaza todas.
- **Activos**: alta agrupada por categoría (Automóviles/Camionetas/Máquinas/Otros) y subgrupo, con todos los datos técnicos (chasis, motor, patente, dónde se compró) y las fechas de seguro, VTV y service — cada una calcula sola si está vigente o por vencer. El **Batán es un Activo más** (categoría Otros, subgrupo "Batán"): al darlo de alta se le carga su capacidad en litros y queda con stock propio.
  - **Edición completa**: todos los campos del alta se pueden corregir después (código, patente, categoría/subgrupo, marca, modelo, año, tipo de combustible, centro de costo, propietario, responsable, estado, observaciones, vencimientos).
  - **Historial de modificaciones**: cada edición queda auditada (quién, cuándo, qué campo, valor anterior y nuevo) — botón "Historial" en cada fila.
  - **Estados ampliados**: Activo, En mantenimiento, Fuera de servicio, Alquilado, De baja. Un equipo "De baja" ya no aparece como opción al crear Solicitudes o Transferencias.
  - **Propietario**: catálogo editable (Empresa, Alquilado, Cliente, Contratista, o lo que agregues) para saber de quién es cada equipo.
  - **Filtros** por categoría, estado, centro de costo, propietario y "solo vencimientos próximos", con **exportación a Excel y PDF** (el PDF lleva encabezado, fecha, total de activos y numeración de página).
  - **Ficha individual en PDF** por activo (botón "Ficha PDF" en cada fila) para inspecciones o auditorías.
  - **Duplicar** un activo para dar de alta uno parecido sin repetir todos los datos a mano.
  - **Importar desde Excel**: botón para cargar equipos en lote desde un archivo con columnas EQUIPO/MARCA/MODELO/TITULAR/AÑO/N°INTERNO/DOMINIO/N°MOTOR/N°CHASIS.
- **Centros de costo**: las 36 obras/áreas reales de tu formulario, con botón para poblarlas de una
- **Reporte de Centros de costo**: junta Solicitudes + Órdenes de carga + Entregas del Batán en un solo listado, filtrable por fecha, centro de costo y activo, con exportación a **Excel** y **PDF**
- **Flujo Solicitud → Orden → Entrega**:
  - **Solicitudes** (`SC-000001`...): se pide combustible para un activo, con centro de costo obligatorio. Se aprueba o rechaza.
  - **Órdenes de carga** (`OC-000001`...): SOLO se generan desde una solicitud aprobada (nunca sueltas), copian sus datos, y quedan con estado pendiente/enviada/utilizada/vencida/cancelada. Se descargan en PDF para mandarle al proveedor (por ahora Axion Clavero, preparado para sumar más).
  - **Confirmar entrega**: si la orden es para el Batán, confirmar la entrega le suma esos litros a su stock. Si es para otro vehículo (cargado directo en el surtidor), no hay stock que tocar.
- **Transferencias** (Movimientos del Batán): entregas de litros del Batán a otros activos — descuenta su stock con una transacción de Firestore, valida que no se entregue más de lo que hay, y deja registrado responsable/centro de costo/km/observaciones de cada entrega.

**Pendiente:**
- Choferes/operadores, Taller, Documentación, Indicadores más completos
  (top 10 vehículos/obras por consumo, evolución mensual — hoy el
  Dashboard solo tiene las alertas de documentación)
- En Activos: adjuntar documentación (PDF/fotos de título, póliza, VTV) y
  foto de portada del equipo — requiere habilitar **Firebase Storage**
  (hoy el proyecto solo usa Firestore), es un paso aparte que no hicimos
  todavía. Logo de la empresa en el PDF exportado (falta el archivo).
  Costos de vencimientos (seguro/VTV/service) — el campo ya existe en el
  modelo de datos, falta la pantalla para cargarlo.

## Próximo paso sugerido

Sumar la pantalla de login con Firebase Auth — sin eso, las reglas de
seguridad actuales (`firestore.rules`) van a bloquear todas las lecturas
y escrituras en producción.
