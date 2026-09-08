# Bloqueador de Páginas

Aplicación de escritorio para Windows que bloquea sitios web **a nivel de sistema operativo**,
por lo que funciona en cualquier navegador (Chrome, Edge, Firefox, etc.), pensada para crear
un entorno seguro para niños al navegar.

## Cómo funciona

La aplicación bloquea los dominios redirigiéndolos a `127.0.0.1` mediante el archivo
`hosts` de Windows (`C:\Windows\System32\drivers\etc\hosts`). Este método:

- Funciona en **todos** los navegadores instalados, sin necesidad de instalar una extensión en cada uno.
- Sigue bloqueando los sitios aunque la aplicación esté cerrada (el bloqueo no depende de que el programa esté corriendo).
- Requiere permisos de administrador de Windows para poder modificar el archivo `hosts` (por eso el instalador y la app se ejecutan como administrador).

## Funciones

- **Lista de sitios bloqueados**: añade o quita dominios manualmente desde el panel.
- **Lista predeterminada para adultos**: incluye una lista base de dominios de contenido para
  adultos, activable/desactivable con un interruptor.
- **Protección con contraseña**: hace falta la contraseña configurada para entrar al panel y
  poder modificar la lista de sitios bloqueados o la configuración.
- **Inicio automático con Windows**: la aplicación se abre (minimizada a la bandeja del sistema)
  al encender el equipo, para mantener la protección activa.

## Limitaciones importantes (léelas antes de confiar en la protección)

- Esta app **no reemplaza** una cuenta de Windows con permisos de administrador separada para
  el niño. Si el niño tiene una cuenta de administrador, podría editar manualmente el archivo
  `hosts` o desinstalar el programa. Se recomienda crear una **cuenta estándar (no administrador)**
  para el niño en Windows.
- El bloqueo es por dominio (DNS a nivel local), no analiza contenido en tiempo real ni bloquea
  búsquedas o resultados dentro de sitios permitidos.
- Si el navegador usa "DNS sobre HTTPS" (DoH) forzado con un proveedor externo, el bloqueo por
  `hosts` puede no aplicarse; en ese caso conviene desactivar DoH forzado en el navegador o
  configurarlo para usar el DNS del sistema.

## Desarrollo

Requisitos: Node.js 18+.

```bash
npm install
npm start
```

## Generar el instalador de Windows (.exe)

El build de Windows debe generarse en Windows (o en una máquina con soporte para NSIS/Wine).

```bash
npm install
npm run dist
```

Esto genera el instalador en la carpeta `dist/`, por ejemplo:
`dist/Bloqueador de Paginas Setup 1.0.0.exe`.

El instalador:

- Pide permisos de administrador (necesarios para editar el archivo `hosts`).
- Permite elegir la carpeta de instalación.
- Crea accesos directos en el escritorio y el menú Inicio.

## Estructura del proyecto

```
main.js              Proceso principal de Electron (lógica de bloqueo, IPC, autoarranque)
preload.js            Puente seguro entre el proceso principal y la interfaz
src/                  Interfaz de usuario (HTML/CSS/JS)
blocklists/           Lista predeterminada de dominios para adultos
assets/               Icono de la aplicación
scripts/generate-icon.js  Script usado para generar el icono (no es necesario re-ejecutarlo)
```
