# ¡FA! — project text (ES / EN)

## ES

**¡FA! — Movistar Arena**
Fiesta ¡FA! de Mex Urtizberea · 5 años · Movistar Arena, Buenos Aires · 2026
Contenido visual en tiempo real y asistencia de dirección y de diseño de puesta.

¡FA! empezó como una tertulia en la casa de Mex Urtizberea y se convirtió en una fiesta itinerante donde artistas de distintas generaciones comparten escenario. Para la edición aniversario en el Movistar Arena, la consigna fue clara: no trasladar la casa de Mex al estadio, sino armar una noche que sorprendiera a 15.000 personas todo el tiempo.

**La puesta.** La propuesta se apoyó en la sorpresa: láser, apariciones de invitados y pantallas que se mueven y cambian el espacio en cada momento. El escenario combina un backwall LED de 20,8 × 9,6 m con cinco pantallas móviles a alturas escalonadas.

Contenido en código, trabajando con agentes de IA (Claude Code y Codex) como herramientas de producción:

- **Visuales por invitado:** animaciones generadas en WebGL/GLSL.
- **Efectos CCTV:** plugins FFGL propios para Resolume que tratan las cámaras de la IMAG en tiempo real, con glow y halation, fragmentación, silueta aislada y transiciones slit-scan entre planos.
- **Motores generativos y tipográficos:** un mundo de partículas que forma paisajes y nombres, un motor tipográfico para presentar a cada artista y motores en TouchDesigner controlados por MIDI (ruido estilo Ikeda, estrellas, prisma, horizonte), con salida independiente al backwall o a las pantallas móviles.

Todo armado para los operadores de Resolume (VJ), con estructura IN/LOOP/OUT, faders maestros y un consumo de GPU acotado.

Para el momento del vivo se trabajó un guion del show: un showrun con columnas por área (CCTV, FX, video, luces, seguidores, posiciones) que bajaba a guiones por departamento. Para seguirlo en vivo se desarrolló GuionGO, una app de show calling offline inspirada en QLab y Ontime. Lee el guion directo de la planilla, marca warning, standby y GO para cada área, controla tiempos planificados contra reales y exporta un PDF limpio para cada departamento.

**Créditos**
Dirección de arte y diseño de puesta: Sofía Gabrieludis · Tomás Salgado

---

## EN

**¡FA! — Movistar Arena**
Fiesta ¡FA! by Mex Urtizberea · 5th anniversary · Movistar Arena, Buenos Aires · 2026
Real-time visual content, plus direction and stage design assistance.

¡FA! started as a gathering at Mex Urtizberea's house and grew into a traveling party where artists from different generations share the stage. For the anniversary edition at Movistar Arena, the brief was clear: not to move Mex's house into the arena, but to build a night that kept surprising 15,000 people from start to finish.

**The staging.** The concept was built on surprise: lasers, guest appearances and screens that move and reshape the space moment by moment. The stage combines a 20.8 × 9.6 m LED backwall with five moving screens at staggered heights.

Content built in code, with AI agents (Claude Code and Codex) as production tools:

- **Visuals per guest:** animations generated in WebGL/GLSL.
- **CCTV effects:** custom FFGL plugins for Resolume that process the IMAG cameras in real time, with glow and halation, fragmentation, isolated silhouettes and slit-scan transitions between shots.
- **Generative and typographic engines:** a particle world that forms landscapes and names, a typographic engine to introduce each artist, and MIDI-controlled TouchDesigner engines (Ikeda-style noise, stars, prism, horizon), each able to output independently to the backwall or the moving screens.

Everything was built for the Resolume operators (VJs), with an IN/LOOP/OUT structure, master faders and a tight GPU budget.

For the live show, a master script was put together: a show run with columns per area (CCTV, FX, video, lights, follow spots, positions) that broke down into scripts for each department. To call the show live, GuionGO was developed: an offline show-calling app inspired by QLab and Ontime. It reads the script straight from the spreadsheet, marks warning, standby and GO for each area, tracks planned against actual times and exports a clean PDF for each department.

**Credits**
Art direction and stage design: Sofía Gabrieludis · Tomás Salgado
