import { huellaClave } from './claves.js'
import type { Consulta } from './db.js'

// Se corre al arrancar; todo es "if not exists", así que se puede correr muchas veces.
// El candado evita que dos funciones de Vercel creen las tablas al mismo tiempo.
export const ESQUEMA = `
begin;
select pg_advisory_xact_lock(20261010);
create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  usuario text not null unique,
  clave text not null,
  nombre text not null,
  municipio text not null,
  ciclo_activo uuid,
  creado timestamptz not null default now()
);
create table if not exists sesiones (
  token text primary key,
  usuario_id uuid not null references usuarios on delete cascade,
  expira timestamptz not null
);
create table if not exists ciclos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios on delete cascade,
  temporada text not null,
  cultivos jsonb not null,
  pagado boolean not null default false,
  creado timestamptz not null default now()
);
create table if not exists gastos (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references ciclos on delete cascade,
  concepto text not null,
  monto double precision not null,
  tipo text not null,
  fecha text not null,
  cultivo text not null,
  creado timestamptz not null default now()
);
create table if not exists notas (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references ciclos on delete cascade,
  tipo text not null,
  cultivo text not null,
  texto text not null,
  creado timestamptz not null default now()
);
create table if not exists anuncios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios on delete cascade,
  titulo text not null,
  categoria text not null,
  modo text not null,
  precio double precision not null,
  unidad text not null,
  municipio text not null,
  whatsapp text not null,
  foto text,
  creado timestamptz not null default now()
);
create table if not exists publicaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios on delete cascade,
  tipo text not null,
  municipio text not null,
  cultivo text not null,
  texto text not null,
  creado timestamptz not null default now()
);
create table if not exists respuestas (
  id uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references publicaciones on delete cascade,
  usuario_id uuid not null references usuarios on delete cascade,
  texto text not null,
  creado timestamptz not null default now()
);
create index if not exists gastos_ciclo on gastos (ciclo_id);
create index if not exists notas_ciclo on notas (ciclo_id);
create index if not exists ciclos_usuario on ciclos (usuario_id);
-- La bitácora no se edita: ni la app ni nadie con acceso a la base puede cambiar una nota ya guardada.
create or replace function bitacora_fija() returns trigger language plpgsql as $$
begin raise exception 'La bitácora no se puede cambiar'; end $$;
create or replace trigger bitacora_fija before update on notas for each row execute function bitacora_fija();
commit;
`

// Cuenta de prueba: empieza vacía, para hacer un ciclo desde cero.
export const PRUEBA = { usuario: 'prueba', clave: 'campo2026', nombre: 'Productor de prueba', municipio: 'Guasave' }

export async function sembrar(consulta: Consulta) {
  const [hay] = await consulta('select 1 from usuarios where usuario = $1', [PRUEBA.usuario])
  if (hay) return
  await consulta('insert into usuarios (usuario, clave, nombre, municipio) values ($1, $2, $3, $4) on conflict (usuario) do nothing',
    [PRUEBA.usuario, await huellaClave(PRUEBA.clave), PRUEBA.nombre, PRUEBA.municipio])
}
