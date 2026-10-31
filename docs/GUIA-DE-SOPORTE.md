# Guía de soporte — Control Económico Familiar

Para quien da soporte a las familias con la cuenta **superadmin**: dar de alta familias y usuarios, configurar qué ve cada una, hacer backups y resolver problemas. Para el uso diario de una familia ver [GUIA-DE-USO.md](GUIA-DE-USO.md); para instalar la app y la base, [INSTALACION-Y-OPERACION.md](INSTALACION-Y-OPERACION.md). Las decisiones de diseño están en [MULTI-FAMILIA.md](MULTI-FAMILIA.md).

## Índice
1. [Qué puede hacer el soporte](#1-qué-puede-hacer-el-soporte)
2. [Alta de una familia nueva](#2-alta-de-una-familia-nueva)
3. [La pestaña Administración](#3-la-pestaña-administración)
4. [Cambios habituales](#4-cambios-habituales)
5. [Backups y restauración](#5-backups-y-restauración)
6. [Problemas comunes](#6-problemas-comunes)

---

## 1. Qué puede hacer el soporte

- La cuenta superadmin es **aparte**: no pertenece a ninguna familia. Hoy es `anitacasadei+soporte@gmail.com`.
- Entra a la **misma app** que las familias. Arriba a la derecha tiene un **selector de familia**: ve la familia elegida tal como la ve ella (con sus funciones), pero **en solo lectura**. No puede cargar, editar ni borrar movimientos, categorías, centros, etc.
- Tiene una pestaña extra, **Administración**, donde sí puede cambiar la **configuración** y los **importadores** de cada familia, descargar el **backup** de todas y **restaurar** una familia.
- Las **altas y bajas** (familias, usuarios, superadmins) se hacen con scripts en el SQL Editor de Supabase: la app solo las muestra.
- El soporte ve los datos de todas las familias: las familias tienen que saberlo.

## 2. Alta de una familia nueva

Todos los scripts están en [`scripts/sql/`](../scripts/sql). Se abren, se cambian los valores marcados `<-- CAMBIAR`, se pegan en **Supabase → SQL Editor → New query** y se ejecutan. Cada uno termina con una consulta que muestra cómo quedó todo.

1. **Familia:** [`alta_familia.sql`](../scripts/sql/alta_familia.sql) con el nombre de la familia (no se puede repetir).
2. **Usuarios:** en Supabase, **Authentication → Users → Add user**, uno por persona (email y contraseña). El registro público está deshabilitado: nadie se puede crear una cuenta solo.
3. **Miembros:** [`alta_miembro.sql`](../scripts/sql/alta_miembro.sql) por cada usuario, con su email, la familia y el **nombre** con el que lo va a ver la familia (por ejemplo, como titular de una cuenta). Si el nombre queda vacío se usa lo que va antes de la @.
4. **Funciones y configuración:** en la app, **Administración → Configuración de _la familia_** (elegida en el selector):
   - Grupo **Funciones**: prender las que use la familia (USDT, Dólares, Flujo de Caja, Facturación ARCA, Tarjetas). Por defecto están todas apagadas: la familia ve solo Resumen, Movimientos, Vencimientos, Saldos, Importar y ABM.
   - Grupo **Reglas**: `sueldo_dias_mes_siguiente` si el sueldo se acredita unos días antes de fin de mes (por ejemplo 3).
   - Grupo **Facturación**: CUIT, razón social y tope de Monotributo, solo si factura con ARCA (hoy ARCA está resuelto para una sola familia: el certificado vive en la Edge Function).
5. **Importadores:** en **Administración → Importadores de _la familia_**, destildar los bancos que no usa. Un importador nuevo les aparece a todas.
6. **Verificar:** correr [`estado.sql`](../scripts/sql/estado.sql) (solo lectura) y revisar que la familia tenga sus miembros, funciones e importadores. Pedirle a alguien de la familia que entre: tiene que ver la app vacía, lista para cargar.

Las categorías, subcategorías, centros de costo (con su titular) y reglas de categorización los carga **la familia** desde el ABM.

## 3. La pestaña Administración

| Tarjeta | Qué muestra o hace |
|---|---|
| **Familias** | Todas las familias, con cantidad de miembros y fecha de alta. |
| **Miembros** | Nombre, email y familia de cada usuario. |
| **Configuración de _familia_** | Cada clave del catálogo con su descripción. Vacío = usa el default; **Guardar** o **Usar default**. Los números van con punto decimal y sin separador de miles. Avisa si Facturación ARCA está prendida sin USDT o sin CUIT/razón social. |
| **Importadores de _familia_** | Un tilde por importador: tildado = la familia lo ve. |
| **Descargar backup** | Un `.json` con todas las familias. |
| **Restaurar una familia** | Ver [Backups y restauración](#5-backups-y-restauración). |

Las claves nuevas de configuración y los importadores nuevos no se crean desde acá: van en `schema.sql` junto con el código que los usa.

## 4. Cambios habituales

| Qué | Cómo |
|---|---|
| Sumar un usuario a una familia que ya existe | Crearlo en Authentication → Users y correr `alta_miembro.sql`. |
| Cambiarle el nombre a un usuario | `alta_miembro.sql` con el mismo email y familia y el nombre nuevo. |
| Pasar un usuario a otra familia | `alta_miembro.sql` con la familia nueva y `v_cambiar_de_familia := true`. Lo que cargó queda en la familia anterior y los centros de los que era titular ahí quedan sin titular. |
| Sacar a un usuario de su familia | [`baja_miembro.sql`](../scripts/sql/baja_miembro.sql). Sus datos quedan en la familia; si vuelve a entrar ve el aviso de que no tiene familia. Para que no pueda entrar más, borrarlo en Authentication → Users. |
| Resetear una contraseña | Authentication → Users → el usuario → *Send password recovery* (le llega un mail con link a la app) o cambiarla a mano. |
| Otra cuenta de soporte | Crearla en Authentication → Users y correr [`alta_superadmin.sql`](../scripts/sql/alta_superadmin.sql). Tiene que ser una cuenta aparte: un miembro de una familia no puede ser superadmin (y al revés). |
| Ver cómo está todo | [`estado.sql`](../scripts/sql/estado.sql) (no cambia nada). |
| Borrar una familia con todos sus datos | No hay script (es irreversible y todavía no hizo falta). Si aparece el caso: backup antes y armar el script con cuidado. |

## 5. Backups y restauración

- **Descargar:** Administración → *Descargar backup completo*. Lleva familias, miembros y los datos de todas las familias (versión 3).
- **Backup diario a Drive:** existe el workflow, pero está **desactivado** hasta cargar sus secrets (ver [INSTALACION-Y-OPERACION.md](INSTALACION-Y-OPERACION.md#backup-diario-a-google-drive)). Genera el mismo archivo.
- **Restaurar una familia:** Administración → *Restaurar una familia desde un backup* → elegir el archivo → *Leer archivo* → elegir la familia → *Restaurar esta familia* → confirmar.
  - Las demás familias no se tocan.
  - **No borra nada:** agrega lo que falta y actualiza lo que coincide por ID.
  - Es **todo o nada**: si una fila no cierra (de otra familia, un ID que ya es de otra familia, una referencia rota), no se aplica ninguna y se muestra el motivo.
  - Si la familia ya no existe, se vuelve a crear con el mismo nombre. Sus **miembros no se restauran** (dependen de los usuarios de Auth): darlos de alta de nuevo con `alta_miembro.sql`. Los centros cuyo titular ya no es de la familia quedan sin titular.
  - Solo acepta backups de este proyecto (versión 3), no los del proyecto original.

## 6. Problemas comunes

| Síntoma | Qué revisar |
|---|---|
| Un usuario entra y ve *"no está asignado a ninguna familia"* | Falta `alta_miembro.sql` para ese email (verlo en `estado.sql`, fila *Sin familia*). |
| A una familia le falta una pestaña (USDT, Dólares, Flujo de Caja) o los campos de tarjeta | La función está apagada: Administración → Configuración → Funciones. |
| No aparece el botón Facturar en las ventas de USDT | Tienen que estar prendidas USDT y Facturación ARCA, y la venta en la categoría de tipo *Venta de USDT*. |
| Al facturar dice que *el soporte tiene que cargar los datos de facturación* | Faltan CUIT o razón social en la configuración de la familia. |
| En Importar falta un banco, o dice que no hay importadores | Administración → Importadores de la familia (y para los de tarjeta, la función Tarjetas). |
| Un sueldo aparece en el mes equivocado en el Resumen | `sueldo_dias_mes_siguiente` en la configuración de la familia. |
| La restauración de un backup falla | El mensaje dice qué tabla y por qué. No se aplicó nada: se puede corregir y reintentar. |
| Un usuario no puede iniciar sesión | Que exista en Authentication → Users; resetearle la contraseña. |
