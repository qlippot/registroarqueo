# registroarqueo

Una página que recibe la tabla de unidades estratigráficas, la revisa y dibuja la matriz de Harris. No corrige nada: lista los problemas para volver a las fichas.

## Uso

Abre `dist/index.html` en el navegador. No necesita servidor ni conexión, salvo para las fuentes.

- **Pegar:** copia las filas de la hoja de registro con la fila de títulos (CORTE, TIPO, Cubre…) y pégalas.
- **Copiar:** devuelve la tabla para pegarla en la hoja.
- La tabla se guarda solo en el navegador que la usa.

## Cómo anotar las relaciones

| Escribe | Significa |
|---|---|
| `2, 5` | varias unidades |
| `5?` | relación dudosa |
| `UE2:3` | unidad de otro corte |
| `n/o` | no observada |
| `5~` | en *Se apoya*: contacto que no implica ser posterior |

- **Cubre, Corta, Rellena, Se apoya:** el sujeto es posterior.
- **Igual a:** la misma unidad con dos números; se dibuja en una caja.
- **Equivalente a:** partes correlacionadas; cajas separadas, sin orden entre sí.
- **Se une a:** estructuras trabadas, construidas a la vez.
- **Incierta:** hay contacto pero no se sabe el orden.

Las columnas pasivas (cubierto, cortado, rellenado, se le apoya) se deducen; si la hoja las trae, se comprueba que coincidan.

## Qué revisa

**Errores:** relaciones que no coinciden entre fichas, bucles, unidades que no existen, tipos que no admiten una relación (un depósito que corta, algo que rellena lo que no es un corte), unidades iguales o unidas que la secuencia ordena, y profundidad contraria a *Cubre* entre depósitos del mismo corte.

**Avisos,** donde los manuales no coinciden: un corte que corta otro corte, un depósito apoyado en un muro, rellenos de un mismo corte sin orden entre sí, unidades sin relación de orden.

**No revisa a propósito:** cotas entre cortes, de rellenos, de estructuras o de estratos inclinados, ni fechas de materiales.

Los tipos son Depósito, Relleno, Corte, Estructura, Arrasamiento y Superficie. Qué admite cada uno se puede cambiar en la pestaña *Reglas*, que también lista los criterios y las fuentes.

## Fuentes principales

- Harris, E. C. 1989. *Principles of Archaeological Stratigraphy*, 2.ª ed.
- Museum of London. 1994. *Archaeological Site Manual*, 3.ª ed.
- Historic England. 2018. *Archaeological Recording Manual*.
- Surrey Archaeological Society. 2010. *Excavation Recording Manual*.
- North Hertfordshire Museums. 2010. *Archaeological Recording System* v2.5.
- May, K., Taylor, J. S. y Binding, C. 2023. Stratigraphic Analysis and The Matrix. *Internet Archaeology* 61.

No se han revisado aún las fichas del ICANH.

## Desarrollo

```
npm test        # pruebas de la lógica
npm run build   # rehace dist/index.html desde src/
```

- `src/core.js`: lectura de la tabla, reglas, revisión y disposición de la matriz. Sin dependencias.
- `src/index.template.html`: la página; `/*CORE*/` se sustituye por `core.js` al construir.
