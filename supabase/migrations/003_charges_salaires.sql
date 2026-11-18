-- 003 : taux des charges sur les salaires (part employeur) pour le coût de la main-d'oeuvre.
-- Peut être relancé sans danger. Aucune donnée effacée.
alter table public.app_settings
  add column if not exists vacation_rate numeric(6,3) not null default 4,      -- vacances (% du salaire)
  add column if not exists rrq_rate      numeric(6,3) not null default 6.300,  -- RRQ employeur 2026
  add column if not exists ae_rate       numeric(6,3) not null default 1.820,  -- assurance-emploi employeur 2026 (Québec, 1,30 % x 1,4)
  add column if not exists rqap_rate     numeric(6,3) not null default 0.602,  -- RQAP employeur 2026
  add column if not exists fss_rate      numeric(6,3) not null default 1.650,  -- FSS, masse salariale de 1 M$ ou moins
  add column if not exists cnt_rate      numeric(6,3) not null default 0.060,  -- normes du travail
  add column if not exists cnesst_rate   numeric(7,4) not null default 0;      -- CNESST : $ par 100 $ de salaire (avis de cotisation)

-- profiles.hourly_cost = taux horaire brut ; les charges s'ajoutent dans l'app.
comment on column public.profiles.hourly_cost is 'Taux horaire brut ($/h). Vacances, DAS et CNESST ajoutés selon app_settings.';
