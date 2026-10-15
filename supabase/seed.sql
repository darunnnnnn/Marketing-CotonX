-- Demo data, so a freshly provisioned project is not a set of empty screens.
--
-- Mirrors src/lib/domain/seed.ts, which is what the app falls back to with no
-- project configured. Idempotent: re-running it changes nothing.
--
-- Apply with:  npx supabase db push --include-seed
-- Or paste into the SQL editor.

-- ----------------------------------------------------------- companies ----

insert into companies (name, domain, website, country_code, country, city, industry, employee_count, verified, sources)
values
  ('Heimtextil Weber', 'heimtextil-weber.de', 'https://heimtextil-weber.de', 'DE', 'Germany', 'Wuppertal', 'Home textiles', 120, true, '{gmail,apollo}'),
  ('Bettwaren Nord', 'bettwaren-nord.de', 'https://bettwaren-nord.de', 'DE', 'Germany', 'Hamburg', 'Bedding', 45, true, '{gmail}'),
  ('Textilhaus Sauer', 'textilhaus-sauer.de', null, 'DE', 'Germany', 'Munich', 'Home textiles', 30, false, '{apollo}'),
  ('Dutch Home Textiles', 'dutchhometextiles.nl', 'https://dutchhometextiles.nl', 'NL', 'Netherlands', 'Rotterdam', 'Importer', 80, true, '{gmail,apollo,linkedin}'),
  ('Amsterdam Linen Co', 'amsterdamlinen.nl', null, 'NL', 'Netherlands', 'Amsterdam', 'Linen', 25, true, '{apollo}'),
  ('Maison du Linge', 'maisondulinge.fr', 'https://maisondulinge.fr', 'FR', 'France', 'Lyon', 'Home textiles', 60, true, '{gmail}'),
  ('Textiles Provence', 'textiles-provence.fr', null, 'FR', 'France', 'Marseille', 'Home textiles', 18, false, '{website}'),
  ('Casa Bella Tessili', 'casabella.it', 'https://casabella.it', 'IT', 'Italy', 'Milan', 'Home textiles', 95, true, '{apollo}'),
  ('Textiles del Norte', 'textilesdelnorte.es', null, 'ES', 'Spain', 'Barcelona', 'Importer', 55, true, '{gmail,apollo}'),
  ('Nordic Home AB', 'nordichome.se', null, 'SE', 'Sweden', 'Gothenburg', 'Retail', 200, true, '{apollo}'),
  ('Grupo Textil Monterrey', 'gtmonterrey.mx', null, 'MX', 'Mexico', 'Monterrey', 'Importer', 140, true, '{apollo,linkedin}'),
  ('Atlantic Home Goods', 'atlantichome.us', null, 'US', 'United States', 'Charlotte', 'Wholesale', 310, true, '{apollo}'),
  ('London Linen House', 'londonlinen.co.uk', null, 'GB', 'United Kingdom', 'London', 'Retail', 70, true, '{gmail}'),
  ('Bruxelles Textiles', 'bruxellestextiles.be', null, 'BE', 'Belgium', 'Brussels', 'Importer', 40, false, '{website}')
on conflict (domain) do nothing;

-- ------------------------------------------------------------ contacts ----

with seed (domain, name, email, phone, designation, role_category, role_priority, language, status, touch, reply, verified, sources, consent) as (
  values
    ('heimtextil-weber.de', 'Klaus Weber', 'k.weber@heimtextil-weber.de', '+49 202 555 118', 'Head of Purchasing', 'Procurement', 'high', 'de', 'enquiry_received', now() - interval '4 days', now() - interval '4 days', true, '{gmail,apollo}', true),
    ('heimtextil-weber.de', null, 'einkauf@heimtextil-weber.de', null, null, 'Procurement', 'high', 'de', 'introduction_sent', now() - interval '18 days', null, true, '{gmail}', false),
    ('bettwaren-nord.de', 'Petra Lindqvist', 'p.lindqvist@bettwaren-nord.de', null, 'Import Manager', 'Import', 'high', 'de', 'no_reply', now() - interval '46 days', null, true, '{gmail}', false),
    ('textilhaus-sauer.de', 'Markus Sauer', 'm.sauer@textilhaus-sauer.de', null, 'Managing Director', 'Executive', 'medium', 'de', 'never_contacted', null, null, false, '{apollo}', false),
    ('dutchhometextiles.nl', 'Jan van den Berg', 'j.vandenberg@dutchhometextiles.nl', '+31 10 555 221', 'Purchasing Director', 'Procurement', 'high', 'nl', 'buyer_replied', now() - interval '6 days', now() - interval '5 days', true, '{gmail,apollo,linkedin}', true),
    ('dutchhometextiles.nl', 'Sanne Mulder', 's.mulder@dutchhometextiles.nl', null, 'Category Buyer', 'Procurement', 'high', 'nl', 'waiting_for_buyer', now() - interval '9 days', null, true, '{apollo}', false),
    ('amsterdamlinen.nl', null, 'inkoop@amsterdamlinen.nl', null, null, 'Procurement', 'high', 'nl', 'never_contacted', null, null, true, '{apollo}', false),
    ('maisondulinge.fr', 'Celine Dubois', 'c.dubois@maisondulinge.fr', '+33 4 72 55 88', 'Responsable Achats', 'Procurement', 'high', 'fr', 'follow_up_required', now() - interval '21 days', null, true, '{gmail}', false),
    ('textiles-provence.fr', null, 'contact@textiles-provence.fr', null, null, 'General inbox', 'low', 'fr', 'never_contacted', null, null, false, '{website}', false),
    ('casabella.it', 'Marco Bellini', 'm.bellini@casabella.it', null, 'Direttore Acquisti', 'Procurement', 'high', 'it', 'conversation_started', now() - interval '11 days', now() - interval '12 days', true, '{apollo}', true),
    ('textilesdelnorte.es', 'Elena Ruiz', 'e.ruiz@textilesdelnorte.es', null, 'Jefa de Compras', 'Procurement', 'high', 'es', 'active_lead', now() - interval '3 days', now() - interval '3 days', true, '{gmail,apollo}', true),
    ('nordichome.se', 'Anders Holm', 'a.holm@nordichome.se', null, 'Sourcing Lead', 'Sourcing', 'high', 'en', 'introduction_sent', now() - interval '13 days', null, true, '{apollo}', false),
    ('gtmonterrey.mx', 'Rodrigo Alvarez', 'r.alvarez@gtmonterrey.mx', '+52 81 5555 9021', 'Gerente de Importaciones', 'Import', 'high', 'es', 'never_contacted', null, null, true, '{apollo,linkedin}', false),
    ('atlantichome.us', 'Dana Whitfield', 'd.whitfield@atlantichome.us', null, 'VP Sourcing', 'Sourcing', 'high', 'en', 'no_reply', now() - interval '52 days', null, true, '{apollo}', false),
    ('londonlinen.co.uk', 'Oliver Grant', 'o.grant@londonlinen.co.uk', null, 'Buying Manager', 'Procurement', 'high', 'en', 'waiting_for_buyer', now() - interval '8 days', null, true, '{gmail}', false),
    ('bruxellestextiles.be', null, 'info@bruxellestextiles.be', null, null, 'General inbox', 'low', 'nl', 'never_contacted', null, null, false, '{website}', false),
    -- Deliberate near-duplicate of Petra, to give the review queue something real to merge.
    ('bettwaren-nord.de', 'Petra Lindquist', 'petra.lindquist@bettwaren-nord.de', null, 'Import Mgr', 'Import', 'high', 'de', 'never_contacted', null, null, false, '{apollo}', false),
    ('maisondulinge.fr', null, 'achats@maisondulinge.fr', null, null, 'Procurement', 'high', 'fr', 'never_contacted', null, null, true, '{website}', false)
)
insert into contacts (
  company_id, name, email, phone, designation, role_category, role_priority,
  preferred_language, status, last_touch_at, last_reply_at, verified, sources, call_consent
)
select companies.id,
       seed.name,
       seed.email,
       seed.phone,
       seed.designation,
       seed.role_category,
       seed.role_priority::role_priority,
       seed.language,
       seed.status::contact_status,
       seed.touch,
       seed.reply,
       seed.verified,
       seed.sources::source_id[],
       seed.consent
from seed
join companies on companies.domain = seed.domain
on conflict (email) do nothing;

-- ----------------------------------------------------------- templates ----

insert into templates (name, kind, channel, language, subject, body, attachments)
values
  ('Cotonex introduction (EN)', 'introduction', 'email', 'en',
   'Cotonex - home textile manufacturing partner',
   E'Dear {{contact_name}},\n\nI am writing from Cotonex, a home textile manufacturer supplying importers and retailers across Europe.\n\nWe produce bed linen, towels, kitchen textiles and cotton bags to buyer specification, with certified production and full traceability.\n\nOur company profile is attached.\n\nKind regards,\nCotonex',
   '{cotonex-profile.pdf}'),
  ('Cotonex Vorstellung (DE)', 'introduction', 'email', 'de',
   'Cotonex - Partner fuer Heimtextilien',
   E'Sehr geehrte Damen und Herren,\n\nich melde mich von Cotonex, einem Hersteller von Heimtextilien fuer Importeure und Haendler in Europa.\n\nMit freundlichen Gruessen\nCotonex',
   '{cotonex-profil-de.pdf}'),
  ('Follow-up (no reply)', 'follow_up', 'email', 'en',
   'Re: Cotonex - home textile manufacturing partner',
   E'Dear {{contact_name}},\n\nI wanted to follow up briefly on my note from {{last_touch_date}}.\n\nIf sourcing is handled by a colleague, I would be grateful for a pointer in the right direction.\n\nKind regards,\nCotonex',
   '{}'),
  ('Spring / Summer collection', 'collection', 'email', 'en',
   'Cotonex Spring/Summer collection',
   E'Dear {{contact_name}},\n\nOur Spring/Summer range is now available: lightweight cotton bedding, waffle towels and printed kitchen textiles.\n\nKind regards,\nCotonex',
   '{ss-collection.pdf}'),
  ('Capability and certifications', 'proof', 'email', 'en',
   'Cotonex - capacity, certifications and audits',
   E'Dear {{contact_name}},\n\nA short summary of our production capability: monthly capacity, OEKO-TEX and GOTS certification, and recent audit reports.\n\nKind regards,\nCotonex',
   '{certifications.pdf}'),
  ('Heimtextil fair invitation', 'event', 'email', 'en',
   'Meet Cotonex at Heimtextil',
   E'Dear {{contact_name}},\n\nCotonex will be exhibiting at Heimtextil. We would be glad to arrange a meeting at our stand.\n\nKind regards,\nCotonex',
   '{}')
on conflict do nothing;

-- ----------------------------------------------------------- campaigns ----

insert into campaigns (name, kind, channel, status, country_codes, target_statuses)
select 'Germany - Introduction', 'introduction', 'email', 'draft', '{DE}', '{never_contacted}'::contact_status[]
where not exists (select 1 from campaigns where name = 'Germany - Introduction');

insert into campaigns (name, kind, channel, status, country_codes, target_statuses)
select 'Benelux - Spring collection', 'collection', 'email', 'pending_approval', '{NL,BE}',
       '{no_reply,waiting_for_buyer,follow_up_required}'::contact_status[]
where not exists (select 1 from campaigns where name = 'Benelux - Spring collection');

-- Steps reference templates by name so the ids do not have to be known here.
insert into sequence_steps (campaign_id, step_order, channel, kind, template_id, delay_days)
select c.id, 1, 'email', 'introduction', t.id, 0
from campaigns c, templates t
where c.name = 'Germany - Introduction' and t.name = 'Cotonex Vorstellung (DE)'
  and not exists (select 1 from sequence_steps s where s.campaign_id = c.id and s.step_order = 1);

insert into sequence_steps (campaign_id, step_order, channel, kind, template_id, delay_days)
select c.id, 2, 'email', 'follow_up', t.id, 7
from campaigns c, templates t
where c.name = 'Germany - Introduction' and t.name = 'Follow-up (no reply)'
  and not exists (select 1 from sequence_steps s where s.campaign_id = c.id and s.step_order = 2);

insert into sequence_steps (campaign_id, step_order, channel, kind, template_id, delay_days)
select c.id, 1, 'email', 'collection', t.id, 0
from campaigns c, templates t
where c.name = 'Benelux - Spring collection' and t.name = 'Spring / Summer collection'
  and not exists (select 1 from sequence_steps s where s.campaign_id = c.id and s.step_order = 1);

-- --------------------------------------------------- duplicate candidate ----

insert into merge_candidates (reason, score, contact_a, contact_b)
select 'Same company, near-identical name and designation. Likely the same person imported twice.',
       0.92,
       least(a.id, b.id), greatest(a.id, b.id)
from contacts a, contacts b
where a.email = 'p.lindqvist@bettwaren-nord.de'
  and b.email = 'petra.lindquist@bettwaren-nord.de'
on conflict (contact_a, contact_b) do nothing;
