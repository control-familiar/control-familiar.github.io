# Guía de uso — Control Económico Familiar

App web para llevar ingresos y egresos, vencimientos, saldos por cuenta, proyección de ahorro, USDT, dólares y más. Los datos son **de tu familia**: todos los usuarios de la familia ven y editan la misma información, y nadie de otra familia la ve. El **soporte** (la cuenta que administra la app) puede verla en solo lectura para ayudarte, y es quien activa funciones o da de alta usuarios.

## Índice
1. [Primeros pasos](#1-primeros-pasos)
2. [Conceptos clave](#2-conceptos-clave)
3. [Menú lateral](#3-menú-lateral)
4. [Configuración inicial (ABM)](#4-configuración-inicial-abm)
5. [Cargar movimientos](#5-cargar-movimientos)
6. [Importar resúmenes](#6-importar-resúmenes)
7. [Vencimientos y tarjeta](#7-vencimientos-y-tarjeta)
8. [Resumen](#8-resumen)
9. [Saldos](#9-saldos)
10. [Flujo de Caja y deudas](#10-flujo-de-caja-y-deudas)
11. [USDT](#11-usdt)
12. [Dólares](#12-dólares)
13. [Backups](#13-backups)
14. [Preguntas frecuentes](#14-preguntas-frecuentes)

---

## 1. Primeros pasos

- **Ingreso:** abrí la app, escribí email y contraseña y tocá **Iniciar sesión**. No hay registro público: los usuarios los da de alta el soporte. El ojito muestra la contraseña que estás escribiendo.
- **Recordarme en este dispositivo** (tildado por defecto): la sesión queda abierta y no hace falta volver a entrar. Destildalo en una compu prestada: la sesión se cierra al cerrar el navegador. En el iPhone, si pasás más de una semana sin abrir la app, Safari puede borrar la sesión; agregando la app a la pantalla de inicio no pasa.
- **Menú de cuenta** (círculo con tus iniciales, arriba a la derecha): elegí el **color del tema** (verde, azul, naranja), **modo claro/oscuro** y **Cerrar sesión**. Las preferencias quedan guardadas en el navegador.
- **Celular:** el menú lateral se abre con el botón de hamburguesa (☰). Para cargar efectivo, el botón flotante **+ Efectivo** abajo a la derecha.
- **Botón “+ Movimiento”** (arriba del menú lateral): abre el alta de un movimiento desde cualquier pestaña.

## 2. Conceptos clave

| Concepto | Qué es |
|---|---|
| **Centro de Costo (CC)** | Una cuenta o “bolsillo” de plata: banco, billetera, tarjeta, efectivo. Tiene código corto (ej. `MPF`), nombre, color, entidad (para el logo), moneda y titular (un usuario de la familia, o ninguno). |
| **Categoría / Subcategoría** | Clasificación del gasto o ingreso (Alimentos › Super). |
| **Movimiento** | Un ingreso o un egreso en un CC, con fecha, contraparte (proveedor, cliente, banco, persona…), detalle y monto. |
| **Fecha futura** | Un movimiento con fecha posterior a hoy es *pendiente*: se gestiona en **Vencimientos**, no cuenta en Saldos y pasa solo a Movimientos cuando llega su fecha. |

### Tratamiento de las categorías en reportes

Al crear una categoría elegís su **Tratamiento en reportes**. Es la decisión más importante de la configuración: pensá si esa plata tiene que bajar tu capacidad de ahorro mensual.

| Tipo | Úsalo para | Efecto |
|---|---|---|
| **Normal** | Gastos e ingresos del día a día (Super, Servicios, Auto…) | Entra en todos los reportes y resta de la capacidad de ahorro. |
| **TEC** | Pasar plata entre cuentas propias | No cuenta en ningún reporte; solo mueve el saldo de cada cuenta. |
| **Inversión** | Gastos grandes que dejan valor (ej. Obra) | Se muestra aparte en Resumen y no resta de la capacidad de ahorro. |
| **Sueldo** | Tu ingreso fijo | Es el “Total ingresos” de Resumen y la base de la capacidad de ahorro. |
| **Solo control** | Movimientos que querés registrar pero no son ingreso/gasto tuyo | No cuenta en reportes, pero sí mueve el saldo de la cuenta. |
| **Venta de USDT** | Adonde van los pesos de cada venta de USDT (solo con USDT activado; una sola) | No cuenta como ingreso: la plata ya entró como USDT. |

**Transferencias entre cuentas (TEC):** son dos movimientos (egreso en una cuenta, ingreso en la otra) con categoría TEC. Al filtrar Movimientos por TEC el total debe dar **$0,00**; si no, falta alguna punta.

## 3. Menú lateral

- **Resumen** — panorama general y gráficos.
- **Movimientos** — listado, alta, edición, filtros, exportación.
- **Vencimientos** — pagos pendientes y movimientos con fecha futura.
- **Saldos** — plata actual por cuenta.
- **Flujo de Caja** — proyección de ahorro y deudas. *(opcional)*
- **USDT** — tenencia y ventas de USDT. *(opcional)*
- **Dólares** — compras/ventas de dólares y saldos en USD. *(opcional)*
- **Importar** — carga masiva desde resúmenes de bancos.
- **ABM** — categorías, subcategorías, centros de costo y reglas.

Las marcadas *(opcional)*, igual que Facturación ARCA y Tarjetas y cuotas, aparecen solo si están activadas para tu familia. Las activa el soporte.

## 4. Configuración inicial (ABM)

Antes de cargar datos, armá la base en **ABM** (cada sección es una subpestaña):

1. **Centros de Costo.** Por cada cuenta: *Código* (ej. `MPF`), *Nombre*, *Color*, *Entidad* (Santander, Nación, Provincia, ICBC, Macro, Mercado Pago: muestra el logo en Saldos) y *Moneda* (Pesos, Dólares o Pesos y dólares).
2. **Categorías.** Nombre, color y tratamiento en reportes (ver [sección 2](#tratamiento-de-las-categorías-en-reportes)). Para que cada cuenta arranque con su saldo actual, creá una categoría **“Saldo Inicial”** y cargá un movimiento por cuenta con ese monto.
3. **Subcategorías.** Se crean dentro de una categoría. También se pueden crear al vuelo escribiendo un nombre nuevo en el campo Subcategoría de un movimiento. Al borrar una subcategoría con movimientos, la app permite **reasignarlos** a otra o dejarlos sin subcategoría.
4. **Reglas de categorización** (opcional, ahorra tiempo al importar): asociá un texto de contraparte (coincidencia parcial, sin importar mayúsculas) a una categoría/subcategoría. Ej.: “Barrientos” → Hogar › Limpieza.

## 5. Cargar movimientos

### Alta manual
Tocá **+ Movimiento**. Campos principales: Fecha, Centro de Costo, Tipo (ingreso/egreso), Monto, Contraparte, Detalle, Categoría y Subcategoría.

- Los desplegables de Centro/Categoría/Subcategoría tienen **buscador**: escribí para filtrar y confirmá con **Enter** o **Tab**.
- **Transferencia:** completá *Centro de Costo Destino* (opcional) para registrar el movimiento de pasaje entre cuentas.
- **Cuotas:** indicá *Cuotas a generar* y la app crea una por mes (con fecha futura, visibles en Vencimientos). *Cuota manual* es solo para escribir la etiqueta a mano en un movimiento suelto; dejala vacía si ya pusiste una cantidad.
- **Tarjeta:** *Marca de tarjeta* y *Fecha de consumo* son opcionales.

### Cargar efectivo (rápido)
Pensado para el celular: el botón flotante **+ Efectivo** (abajo a la derecha) abre una hoja de carga rápida.
- El **Monto** va primero, con el teclado ya abierto. Se escribe como siempre: `1.500` o `1.500,50`.
- **Egreso / Ingreso**, la **Fecha** (Hoy, Ayer u Otra…), el **Centro de Costo** y la **Categoría** se eligen con un toque. El centro que usaste la última vez en ese teléfono viene marcado; las categorías que más usás aparecen primero (*Otra…* muestra todas).
- La **Contraparte** se autocompleta con las que ya cargaste y, si tiene una regla de categorización, completa sola la categoría.
- Detalle y Subcategoría están en **Más datos**; también se pueden completar después desde Movimientos.
- **Guardar** queda siempre abajo. **Guardar y cargar otro** deja la hoja abierta con la misma fecha, centro y tipo (útil con varios tickets).
- Después de guardar aparece un aviso con **Deshacer** por unos segundos. La hoja se cierra con *Cancelar*, tocando afuera o deslizándola hacia abajo.

### Listado de Movimientos
- **Filtros:** búsqueda por texto y filtros múltiples (tildás varias opciones) de Centro, Categoría, Subcategoría y Mes. *Solo incompletos* muestra los que no tienen categoría; *Solo tarjeta* los de tarjeta. **Limpiar filtros** los reinicia.
- **Paginación** de 50 en 50.
- **Quién lo cargó:** al editar un movimiento, debajo del título dice quién lo cargó y cuándo (*Cargado por Ana el 31/10/2026 a las 17:45*). Lo pone la base y no se puede cambiar. En los cargados antes de noviembre de 2026 dice solo cuándo.
- **Edición múltiple:** seleccioná varios movimientos y editalos en lote (por ejemplo, asignarles la misma categoría).
- **Agrupar tarjeta:** los consumos de un mismo resumen se pueden agrupar y desplegar.
- **Exportar a Excel** lo filtrado.
- Las ventas de USDT muestran un botón para **facturar con ARCA** (ver [sección 11](#11-usdt)).

## 6. Importar resúmenes

**Importar** convierte el texto copiado de un resumen en movimientos.

1. Elegí la **Entidad**: Mercado Pago, Santander, Nación, Provincia, Macro, Tarjeta de Crédito o *Excel histórico* (ya categorizado). Ves los que están habilitados para tu familia; si te falta uno, pedíselo al soporte.
2. Para *Tarjeta de Crédito* indicá además Banco, Vencimiento del resumen y, opcionalmente, la marca.
3. Pegá el texto del resumen en el cuadro y tocá **Previsualizar**.
4. Revisá la tabla: podés corregir centro, categoría y subcategoría de cada fila. Las **reglas de categorización** completan las que coincidan, y los **posibles duplicados** (mismo centro, contraparte, monto y fecha que algo ya cargado) quedan marcados.
5. Confirmá para guardar.

*Mercado Pago:* copiá lo que ves en **Actividad** (también se acepta lo copiado de la pestaña Movimientos, el formato anterior). No se importan los pagos con tarjeta de crédito (entran con el resumen de la tarjeta), las compras devueltas junto con su devolución, lo rechazado o cancelado ni lo que está en dólares; la pantalla avisa cuántos quedaron afuera y por qué.

*Tarjeta Galicia:* copiá el detalle de consumos del resumen (PDF), aunque arrastre encabezados y pies de página. Los consumos en dólares o en otra moneda extranjera no se importan (la pantalla avisa cuántos); los impuestos y percepciones del final entran uno por línea, y cada consumo lleva en Detalle la tarjeta y su titular (*Tarjeta 1234 · NOMBRE*).

*Excel histórico:* pegá las filas copiadas del Excel con columnas separadas por tab, en el orden que indica la propia pantalla (Periodo, Cuenta, Categoría, Subcategoría, CC, Fecha, Contraparte, Detalle, Ingreso, Egreso).

## 7. Vencimientos y tarjeta

**Vencimientos** tiene tres partes:

- **Vencimientos propios:** recordatorios de algo a pagar, con concepto, fecha, monto, centro y, opcionalmente, categoría y subcategoría. No son movimientos: no cuentan en Saldos ni en reportes. Se pueden editar, borrar, **marcar como pagado** o **saltear**:
  - al pagar elegís entre *marcar pagado y cargarlo como movimiento* (sale con su categoría) o *solo marcar pagado*;
  - *saltear* es para cuando ese mes no se paga: sale de la lista sin crear movimiento. Si es recurrente, los meses siguientes siguen apareciendo;
  - si ya cargaste (o importaste) el gasto, el vencimiento te lo avisa: *"Ya tenés un movimiento de esta categoría el día tanto… ¿Marcar pagado?"*. Busca egresos del mismo mes con la misma categoría (y subcategoría, si el vencimiento tiene); tocándolo se marca pagado sin duplicar el movimiento.
  Los pagados y salteados quedan en el historial de abajo, desde donde se pueden volver a pendiente.
- **Vencimientos recurrentes:** para lo que se paga todos los meses (por ejemplo, Patín). Cargás concepto, día del mes, monto, centro, categoría y el mes *Desde* (y *Hasta*, si termina). Cada vez que se abre la app se crea solo el vencimiento de cada mes que falte, incluso los meses ya pasados desde *Desde*. Esos vencimientos se ven con el ícono ↻ y se pagan o saltean como cualquier otro. Si el mes no tiene ese día (el 31 en febrero), vence el último día del mes. Cambiar un recurrente afecta solo a los meses que todavía no se crearon; borrarlo deja los ya creados.
- **Movimientos con fecha futura** (por ejemplo cuotas de tarjeta), agrupados. Estos sí son movimientos: no afectan Saldos hasta su fecha y, cuando llega, pasan solos a Movimientos.

En **Resumen** aparece un aviso con los vencimientos próximos.

## 8. Resumen

- **Estado actual:** la foto de hoy (saldo total, tenencia en USDT y dólares, ahorro promedio). No depende de los filtros. En el celular se ve como una lista.
- **Período y filtros:** debajo de Estado actual. Arriba, el mes con flechas **‹ ›** para pasar de un mes a otro. Debajo, "Según estos filtros" con el resumen de lo aplicado (centro, categoría, desglose); tocándolo se despliegan los filtros (Centro, Categoría, Mes —varios a la vez— y Desglose por categoría o centro). En la computadora arrancan desplegados y en el celular plegados, y plegados quedan fijos arriba al hacer scroll. **Volver al mes actual** deshace los cambios. Todo lo que está debajo (con la línea verde al costado) responde a estos filtros.
- **Saldo del período:** lo que te quedó (ingresos − egresos − Inversión), con el % ahorrado del ingreso, la diferencia con el mes anterior y una barra de lo que entró y lo que salió. Abajo, **Ingresos** (categorías *Sueldo*), **Egresos** (gastos netos del resto, sin TEC ni Solo control) e **Inversión**. Cuentan solo los movimientos hasta hoy; debajo de Egresos se avisa lo que **falta pagar** del período (movimientos con fecha futura y vencimientos sin pagar). Los gastos en dólares suman pasados a pesos al dólar blue de hoy.
- **Tendencia mensual:** ingresos (verde) y egresos + Inversión (coral) de cada mes, con el saldo arriba. Tocá un mes para verlo.
- **Total por categoría/centro:** neto de cada una (+ a favor, − en contra), sin TEC, Solo control, Inversión ni Sueldo. Con un solo mes elegido, cada fila se compara con su promedio de los 3 meses anteriores. **Tocá una fila** para ver esos movimientos.
- **Top contrapartes:** las 8 con mayor movimiento neto del período. También se tocan para ver sus movimientos.
- **Comparativa mensual por categoría:** neto por categoría, mes a mes, con su propio rango. En el celular se desliza de costado con la categoría fija.
- Si el período no tiene movimientos, en vez de tarjetas en $0 aparece un aviso con accesos a otro mes o a cargar efectivo.

## 9. Saldos

Muestra el saldo real de cada Centro de Costo: parte del “Saldo Inicial” y suma/resta **todos** los movimientos (incluso TEC, Inversión y Solo control). Se recalcula con cada movimiento nuevo; **Recalcular** trae cambios hechos desde otra sesión. Las cuentas se agrupan por titular, y al final "Sin titular". Desde una cuenta se puede saltar a sus movimientos. Debajo se muestran los saldos en dólares y la tenencia de USDT (aparte del total en pesos).

## 10. Flujo de Caja y deudas

Proyecta tu ahorro acumulado a futuro.

- **Configuración:** *Ventana histórica* (últimos 3, 6 o 12 meses cerrados, o todo el histórico) y *Meses a proyectar* (6, 12 o 24).
- **Capacidad de ahorro:** promedio de (Sueldo − gastos corrientes) en la ventana, sin TEC ni Inversión. Los gastos en dólares se suman pasados al dólar blue.
- **Deudas:** cargá cada deuda con su cuota mensual; se descuentan de la proyección y se dan de baja solas al terminar de pagarse.
- **Proyección:** arranca del saldo actual (pesos + USDT + dólares) y suma cada mes la capacidad de ahorro menos las cuotas de deudas. No incluye vencimientos ni cuotas ya cargadas con fecha futura (esos se ven en Vencimientos).

## 11. USDT

Registra tu tenencia de USDT.

- **Ingreso:** cantidad de USDT recibida (con datos opcionales). Cuenta como sueldo en Resumen y Flujo de Caja solo si le ponés una categoría de tipo Sueldo.
- **Venta:** indicás cuántos USDT vendiste y cuántos pesos recibiste; la app **resta de la tenencia y crea sola el ingreso en pesos** en Movimientos, en la categoría de tipo *Venta de USDT*. No hay que cargarlo dos veces.
- **Desde un movimiento existente:** si ya tenés el ingreso en pesos, usá “Generar movimiento USDT” sobre ese movimiento e indicá cuántos USDT eran; la app calcula la cotización.
- **Cotización:** botón para actualizarla; se usa para valuar la tenencia en pesos.
- **Facturación ARCA:** en Movimientos, las ventas de USDT tienen un botón para emitir una **Factura C a Consumidor Final** ante ARCA. Antes de emitir valida que no se supere el tope de facturación de tu categoría de Monotributo (acumulado de los últimos 12 meses). Una vez emitida podés ver el comprobante. Requiere la configuración descripta en [INSTALACION-Y-OPERACION.md](INSTALACION-Y-OPERACION.md#facturación-arca).

## 12. Dólares

Para compras y ventas de dólares y algún ingreso/gasto en USD.

- Los **Centros de Costo en dólares** (o “Pesos y dólares”) llevan su saldo en USD, visible en la pestaña.
- **Compra/Venta:** indicá CC en dólares, cantidad (US$), CC en pesos y pesos pagados/recibidos. Se mueven los dólares y se crea (o actualiza) sola la **contraparte en pesos** en Movimientos. Para que no cuente como gasto o ingreso, usá una categoría de tipo *Inversión* o *Solo control*.
- **Transferencia entre cuentas:** elegí CC origen y CC destino (los dos en dólares). Se crean un gasto en el origen y un ingreso en el destino con la categoría de tipo *TEC*. También se puede cargar un Ingreso/Gasto con una categoría TEC y completar el **CC destino** para que se cree el espejo.
- El botón **“Usar blue de hoy”** sugiere el monto en pesos con la cotización del dólar blue.
- Los montos en dólares no se suman a ningún informe en pesos, salvo al Flujo de Caja y al total de Saldos de la proyección (a cotización blue).

## 13. Backups

Los backups los hace **el soporte**: si necesitás recuperar algo, pedíselo. Restaura los datos de tu familia sin borrar nada de lo que ya tenés ni tocar a las demás familias (ver [GUIA-DE-SOPORTE.md](GUIA-DE-SOPORTE.md#5-backups-y-restauración)).

## 14. Preguntas frecuentes

**El saldo de una cuenta no coincide con el banco.** Revisá que cargaste la categoría *Saldo Inicial*, que no falten movimientos y que las transferencias (TEC) tengan sus dos puntas. Tocá *Recalcular* en Saldos.

**Cargué un movimiento y no aparece en Movimientos.** Si su fecha es posterior a hoy, está en *Vencimientos*.

**Importé dos veces el mismo resumen.** La previsualización marca los posibles duplicados; destildalos antes de confirmar. Los ya guardados se pueden borrar desde Movimientos.

**Un gasto no aparece en Resumen.** Revisá el tratamiento de su categoría: TEC, Solo control, Inversión y Sueldo se excluyen o se muestran aparte.

**No puedo iniciar sesión.** Pedile al soporte que cree tu usuario o te resetee la contraseña.

**Entro y me dice que mi usuario no está asignado a ninguna familia.** El soporte todavía no te sumó a tu familia: pedíselo.

**No veo una pestaña (USDT, Dólares, Flujo de Caja), el botón Facturar o los campos de tarjeta.** Son funciones opcionales que activa el soporte para cada familia.

**En Importar no está mi banco.** Pedíselo al soporte: puede estar oculto para tu familia, o hay que agregarlo a la app.

**El sueldo aparece en el mes equivocado en el Resumen.** Si se acredita unos días antes de fin de mes, el soporte puede configurar que esos días cuenten para el mes siguiente.
