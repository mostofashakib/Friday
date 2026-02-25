-- Enable pgvector extension
create extension if not exists vector;

-- Sessions
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  interview_type text not null check (interview_type in ('behavioral', 'technical', 'general')),
  role text,
  difficulty integer default 3 check (difficulty between 1 and 5),
  status text default 'active' check (status in ('active', 'completed')),
  turn_count integer default 0,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Row-level security
alter table sessions enable row level security;
create policy "Users can access own sessions"
  on sessions for all
  using (auth.uid() = user_id);

-- Messages (Q&A turns)
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  role text not null check (role in ('interviewer', 'user', 'coach')),
  content text not null,
  competency text,
  score integer check (score between 1 and 5),
  turn_number integer,
  is_followup boolean default false,
  created_at timestamptz default now()
);

alter table messages enable row level security;
create policy "Users can access messages in own sessions"
  on messages for all
  using (
    session_id in (
      select id from sessions where user_id = auth.uid()
    )
  );

-- RAG embeddings (pgvector)
create table if not exists message_embeddings (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  message_id uuid references messages(id) on delete cascade,
  embedding vector(1536),
  content text,
  metadata jsonb
);

alter table message_embeddings enable row level security;
create policy "Users can access embeddings in own sessions"
  on message_embeddings for all
  using (
    session_id in (
      select id from sessions where user_id = auth.uid()
    )
  );

-- Competency scores
create table if not exists competency_scores (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  competency text not null,
  score numeric default 0,
  attempts integer default 0,
  updated_at timestamptz default now(),
  unique(session_id, competency)
);

alter table competency_scores enable row level security;
create policy "Users can access competency scores in own sessions"
  on competency_scores for all
  using (
    session_id in (
      select id from sessions where user_id = auth.uid()
    )
  );

-- pgvector similarity search function
create or replace function match_session_embeddings(
  p_session_id uuid,
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    me.id,
    me.content,
    me.metadata,
    1 - (me.embedding <=> query_embedding) as similarity
  from message_embeddings me
  where
    me.session_id = p_session_id
    and 1 - (me.embedding <=> query_embedding) > match_threshold
  order by me.embedding <=> query_embedding
  limit match_count;
$$;
